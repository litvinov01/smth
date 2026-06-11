import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    Optional,
    ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import { EVENT_TOPICS } from '../domain/event-topics';
import {
    deploymentRequestedEventSchema,
    swapCreatedEventSchema,
} from '../../messaging/domain/events/swap-events.schema';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../messaging/domain/ports/event-publisher.port';
import { CreateTransactionCommand, EvmAddress, EvmTxHash, Transaction } from '../domain/transaction.entity';
import { TRANSACTOR_PORT, TransactorPort } from '../domain/ports/transactor.port';
import { TRANSACTION_REPOSITORY, TransactionRepositoryPort } from '../domain/ports/transaction.repository.port';
import { TRANSACTION_STATUS, TransactionStatus, canTransition } from '../domain/transaction-status';
import { DEPLOYMENT_CLAIM_TX_HASH, isDeploymentClaimTxHash } from '../domain/deployment-claim';
import { uuidSchema } from '../../shared/validation/fields.schema';
import { toOnChainAmount } from './on-chain-amount';

@Injectable()
export class TransactionService {
    private readonly logger = new Logger(TransactionService.name);

    constructor(
        @Inject(TRANSACTION_REPOSITORY)
        private readonly transactionRepository: TransactionRepositoryPort,
        @Inject(TRANSACTOR_PORT)
        private readonly transactorPort: TransactorPort,
        private readonly appConfig: AppConfigService,
        @Optional()
        @Inject(EVENT_PUBLISHER)
        private readonly eventPublisher?: EventPublisherPort,
    ) {}

    async create(command: CreateTransactionCommand): Promise<Transaction> {
        const transaction = await this.transactionRepository.create({
            ...command,
            currency: command.currency.toUpperCase(),
        });

        if (!this.isMessagingEnabled) {
            this.logger.debug(`Messaging is disabled, skipping swap creation event for transaction ${transaction.id}`);
            return transaction;
        }

        // TODO: transactional outbox — persist event before publish so a failed publish can be retried.
        await this.eventPublisher!.publish(
            EVENT_TOPICS.SWAP_CREATED,
            transaction.id,
            swapCreatedEventSchema.parse({
                transactionId: transaction.id,
                currency: transaction.currency,
                amount: transaction.amount,
                userId: transaction.user.id,
                consumerAddress: transaction.consumerAddress,
                occurredAt: transaction.createdAt.toISOString(),
            }),
        );

        return transaction;
    }

    async getById(id: string): Promise<Transaction> {
        const normalizedId = this.normalizeTransactionId(id);
        const transaction = await this.transactionRepository.findById(normalizedId);
        if (!transaction) {
            throw new NotFoundException(`Transaction ${id} not found`);
        }
        return transaction;
    }

    async submit(id: string): Promise<Transaction> {
        const transaction = await this.getById(id);
        this.assertSubmittable(transaction, id);

        if (this.isMessagingEnabled) {
            // TODO: transactional outbox — persist event before publish so a failed publish can be retried.
            await this.eventPublisher!.publish(
                EVENT_TOPICS.DEPLOYMENT_REQUESTED,
                transaction.id,
                deploymentRequestedEventSchema.parse({
                    transactionId: transaction.id,
                    consumerAddress: transaction.consumerAddress!,
                    amount: transaction.amount,
                    occurredAt: new Date().toISOString(),
                }),
            );

            return transaction;
        }

        const txHash = await this.deployOnChain(transaction);
        return this.transition(
            transaction.id,
            TRANSACTION_STATUS.PENDING,
            {
                txHash,
            },
            transaction,
        );
    }

    async broadcastDeployment(transactionId: string): Promise<EvmTxHash> {
        const transaction = await this.getById(transactionId);

        if (
            transaction.status === TRANSACTION_STATUS.PENDING &&
            transaction.txHash &&
            !isDeploymentClaimTxHash(transaction.txHash)
        ) {
            return transaction.txHash;
        }

        if (transaction.status !== TRANSACTION_STATUS.CREATED) {
            throw new BadRequestException(
                `Transaction ${transactionId} cannot broadcast deployment from status ${transaction.status}`,
            );
        }

        if (isDeploymentClaimTxHash(transaction.txHash)) {
            if (!(await this.releaseStaleDeploymentClaim(transactionId, transaction))) {
                throw new ConflictException(`Deployment already in progress for transaction ${transactionId}`);
            }
        }

        let claimed = await this.transactionRepository.claimDeploymentBroadcast(
            transactionId,
            DEPLOYMENT_CLAIM_TX_HASH,
        );

        if (!claimed) {
            const current = await this.getById(transactionId);
            if (
                current.status === TRANSACTION_STATUS.PENDING &&
                current.txHash &&
                !isDeploymentClaimTxHash(current.txHash)
            ) {
                return current.txHash;
            }

            if (current.status === TRANSACTION_STATUS.CREATED && isDeploymentClaimTxHash(current.txHash)) {
                if (await this.releaseStaleDeploymentClaim(transactionId, current)) {
                    claimed = await this.transactionRepository.claimDeploymentBroadcast(
                        transactionId,
                        DEPLOYMENT_CLAIM_TX_HASH,
                    );
                }
            }

            if (!claimed) {
                if (isDeploymentClaimTxHash(current.txHash)) {
                    throw new ConflictException(`Deployment already in progress for transaction ${transactionId}`);
                }

                throw new BadRequestException(
                    `Transaction ${transactionId} cannot broadcast deployment from status ${current.status}`,
                );
            }
        }

        try {
            const txHash = await this.deployOnChain(transaction);
            const finalized = await this.transactionRepository.finalizeDeploymentBroadcast(
                transactionId,
                DEPLOYMENT_CLAIM_TX_HASH,
                txHash,
            );

            if (!finalized?.txHash) {
                const current = await this.getById(transactionId);
                if (current.txHash && !isDeploymentClaimTxHash(current.txHash)) {
                    return current.txHash;
                }

                throw new BadRequestException(`Failed to finalize deployment for transaction ${transactionId}`);
            }

            return finalized.txHash;
        } catch (error) {
            await this.transactionRepository.releaseDeploymentBroadcastClaim(transactionId, DEPLOYMENT_CLAIM_TX_HASH);
            throw error;
        }
    }

    async applyTxMined(transactionId: string, contractAddress: EvmAddress): Promise<Transaction> {
        const transaction = await this.getById(transactionId);
        if (transaction.status !== TRANSACTION_STATUS.PENDING) {
            return transaction;
        }

        return this.transition(transactionId, TRANSACTION_STATUS.FUNDED, { contractAddress }, transaction);
    }

    async applyTxFailed(transactionId: string): Promise<Transaction> {
        const transaction = await this.getById(transactionId);
        if (transaction.status === TRANSACTION_STATUS.SUCCESS || transaction.status === TRANSACTION_STATUS.FAILED) {
            return transaction;
        }

        return this.transition(transactionId, TRANSACTION_STATUS.FAILED, {}, transaction);
    }

    async applyTxConfirmedSuccess(transactionId: string): Promise<Transaction> {
        const transaction = await this.getById(transactionId);
        if (transaction.status !== TRANSACTION_STATUS.FUNDED) {
            return transaction;
        }

        return this.transition(transactionId, TRANSACTION_STATUS.SUCCESS, {}, transaction);
    }

    async listByStatus(statuses: TransactionStatus[]): Promise<Transaction[]> {
        return this.transactionRepository.findByStatus(statuses);
    }

    private assertSubmittable(transaction: Transaction, id: string): void {
        if (transaction.status !== TRANSACTION_STATUS.CREATED) {
            throw new BadRequestException(`Transaction ${id} cannot be submitted from status ${transaction.status}`);
        }

        if (isDeploymentClaimTxHash(transaction.txHash)) {
            throw new BadRequestException(`Transaction ${id} deployment is already in progress`);
        }

        if (!transaction.consumerAddress) {
            throw new BadRequestException(`Transaction ${id} has no consumer address for on-chain deploy`);
        }
    }

    private async deployOnChain(transaction: Transaction): Promise<EvmTxHash> {
        try {
            const deployResult = await this.transactorPort.deploy(
                transaction.consumerAddress!,
                toOnChainAmount(transaction.amount),
            );
            return deployResult.txHash;
        } catch (error) {
            if (error instanceof ServiceUnavailableException) {
                throw error;
            }
            throw new ServiceUnavailableException('Failed to submit on-chain deploy transaction');
        }
    }

    private get isMessagingEnabled(): boolean {
        return this.appConfig.messaging.enabled && Boolean(this.eventPublisher);
    }

    private async transition(
        id: string,
        to: TransactionStatus,
        fields: {
            contractAddress?: EvmAddress;
            txHash?: Transaction['txHash'];
        } = {},
        current?: Transaction,
    ): Promise<Transaction> {
        const transaction = current ?? (await this.getById(id));

        if (!canTransition(transaction.status, to)) {
            throw new BadRequestException(
                `Invalid status transition ${transaction.status} -> ${to} for transaction ${id}`,
            );
        }

        return this.transactionRepository.update(id, {
            status: to,
            contractAddress: fields.contractAddress ?? transaction.contractAddress,
            txHash: fields.txHash ?? transaction.txHash,
        });
    }

    private normalizeTransactionId(id: string): string {
        const parsed = uuidSchema.safeParse(id);
        if (!parsed.success) {
            throw new NotFoundException(`Transaction ${id} not found`);
        }
        return parsed.data;
    }

    private async releaseStaleDeploymentClaim(transactionId: string, transaction: Transaction): Promise<boolean> {
        if (!isDeploymentClaimTxHash(transaction.txHash)) {
            return false;
        }

        const claimedAt = transaction.deploymentClaimedAt;
        if (!claimedAt) {
            this.logger.warn(`Releasing deployment claim for ${transactionId} (no claim timestamp)`);
            await this.transactionRepository.releaseDeploymentBroadcastClaim(transactionId, DEPLOYMENT_CLAIM_TX_HASH);
            return true;
        }

        const ageMs = Date.now() - claimedAt.getTime();
        if (ageMs < this.appConfig.messaging.deploymentClaimTtlMs) {
            return false;
        }

        this.logger.warn(
            `Releasing stale deployment claim for ${transactionId} (age ${Math.round(ageMs / 1000)}s)`,
        );
        await this.transactionRepository.releaseDeploymentBroadcastClaim(transactionId, DEPLOYMENT_CLAIM_TX_HASH);
        return true;
    }
}

import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { ON_CHAIN_AMOUNT_DECIMALS } from '../../shared/validation/fields.schema';
import { CreateTransactionCommand, EvmAddress, Transaction } from '../domain/transaction.entity';
import { TRANSACTOR_PORT, TransactorPort } from '../domain/ports/transactor.port';
import { TRANSACTION_REPOSITORY, TransactionRepositoryPort } from '../domain/ports/transaction.repository.port';
import { TRANSACTION_STATUS, TransactionStatus, canTransition } from '../domain/transaction-status';

@Injectable()
export class TransactionService {
    constructor(
        @Inject(TRANSACTION_REPOSITORY)
        private readonly transactionRepository: TransactionRepositoryPort,
        @Inject(TRANSACTOR_PORT)
        private readonly transactorPort: TransactorPort,
    ) {}

    async create(command: CreateTransactionCommand): Promise<Transaction> {
        const id = this.generateMd5Id();
        return this.transactionRepository.create(
            {
                ...command,
                currency: command.currency.toUpperCase(),
            },
            id,
        );
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

        if (transaction.status !== TRANSACTION_STATUS.CREATED) {
            throw new BadRequestException(`Transaction ${id} cannot be submitted from status ${transaction.status}`);
        }

        if (!transaction.consumerAddress) {
            throw new BadRequestException(`Transaction ${id} has no consumer address for on-chain deploy`);
        }

        let deployResult;
        try {
            deployResult = await this.transactorPort.deploy(
                transaction.consumerAddress,
                toOnChainAmount(transaction.amount),
            );
        } catch (error) {
            if (error instanceof ServiceUnavailableException) {
                throw error;
            }
            throw new ServiceUnavailableException('Failed to submit on-chain deploy transaction');
        }

        return this.transition(
            transaction.id,
            TRANSACTION_STATUS.PENDING,
            {
                txHash: deployResult.txHash,
            },
            transaction,
        );
    }

    async markFunded(id: string, contractAddress: EvmAddress): Promise<Transaction> {
        return this.transition(id, TRANSACTION_STATUS.FUNDED, {
            contractAddress,
        });
    }

    async markSuccess(id: string): Promise<Transaction> {
        return this.transition(id, TRANSACTION_STATUS.SUCCESS);
    }

    async markFailed(id: string): Promise<Transaction> {
        return this.transition(id, TRANSACTION_STATUS.FAILED);
    }

    async listByStatus(statuses: TransactionStatus[]): Promise<Transaction[]> {
        return this.transactionRepository.findByStatus(statuses);
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
        const normalizedId = id.trim().toLowerCase();
        if (!/^[a-f0-9]{32}$/.test(normalizedId)) {
            throw new NotFoundException(`Transaction ${id} not found`);
        }
        return normalizedId;
    }

    private generateMd5Id(): string {
        return createHash('md5').update(randomUUID()).digest('hex');
    }
}

function toOnChainAmount(amount: string): bigint {
    const [whole, fraction = ''] = amount.split('.');
    if (fraction.length > ON_CHAIN_AMOUNT_DECIMALS) {
        throw new BadRequestException(
            `amount must have at most ${ON_CHAIN_AMOUNT_DECIMALS} decimal places for on-chain conversion`,
        );
    }

    const paddedFraction = `${fraction}${'0'.repeat(ON_CHAIN_AMOUNT_DECIMALS)}`.slice(0, ON_CHAIN_AMOUNT_DECIMALS);
    return BigInt(`${whole}${paddedFraction}`);
}

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TRANSACTION_STATUS } from '../../../domain/transaction-status';
import { Transaction } from '../../../domain/transaction.entity';
import { TRANSACTOR_PORT, TransactorPort } from '../../../domain/ports/transactor.port';
import { TransactionService } from '../../../application/transaction.service';
import { AppConfigService } from '../../../../config/config.service';

@Injectable()
export class ChainSyncListener implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ChainSyncListener.name);
    private pollTimer: NodeJS.Timeout | null = null;
    /** Last block scanned per transaction — avoids re-fetching full history each poll. */
    private readonly lastSyncedBlock = new Map<string, bigint>();

    constructor(
        private readonly appConfig: AppConfigService,
        @Inject(TRANSACTOR_PORT)
        private readonly transactorPort: TransactorPort,
        private readonly transactionService: TransactionService,
    ) {}

    onModuleInit(): void {
        if (!this.appConfig.evm.enabled) {
            this.logger.log('EVM not configured — chain sync disabled');
            return;
        }

        this.logger.log(`Starting chain sync (poll every ${this.appConfig.evm.pollIntervalMs}ms)`);
        void this.sync();
        this.pollTimer = setInterval(() => void this.sync(), this.appConfig.evm.pollIntervalMs);
    }

    onModuleDestroy(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }
    }

    private async sync(): Promise<void> {
        try {
            await this.syncPendingDeployments();
            await this.syncOnChainEvents();
        } catch (error) {
            this.logger.error('Chain sync failed', error);
        }
    }

    private async syncPendingDeployments(): Promise<void> {
        const pending = await this.transactionService.listByStatus([TRANSACTION_STATUS.PENDING]);

        for (const transaction of pending) {
            if (!transaction.txHash) {
                continue;
            }

            const receipt = await this.transactorPort.getDeploymentReceipt(transaction.txHash);

            if (!receipt) {
                continue;
            }

            if (receipt.status === 'reverted') {
                await this.transactionService.markFailed(transaction.id);
                continue;
            }

            if (receipt.contractAddress) {
                this.lastSyncedBlock.set(transaction.id, receipt.blockNumber);
                await this.transactionService.markFunded(transaction.id, receipt.contractAddress);
            }
        }
    }

    private async syncOnChainEvents(): Promise<void> {
        const funded = await this.transactionService.listByStatus([TRANSACTION_STATUS.FUNDED]);
        const currentBlock = await this.transactorPort.getBlockNumber();

        for (const transaction of funded) {
            if (!transaction.contractAddress) {
                continue;
            }

            const fromBlock = await this.resolveFromBlock(transaction);
            const events = await this.transactorPort.getSettlementEvents(
                transaction.contractAddress,
                fromBlock,
                currentBlock,
            );

            this.lastSyncedBlock.set(transaction.id, currentBlock);

            if (events.includes('fulfilled')) {
                await this.transactionService.markSuccess(transaction.id);
            } else if (events.includes('cancelled')) {
                await this.transactionService.markFailed(transaction.id);
            }
        }
    }

    private async resolveFromBlock(transaction: Transaction): Promise<bigint> {
        const cached = this.lastSyncedBlock.get(transaction.id);
        if (cached !== undefined) {
            return cached + 1n;
        }

        if (transaction.txHash) {
            const receipt = await this.transactorPort.getDeploymentReceipt(transaction.txHash);
            if (receipt) {
                return receipt.blockNumber;
            }
        }

        return 0n;
    }
}

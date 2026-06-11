import { CreateTransactionCommand, EvmTxHash, Transaction, UpdateTransactionPatch } from '../transaction.entity';
import { TransactionStatus } from '../transaction-status';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionRepositoryPort {
    create(command: CreateTransactionCommand): Promise<Transaction>;
    findById(id: string): Promise<Transaction | null>;
    findByContractAddress(address: string): Promise<Transaction | null>;
    findByStatus(statuses: TransactionStatus[]): Promise<Transaction[]>;
    update(id: string, patch: UpdateTransactionPatch): Promise<Transaction>;
    claimDeploymentBroadcast(id: string, claimTxHash: EvmTxHash): Promise<boolean>;
    finalizeDeploymentBroadcast(id: string, claimTxHash: EvmTxHash, txHash: EvmTxHash): Promise<Transaction | null>;
    releaseDeploymentBroadcastClaim(id: string, claimTxHash: EvmTxHash): Promise<void>;
}

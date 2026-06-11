import { TransactionStatus } from './transaction-status';

export type EvmAddress = `0x${string}`;
export type EvmTxHash = `0x${string}`;

export interface TransactionUser {
    id: string;
}

export interface Transaction {
    id: string;
    currency: string;
    status: TransactionStatus;
    amount: string;
    createdAt: Date;
    user: TransactionUser;
    consumerAddress: EvmAddress | null;
    contractAddress: EvmAddress | null;
    txHash: EvmTxHash | null;
    deploymentClaimedAt: Date | null;
}

export interface CreateTransactionCommand {
    currency: string;
    amount: string;
    userId: string;
    consumerAddress?: EvmAddress;
}

export interface UpdateTransactionPatch {
    status?: TransactionStatus;
    contractAddress?: EvmAddress | null;
    txHash?: EvmTxHash | null;
}

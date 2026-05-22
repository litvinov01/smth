import { EvmAddress, EvmTxHash } from '../transaction.entity';

export const TRANSACTOR_PORT = Symbol('TRANSACTOR_PORT');

export interface DeployTransactorResult {
    txHash: EvmTxHash;
}

export interface DeploymentReceipt {
    status: 'success' | 'reverted';
    contractAddress?: EvmAddress;
    blockNumber: bigint;
}

export type TransactorSettlementEvent = 'fulfilled' | 'cancelled';

export interface TransactorPort {
    deploy(consumer: EvmAddress, amount: bigint): Promise<DeployTransactorResult>;
    fulfill(contractAddress: EvmAddress): Promise<EvmTxHash>;
    cancel(contractAddress: EvmAddress): Promise<EvmTxHash>;
    getDeploymentReceipt(txHash: EvmTxHash): Promise<DeploymentReceipt | null>;
    getSettlementEvents(
        contractAddress: EvmAddress,
        fromBlock: bigint,
        toBlock?: bigint,
    ): Promise<TransactorSettlementEvent[]>;
    getBlockNumber(): Promise<bigint>;
}

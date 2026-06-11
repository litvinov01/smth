import { EvmTxHash } from './transaction.entity';

/** Sentinel tx hash set while a deployment broadcast is in-flight (atomic claim). */
export const DEPLOYMENT_CLAIM_TX_HASH =
    '0x0000000000000000000000000000000000000000000000000000000000000000' as EvmTxHash;

export function isDeploymentClaimTxHash(txHash: EvmTxHash | null | undefined): boolean {
    return txHash === DEPLOYMENT_CLAIM_TX_HASH;
}

import { z } from 'zod';
import { evmAddressBodySchema, evmTxHashSchema, uuidV7Schema } from '../../../shared/validation/fields.schema';

export const swapCreatedEventSchema = z.object({
    transactionId: uuidV7Schema,
    currency: z.string(),
    amount: z.string(),
    userId: uuidV7Schema,
    consumerAddress: evmAddressBodySchema.nullable(),
    occurredAt: z.string().datetime(),
});

export const deploymentRequestedEventSchema = z.object({
    transactionId: uuidV7Schema,
    consumerAddress: evmAddressBodySchema,
    amount: z.string(),
    occurredAt: z.string().datetime(),
});

export const receiptCheckEventSchema = z.object({
    transactionId: uuidV7Schema,
    txHash: evmTxHashSchema,
    checkAt: z.number().int(),
});

export const settlementCheckEventSchema = z.object({
    transactionId: uuidV7Schema,
    contractAddress: evmAddressBodySchema,
    fromBlock: z.string(),
    checkAt: z.number().int(),
    attempt: z.number().int().nonnegative().default(0),
});

export const txMinedEventSchema = z.object({
    transactionId: uuidV7Schema,
    txHash: evmTxHashSchema,
    contractAddress: evmAddressBodySchema,
    blockNumber: z.string(),
    occurredAt: z.string().datetime(),
});

export const txFailedEventSchema = z.object({
    transactionId: uuidV7Schema,
    txHash: evmTxHashSchema.optional(),
    reason: z.enum([
        'deployment_reverted',
        'settlement_cancelled',
        'deployment_error',
        'evm_unavailable',
        'settlement_timeout',
    ]),
    occurredAt: z.string().datetime(),
});

export const txConfirmedEventSchema = z.object({
    transactionId: uuidV7Schema,
    contractAddress: evmAddressBodySchema,
    outcome: z.enum(['fulfilled', 'cancelled']),
    occurredAt: z.string().datetime(),
});

export type SwapCreatedEvent = z.infer<typeof swapCreatedEventSchema>;
export type DeploymentRequestedEvent = z.infer<typeof deploymentRequestedEventSchema>;
export type ReceiptCheckEvent = z.infer<typeof receiptCheckEventSchema>;
export type SettlementCheckEvent = z.infer<typeof settlementCheckEventSchema>;
export type TxMinedEvent = z.infer<typeof txMinedEventSchema>;
export type TxFailedEvent = z.infer<typeof txFailedEventSchema>;
export type TxConfirmedEvent = z.infer<typeof txConfirmedEventSchema>;

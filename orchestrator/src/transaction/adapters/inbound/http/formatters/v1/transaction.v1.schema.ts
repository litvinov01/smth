import { z } from 'zod';
import { TRANSACTION_STATUS } from '../../../../../domain/transaction-status';
import {
    evmAddressBodySchema,
    evmTxHashSchema,
    isoCurrencySchema,
    positiveDecimalAmountSchema,
    uuidSchema,
} from '../../../../../../shared/validation/fields.schema';

export const createTransactionV1Schema = z.object({
    currency: isoCurrencySchema,
    amount: positiveDecimalAmountSchema,
    user: z.object({
        id: uuidSchema,
    }),
    consumer: z
        .object({
            address: evmAddressBodySchema,
        })
        .optional(),
});

export const transactionIdParamSchema = z.object({
    id: uuidSchema,
});

const transactionStatusSchema = z.enum([
    TRANSACTION_STATUS.CREATED,
    TRANSACTION_STATUS.PENDING,
    TRANSACTION_STATUS.FUNDED,
    TRANSACTION_STATUS.SUCCESS,
    TRANSACTION_STATUS.FAILED,
]);

export const transactionV1ResponseSchema = z.object({
    id: uuidSchema,
    currency: isoCurrencySchema,
    status: transactionStatusSchema,
    amount: z.string(),
    created_at: z.string().datetime(),
    user: z.object({
        id: uuidSchema,
    }),
    consumer_address: evmAddressBodySchema.nullable(),
    contract_address: evmAddressBodySchema.nullable(),
    tx_hash: evmTxHashSchema.nullable(),
});

export type CreateTransactionV1Input = z.infer<typeof createTransactionV1Schema>;
export type TransactionIdParamInput = z.infer<typeof transactionIdParamSchema>;
export type TransactionV1ResponseInput = z.infer<typeof transactionV1ResponseSchema>;

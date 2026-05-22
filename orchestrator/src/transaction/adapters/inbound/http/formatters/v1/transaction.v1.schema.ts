import { z } from 'zod';
import { TRANSACTION_STATUS } from '../../../../../domain/transaction-status';
import {
    evmAddressBodySchema,
    isoCurrencySchema,
    md5HexSchema,
    positiveDecimalAmountSchema,
} from '../../../../../../shared/validation/fields.schema';

export const createTransactionV1Schema = z.object({
    currency: isoCurrencySchema,
    amount: positiveDecimalAmountSchema,
    user: z.object({
        id: md5HexSchema,
    }),
    consumer: z
        .object({
            address: evmAddressBodySchema,
        })
        .optional(),
});

export const transactionIdParamSchema = z.object({
    id: md5HexSchema,
});

const transactionStatusSchema = z.enum([
    TRANSACTION_STATUS.CREATED,
    TRANSACTION_STATUS.PENDING,
    TRANSACTION_STATUS.FUNDED,
    TRANSACTION_STATUS.SUCCESS,
    TRANSACTION_STATUS.FAILED,
]);

const evmTxHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a 0x-prefixed 32-byte hex hash');

export const transactionV1ResponseSchema = z.object({
    id: md5HexSchema,
    currency: isoCurrencySchema,
    status: transactionStatusSchema,
    amount: z.string(),
    created_at: z.string().datetime(),
    user: z.object({
        id: md5HexSchema,
    }),
    consumer_address: evmAddressBodySchema.nullable(),
    contract_address: evmAddressBodySchema.nullable(),
    tx_hash: evmTxHashSchema.nullable(),
});

export type CreateTransactionV1Input = z.infer<typeof createTransactionV1Schema>;
export type TransactionIdParamInput = z.infer<typeof transactionIdParamSchema>;
export type TransactionV1ResponseInput = z.infer<typeof transactionV1ResponseSchema>;

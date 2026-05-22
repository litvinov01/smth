import { z } from 'zod';

export const ON_CHAIN_AMOUNT_DECIMALS = 8;

export const md5HexSchema = z
    .string({ required_error: 'Must be a string' })
    .trim()
    .transform((value) => value.toLowerCase())
    .pipe(z.string().regex(/^[a-f0-9]{32}$/, 'Must be a 32-character md5 hex string'));

export const isoCurrencySchema = z
    .string({ required_error: 'currency must be a string' })
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO 4217 code (e.g. EUR)'));

function assertAmountPrecision(value: string, ctx: z.RefinementCtx): void {
    const fraction = value.split('.')[1];
    if (fraction && fraction.length > ON_CHAIN_AMOUNT_DECIMALS) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `amount must have at most ${ON_CHAIN_AMOUNT_DECIMALS} decimal places`,
        });
    }
}

export const positiveDecimalAmountSchema = z
    .union([
        z
            .number({ invalid_type_error: 'amount must be a number or string' })
            .finite()
            .positive('amount must be a positive number'),
        z.string({ invalid_type_error: 'amount must be a number or string' }).trim(),
    ])
    .superRefine((value, ctx) => {
        const asString = typeof value === 'number' ? value.toString() : value;

        if (!/^\d+(\.\d+)?$/.test(asString) || Number(asString) <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'amount must be a positive decimal',
            });
            return;
        }

        assertAmountPrecision(asString, ctx);
    })
    .transform((value) => (typeof value === 'number' ? value.toString() : value));

export const evmAddressBodySchema = z
    .string({ required_error: 'consumer.address must be a string' })
    .trim()
    .transform((value) => value.toLowerCase())
    .pipe(z.string().regex(/^0x[a-f0-9]{40}$/, 'Must be a 0x-prefixed 20-byte hex address'));

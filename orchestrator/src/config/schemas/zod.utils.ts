import { z } from 'zod';

export const emptyToUndefined = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
};

export const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Expected a 0x-prefixed 20-byte hex address');

export const privateKeySchema = z
    .string()
    .transform((value) => (value.startsWith('0x') ? value : `0x${value}`))
    .pipe(z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Expected a 32-byte hex private key'));

export const hexBytecodeSchema = z
    .string()
    .transform((value) => (value.startsWith('0x') ? value : `0x${value}`))
    .pipe(z.string().regex(/^0x[a-fA-F0-9]+$/, 'Expected 0x-prefixed contract bytecode hex'));

export const postgresUrlSchema = z
    .string()
    .min(1)
    .refine(
        (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
        'DATABASE_URL must be a PostgreSQL connection URL',
    );

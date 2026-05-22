import { z } from 'zod';
import { appConfigSchema } from './app.schema';
import { evmConfigSchema } from './evm.schema';
import { emptyToUndefined, hexBytecodeSchema, privateKeySchema } from './zod.utils';

const envSchema = appConfigSchema.extend({
    EVM_RPC_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    EVM_CHAIN_ID: z.coerce.number().int().positive().default(31337),
    ORCHESTRATOR_PRIVATE_KEY: z.preprocess(emptyToUndefined, privateKeySchema.optional()),
    TRANSACTOR_BYTECODE: z.preprocess(emptyToUndefined, hexBytecodeSchema.optional()),
    EVM_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
});

export const configSchema = envSchema.transform((env) => ({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    database: {
        url: env.DATABASE_URL,
    },
    evm: evmConfigSchema.parse(env),
}));

export type AppConfig = z.output<typeof configSchema>;

export { appConfigSchema, evmConfigSchema };
export type { AppConfigSlice } from './app.schema';
export type { EvmConfig } from './evm.schema';

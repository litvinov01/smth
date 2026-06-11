import { z } from 'zod';
import { appConfigSchema } from './app.schema';
import { evmConfigSchema } from './evm.schema';
import { messagingConfigSchema } from './messaging.schema';
import { emptyToUndefined, hexBytecodeSchema, privateKeySchema } from './zod.utils';

const envSchema = appConfigSchema.extend({
    EVM_RPC_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    EVM_CHAIN_ID: z.coerce.number().int().positive().default(31337),
    ORCHESTRATOR_PRIVATE_KEY: z.preprocess(emptyToUndefined, privateKeySchema.optional()),
    TRANSACTOR_BYTECODE: z.preprocess(emptyToUndefined, hexBytecodeSchema.optional()),
    EVM_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
    PROCESS_ROLE: z.enum(['api', 'worker', 'all']).default('all'),
    KAFKA_BROKERS: z.preprocess(emptyToUndefined, z.string().optional()),
    KAFKA_CLIENT_ID: z.string().default('swap-orchestrator'),
    RECEIPT_CHECK_DELAY_MS: z.coerce.number().int().positive().default(3_000),
    SETTLEMENT_CHECK_DELAY_MS: z.coerce.number().int().positive().default(5_000),
    SETTLEMENT_CHECK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(120),
    KAFKA_CONSUMER_MAX_RETRIES: z.coerce.number().int().positive().default(3),
});

export const configSchema = envSchema.transform((env) => ({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    database: {
        url: env.DATABASE_URL,
    },
    evm: evmConfigSchema.parse(env),
    messaging: messagingConfigSchema.parse(env),
}));

export type AppConfig = z.output<typeof configSchema>;

export { appConfigSchema, evmConfigSchema, messagingConfigSchema };
export type { AppConfigSlice } from './app.schema';
export type { EvmConfig } from './evm.schema';
export type { MessagingConfig } from './messaging.schema';

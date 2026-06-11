import { z } from 'zod';
import { emptyToUndefined } from './zod.utils';

const processRoleSchema = z.enum(['api', 'worker', 'all']).default('all');

const messagingEnvSchema = z.object({
    PROCESS_ROLE: processRoleSchema,
    KAFKA_BROKERS: z.preprocess(emptyToUndefined, z.string().optional()),
    KAFKA_CLIENT_ID: z.string().default('swap-orchestrator'),
    RECEIPT_CHECK_DELAY_MS: z.coerce.number().int().positive().default(3_000),
    SETTLEMENT_CHECK_DELAY_MS: z.coerce.number().int().positive().default(5_000),
    SETTLEMENT_CHECK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(120),
    KAFKA_CONSUMER_MAX_RETRIES: z.coerce.number().int().positive().default(3),
    DEPLOYMENT_CLAIM_TTL_MS: z.coerce.number().int().positive().default(300_000),
});

export const messagingConfigSchema = messagingEnvSchema.transform((env) => {
    const enabled = Boolean(env.KAFKA_BROKERS);

    return {
        enabled,
        processRole: env.PROCESS_ROLE,
        kafka: {
            brokers: env.KAFKA_BROKERS?.split(',').map((broker) => broker.trim()) ?? [],
            clientId: env.KAFKA_CLIENT_ID,
        },
        receiptCheckDelayMs: env.RECEIPT_CHECK_DELAY_MS,
        settlementCheckDelayMs: env.SETTLEMENT_CHECK_DELAY_MS,
        settlementCheckMaxAttempts: env.SETTLEMENT_CHECK_MAX_ATTEMPTS,
        kafkaConsumerMaxRetries: env.KAFKA_CONSUMER_MAX_RETRIES,
        deploymentClaimTtlMs: env.DEPLOYMENT_CLAIM_TTL_MS,
    };
});

export type MessagingConfig = z.output<typeof messagingConfigSchema>;

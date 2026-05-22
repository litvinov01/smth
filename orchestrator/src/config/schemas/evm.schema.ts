import { z } from 'zod';
import { emptyToUndefined, hexBytecodeSchema, privateKeySchema } from './zod.utils';

const evmEnvSchema = z.object({
    EVM_RPC_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    EVM_CHAIN_ID: z.coerce.number().int().positive().default(31337),
    ORCHESTRATOR_PRIVATE_KEY: z.preprocess(emptyToUndefined, privateKeySchema.optional()),
    TRANSACTOR_BYTECODE: z.preprocess(emptyToUndefined, hexBytecodeSchema.optional()),
    EVM_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
});

export const evmConfigSchema = evmEnvSchema.transform((env) => {
    const enabled = Boolean(env.EVM_RPC_URL && env.ORCHESTRATOR_PRIVATE_KEY && env.TRANSACTOR_BYTECODE);

    return {
        enabled,
        rpcUrl: env.EVM_RPC_URL,
        chainId: env.EVM_CHAIN_ID,
        privateKey: env.ORCHESTRATOR_PRIVATE_KEY as `0x${string}` | undefined,
        bytecode: env.TRANSACTOR_BYTECODE as `0x${string}` | undefined,
        pollIntervalMs: env.EVM_POLL_INTERVAL_MS,
    };
});

export type EvmConfig = z.output<typeof evmConfigSchema>;

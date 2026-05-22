import { config as loadDotenv } from 'dotenv';
import { ZodError } from 'zod';
import { AppConfig, configSchema } from './schemas';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    if (env === process.env) {
        loadDotenv();
    }

    try {
        return configSchema.parse(env);
    } catch (error) {
        if (error instanceof ZodError) {
            const details = error.issues
                .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
                .join('\n');

            throw new Error(`Invalid environment configuration:\n${details}`);
        }

        throw error;
    }
}

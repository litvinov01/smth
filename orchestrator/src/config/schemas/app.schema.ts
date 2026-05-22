import { z } from 'zod';
import { postgresUrlSchema } from './zod.utils';

export const appConfigSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: postgresUrlSchema,
});

export type AppConfigSlice = z.infer<typeof appConfigSchema>;

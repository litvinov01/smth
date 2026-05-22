import { loadConfig } from '../load-config';

describe('configSchema', () => {
    const baseEnv: NodeJS.ProcessEnv = {
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/swap_db?schema=public',
    };

    it('parses required app config with defaults', () => {
        const config = loadConfig({ ...baseEnv });

        expect(config.nodeEnv).toBe('development');
        expect(config.port).toBe(3000);
        expect(config.database.url).toBe(baseEnv.DATABASE_URL);
        expect(config.evm.enabled).toBe(false);
        expect(config.evm.chainId).toBe(31337);
        expect(config.evm.pollIntervalMs).toBe(10_000);
    });

    it('normalizes optional EVM settings and marks enabled when complete', () => {
        const config = loadConfig({
            ...baseEnv,
            EVM_RPC_URL: 'http://localhost:8545',
            ORCHESTRATOR_PRIVATE_KEY: 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            TRANSACTOR_BYTECODE: '0x608060405234',
            EVM_CHAIN_ID: '31337',
            EVM_POLL_INTERVAL_MS: '5000',
        });

        expect(config.evm.enabled).toBe(true);
        expect(config.evm.rpcUrl).toBe('http://localhost:8545');
        expect(config.evm.privateKey).toBe('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
        expect(config.evm.bytecode).toBe('0x608060405234');
        expect(config.evm.chainId).toBe(31337);
        expect(config.evm.pollIntervalMs).toBe(5000);
    });

    it('treats empty EVM strings as unset', () => {
        const config = loadConfig({
            ...baseEnv,
            EVM_RPC_URL: '',
            ORCHESTRATOR_PRIVATE_KEY: '   ',
            TRANSACTOR_BYTECODE: '',
        });

        expect(config.evm.enabled).toBe(false);
        expect(config.evm.rpcUrl).toBeUndefined();
        expect(config.evm.privateKey).toBeUndefined();
        expect(config.evm.bytecode).toBeUndefined();
    });

    it('rejects invalid DATABASE_URL', () => {
        expect(() =>
            loadConfig({
                DATABASE_URL: 'mysql://localhost/db',
            }),
        ).toThrow(/Invalid environment configuration/);
    });

    it('rejects invalid private key format', () => {
        expect(() =>
            loadConfig({
                ...baseEnv,
                EVM_RPC_URL: 'http://localhost:8545',
                ORCHESTRATOR_PRIVATE_KEY: '0x1234',
                TRANSACTOR_BYTECODE: '0x608060405234',
            }),
        ).toThrow(/Invalid environment configuration/);
    });
});

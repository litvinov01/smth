import {
  GenericContainer,
  Network,
  StartedNetwork,
  StartedTestContainer,
  Wait,
} from 'testcontainers';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import * as path from 'path';

const POSTGRES_HOST = 'db';
const POSTGRES_PORT = 5432;
const TEST_USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('Orchestrator (e2e with Testcontainers)', () => {
  let network: StartedNetwork;
  let postgres: StartedPostgreSqlContainer;
  let app: StartedTestContainer;
  let baseUrl: string;

  beforeEach(async () => {
    network = await new Network().start();

    postgres = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('swap_db')
      .withUsername('postgres')
      .withPassword('postgres')
      .withNetwork(network)
      .withNetworkAliases(POSTGRES_HOST)
      .start();

    const imageTag = process.env.E2E_APP_IMAGE ?? 'swap-orchestrator:test-app';

    const appContainer =
      process.env.E2E_BUILD_IMAGE === 'true'
        ? await GenericContainer.fromDockerfile(path.resolve(__dirname, '..'))
            .withTarget('test-app')
            .build()
        : new GenericContainer(imageTag);

    app = await appContainer
      .withNetwork(network)
      .withEnvironment({
        DATABASE_URL: `postgresql://postgres:postgres@${POSTGRES_HOST}:${POSTGRES_PORT}/swap_db?schema=public`,
      })
      .withExposedPorts(3000)
      .withWaitStrategy(Wait.forHttp('/api', 3000))
      .start();

    baseUrl = `http://${app.getHost()}:${app.getMappedPort(3000)}`;
  });

  afterEach(async () => {
    if (app) await app.stop();
    if (postgres) await postgres.stop();
    if (network) await network.stop();
  });

  it('GET /api returns hello when app and postgres run in containers', async () => {
    const response = await fetch(`${baseUrl}/api`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Swap Orchestrator');
  });

  it('POST /api/v1/transactions creates a transaction and GET retrieves it', async () => {
    const createResponse = await fetch(`${baseUrl}/api/v1/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'eur',
        amount: '100.50',
        user: { id: TEST_USER_ID },
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created).toMatchObject({
      currency: 'EUR',
      status: 'CREATED',
      amount: '100.5',
      user: { id: TEST_USER_ID },
    });
    expect(created.id).toMatch(/^[a-f0-9]{32}$/);
    expect(created.created_at).toBeDefined();

    const getResponse = await fetch(
      `${baseUrl}/api/v1/transactions/${created.id}`,
    );

    expect(getResponse.status).toBe(200);
    const fetched = await getResponse.json();
    expect(fetched).toEqual(created);
  });

  it('GET /api/v1/transactions/:id returns 404 for unknown id', async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/transactions/${'b'.repeat(32)}`,
    );

    expect(response.status).toBe(404);
  });
});

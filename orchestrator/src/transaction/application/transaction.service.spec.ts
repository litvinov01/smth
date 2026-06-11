import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../../config/config.service';
import { DEPLOYMENT_CLAIM_TX_HASH } from '../domain/deployment-claim';
import { TRANSACTION_STATUS } from '../domain/transaction-status';
import { Transaction } from '../domain/transaction.entity';
import { TRANSACTOR_PORT, TransactorPort } from '../domain/ports/transactor.port';
import { TRANSACTION_REPOSITORY, TransactionRepositoryPort } from '../domain/ports/transaction.repository.port';
import { UUID_V7_REGEX } from '../../shared/validation/fields.schema';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
    let service: TransactionService;
    let repository: jest.Mocked<TransactionRepositoryPort>;
    let transactorPort: jest.Mocked<TransactorPort>;
    let appConfig: { messaging: { enabled: boolean; deploymentClaimTtlMs: number } };

    const consumerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8' as const;
    const sampleTransactionId = '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4c';
    const sampleTransaction: Transaction = {
        id: sampleTransactionId,
        currency: 'EUR',
        status: TRANSACTION_STATUS.CREATED,
        amount: '100.50',
        createdAt: new Date('2025-05-22T12:00:00.000Z'),
        user: { id: '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4e' },
        consumerAddress,
        contractAddress: null,
        txHash: null,
        deploymentClaimedAt: null,
    };

    beforeEach(async () => {
        repository = {
            create: jest.fn(),
            findById: jest.fn(),
            findByContractAddress: jest.fn(),
            findByStatus: jest.fn(),
            update: jest.fn(),
            claimDeploymentBroadcast: jest.fn(),
            finalizeDeploymentBroadcast: jest.fn(),
            releaseDeploymentBroadcastClaim: jest.fn(),
        };
        transactorPort = {
            deploy: jest.fn(),
            fulfill: jest.fn(),
            cancel: jest.fn(),
            getDeploymentReceipt: jest.fn(),
            getSettlementEvents: jest.fn(),
            getBlockNumber: jest.fn(),
        };
        appConfig = { messaging: { enabled: false, deploymentClaimTtlMs: 300_000 } };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TransactionService,
                {
                    provide: TRANSACTION_REPOSITORY,
                    useValue: repository,
                },
                {
                    provide: TRANSACTOR_PORT,
                    useValue: transactorPort,
                },
                {
                    provide: AppConfigService,
                    useValue: appConfig,
                },
            ],
        }).compile();

        service = module.get(TransactionService);
    });

    describe('create', () => {
        it('uppercases currency, persists via repository, and returns created transaction', async () => {
            repository.create.mockResolvedValue(sampleTransaction);

            const result = await service.create({
                currency: 'eur',
                amount: '100.50',
                userId: sampleTransaction.user.id,
                consumerAddress,
            });

            expect(repository.create).toHaveBeenCalledTimes(1);
            expect(repository.create).toHaveBeenCalledWith({
                currency: 'EUR',
                amount: '100.50',
                userId: sampleTransaction.user.id,
                consumerAddress,
            });
            expect(result).toBe(sampleTransaction);
            expect(result.id).toMatch(UUID_V7_REGEX);
        });
    });

    describe('getById', () => {
        it('returns transaction when found', async () => {
            repository.findById.mockResolvedValue(sampleTransaction);

            const result = await service.getById(sampleTransaction.id);

            expect(repository.findById).toHaveBeenCalledWith(sampleTransaction.id);
            expect(result).toBe(sampleTransaction);
        });

        it('normalizes id before lookup', async () => {
            repository.findById.mockResolvedValue(sampleTransaction);

            await service.getById(`  ${sampleTransaction.id.toUpperCase()}  `);

            expect(repository.findById).toHaveBeenCalledWith(sampleTransaction.id);
        });

        it('throws NotFoundException when id is not a uuid', async () => {
            await expect(service.getById('not-a-uuid')).rejects.toThrow(NotFoundException);
            expect(repository.findById).not.toHaveBeenCalled();
        });

        it('accepts legacy md5-derived uuid', async () => {
            const legacyId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            repository.findById.mockResolvedValue({ ...sampleTransaction, id: legacyId });

            const result = await service.getById(legacyId);

            expect(repository.findById).toHaveBeenCalledWith(legacyId);
            expect(result.id).toBe(legacyId);
        });

        it('throws NotFoundException when transaction does not exist', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(service.getById(sampleTransaction.id)).rejects.toThrow(
                new NotFoundException(`Transaction ${sampleTransaction.id} not found`),
            );
        });
    });

    describe('submit (sync fallback)', () => {
        it('deploys on-chain and moves transaction to PENDING', async () => {
            repository.findById.mockResolvedValue(sampleTransaction);
            transactorPort.deploy.mockResolvedValue({
                txHash: '0xabc123',
            });
            repository.update.mockResolvedValue({
                ...sampleTransaction,
                status: TRANSACTION_STATUS.PENDING,
                txHash: '0xabc123',
            });

            const result = await service.submit(sampleTransaction.id);

            expect(transactorPort.deploy).toHaveBeenCalledWith(consumerAddress, 10050000000n);
            expect(repository.findById).toHaveBeenCalledTimes(1);
            expect(repository.update).toHaveBeenCalledWith(sampleTransaction.id, {
                status: TRANSACTION_STATUS.PENDING,
                contractAddress: null,
                txHash: '0xabc123',
            });
            expect(result.status).toBe(TRANSACTION_STATUS.PENDING);
        });

        it('rejects submit when consumer address is missing', async () => {
            repository.findById.mockResolvedValue({
                ...sampleTransaction,
                consumerAddress: null,
            });

            await expect(service.submit(sampleTransaction.id)).rejects.toThrow(BadRequestException);
            expect(transactorPort.deploy).not.toHaveBeenCalled();
        });

        it('rejects submit when status is not CREATED', async () => {
            repository.findById.mockResolvedValue({
                ...sampleTransaction,
                status: TRANSACTION_STATUS.PENDING,
            });

            await expect(service.submit(sampleTransaction.id)).rejects.toThrow(BadRequestException);
        });

        it('propagates EVM unavailable errors', async () => {
            repository.findById.mockResolvedValue(sampleTransaction);
            transactorPort.deploy.mockRejectedValue(new ServiceUnavailableException('EVM is not configured'));

            await expect(service.submit(sampleTransaction.id)).rejects.toThrow(ServiceUnavailableException);
        });
    });

    describe('broadcastDeployment', () => {
        it('claims, deploys, and finalizes a CREATED transaction', async () => {
            repository.findById.mockResolvedValue(sampleTransaction);
            repository.claimDeploymentBroadcast.mockResolvedValue(true);
            transactorPort.deploy.mockResolvedValue({ txHash: '0xabc123' });
            repository.finalizeDeploymentBroadcast.mockResolvedValue({
                ...sampleTransaction,
                status: TRANSACTION_STATUS.PENDING,
                txHash: '0xabc123',
            });

            const result = await service.broadcastDeployment(sampleTransaction.id);

            expect(repository.claimDeploymentBroadcast).toHaveBeenCalledWith(
                sampleTransaction.id,
                DEPLOYMENT_CLAIM_TX_HASH,
            );
            expect(transactorPort.deploy).toHaveBeenCalled();
            expect(result).toBe('0xabc123');
        });

        it('returns existing tx hash when already PENDING', async () => {
            repository.findById.mockResolvedValue({
                ...sampleTransaction,
                status: TRANSACTION_STATUS.PENDING,
                txHash: '0xexisting',
            });

            const result = await service.broadcastDeployment(sampleTransaction.id);

            expect(result).toBe('0xexisting');
            expect(repository.claimDeploymentBroadcast).not.toHaveBeenCalled();
        });

        it('skips with BadRequestException when status is not deployable', async () => {
            repository.findById.mockResolvedValue({
                ...sampleTransaction,
                status: TRANSACTION_STATUS.FUNDED,
            });

            await expect(service.broadcastDeployment(sampleTransaction.id)).rejects.toThrow(BadRequestException);
        });

        it('releases claim and rethrows when deploy fails', async () => {
            repository.findById.mockResolvedValue(sampleTransaction);
            repository.claimDeploymentBroadcast.mockResolvedValue(true);
            transactorPort.deploy.mockRejectedValue(new ServiceUnavailableException('EVM down'));

            await expect(service.broadcastDeployment(sampleTransaction.id)).rejects.toThrow(
                ServiceUnavailableException,
            );
            expect(repository.releaseDeploymentBroadcastClaim).toHaveBeenCalledWith(
                sampleTransaction.id,
                DEPLOYMENT_CLAIM_TX_HASH,
            );
        });

        it('releases stale claim without timestamp and retries', async () => {
            repository.findById.mockResolvedValue({
                ...sampleTransaction,
                txHash: DEPLOYMENT_CLAIM_TX_HASH,
                deploymentClaimedAt: null,
            });
            repository.claimDeploymentBroadcast.mockResolvedValue(true);
            transactorPort.deploy.mockResolvedValue({ txHash: '0xabc123' });
            repository.finalizeDeploymentBroadcast.mockResolvedValue({
                ...sampleTransaction,
                status: TRANSACTION_STATUS.PENDING,
                txHash: '0xabc123',
            });

            const result = await service.broadcastDeployment(sampleTransaction.id);

            expect(repository.releaseDeploymentBroadcastClaim).toHaveBeenCalled();
            expect(result).toBe('0xabc123');
        });

        it('throws ConflictException for active in-progress claim', async () => {
            repository.findById.mockResolvedValue({
                ...sampleTransaction,
                txHash: DEPLOYMENT_CLAIM_TX_HASH,
                deploymentClaimedAt: new Date(),
            });

            await expect(service.broadcastDeployment(sampleTransaction.id)).rejects.toThrow(ConflictException);
        });
    });
});

import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TRANSACTION_STATUS } from '../domain/transaction-status';
import { Transaction } from '../domain/transaction.entity';
import { TRANSACTOR_PORT, TransactorPort } from '../domain/ports/transactor.port';
import { TRANSACTION_REPOSITORY, TransactionRepositoryPort } from '../domain/ports/transaction.repository.port';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
    let service: TransactionService;
    let repository: jest.Mocked<TransactionRepositoryPort>;
    let transactorPort: jest.Mocked<TransactorPort>;

    const consumerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8' as const;
    const sampleTransaction: Transaction = {
        id: 'a1b2c3d4e5f6789012345678901234ab',
        currency: 'EUR',
        status: TRANSACTION_STATUS.CREATED,
        amount: '100.50',
        createdAt: new Date('2025-05-22T12:00:00.000Z'),
        user: { id: 'fedcba9876543210fedcba9876543210' },
        consumerAddress,
        contractAddress: null,
        txHash: null,
    };

    beforeEach(async () => {
        repository = {
            create: jest.fn(),
            findById: jest.fn(),
            findByContractAddress: jest.fn(),
            findByStatus: jest.fn(),
            update: jest.fn(),
        };
        transactorPort = {
            deploy: jest.fn(),
            fulfill: jest.fn(),
            cancel: jest.fn(),
            getDeploymentReceipt: jest.fn(),
            getSettlementEvents: jest.fn(),
            getBlockNumber: jest.fn(),
        };
        repository.findByStatus = jest.fn();

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
            ],
        }).compile();

        service = module.get(TransactionService);
    });

    describe('create', () => {
        it('generates md5 id, uppercases currency, and delegates to repository', async () => {
            repository.create.mockResolvedValue(sampleTransaction);

            const result = await service.create({
                currency: 'eur',
                amount: '100.50',
                userId: sampleTransaction.user.id,
                consumerAddress,
            });

            expect(repository.create).toHaveBeenCalledTimes(1);
            const [command, id] = repository.create.mock.calls[0];
            expect(command).toEqual({
                currency: 'EUR',
                amount: '100.50',
                userId: sampleTransaction.user.id,
                consumerAddress,
            });
            expect(id).toMatch(/^[a-f0-9]{32}$/);
            expect(result).toBe(sampleTransaction);
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

        it('throws NotFoundException when id is not md5 hex', async () => {
            await expect(service.getById('not-an-md5-id')).rejects.toThrow(NotFoundException);
            expect(repository.findById).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when transaction does not exist', async () => {
            repository.findById.mockResolvedValue(null);

            await expect(service.getById(sampleTransaction.id)).rejects.toThrow(
                new NotFoundException(`Transaction ${sampleTransaction.id} not found`),
            );
        });
    });

    describe('submit', () => {
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
});

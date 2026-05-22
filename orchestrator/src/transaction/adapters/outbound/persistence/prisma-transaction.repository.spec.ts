import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TRANSACTION_STATUS } from '../../../domain/transaction-status';
import { EvmAddress } from '../../../domain/transaction.entity';
import { PrismaTransactionRepository } from './prisma-transaction.repository';

describe('PrismaTransactionRepository', () => {
    let repository: PrismaTransactionRepository;
    let prisma: {
        user: { upsert: jest.Mock };
        transaction: {
            create: jest.Mock;
            findUnique: jest.Mock;
            findFirst: jest.Mock;
            findMany: jest.Mock;
            update: jest.Mock;
        };
    };

    const userId = 'fedcba9876543210fedcba9876543210';
    const transactionId = 'a1b2c3d4e5f6789012345678901234ab';
    const createdAt = new Date('2025-05-22T12:00:00.000Z');
    const consumerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8' as EvmAddress;

    const prismaRecord = {
        id: transactionId,
        currency: 'EUR',
        status: TRANSACTION_STATUS.CREATED,
        amount: new Prisma.Decimal('100.50'),
        createdAt,
        userId,
        consumerAddress,
        contractAddress: null,
        txHash: null,
        user: { id: userId },
    };

    const domainRecord = {
        id: transactionId,
        currency: 'EUR',
        status: TRANSACTION_STATUS.CREATED,
        amount: '100.5',
        createdAt,
        user: { id: userId },
        consumerAddress,
        contractAddress: null,
        txHash: null,
    };

    beforeEach(async () => {
        prisma = {
            user: { upsert: jest.fn().mockResolvedValue({ id: userId }) },
            transaction: {
                create: jest.fn().mockResolvedValue(prismaRecord),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [PrismaTransactionRepository, { provide: PrismaService, useValue: prisma }],
        }).compile();

        repository = module.get(PrismaTransactionRepository);
    });

    describe('create', () => {
        it('upserts user, persists transaction with CREATED status, and maps to domain', async () => {
            const command = {
                currency: 'EUR',
                amount: '100.5',
                userId,
                consumerAddress,
            };

            const result = await repository.create(command, transactionId);

            expect(prisma.user.upsert).toHaveBeenCalledWith({
                where: { id: userId },
                create: { id: userId },
                update: {},
            });
            expect(prisma.transaction.create).toHaveBeenCalledWith({
                data: {
                    id: transactionId,
                    currency: 'EUR',
                    status: TRANSACTION_STATUS.CREATED,
                    amount: expect.any(Prisma.Decimal),
                    userId,
                    consumerAddress,
                },
                include: { user: true },
            });
            expect(result).toEqual(domainRecord);
        });

        it('persists lowercased consumer address', async () => {
            const mixedCaseAddress = '0x70997970C51812dc3a010C7d01b50e0d17dc79C8' as EvmAddress;
            const command = {
                currency: 'EUR',
                amount: '100.5',
                userId,
                consumerAddress: mixedCaseAddress,
            };

            await repository.create(command, transactionId);

            expect(prisma.transaction.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        consumerAddress: mixedCaseAddress.toLowerCase(),
                    }),
                }),
            );
        });
    });

    describe('findById', () => {
        it('returns domain transaction when record exists', async () => {
            prisma.transaction.findUnique.mockResolvedValue(prismaRecord);

            const result = await repository.findById(transactionId);

            expect(prisma.transaction.findUnique).toHaveBeenCalledWith({
                where: { id: transactionId },
                include: { user: true },
            });
            expect(result).toEqual(domainRecord);
        });

        it('returns null when record does not exist', async () => {
            prisma.transaction.findUnique.mockResolvedValue(null);

            const result = await repository.findById(transactionId);

            expect(result).toBeNull();
        });
    });

    describe('update', () => {
        it('persists patch and maps to domain', async () => {
            const updatedRecord = {
                ...prismaRecord,
                status: TRANSACTION_STATUS.PENDING,
                txHash: '0xabc123',
            };
            prisma.transaction.update.mockResolvedValue(updatedRecord);

            const result = await repository.update(transactionId, {
                status: TRANSACTION_STATUS.PENDING,
                txHash: '0xabc123',
            });

            expect(prisma.transaction.update).toHaveBeenCalledWith({
                where: { id: transactionId },
                data: {
                    status: TRANSACTION_STATUS.PENDING,
                    txHash: '0xabc123',
                },
                include: { user: true },
            });
            expect(result.status).toBe(TRANSACTION_STATUS.PENDING);
            expect(result.txHash).toBe('0xabc123');
        });
    });
});

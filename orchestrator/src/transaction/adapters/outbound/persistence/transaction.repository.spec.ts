import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TRANSACTION_STATUS } from '../../../domain/transaction-status';
import { EvmAddress } from '../../../domain/transaction.entity';
import { TransactionRepository } from './transaction.repository';

describe('TransactionRepository', () => {
    let repository: TransactionRepository;
    let prisma: {
        user: { upsert: jest.Mock };
        transaction: {
            create: jest.Mock;
            findUnique: jest.Mock;
            findFirst: jest.Mock;
            findMany: jest.Mock;
            update: jest.Mock;
            updateMany: jest.Mock;
        };
    };

    const userId = '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4e';
    const transactionId = '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4c';
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
        deploymentClaimedAt: null,
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
        deploymentClaimedAt: null,
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
                updateMany: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [TransactionRepository, { provide: PrismaService, useValue: prisma }],
        }).compile();

        repository = module.get(TransactionRepository);
    });

    describe('create', () => {
        it('upserts user, persists transaction with CREATED status, and maps to domain', async () => {
            const command = {
                currency: 'EUR',
                amount: '100.5',
                userId,
                consumerAddress,
            };

            const result = await repository.create(command);

            expect(prisma.user.upsert).toHaveBeenCalledWith({
                where: { id: userId },
                create: { id: userId },
                update: {},
            });
            expect(prisma.transaction.create).toHaveBeenCalledWith({
                data: {
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

            await repository.create(command);

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

    describe('claimDeploymentBroadcast', () => {
        const claimTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

        it('sets sentinel tx hash and claim timestamp atomically', async () => {
            prisma.transaction.updateMany.mockResolvedValue({ count: 1 });

            const result = await repository.claimDeploymentBroadcast(transactionId, claimTxHash);

            expect(result).toBe(true);
            expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
                where: { id: transactionId, status: TRANSACTION_STATUS.CREATED, txHash: null },
                data: { txHash: claimTxHash, deploymentClaimedAt: expect.any(Date) },
            });
        });

        it('returns false when another worker already claimed', async () => {
            prisma.transaction.updateMany.mockResolvedValue({ count: 0 });

            const result = await repository.claimDeploymentBroadcast(transactionId, claimTxHash);

            expect(result).toBe(false);
        });
    });

    describe('finalizeDeploymentBroadcast', () => {
        const claimTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const realTxHash = '0xabc123';

        it('moves to PENDING with real tx hash and clears claim timestamp', async () => {
            prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
            prisma.transaction.findUnique.mockResolvedValue({
                ...prismaRecord,
                status: TRANSACTION_STATUS.PENDING,
                txHash: realTxHash,
                deploymentClaimedAt: null,
            });

            const result = await repository.finalizeDeploymentBroadcast(transactionId, claimTxHash, realTxHash);

            expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
                where: { id: transactionId, status: TRANSACTION_STATUS.CREATED, txHash: claimTxHash },
                data: { status: TRANSACTION_STATUS.PENDING, txHash: realTxHash, deploymentClaimedAt: null },
            });
            expect(result?.status).toBe(TRANSACTION_STATUS.PENDING);
            expect(result?.txHash).toBe(realTxHash);
        });

        it('returns null when claim was lost', async () => {
            prisma.transaction.updateMany.mockResolvedValue({ count: 0 });

            const result = await repository.finalizeDeploymentBroadcast(transactionId, claimTxHash, realTxHash);

            expect(result).toBeNull();
        });
    });

    describe('releaseDeploymentBroadcastClaim', () => {
        const claimTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

        it('clears sentinel tx hash and claim timestamp', async () => {
            prisma.transaction.updateMany.mockResolvedValue({ count: 1 });

            await repository.releaseDeploymentBroadcastClaim(transactionId, claimTxHash);

            expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
                where: { id: transactionId, status: TRANSACTION_STATUS.CREATED, txHash: claimTxHash },
                data: { txHash: null, deploymentClaimedAt: null },
            });
        });
    });
});

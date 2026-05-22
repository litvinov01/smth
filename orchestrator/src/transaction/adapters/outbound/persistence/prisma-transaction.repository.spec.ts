import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TRANSACTION_STATUS } from '../../../domain/transaction-status';
import { PrismaTransactionRepository } from './prisma-transaction.repository';

describe('PrismaTransactionRepository', () => {
  let repository: PrismaTransactionRepository;
  let prisma: {
    user: { upsert: jest.Mock };
    transaction: { create: jest.Mock; findUnique: jest.Mock };
  };

  const userId = 'fedcba9876543210fedcba9876543210';
  const transactionId = 'a1b2c3d4e5f6789012345678901234ab';
  const createdAt = new Date('2025-05-22T12:00:00.000Z');

  const prismaRecord = {
    id: transactionId,
    currency: 'EUR',
    status: TRANSACTION_STATUS.CREATED,
    amount: new Prisma.Decimal('100.50'),
    createdAt,
    userId,
    user: { id: userId },
  };

  beforeEach(async () => {
    prisma = {
      user: { upsert: jest.fn().mockResolvedValue({ id: userId }) },
      transaction: {
        create: jest.fn().mockResolvedValue(prismaRecord),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTransactionRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(PrismaTransactionRepository);
  });

  describe('create', () => {
    it('upserts user, persists transaction with CREATED status, and maps to domain', async () => {
      const command = {
        currency: 'EUR',
        amount: '100.5',
        userId,
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
        },
        include: { user: true },
      });
      expect(result).toEqual({
        id: transactionId,
        currency: 'EUR',
        status: TRANSACTION_STATUS.CREATED,
        amount: '100.5',
        createdAt,
        user: { id: userId },
      });
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
      expect(result).toEqual({
        id: transactionId,
        currency: 'EUR',
        status: TRANSACTION_STATUS.CREATED,
        amount: '100.5',
        createdAt,
        user: { id: userId },
      });
    });

    it('returns null when record does not exist', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      const result = await repository.findById(transactionId);

      expect(result).toBeNull();
    });
  });
});

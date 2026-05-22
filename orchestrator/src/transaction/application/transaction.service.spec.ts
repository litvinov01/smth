import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TRANSACTION_STATUS } from '../domain/transaction-status';
import { Transaction } from '../domain/transaction.entity';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepositoryPort,
} from '../domain/ports/transaction.repository.port';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  let service: TransactionService;
  let repository: jest.Mocked<TransactionRepositoryPort>;

  const sampleTransaction: Transaction = {
    id: 'a1b2c3d4e5f6789012345678901234ab',
    currency: 'EUR',
    status: TRANSACTION_STATUS.CREATED,
    amount: '100.50',
    createdAt: new Date('2025-05-22T12:00:00.000Z'),
    user: { id: 'fedcba9876543210fedcba9876543210' },
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: TRANSACTION_REPOSITORY,
          useValue: repository,
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
      });

      expect(repository.create).toHaveBeenCalledTimes(1);
      const [command, id] = repository.create.mock.calls[0];
      expect(command).toEqual({
        currency: 'EUR',
        amount: '100.50',
        userId: sampleTransaction.user.id,
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
      await expect(service.getById('not-an-md5-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when transaction does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById(sampleTransaction.id)).rejects.toThrow(
        new NotFoundException(`Transaction ${sampleTransaction.id} not found`),
      );
    });
  });
});

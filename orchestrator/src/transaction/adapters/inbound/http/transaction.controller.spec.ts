import { Test, TestingModule } from '@nestjs/testing';
import { TRANSACTION_STATUS } from '../../../domain/transaction-status';
import { Transaction } from '../../../domain/transaction.entity';
import { TransactionService } from '../../../application/transaction.service';
import { TransactionController } from './transaction.controller';
import {
  CreateTransactionV1Body,
  CreateTransactionV1Formatter,
} from './formatters/v1/transaction.v1.formatter';

describe('TransactionController', () => {
  let controller: TransactionController;
  let transactionService: jest.Mocked<
    Pick<TransactionService, 'create' | 'getById'>
  >;
  let createTransactionV1Formatter: jest.Mocked<
    Pick<CreateTransactionV1Formatter, 'parse'>
  >;

  const sampleTransaction: Transaction = {
    id: 'a1b2c3d4e5f6789012345678901234ab',
    currency: 'EUR',
    status: TRANSACTION_STATUS.CREATED,
    amount: '100.50',
    createdAt: new Date('2025-05-22T12:00:00.000Z'),
    user: { id: 'fedcba9876543210fedcba9876543210' },
  };

  beforeEach(async () => {
    transactionService = {
      create: jest.fn(),
      getById: jest.fn(),
    };
    createTransactionV1Formatter = {
      parse: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        { provide: TransactionService, useValue: transactionService },
        {
          provide: CreateTransactionV1Formatter,
          useValue: createTransactionV1Formatter,
        },
      ],
    }).compile();

    controller = module.get(TransactionController);
  });

  describe('create', () => {
    it('parses body, delegates to service, and returns domain transaction', async () => {
      const body: CreateTransactionV1Body = {
        currency: 'EUR',
        amount: '100.50',
        user: { id: sampleTransaction.user.id },
      };
      const command = {
        currency: 'EUR',
        amount: '100.50',
        userId: sampleTransaction.user.id,
      };

      createTransactionV1Formatter.parse.mockReturnValue(command);
      transactionService.create.mockResolvedValue(sampleTransaction);

      const result = await controller.create(body);

      expect(createTransactionV1Formatter.parse).toHaveBeenCalledWith(body);
      expect(transactionService.create).toHaveBeenCalledWith(command);
      expect(result).toBe(sampleTransaction);
    });
  });

  describe('getById', () => {
    it('delegates to service and returns domain transaction', async () => {
      transactionService.getById.mockResolvedValue(sampleTransaction);

      const result = await controller.getById(sampleTransaction.id);

      expect(transactionService.getById).toHaveBeenCalledWith(
        sampleTransaction.id,
      );
      expect(result).toBe(sampleTransaction);
    });
  });
});

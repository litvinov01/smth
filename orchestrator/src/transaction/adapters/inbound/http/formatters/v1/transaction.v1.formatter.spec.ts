import { BadRequestException } from '@nestjs/common';
import { TRANSACTION_STATUS } from '../../../../../domain/transaction-status';
import { Transaction } from '../../../../../domain/transaction.entity';
import {
  CreateTransactionV1Formatter,
  TransactionResponseV1Formatter,
} from './transaction.v1.formatter';

describe('CreateTransactionV1Formatter', () => {
  const formatter = new CreateTransactionV1Formatter();

  it('parses valid body into create command', () => {
    expect(
      formatter.parse({
        currency: ' eur ',
        amount: '100.50',
        user: { id: 'A1B2C3D4E5F6789012345678901234AB' },
      }),
    ).toEqual({
      currency: 'EUR',
      amount: '100.50',
      userId: 'a1b2c3d4e5f6789012345678901234ab',
    });
  });

  it('accepts numeric amount', () => {
    expect(
      formatter.parse({
        currency: 'USD',
        amount: 42,
        user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
      }),
    ).toEqual({
      currency: 'USD',
      amount: '42',
      userId: 'a1b2c3d4e5f6789012345678901234ab',
    });
  });

  it.each([
    [{ currency: 1, amount: '1', user: { id: 'a1b2c3d4e5f6789012345678901234ab' } }, 'currency must be a string'],
    [{ currency: 'EURO', amount: '1', user: { id: 'a1b2c3d4e5f6789012345678901234ab' } }, 'currency must be a 3-letter ISO 4217 code'],
    [{ currency: 'EUR', amount: '-1', user: { id: 'a1b2c3d4e5f6789012345678901234ab' } }, 'amount must be a positive decimal'],
    [{ currency: 'EUR', amount: '1', user: { id: 'short' } }, 'user.id must be a 32-character md5 hex string'],
  ])('rejects invalid payload %#', (body, message) => {
    expect(() => formatter.parse(body)).toThrow(BadRequestException);
    expect(() => formatter.parse(body)).toThrow(message);
  });
});

describe('TransactionResponseV1Formatter', () => {
  const formatter = new TransactionResponseV1Formatter();

  it('maps domain transaction to v1 response', () => {
    const transaction: Transaction = {
      id: 'a1b2c3d4e5f6789012345678901234ab',
      currency: 'EUR',
      status: TRANSACTION_STATUS.CREATED,
      amount: '100.50',
      createdAt: new Date('2025-05-22T12:00:00.000Z'),
      user: { id: 'fedcba9876543210fedcba9876543210' },
    };

    expect(formatter.format(transaction)).toEqual({
      id: transaction.id,
      currency: 'EUR',
      status: TRANSACTION_STATUS.CREATED,
      amount: '100.50',
      created_at: '2025-05-22T12:00:00.000Z',
      user: { id: 'fedcba9876543210fedcba9876543210' },
    });
  });
});

import { TRANSACTION_STATUS } from '../../../../../domain/transaction-status';
import { Transaction } from '../../../../../domain/transaction.entity';
import { CreateTransactionV1Formatter, TransactionResponseV1Formatter } from './transaction.v1.formatter';

describe('CreateTransactionV1Formatter', () => {
    const formatter = new CreateTransactionV1Formatter();
    const consumerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';

    it('maps validated body into create command', () => {
        expect(
            formatter.parse({
                currency: 'EUR',
                amount: '100.50',
                user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
                consumer: { address: consumerAddress },
            }),
        ).toEqual({
            currency: 'EUR',
            amount: '100.50',
            userId: 'a1b2c3d4e5f6789012345678901234ab',
            consumerAddress,
        });
    });

    it('maps body without consumer address', () => {
        expect(
            formatter.parse({
                currency: 'USD',
                amount: '42',
                user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
            }),
        ).toEqual({
            currency: 'USD',
            amount: '42',
            userId: 'a1b2c3d4e5f6789012345678901234ab',
            consumerAddress: undefined,
        });
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
            consumerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
            contractAddress: null,
            txHash: null,
        };

        expect(formatter.format(transaction)).toEqual({
            id: transaction.id,
            currency: 'EUR',
            status: TRANSACTION_STATUS.CREATED,
            amount: '100.50',
            created_at: '2025-05-22T12:00:00.000Z',
            user: { id: 'fedcba9876543210fedcba9876543210' },
            consumer_address: transaction.consumerAddress,
            contract_address: null,
            tx_hash: null,
        });
    });
});

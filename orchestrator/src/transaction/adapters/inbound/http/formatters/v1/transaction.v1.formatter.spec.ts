import { TRANSACTION_STATUS } from '../../../../../domain/transaction-status';
import { DEPLOYMENT_CLAIM_TX_HASH } from '../../../../../domain/deployment-claim';
import { Transaction } from '../../../../../domain/transaction.entity';
import { CreateTransactionV1Formatter, TransactionResponseV1Formatter } from './transaction.v1.formatter';

describe('CreateTransactionV1Formatter', () => {
    const formatter = new CreateTransactionV1Formatter();
    const consumerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
    const sampleUserId = '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4e';

    it('maps validated body into create command', () => {
        expect(
            formatter.parse({
                currency: 'EUR',
                amount: '100.50',
                user: { id: sampleUserId },
                consumer: { address: consumerAddress },
            }),
        ).toEqual({
            currency: 'EUR',
            amount: '100.50',
            userId: sampleUserId,
            consumerAddress,
        });
    });

    it('maps body without consumer address', () => {
        expect(
            formatter.parse({
                currency: 'USD',
                amount: '42',
                user: { id: sampleUserId },
            }),
        ).toEqual({
            currency: 'USD',
            amount: '42',
            userId: sampleUserId,
            consumerAddress: undefined,
        });
    });
});

describe('TransactionResponseV1Formatter', () => {
    const formatter = new TransactionResponseV1Formatter();
    const sampleUserId = '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4e';

    it('maps domain transaction to v1 response', () => {
        const transaction: Transaction = {
            id: '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4c',
            currency: 'EUR',
            status: TRANSACTION_STATUS.CREATED,
            amount: '100.50',
            createdAt: new Date('2025-05-22T12:00:00.000Z'),
            user: { id: sampleUserId },
            consumerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
            contractAddress: null,
            txHash: null,
            deploymentClaimedAt: null,
        };

        expect(formatter.format(transaction)).toEqual({
            id: transaction.id,
            currency: 'EUR',
            status: TRANSACTION_STATUS.CREATED,
            amount: '100.50',
            created_at: '2025-05-22T12:00:00.000Z',
            user: { id: sampleUserId },
            consumer_address: transaction.consumerAddress,
            contract_address: null,
            tx_hash: null,
        });
    });

    it('hides internal deployment claim sentinel from tx_hash', () => {
        const transaction: Transaction = {
            id: '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4c',
            currency: 'EUR',
            status: TRANSACTION_STATUS.CREATED,
            amount: '100.50',
            createdAt: new Date('2025-05-22T12:00:00.000Z'),
            user: { id: sampleUserId },
            consumerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
            contractAddress: null,
            txHash: DEPLOYMENT_CLAIM_TX_HASH,
            deploymentClaimedAt: new Date(),
        };

        expect(formatter.format(transaction).tx_hash).toBeNull();
    });
});

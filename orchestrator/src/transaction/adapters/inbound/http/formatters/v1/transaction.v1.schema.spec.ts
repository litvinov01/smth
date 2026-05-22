import { ZodError } from 'zod';
import { createTransactionV1Schema, transactionIdParamSchema } from './transaction.v1.schema';

describe('createTransactionV1Schema', () => {
    const consumerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';

    it('parses and normalizes valid payload', () => {
        expect(
            createTransactionV1Schema.parse({
                currency: ' eur ',
                amount: '100.50',
                user: { id: 'A1B2C3D4E5F6789012345678901234AB' },
                consumer: { address: consumerAddress },
            }),
        ).toEqual({
            currency: 'EUR',
            amount: '100.50',
            user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
            consumer: { address: consumerAddress.toLowerCase() },
        });
    });

    it('lowercases consumer address', () => {
        expect(
            createTransactionV1Schema.parse({
                currency: 'EUR',
                amount: '1',
                user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
                consumer: { address: '0x70997970C51812dc3a010C7d01b50e0d17dc79C8' },
            }).consumer?.address,
        ).toBe(consumerAddress.toLowerCase());
    });

    it('accepts numeric amount', () => {
        expect(
            createTransactionV1Schema.parse({
                currency: 'USD',
                amount: 42,
                user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
            }),
        ).toEqual({
            currency: 'USD',
            amount: '42',
            user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
        });
    });

    it.each([
        [
            {
                currency: 1,
                amount: '1',
                user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
            },
            'Expected string',
        ],
        [
            {
                currency: 'EURO',
                amount: '1',
                user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
            },
            'Must be a 3-letter ISO 4217 code',
        ],
        [
            {
                currency: 'EUR',
                amount: '-1',
                user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
            },
            'amount must be a positive decimal',
        ],
        [
            {
                currency: 'EUR',
                amount: '1.123456789',
                user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
            },
            'amount must have at most 8 decimal places',
        ],
        [{ currency: 'EUR', amount: '1', user: { id: 'short' } }, 'Must be a 32-character md5 hex string'],
        [
            {
                currency: 'EUR',
                amount: '1',
                user: { id: 'a1b2c3d4e5f6789012345678901234ab' },
                consumer: { address: 'bad' },
            },
            'Must be a 0x-prefixed 20-byte hex address',
        ],
    ])('rejects invalid payload %#', (body, message) => {
        expect(() => createTransactionV1Schema.parse(body)).toThrow(ZodError);
        expect(() => createTransactionV1Schema.parse(body)).toThrow(message);
    });
});

describe('transactionIdParamSchema', () => {
    it('normalizes route id to lowercase md5', () => {
        expect(
            transactionIdParamSchema.parse({
                id: 'A1B2C3D4E5F6789012345678901234AB',
            }),
        ).toEqual({ id: 'a1b2c3d4e5f6789012345678901234ab' });
    });

    it('rejects invalid route id', () => {
        expect(() => transactionIdParamSchema.parse({ id: 'not-md5' })).toThrow(ZodError);
    });
});

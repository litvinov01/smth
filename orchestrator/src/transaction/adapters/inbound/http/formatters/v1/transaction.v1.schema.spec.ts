import { ZodError } from 'zod';
import { createTransactionV1Schema, transactionIdParamSchema } from './transaction.v1.schema';

describe('createTransactionV1Schema', () => {
    const consumerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
    const sampleUserId = '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4e';

    it('parses and normalizes valid payload', () => {
        expect(
            createTransactionV1Schema.parse({
                currency: ' eur ',
                amount: '100.50',
                user: { id: '018F5E30-8C4A-7B3E-B3D1-8B4E7F6A5D4E' },
                consumer: { address: consumerAddress },
            }),
        ).toEqual({
            currency: 'EUR',
            amount: '100.50',
            user: { id: sampleUserId },
            consumer: { address: consumerAddress.toLowerCase() },
        });
    });

    it('lowercases consumer address', () => {
        expect(
            createTransactionV1Schema.parse({
                currency: 'EUR',
                amount: '1',
                user: { id: sampleUserId },
                consumer: { address: '0x70997970C51812dc3a010C7d01b50e0d17dc79C8' },
            }).consumer?.address,
        ).toBe(consumerAddress.toLowerCase());
    });

    it('accepts numeric amount', () => {
        expect(
            createTransactionV1Schema.parse({
                currency: 'USD',
                amount: 42,
                user: { id: sampleUserId },
            }),
        ).toEqual({
            currency: 'USD',
            amount: '42',
            user: { id: sampleUserId },
        });
    });

    it.each([
        [
            {
                currency: 1,
                amount: '1',
                user: { id: sampleUserId },
            },
            'Expected string',
        ],
        [
            {
                currency: 'EURO',
                amount: '1',
                user: { id: sampleUserId },
            },
            'Must be a 3-letter ISO 4217 code',
        ],
        [
            {
                currency: 'EUR',
                amount: '-1',
                user: { id: sampleUserId },
            },
            'amount must be a positive decimal',
        ],
        [
            {
                currency: 'EUR',
                amount: '1.123456789',
                user: { id: sampleUserId },
            },
            'amount must have at most 8 decimal places',
        ],
        [{ currency: 'EUR', amount: '1', user: { id: 'not-a-uuid' } }, 'Must be a UUID'],
        [
            {
                currency: 'EUR',
                amount: '1',
                user: { id: sampleUserId },
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
    const sampleTransactionId = '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4c';

    it('normalizes route id to lowercase uuid', () => {
        expect(
            transactionIdParamSchema.parse({
                id: '018F5E30-8C4A-7B3E-B3D1-8B4E7F6A5D4C',
            }),
        ).toEqual({ id: sampleTransactionId });
    });

    it('accepts legacy md5-derived uuid on route id', () => {
        const legacyId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        expect(transactionIdParamSchema.parse({ id: legacyId })).toEqual({ id: legacyId });
    });

    it('rejects invalid route id', () => {
        expect(() => transactionIdParamSchema.parse({ id: 'not-a-uuid' })).toThrow(ZodError);
    });
});

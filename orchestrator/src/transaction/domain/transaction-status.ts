export const TRANSACTION_STATUS = {
    CREATED: 'CREATED',
    PENDING: 'PENDING',
    FUNDED: 'FUNDED',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
} as const;

export type TransactionStatus = (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

export const INITIAL_TRANSACTION_STATUS = TRANSACTION_STATUS.CREATED;

const ALLOWED_TRANSITIONS: Record<TransactionStatus, readonly TransactionStatus[]> = {
    CREATED: [TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.FAILED],
    PENDING: [TRANSACTION_STATUS.FUNDED, TRANSACTION_STATUS.FAILED],
    FUNDED: [TRANSACTION_STATUS.SUCCESS, TRANSACTION_STATUS.FAILED],
    SUCCESS: [],
    FAILED: [],
};

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
}

export function parseTransactionStatus(value: string): TransactionStatus {
    if (!(Object.values(TRANSACTION_STATUS) as string[]).includes(value)) {
        throw new Error(`Invalid transaction status in database: ${value}`);
    }

    return value as TransactionStatus;
}

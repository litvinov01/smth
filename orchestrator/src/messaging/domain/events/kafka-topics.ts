export const KAFKA_TOPICS = {
    SWAP_CREATED: 'swap.created',
    DEPLOYMENT_REQUESTED: 'deployment.requested',
    RECEIPT_CHECK: 'receipt.check',
    SETTLEMENT_CHECK: 'settlement.check',
    TX_MINED: 'tx.mined',
    TX_FAILED: 'tx.failed',
    TX_CONFIRMED: 'tx.confirmed',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

export function toDlqTopic(topic: KafkaTopic): `${KafkaTopic}.dlq` {
    return `${topic}.dlq`;
}

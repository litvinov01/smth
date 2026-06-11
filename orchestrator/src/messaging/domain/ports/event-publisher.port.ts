import { KafkaTopic } from '../events/kafka-topics';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

export interface DeadLetterPayload {
    sourceTopic: KafkaTopic;
    key: string;
    originalPayload: unknown;
    error: string;
    failedAt: string;
    attempt: number;
}

export interface EventPublisherPort {
    publish<T extends object>(topic: KafkaTopic, key: string, payload: T): Promise<void>;
    publishDeadLetter(payload: DeadLetterPayload): Promise<void>;
}

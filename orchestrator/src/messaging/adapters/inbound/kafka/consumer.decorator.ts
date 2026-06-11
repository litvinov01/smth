import { Injectable, SetMetadata, applyDecorators } from '@nestjs/common';
import { KafkaTopic } from '../../../domain/events/kafka-topics';

export const CONSUMER_METADATA_KEY = 'messaging:consumer';

export type ConsumerOptions = {
    topic: KafkaTopic;
    /** Wait until `payload.checkAt` (epoch ms) before invoking handle. */
    deferred?: boolean;
    /** Skip registration when EVM is not configured. */
    requiresEvm?: boolean;
};

/** Registers a Kafka message consumer class in the consumer collection (discovered on bootstrap). */
export function Consumer(options: ConsumerOptions): ClassDecorator {
    return applyDecorators(Injectable(), SetMetadata(CONSUMER_METADATA_KEY, options));
}

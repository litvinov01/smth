import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ConsumerCollection } from './adapters/inbound/kafka/consumer.collection';
import { ConsumerExplorer } from './adapters/inbound/kafka/consumer.explorer';
import { KafkaConsumerRunner } from './adapters/inbound/kafka/kafka-consumer.runner';
import { KafkaEventPublisher } from './adapters/outbound/kafka/kafka-event.publisher';
import { EVENT_PUBLISHER } from './domain/ports/event-publisher.port';

@Global()
@Module({
    imports: [DiscoveryModule],
    providers: [
        KafkaEventPublisher,
        ConsumerCollection,
        ConsumerExplorer,
        KafkaConsumerRunner,
        {
            provide: EVENT_PUBLISHER,
            useExisting: KafkaEventPublisher,
        },
    ],
    exports: [EVENT_PUBLISHER, KafkaConsumerRunner, ConsumerCollection],
})
export class MessagingModule {}

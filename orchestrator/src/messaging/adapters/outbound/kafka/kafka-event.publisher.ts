import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { AppConfigService } from '../../../../config/config.service';
import { KafkaTopic, toDlqTopic } from '../../../domain/events/kafka-topics';
import { DeadLetterPayload, EventPublisherPort } from '../../../domain/ports/event-publisher.port';

@Injectable()
export class KafkaEventPublisher implements EventPublisherPort, OnModuleInit, OnModuleDestroy {
    private producer: Producer | null = null;

    constructor(private readonly appConfig: AppConfigService) {}

    async onModuleInit(): Promise<void> {
        if (!this.appConfig.messaging.enabled) {
            return;
        }

        const kafka = new Kafka({
            clientId: this.appConfig.messaging.kafka.clientId,
            brokers: this.appConfig.messaging.kafka.brokers,
        });
        this.producer = kafka.producer();
        await this.producer.connect();
    }

    async onModuleDestroy(): Promise<void> {
        await this.producer?.disconnect();
    }

    async publish<T extends object>(topic: KafkaTopic, key: string, payload: T): Promise<void> {
        if (!this.producer) {
            throw new Error('Kafka producer is not connected');
        }

        await this.producer.send({
            topic,
            messages: [{ key, value: JSON.stringify(payload) }],
        });
    }

    async publishDeadLetter(payload: DeadLetterPayload): Promise<void> {
        if (!this.producer) {
            throw new Error('Kafka producer is not connected');
        }

        const topic = toDlqTopic(payload.sourceTopic);
        await this.producer.send({
            topic,
            messages: [
                {
                    key: payload.key,
                    value: JSON.stringify(payload),
                },
            ],
        });
    }
}

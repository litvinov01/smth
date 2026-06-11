import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import { AppConfigService } from '../../../../config/config.service';
import { KafkaTopic } from '../../../domain/events/kafka-topics';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../../domain/ports/event-publisher.port';
import { sleep } from '../../../domain/sleep';
import { ConsumerCollection } from './consumer.collection';

type HandlerRegistration = {
    handle: (payload: unknown) => Promise<void>;
    waitUntilCheckAt: boolean;
};

const DEFERRED_HEARTBEAT_INTERVAL_MS = 3_000;

@Injectable()
export class KafkaConsumerRunner implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(KafkaConsumerRunner.name);
    private readonly consumers: Consumer[] = [];
    private handlers = new Map<KafkaTopic, HandlerRegistration>();
    private readonly retryAttempts = new Map<string, number>();

    constructor(
        private readonly appConfig: AppConfigService,
        private readonly consumerCollection: ConsumerCollection,
        @Optional()
        @Inject(EVENT_PUBLISHER)
        private readonly eventPublisher?: EventPublisherPort,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        for (const registration of this.consumerCollection.all()) {
            const handler = (payload: unknown) => registration.instance.handle(payload);
            this.handlers.set(registration.topic, {
                handle: handler,
                waitUntilCheckAt: registration.deferred ?? false,
            });
        }

        if (!this.appConfig.messaging.enabled || !this.appConfig.runsWorkers || this.handlers.size === 0) {
            return;
        }

        const kafka = new Kafka({
            clientId: `${this.appConfig.messaging.kafka.clientId}-consumer`,
            brokers: this.appConfig.messaging.kafka.brokers,
        });

        const immediateTopics = [...this.handlers.entries()]
            .filter(([, registration]) => !registration.waitUntilCheckAt)
            .map(([topic]) => topic);
        const deferredTopics = [...this.handlers.entries()]
            .filter(([, registration]) => registration.waitUntilCheckAt)
            .map(([topic]) => topic);

        if (immediateTopics.length > 0) {
            await this.startConsumer(
                kafka,
                `${this.appConfig.messaging.kafka.clientId}-workers`,
                immediateTopics,
                false,
            );
        }

        if (deferredTopics.length > 0) {
            await this.startConsumer(
                kafka,
                `${this.appConfig.messaging.kafka.clientId}-workers-deferred`,
                deferredTopics,
                true,
            );
        }
    }

    async onModuleDestroy(): Promise<void> {
        await Promise.all(this.consumers.map((consumer) => consumer.disconnect()));
    }

    private async startConsumer(kafka: Kafka, groupId: string, topics: KafkaTopic[], deferred: boolean): Promise<void> {
        const consumer = kafka.consumer({ groupId });
        await consumer.connect();

        for (const topic of topics) {
            await consumer.subscribe({ topic, fromBeginning: false });
        }

        await consumer.run({
            eachMessage: async (payload) => this.handleMessage(payload, deferred),
        });

        this.consumers.push(consumer);
        this.logger.log(`Kafka consumer ${groupId} subscribed to ${topics.join(', ')}`);
    }

    private async handleMessage(
        { topic, partition, message, heartbeat }: EachMessagePayload,
        deferred: boolean,
    ): Promise<void> {
        const kafkaTopic = topic as KafkaTopic;
        const registration = this.handlers.get(kafkaTopic);
        if (!registration || !message.value) {
            this.logger.warn(`No handler found for topic ${topic} or message value is null`);
            return;
        }

        const retryKey = `${topic}:${partition}:${message.offset}`;
        let payload: unknown;

        try {
            payload = JSON.parse(message.value.toString());

            if (deferred) {
                await this.waitUntilCheckAt(payload, heartbeat);
            }

            await registration.handle(payload);
            this.retryAttempts.delete(retryKey);
        } catch (error) {
            const attempt = (this.retryAttempts.get(retryKey) ?? 0) + 1;
            this.retryAttempts.set(retryKey, attempt);
            const maxRetries = this.appConfig.messaging.kafkaConsumerMaxRetries;

            if (attempt >= maxRetries) {
                this.retryAttempts.delete(retryKey);
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(
                    `Kafka message on ${topic} failed after ${attempt} attempts; publishing to DLQ`,
                    error,
                );

                if (this.eventPublisher) {
                    await this.eventPublisher.publishDeadLetter({
                        sourceTopic: kafkaTopic,
                        key: message.key?.toString() ?? '',
                        originalPayload: payload ?? message.value.toString(),
                        error: errorMessage,
                        failedAt: new Date().toISOString(),
                        attempt,
                    });
                }

                return;
            }

            this.logger.warn(`Kafka message on ${topic} failed (attempt ${attempt}/${maxRetries}); will retry`, error);
            throw error;
        }
    }

    private async waitUntilCheckAt(payload: unknown, heartbeat: () => Promise<void>): Promise<void> {
        const checkAt = (payload as { checkAt?: number }).checkAt;
        if (typeof checkAt !== 'number') {
            return;
        }

        while (true) {
            const delay = checkAt - Date.now();
            if (delay <= 0) {
                return;
            }

            await sleep(Math.min(delay, DEFERRED_HEARTBEAT_INTERVAL_MS));
            await heartbeat();
        }
    }
}

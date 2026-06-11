import { Injectable } from '@nestjs/common';
import { KafkaTopic } from '../../../domain/events/kafka-topics';
import { MessageConsumer } from '../../../domain/ports/message-consumer.port';
import { ConsumerOptions } from './consumer.decorator';

export type RegisteredConsumer = ConsumerOptions & {
    instance: MessageConsumer;
};

@Injectable()
export class ConsumerCollection {
    private readonly consumers: RegisteredConsumer[] = [];

    add(options: ConsumerOptions, instance: MessageConsumer): void {
        this.consumers.push({ ...options, instance });
    }

    getByTopic(topic: KafkaTopic): RegisteredConsumer | undefined {
        return this.consumers.find((consumer) => consumer.topic === topic);
    }

    all(): readonly RegisteredConsumer[] {
        return this.consumers;
    }
}

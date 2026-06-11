import { Inject, Logger } from '@nestjs/common';
import { Consumer } from '../../../../messaging/adapters/inbound/kafka/consumer.decorator';
import { AppConfigService } from '../../../../config/config.service';
import { KAFKA_TOPICS } from '../../../../messaging/domain/events/kafka-topics';
import { settlementCheckEventSchema } from '../../../../messaging/domain/events/swap-events.schema';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../../../messaging/domain/ports/event-publisher.port';
import { MessageConsumer } from '../../../../messaging/domain/ports/message-consumer.port';
import { TRANSACTOR_PORT, TransactorPort } from '../../../domain/ports/transactor.port';
import { EvmAddress } from '../../../domain/transaction.entity';

@Consumer({ topic: KAFKA_TOPICS.SETTLEMENT_CHECK, deferred: true, requiresEvm: true })
export class SettlementCheckConsumer implements MessageConsumer {
    private readonly logger = new Logger(SettlementCheckConsumer.name);

    constructor(
        private readonly appConfig: AppConfigService,
        @Inject(TRANSACTOR_PORT)
        private readonly transactorPort: TransactorPort,
        @Inject(EVENT_PUBLISHER)
        private readonly eventPublisher: EventPublisherPort,
    ) {}

    async handle(payload: unknown): Promise<void> {
        const event = settlementCheckEventSchema.parse(payload);
        const fromBlock = BigInt(event.fromBlock);
        const currentBlock = await this.transactorPort.getBlockNumber();
        const events = await this.transactorPort.getSettlementEvents(
            event.contractAddress as EvmAddress,
            fromBlock,
            currentBlock,
        );

        if (events.includes('fulfilled')) {
            await this.eventPublisher.publish(KAFKA_TOPICS.TX_CONFIRMED, event.transactionId, {
                transactionId: event.transactionId,
                contractAddress: event.contractAddress,
                outcome: 'fulfilled',
                occurredAt: new Date().toISOString(),
            });
            return;
        }

        if (events.includes('cancelled')) {
            await this.eventPublisher.publish(KAFKA_TOPICS.TX_CONFIRMED, event.transactionId, {
                transactionId: event.transactionId,
                contractAddress: event.contractAddress,
                outcome: 'cancelled',
                occurredAt: new Date().toISOString(),
            });
            return;
        }

        const nextAttempt = event.attempt + 1;
        if (nextAttempt >= this.appConfig.messaging.settlementCheckMaxAttempts) {
            await this.eventPublisher.publish(KAFKA_TOPICS.TX_FAILED, event.transactionId, {
                transactionId: event.transactionId,
                reason: 'settlement_timeout',
                occurredAt: new Date().toISOString(),
            });
            this.logger.warn(`Settlement timed out for ${event.transactionId} after ${nextAttempt} attempts`);
            return;
        }

        await this.eventPublisher.publish(KAFKA_TOPICS.SETTLEMENT_CHECK, event.transactionId, {
            transactionId: event.transactionId,
            contractAddress: event.contractAddress,
            fromBlock: event.fromBlock,
            checkAt: Date.now() + this.appConfig.messaging.settlementCheckDelayMs,
            attempt: nextAttempt,
        });
    }
}

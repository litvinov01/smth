import {
    BadRequestException,
    ConflictException,
    Inject,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Consumer } from '../../../../messaging/adapters/inbound/kafka/consumer.decorator';
import { AppConfigService } from '../../../../config/config.service';
import { KAFKA_TOPICS } from '../../../../messaging/domain/events/kafka-topics';
import { deploymentRequestedEventSchema } from '../../../../messaging/domain/events/swap-events.schema';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../../../messaging/domain/ports/event-publisher.port';
import { MessageConsumer } from '../../../../messaging/domain/ports/message-consumer.port';
import { TransactionService } from '../../../application/transaction.service';

@Consumer({ topic: KAFKA_TOPICS.DEPLOYMENT_REQUESTED, requiresEvm: true })
export class DeploymentRequestedConsumer implements MessageConsumer {
    private readonly logger = new Logger(DeploymentRequestedConsumer.name);

    constructor(
        private readonly appConfig: AppConfigService,
        private readonly transactionService: TransactionService,
        @Inject(EVENT_PUBLISHER)
        private readonly eventPublisher: EventPublisherPort,
    ) {}

    async handle(payload: unknown): Promise<void> {
        const event = deploymentRequestedEventSchema.parse(payload);

        let txHash: string;
        try {
            txHash = await this.transactionService.broadcastDeployment(event.transactionId);
        } catch (error) {
            if (error instanceof ConflictException || error instanceof ServiceUnavailableException) {
                throw error;
            }

            if (error instanceof BadRequestException) {
                this.logger.warn(
                    `Skipping deployment.requested for ${event.transactionId}: ${error.message}`,
                );
                return;
            }

            await this.eventPublisher.publish(KAFKA_TOPICS.TX_FAILED, event.transactionId, {
                transactionId: event.transactionId,
                reason: 'deployment_error',
                occurredAt: new Date().toISOString(),
            });
            this.logger.error(`Deployment failed for ${event.transactionId}`, error);
            return;
        }

        await this.eventPublisher.publish(KAFKA_TOPICS.RECEIPT_CHECK, event.transactionId, {
            transactionId: event.transactionId,
            txHash,
            checkAt: Date.now() + this.appConfig.messaging.receiptCheckDelayMs,
        });
        this.logger.log(`Deployment broadcast for ${event.transactionId}: ${txHash}`);
    }
}

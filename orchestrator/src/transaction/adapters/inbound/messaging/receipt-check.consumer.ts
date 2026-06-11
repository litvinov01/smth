import { Inject, Logger } from '@nestjs/common';
import { Consumer } from '../../../../messaging/adapters/inbound/kafka/consumer.decorator';
import { AppConfigService } from '../../../../config/config.service';
import { KAFKA_TOPICS } from '../../../../messaging/domain/events/kafka-topics';
import { receiptCheckEventSchema } from '../../../../messaging/domain/events/swap-events.schema';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../../../messaging/domain/ports/event-publisher.port';
import { MessageConsumer } from '../../../../messaging/domain/ports/message-consumer.port';
import { TRANSACTOR_PORT, TransactorPort } from '../../../domain/ports/transactor.port';
import { EvmAddress, EvmTxHash } from '../../../domain/transaction.entity';

@Consumer({ topic: KAFKA_TOPICS.RECEIPT_CHECK, deferred: true, requiresEvm: true })
export class ReceiptCheckConsumer implements MessageConsumer {
    private readonly logger = new Logger(ReceiptCheckConsumer.name);

    constructor(
        private readonly appConfig: AppConfigService,
        @Inject(TRANSACTOR_PORT)
        private readonly transactorPort: TransactorPort,
        @Inject(EVENT_PUBLISHER)
        private readonly eventPublisher: EventPublisherPort,
    ) {}

    async handle(payload: unknown): Promise<void> {
        const event = receiptCheckEventSchema.parse(payload);
        const txHash = event.txHash as EvmTxHash;
        const receipt = await this.transactorPort.getDeploymentReceipt(txHash);

        if (!receipt) {
            await this.republishReceiptCheck(event.transactionId, txHash);
            return;
        }

        if (receipt.status === 'reverted') {
            await this.publishTxFailed(event.transactionId, txHash, 'deployment_reverted');
            return;
        }

        if (!receipt.contractAddress) {
            await this.republishReceiptCheck(event.transactionId, txHash);
            return;
        }

        await this.eventPublisher.publish(KAFKA_TOPICS.TX_MINED, event.transactionId, {
            transactionId: event.transactionId,
            txHash,
            contractAddress: receipt.contractAddress as EvmAddress,
            blockNumber: receipt.blockNumber.toString(),
            occurredAt: new Date().toISOString(),
        });

        await this.eventPublisher.publish(KAFKA_TOPICS.SETTLEMENT_CHECK, event.transactionId, {
            transactionId: event.transactionId,
            contractAddress: receipt.contractAddress as EvmAddress,
            fromBlock: receipt.blockNumber.toString(),
            checkAt: Date.now() + this.appConfig.messaging.settlementCheckDelayMs,
            attempt: 0,
        });

        this.logger.log(`Receipt confirmed for ${event.transactionId}; settlement check scheduled`);
    }

    private async republishReceiptCheck(transactionId: string, txHash: EvmTxHash): Promise<void> {
        await this.eventPublisher.publish(KAFKA_TOPICS.RECEIPT_CHECK, transactionId, {
            transactionId,
            txHash,
            checkAt: Date.now() + this.appConfig.messaging.receiptCheckDelayMs,
        });
    }

    private async publishTxFailed(
        transactionId: string,
        txHash: EvmTxHash,
        reason: 'deployment_reverted' | 'deployment_error',
    ): Promise<void> {
        await this.eventPublisher.publish(KAFKA_TOPICS.TX_FAILED, transactionId, {
            transactionId,
            txHash,
            reason,
            occurredAt: new Date().toISOString(),
        });
    }
}

import { Consumer } from '../../../../messaging/adapters/inbound/kafka/consumer.decorator';
import { KAFKA_TOPICS } from '../../../../messaging/domain/events/kafka-topics';
import { MessageConsumer } from '../../../../messaging/domain/ports/message-consumer.port';
import { TransactionEventProcessor } from '../../../application/transaction-event.processor';

@Consumer({ topic: KAFKA_TOPICS.TX_MINED })
export class TxMinedConsumer implements MessageConsumer {
    constructor(private readonly transactionEventProcessor: TransactionEventProcessor) {}

    handle(payload: unknown): Promise<void> {
        return this.transactionEventProcessor.handleTxMined(payload);
    }
}

@Consumer({ topic: KAFKA_TOPICS.TX_FAILED })
export class TxFailedConsumer implements MessageConsumer {
    constructor(private readonly transactionEventProcessor: TransactionEventProcessor) {}

    handle(payload: unknown): Promise<void> {
        return this.transactionEventProcessor.handleTxFailed(payload);
    }
}

@Consumer({ topic: KAFKA_TOPICS.TX_CONFIRMED })
export class TxConfirmedConsumer implements MessageConsumer {
    constructor(private readonly transactionEventProcessor: TransactionEventProcessor) {}

    handle(payload: unknown): Promise<void> {
        return this.transactionEventProcessor.handleTxConfirmed(payload);
    }
}

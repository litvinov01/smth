import { Injectable, Logger } from '@nestjs/common';
import {
    txConfirmedEventSchema,
    txFailedEventSchema,
    txMinedEventSchema,
} from '../../messaging/domain/events/swap-events.schema';
import { TransactionService } from './transaction.service';
import { EvmAddress } from '../domain/transaction.entity';

@Injectable()
export class TransactionEventProcessor {
    private readonly logger = new Logger(TransactionEventProcessor.name);

    constructor(private readonly transactionService: TransactionService) {}

    async handleTxMined(payload: unknown): Promise<void> {
        const event = txMinedEventSchema.parse(payload);
        await this.transactionService.applyTxMined(event.transactionId, event.contractAddress as EvmAddress);
        this.logger.log(`Applied tx.mined for ${event.transactionId}`);
    }

    async handleTxFailed(payload: unknown): Promise<void> {
        const event = txFailedEventSchema.parse(payload);
        await this.transactionService.applyTxFailed(event.transactionId);
        this.logger.log(`Applied tx.failed for ${event.transactionId} (${event.reason})`);
    }

    async handleTxConfirmed(payload: unknown): Promise<void> {
        const event = txConfirmedEventSchema.parse(payload);
        if (event.outcome === 'fulfilled') {
            await this.transactionService.applyTxConfirmedSuccess(event.transactionId);
        } else {
            await this.transactionService.applyTxFailed(event.transactionId);
        }
        this.logger.log(`Applied tx.confirmed for ${event.transactionId} (${event.outcome})`);
    }
}

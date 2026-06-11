import {
    BadRequestException,
    ConflictException,
    Inject,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../../../../config/config.service';
import { KAFKA_TOPICS } from '../../../../messaging/domain/events/kafka-topics';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../../../messaging/domain/ports/event-publisher.port';
import { TransactionService } from '../../../application/transaction.service';
import { DeploymentRequestedConsumer } from './deployment-requested.consumer';

describe('DeploymentRequestedConsumer', () => {
    let consumer: DeploymentRequestedConsumer;
    let transactionService: jest.Mocked<Pick<TransactionService, 'broadcastDeployment'>>;
    let eventPublisher: jest.Mocked<EventPublisherPort>;

    const event = {
        transactionId: '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4c',
        consumerAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        amount: '100.50',
        occurredAt: new Date().toISOString(),
    };

    beforeEach(async () => {
        transactionService = { broadcastDeployment: jest.fn() };
        eventPublisher = { publish: jest.fn(), publishDeadLetter: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeploymentRequestedConsumer,
                {
                    provide: AppConfigService,
                    useValue: { messaging: { receiptCheckDelayMs: 3_000 } },
                },
                { provide: TransactionService, useValue: transactionService },
                { provide: EVENT_PUBLISHER, useValue: eventPublisher },
            ],
        }).compile();

        consumer = module.get(DeploymentRequestedConsumer);
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    it('publishes receipt check after successful broadcast', async () => {
        transactionService.broadcastDeployment.mockResolvedValue('0xabc123');

        await consumer.handle(event);

        expect(eventPublisher.publish).toHaveBeenCalledWith(
            KAFKA_TOPICS.RECEIPT_CHECK,
            event.transactionId,
            expect.objectContaining({
                transactionId: event.transactionId,
                txHash: '0xabc123',
            }),
        );
        expect(eventPublisher.publish).not.toHaveBeenCalledWith(KAFKA_TOPICS.TX_FAILED, expect.anything(), expect.anything());
    });

    it('skips idempotently when broadcast is not applicable', async () => {
        transactionService.broadcastDeployment.mockRejectedValue(
            new BadRequestException('cannot broadcast from status FUNDED'),
        );

        await consumer.handle(event);

        expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('rethrows evm unavailable for kafka retry', async () => {
        transactionService.broadcastDeployment.mockRejectedValue(new ServiceUnavailableException('EVM down'));

        await expect(consumer.handle(event)).rejects.toThrow(ServiceUnavailableException);
        expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('rethrows conflict for kafka retry', async () => {
        transactionService.broadcastDeployment.mockRejectedValue(new ConflictException('in progress'));

        await expect(consumer.handle(event)).rejects.toThrow(ConflictException);
    });

    it('publishes tx.failed only for deployment errors', async () => {
        transactionService.broadcastDeployment.mockRejectedValue(new Error('rpc failed'));

        await consumer.handle(event);

        expect(eventPublisher.publish).toHaveBeenCalledWith(
            KAFKA_TOPICS.TX_FAILED,
            event.transactionId,
            expect.objectContaining({ reason: 'deployment_error' }),
        );
    });

    it('does not publish tx.failed when receipt check publish fails', async () => {
        transactionService.broadcastDeployment.mockResolvedValue('0xabc123');
        eventPublisher.publish.mockRejectedValue(new Error('kafka down'));

        await expect(consumer.handle(event)).rejects.toThrow('kafka down');
        expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
        expect(eventPublisher.publish).not.toHaveBeenCalledWith(KAFKA_TOPICS.TX_FAILED, expect.anything(), expect.anything());
    });
});

import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionService } from './application/transaction.service';
import { TransactionEventProcessor } from './application/transaction-event.processor';
import { TRANSACTION_REPOSITORY } from './domain/ports/transaction.repository.port';
import { TRANSACTOR_PORT } from './domain/ports/transactor.port';
import { TransactionController } from './adapters/inbound/http/transaction.controller';
import { DeploymentRequestedConsumer } from './adapters/inbound/messaging/deployment-requested.consumer';
import { ReceiptCheckConsumer } from './adapters/inbound/messaging/receipt-check.consumer';
import { SettlementCheckConsumer } from './adapters/inbound/messaging/settlement-check.consumer';
import {
    TxConfirmedConsumer,
    TxFailedConsumer,
    TxMinedConsumer,
} from './adapters/inbound/messaging/transaction-event.consumers';
import {
    CreateTransactionV1Formatter,
    TransactionResponseV1Formatter,
} from './adapters/inbound/http/formatters/v1/transaction.v1.formatter';
import { TransactionRepository } from './adapters/outbound/persistence/transaction.repository';
import { ViemTransactorAdapter } from './adapters/outbound/blockchain/viem-transactor.adapter';

@Module({
    imports: [PrismaModule, MessagingModule],
    controllers: [TransactionController],
    providers: [
        TransactionService,
        TransactionEventProcessor,
        CreateTransactionV1Formatter,
        TransactionResponseV1Formatter,
        ViemTransactorAdapter,
        DeploymentRequestedConsumer,
        ReceiptCheckConsumer,
        SettlementCheckConsumer,
        TxMinedConsumer,
        TxFailedConsumer,
        TxConfirmedConsumer,
        {
            provide: TRANSACTION_REPOSITORY,
            useClass: TransactionRepository,
        },
        {
            provide: TRANSACTOR_PORT,
            useExisting: ViemTransactorAdapter,
        },
    ],
})
export class TransactionModule {}

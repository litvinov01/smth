import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionService } from './application/transaction.service';
import { TRANSACTION_REPOSITORY } from './domain/ports/transaction.repository.port';
import { TRANSACTOR_PORT } from './domain/ports/transactor.port';
import { TransactionController } from './adapters/inbound/http/transaction.controller';
import { ChainSyncListener } from './adapters/inbound/chain/chain-sync.listener';
import {
    CreateTransactionV1Formatter,
    TransactionResponseV1Formatter,
} from './adapters/inbound/http/formatters/v1/transaction.v1.formatter';
import { PrismaTransactionRepository } from './adapters/outbound/persistence/prisma-transaction.repository';
import { ViemTransactorAdapter } from './adapters/outbound/blockchain/viem-transactor.adapter';

@Module({
    imports: [PrismaModule],
    controllers: [TransactionController],
    providers: [
        TransactionService,
        CreateTransactionV1Formatter,
        TransactionResponseV1Formatter,
        ViemTransactorAdapter,
        ChainSyncListener,
        {
            provide: TRANSACTION_REPOSITORY,
            useClass: PrismaTransactionRepository,
        },
        {
            provide: TRANSACTOR_PORT,
            useExisting: ViemTransactorAdapter,
        },
    ],
})
export class TransactionModule {}

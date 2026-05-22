import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionService } from './application/transaction.service';
import { TRANSACTION_REPOSITORY } from './domain/ports/transaction.repository.port';
import { TransactionController } from './adapters/inbound/http/transaction.controller';
import {
  CreateTransactionV1Formatter,
  TransactionResponseV1Formatter,
} from './adapters/inbound/http/formatters/v1/transaction.v1.formatter';
import { PrismaTransactionRepository } from './adapters/outbound/persistence/prisma-transaction.repository';

@Module({
  imports: [PrismaModule],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    CreateTransactionV1Formatter,
    TransactionResponseV1Formatter,
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: PrismaTransactionRepository,
    },
  ],
})
export class TransactionModule {}

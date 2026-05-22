import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  CreateTransactionCommand,
  Transaction,
} from '../../../domain/transaction.entity';
import { INITIAL_TRANSACTION_STATUS } from '../../../domain/transaction-status';
import { TransactionRepositoryPort } from '../../../domain/ports/transaction.repository.port';

@Injectable()
export class PrismaTransactionRepository implements TransactionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    command: CreateTransactionCommand,
    id: string,
  ): Promise<Transaction> {
    await this.prisma.user.upsert({
      where: { id: command.userId },
      create: { id: command.userId },
      update: {},
    });

    const record = await this.prisma.transaction.create({
      data: {
        id,
        currency: command.currency,
        status: INITIAL_TRANSACTION_STATUS,
        amount: new Prisma.Decimal(command.amount),
        userId: command.userId,
      },
      include: { user: true },
    });

    return this.toDomain(record);
  }

  async findById(id: string): Promise<Transaction | null> {
    const record = await this.prisma.transaction.findUnique({
      where: { id },
      include: { user: true },
    });

    return record ? this.toDomain(record) : null;
  }

  private toDomain(record: {
    id: string;
    currency: string;
    status: string;
    amount: Prisma.Decimal;
    createdAt: Date;
    user: { id: string };
  }): Transaction {
    return {
      id: record.id,
      currency: record.currency,
      status: record.status as Transaction['status'],
      amount: record.amount.toString(),
      createdAt: record.createdAt,
      user: { id: record.user.id },
    };
  }
}

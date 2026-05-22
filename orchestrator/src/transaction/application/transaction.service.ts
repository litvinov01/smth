import { createHash, randomUUID } from 'crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateTransactionCommand,
  Transaction,
} from '../domain/transaction.entity';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepositoryPort,
} from '../domain/ports/transaction.repository.port';

@Injectable()
export class TransactionService {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepositoryPort,
  ) {}

  async create(command: CreateTransactionCommand): Promise<Transaction> {
    const id = this.generateMd5Id();
    return this.transactionRepository.create(
      {
        ...command,
        currency: command.currency.toUpperCase(),
      },
      id,
    );
  }

  async getById(id: string): Promise<Transaction> {
    const normalizedId = id.trim().toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(normalizedId)) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    const transaction = await this.transactionRepository.findById(normalizedId);
    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    return transaction;
  }

  private generateMd5Id(): string {
    return createHash('md5').update(randomUUID()).digest('hex');
  }
}

import { CreateTransactionCommand, Transaction } from '../transaction.entity';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionRepositoryPort {
  create(command: CreateTransactionCommand, id: string): Promise<Transaction>;
  findById(id: string): Promise<Transaction | null>;
}

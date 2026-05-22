import { TransactionStatus } from './transaction-status';

export interface TransactionUser {
  id: string;
}

export interface Transaction {
  id: string;
  currency: string;
  status: TransactionStatus;
  amount: string;
  createdAt: Date;
  user: TransactionUser;
}

export interface CreateTransactionCommand {
  currency: string;
  amount: string;
  userId: string;
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { V1ResponseFormatter } from '../../../../../../shared/http/v1';
import {
  CreateTransactionCommand,
  Transaction,
} from '../../../../../domain/transaction.entity';

const MD5_PATTERN = /^[a-f0-9]{32}$/;
const ISO_CURRENCY_PATTERN = /^[A-Z]{3}$/;

export interface CreateTransactionV1Body {
  currency?: unknown;
  amount?: unknown;
  user?: { id?: unknown };
}

export interface TransactionV1Response {
  id: string;
  currency: string;
  status: string;
  amount: string;
  created_at: string;
  user: { id: string };
}

@Injectable()
export class CreateTransactionV1Formatter {
  parse(body: CreateTransactionV1Body): CreateTransactionCommand {
    return {
      currency: parseCurrency(body.currency),
      amount: parseAmount(body.amount),
      userId: parseUserId(body.user?.id),
    };
  }
}

@Injectable()
export class TransactionResponseV1Formatter
  implements V1ResponseFormatter<Transaction, TransactionV1Response>
{
  format(transaction: Transaction): TransactionV1Response {
    return {
      id: transaction.id,
      currency: transaction.currency,
      status: transaction.status,
      amount: transaction.amount,
      created_at: transaction.createdAt.toISOString(),
      user: { id: transaction.user.id },
    };
  }
}

function parseCurrency(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('currency must be a string');
  }
  const normalized = value.trim().toUpperCase();
  if (!ISO_CURRENCY_PATTERN.test(normalized)) {
    throw new BadRequestException(
      'currency must be a 3-letter ISO 4217 code (e.g. EUR)',
    );
  }
  return normalized;
}

function parseAmount(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }
    return value.toString();
  }
  if (typeof value !== 'string') {
    throw new BadRequestException('amount must be a number or string');
  }
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed) || Number(trimmed) <= 0) {
    throw new BadRequestException('amount must be a positive decimal');
  }
  return trimmed;
}

function parseUserId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('user.id must be a string');
  }
  const normalized = value.trim().toLowerCase();
  if (!MD5_PATTERN.test(normalized)) {
    throw new BadRequestException(
      'user.id must be a 32-character md5 hex string',
    );
  }
  return normalized;
}

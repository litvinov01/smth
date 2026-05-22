import { Body, Get, Param, Post } from '@nestjs/common';
import { V1 } from '../../../../shared/http/v1';
import { TransactionService } from '../../../application/transaction.service';
import {
  CreateTransactionV1Body,
  CreateTransactionV1Formatter,
  TransactionResponseV1Formatter,
} from './formatters/v1/transaction.v1.formatter';

@V1('transactions', TransactionResponseV1Formatter)
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly createTransactionV1Formatter: CreateTransactionV1Formatter,
  ) {}

  @Post()
  create(@Body() body: CreateTransactionV1Body) {
    const command = this.createTransactionV1Formatter.parse(body);
    return this.transactionService.create(command);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.transactionService.getById(id);
  }
}

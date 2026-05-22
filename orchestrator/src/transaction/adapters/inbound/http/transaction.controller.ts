import { Body, Get, Param, Post } from '@nestjs/common';
import { V1Controller } from '../../../../shared/http/v1';
import { TransactionService } from '../../../application/transaction.service';
import { CreateTransactionV1Dto, TransactionIdParamDto } from './formatters/v1/transaction.v1.dto';
import { CreateTransactionV1Formatter, TransactionResponseV1Formatter } from './formatters/v1/transaction.v1.formatter';
import {
    CreateTransactionDocs,
    GetTransactionDocs,
    SubmitTransactionDocs,
    TransactionControllerDocs,
} from './docs/transaction.docs';

@TransactionControllerDocs
@V1Controller('transactions', TransactionResponseV1Formatter)
export class TransactionController {
    constructor(
        private readonly transactionService: TransactionService,
        private readonly createTransactionV1Formatter: CreateTransactionV1Formatter,
    ) {}

    @CreateTransactionDocs
    @Post()
    create(@Body() body: CreateTransactionV1Dto) {
        const command = this.createTransactionV1Formatter.parse(body);
        return this.transactionService.create(command);
    }

    @SubmitTransactionDocs
    @Post(':id/submit')
    submit(@Param() params: TransactionIdParamDto) {
        return this.transactionService.submit(params.id);
    }

    @GetTransactionDocs
    @Get(':id')
    getById(@Param() params: TransactionIdParamDto) {
        return this.transactionService.getById(params.id);
    }
}

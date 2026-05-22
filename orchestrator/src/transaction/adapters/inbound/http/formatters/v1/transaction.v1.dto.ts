import { createZodDto } from 'nestjs-zod';
import {
    createTransactionV1Schema,
    transactionIdParamSchema,
    transactionV1ResponseSchema,
} from './transaction.v1.schema';

export class CreateTransactionV1Dto extends createZodDto(createTransactionV1Schema) {}

export class TransactionIdParamDto extends createZodDto(transactionIdParamSchema) {}

export class TransactionV1ResponseDto extends createZodDto(transactionV1ResponseSchema) {}

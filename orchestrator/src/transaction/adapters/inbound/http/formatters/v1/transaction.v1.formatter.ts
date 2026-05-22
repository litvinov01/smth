import { Injectable } from '@nestjs/common';
import { V1ResponseFormatter } from '../../../../../../shared/http/v1';
import { CreateTransactionCommand, EvmAddress, Transaction } from '../../../../../domain/transaction.entity';
import { CreateTransactionV1Input } from './transaction.v1.schema';

export interface TransactionV1Response {
    id: string;
    currency: string;
    status: string;
    amount: string;
    created_at: string;
    user: { id: string };
    consumer_address: string | null;
    contract_address: string | null;
    tx_hash: string | null;
}

@Injectable()
export class CreateTransactionV1Formatter {
    parse(body: CreateTransactionV1Input): CreateTransactionCommand {
        return {
            currency: body.currency,
            amount: body.amount,
            userId: body.user.id,
            consumerAddress: body.consumer?.address as EvmAddress | undefined,
        };
    }
}

@Injectable()
export class TransactionResponseV1Formatter implements V1ResponseFormatter<Transaction, TransactionV1Response> {
    format(transaction: Transaction): TransactionV1Response {
        return {
            id: transaction.id,
            currency: transaction.currency,
            status: transaction.status,
            amount: transaction.amount,
            created_at: transaction.createdAt.toISOString(),
            user: { id: transaction.user.id },
            consumer_address: transaction.consumerAddress,
            contract_address: transaction.contractAddress,
            tx_hash: transaction.txHash,
        };
    }
}

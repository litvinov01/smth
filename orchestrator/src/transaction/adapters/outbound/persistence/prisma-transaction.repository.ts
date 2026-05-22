import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateTransactionCommand, EvmAddress, Transaction, UpdateTransactionPatch } from '../../../domain/transaction.entity';
import { INITIAL_TRANSACTION_STATUS, parseTransactionStatus } from '../../../domain/transaction-status';
import { TransactionStatus } from '../../../domain/transaction-status';
import { TransactionRepositoryPort } from '../../../domain/ports/transaction.repository.port';

@Injectable()
export class PrismaTransactionRepository implements TransactionRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async create(command: CreateTransactionCommand, id: string): Promise<Transaction> {
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
                consumerAddress: normalizeOptionalAddress(command.consumerAddress),
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

    async findByContractAddress(address: string): Promise<Transaction | null> {
        const record = await this.prisma.transaction.findFirst({
            where: { contractAddress: address.toLowerCase() },
            include: { user: true },
        });

        return record ? this.toDomain(record) : null;
    }

    async findByStatus(statuses: TransactionStatus[]): Promise<Transaction[]> {
        const records = await this.prisma.transaction.findMany({
            where: { status: { in: statuses } },
            include: { user: true },
        });

        return records.map((record) => this.toDomain(record));
    }

    async update(id: string, patch: UpdateTransactionPatch): Promise<Transaction> {
        const record = await this.prisma.transaction.update({
            where: { id },
            data: {
                ...(patch.status !== undefined ? { status: patch.status } : {}),
                ...(patch.contractAddress !== undefined
                    ? { contractAddress: normalizeOptionalAddress(patch.contractAddress) }
                    : {}),
                ...(patch.txHash !== undefined ? { txHash: patch.txHash } : {}),
            },
            include: { user: true },
        });

        return this.toDomain(record);
    }

    private toDomain(record: {
        id: string;
        currency: string;
        status: string;
        amount: Prisma.Decimal;
        createdAt: Date;
        consumerAddress: string | null;
        contractAddress: string | null;
        txHash: string | null;
        user: { id: string };
    }): Transaction {
        return {
            id: record.id,
            currency: record.currency,
            status: parseTransactionStatus(record.status),
            amount: record.amount.toString(),
            createdAt: record.createdAt,
            user: { id: record.user.id },
            consumerAddress: record.consumerAddress as Transaction['consumerAddress'],
            contractAddress: record.contractAddress as Transaction['contractAddress'],
            txHash: record.txHash as Transaction['txHash'],
        };
    }
}

function normalizeOptionalAddress(address: EvmAddress | null | undefined): string | null {
    return address ? address.toLowerCase() : null;
}

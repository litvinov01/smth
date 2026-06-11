import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
    CreateTransactionCommand,
    EvmAddress,
    EvmTxHash,
    Transaction,
    UpdateTransactionPatch,
} from '../../../domain/transaction.entity';
import {
    INITIAL_TRANSACTION_STATUS,
    parseTransactionStatus,
    TRANSACTION_STATUS,
} from '../../../domain/transaction-status';
import { TransactionStatus } from '../../../domain/transaction-status';
import { TransactionRepositoryPort } from '../../../domain/ports/transaction.repository.port';

type TransactionRow = {
    id: string;
    currency: string;
    status: string;
    amount: Prisma.Decimal;
    createdAt: Date;
    userId: string;
    consumerAddress: string | null;
    contractAddress: string | null;
    txHash: string | null;
    deploymentClaimedAt?: Date | null;
    user?: { id: string };
};

type NewTransactionRow = {
    currency: string;
    status: typeof INITIAL_TRANSACTION_STATUS;
    amount: Prisma.Decimal;
    userId: string;
    consumerAddress: string | null;
};

@Injectable()
export class TransactionRepository implements TransactionRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async create(command: CreateTransactionCommand): Promise<Transaction> {
        await this.prisma.user.upsert({
            where: { id: command.userId },
            create: { id: command.userId },
            update: {},
        });

        const data: NewTransactionRow = {
            currency: command.currency,
            status: INITIAL_TRANSACTION_STATUS,
            amount: new Prisma.Decimal(command.amount),
            userId: command.userId,
            consumerAddress: normalizeOptionalAddress(command.consumerAddress),
        };

        const record = await this.prisma.transaction.create({
            data: data as Prisma.TransactionUncheckedCreateInput,
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

    async claimDeploymentBroadcast(id: string, claimTxHash: EvmTxHash): Promise<boolean> {
        const result = await this.prisma.transaction.updateMany({
            where: { id, status: TRANSACTION_STATUS.CREATED, txHash: null },
            data: {
                txHash: claimTxHash,
                deploymentClaimedAt: new Date(),
            } as Prisma.TransactionUpdateManyMutationInput,
        });

        return result.count === 1;
    }

    async finalizeDeploymentBroadcast(
        id: string,
        claimTxHash: EvmTxHash,
        txHash: EvmTxHash,
    ): Promise<Transaction | null> {
        const result = await this.prisma.transaction.updateMany({
            where: { id, status: TRANSACTION_STATUS.CREATED, txHash: claimTxHash },
            data: {
                status: TRANSACTION_STATUS.PENDING,
                txHash,
                deploymentClaimedAt: null,
            } as Prisma.TransactionUpdateManyMutationInput,
        });

        if (result.count === 0) {
            return null;
        }

        return this.findById(id);
    }

    async releaseDeploymentBroadcastClaim(id: string, claimTxHash: EvmTxHash): Promise<void> {
        await this.prisma.transaction.updateMany({
            where: { id, status: TRANSACTION_STATUS.CREATED, txHash: claimTxHash },
            data: { txHash: null, deploymentClaimedAt: null } as Prisma.TransactionUpdateManyMutationInput,
        });
    }

    private toDomain(record: TransactionRow): Transaction {
        return {
            id: record.id,
            currency: record.currency,
            status: parseTransactionStatus(record.status),
            amount: record.amount.toString(),
            createdAt: record.createdAt,
            user: { id: record.user?.id ?? record.userId },
            consumerAddress: record.consumerAddress as Transaction['consumerAddress'],
            contractAddress: record.contractAddress as Transaction['contractAddress'],
            txHash: record.txHash as Transaction['txHash'],
            deploymentClaimedAt: record.deploymentClaimedAt ?? null,
        };
    }
}

function normalizeOptionalAddress(address: EvmAddress | null | undefined): string | null {
    return address ? address.toLowerCase() : null;
}

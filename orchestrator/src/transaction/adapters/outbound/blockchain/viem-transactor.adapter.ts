import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../../../../config/config.service';
import {
    DeployTransactorResult,
    DeploymentReceipt,
    TransactorPort,
    TransactorSettlementEvent,
} from '../../../domain/ports/transactor.port';
import { EvmAddress, EvmTxHash } from '../../../domain/transaction.entity';
import { getTransactorAbi } from './transactor.abi';

/** Minimal viem client surface — avoids deep generic instantiation from viem types. */
interface ViemClients {
    chain: { id: number; name: string };
    account: { address: EvmAddress };
    abi: readonly unknown[];
    wallet: {
        deployContract(args: Record<string, unknown>): Promise<EvmTxHash>;
        writeContract(args: Record<string, unknown>): Promise<EvmTxHash>;
    };
    publicClient: {
        getBlockNumber(): Promise<bigint>;
        getTransactionReceipt(args: { hash: EvmTxHash }): Promise<{
            status: 'success' | 'reverted';
            contractAddress?: EvmAddress;
            blockNumber: bigint;
        } | null>;
        getContractEvents(args: Record<string, unknown>): Promise<Array<{ eventName?: string }>>;
    };
}

@Injectable()
export class ViemTransactorAdapter implements TransactorPort {
    private clients: ViemClients | null = null;

    constructor(private readonly appConfig: AppConfigService) {}

    async deploy(consumer: EvmAddress, amount: bigint): Promise<DeployTransactorResult> {
        const { wallet, chain, account, abi } = await this.getClients();
        const txHash = await wallet.deployContract({
            chain,
            account,
            abi,
            bytecode: this.appConfig.evm.bytecode!,
            args: [consumer, amount],
            value: amount,
        });

        return { txHash };
    }

    async fulfill(contractAddress: EvmAddress): Promise<EvmTxHash> {
        const { wallet, chain, account, abi } = await this.getClients();
        return wallet.writeContract({
            chain,
            account,
            address: contractAddress,
            abi,
            functionName: 'fulfill',
        });
    }

    async cancel(contractAddress: EvmAddress): Promise<EvmTxHash> {
        const { wallet, chain, account, abi } = await this.getClients();
        return wallet.writeContract({
            chain,
            account,
            address: contractAddress,
            abi,
            functionName: 'cancel',
        });
    }

    async getDeploymentReceipt(txHash: EvmTxHash): Promise<DeploymentReceipt | null> {
        const receipt = await (await this.getClients()).publicClient.getTransactionReceipt({ hash: txHash });
        if (!receipt) {
            return null;
        }

        return {
            status: receipt.status,
            contractAddress: receipt.contractAddress,
            blockNumber: receipt.blockNumber,
        };
    }

    async getSettlementEvents(
        contractAddress: EvmAddress,
        fromBlock: bigint,
        toBlock?: bigint,
    ): Promise<TransactorSettlementEvent[]> {
        const { publicClient, abi } = await this.getClients();
        const logs = await publicClient.getContractEvents({
            address: contractAddress,
            abi,
            fromBlock,
            ...(toBlock !== undefined ? { toBlock } : {}),
            strict: true,
        });

        return logs
            .map((log) => log.eventName)
            .filter((eventName): eventName is 'Fulfilled' | 'Cancelled' =>
                eventName === 'Fulfilled' || eventName === 'Cancelled',
            )
            .map((eventName) => (eventName === 'Fulfilled' ? 'fulfilled' : 'cancelled'));
    }

    async getBlockNumber(): Promise<bigint> {
        return (await this.getClients()).publicClient.getBlockNumber();
    }

    private async getClients(): Promise<ViemClients> {
        if (!this.appConfig.evm.enabled) {
            throw new ServiceUnavailableException(
                'EVM is not configured (set EVM_RPC_URL, ORCHESTRATOR_PRIVATE_KEY, TRANSACTOR_BYTECODE)',
            );
        }

        if (!this.clients) {
            this.clients = await createViemClients(this.appConfig);
        }

        return this.clients;
    }
}

async function createViemClients(appConfig: AppConfigService): Promise<ViemClients> {
    const evm = appConfig.evm;
    const { createPublicClient, createWalletClient, http } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { anvil } = await import('viem/chains');
    const abi = await getTransactorAbi();

    const chain = evm.chainId === anvil.id ? anvil : { ...anvil, id: evm.chainId, name: `evm-${evm.chainId}` };

    const transport = http(evm.rpcUrl!);
    const account = privateKeyToAccount(evm.privateKey!);

    return {
        chain,
        account,
        abi,
        wallet: createWalletClient({
            account,
            chain,
            transport,
        }) as ViemClients['wallet'],
        publicClient: createPublicClient({
            chain,
            transport,
        }) as ViemClients['publicClient'],
    };
}

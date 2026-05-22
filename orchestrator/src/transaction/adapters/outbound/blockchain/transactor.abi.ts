let cachedAbi: readonly unknown[] | null = null;

export async function getTransactorAbi(): Promise<readonly unknown[]> {
    if (!cachedAbi) {
        const { parseAbi } = await import('viem');
        cachedAbi = parseAbi([
            'constructor(address consumer, uint256 amount)',
            'function fulfill()',
            'function cancel()',
            'event Funded(address indexed from, uint256 amount)',
            'event Fulfilled(address indexed consumer, uint256 amount)',
            'event Cancelled(address indexed emitent, uint256 refunded)',
        ]);
    }

    return cachedAbi;
}

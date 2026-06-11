import { BadRequestException } from '@nestjs/common';
import { ON_CHAIN_AMOUNT_DECIMALS } from '../../shared/validation/fields.schema';

export function toOnChainAmount(amount: string): bigint {
    const [whole, fraction = ''] = amount.split('.');
    if (fraction.length > ON_CHAIN_AMOUNT_DECIMALS) {
        throw new BadRequestException(
            `amount must have at most ${ON_CHAIN_AMOUNT_DECIMALS} decimal places for on-chain conversion`,
        );
    }

    const paddedFraction = `${fraction}${'0'.repeat(ON_CHAIN_AMOUNT_DECIMALS)}`.slice(0, ON_CHAIN_AMOUNT_DECIMALS);
    return BigInt(`${whole}${paddedFraction}`);
}

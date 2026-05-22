# On-chain contracts

Solidity contracts for the digital-fiat exchange (blockchain VM). The orchestrator coordinates off-chain state; these contracts handle on-chain settlement.

| Contract | File | Solidity | Purpose |
|----------|------|----------|---------|
| Transactor | [Transactor.sol](./Transactor.sol) | `^0.8.20` | Escrow between emitent and consumer |

## Transactor

Single deployment = one settlement. The **emitent** (deployer) funds the contract; the **consumer** either partially credits the emitent or fulfills the remainder.

### Lifecycle

```
emitent deploys + funds → [open] → partialCredit* → fulfill → closed
                              └→ cancel (emitent) → closed
```

### API

| Function | Caller | Description |
|----------|--------|-------------|
| `constructor(consumer, amount)` | emitent | Sets parties and expected `remainingAmount`; optional `msg.value` |
| `deposit()` | emitent | Adds ETH while open |
| `partialCredit(amount)` | consumer | Sends `amount` to emitent; reduces `remainingAmount` |
| `fulfill()` | consumer | Sends `remainingAmount` to consumer; refunds surplus to emitent |
| `cancel()` | emitent | Refunds full balance to emitent |

Only the emitent may fund (`receive`, `deposit`). Transfers use explicit `call` (no `selfdestruct`).

### Events

- `Funded(from, amount)`
- `PartiallyCredited(emitent, consumer, credited, remaining)`
- `Fulfilled(consumer, amount)`
- `Cancelled(emitent, refunded)`

### Integration with orchestrator

Map one orchestrator `Transaction` (md5 id, ISO currency, status) to one deployed `Transactor` instance (or a future factory). Amounts on-chain are `uint256` wei; align decimals and currency metadata off-chain.

### Local development

Add Hardhat or Foundry under `contracts/` when you are ready to compile and test. Not set up in this repo yet.

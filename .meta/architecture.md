# Hexagonal Architecture

Basic code design rule for this repository. All new bounded contexts (modules) follow this layout unless explicitly agreed otherwise.

## Principle

Business logic must not depend on HTTP, Prisma, or any infrastructure detail. Dependencies point **inward**: adapters implement ports defined by the domain/application layer.

```
         ┌─────────────────────────────────────┐
  HTTP   │  adapters/inbound (controllers,     │
 ───────►│  formatters)                        │
         │           │                         │
         │           ▼                         │
         │  application (services / use cases) │
         │           │                         │
         │           ▼                         │
         │  domain (entities, value objects,   │
         │          ports)                     │
         │           ▲                         │
         │           │                         │
         │  adapters/outbound (repositories,   │
         │  messaging, external APIs)          │
         └─────────────────────────────────────┘
```

## Module folder structure

Each bounded context lives under `orchestrator/src/<context>/`:

```
<context>/
├── domain/
│   ├── *.entity.ts          # core domain types
│   ├── *.enum.ts            # domain constants (status, etc.)
│   └── ports/               # interfaces (repository, gateways)
├── application/
│   └── *.service.ts         # business rules, orchestration
├── adapters/
│   ├── inbound/
│   │   └── http/
│   │       ├── *.controller.ts
│   │       └── formatters/
│   │           └── v1/      # API version input/output mapping
│   └── outbound/
│       └── persistence/
│           └── *.repository.ts
└── <context>.module.ts
```

## Layer rules

| Layer | Responsibility | Must not |
|-------|----------------|----------|
| **Domain** | Entities, invariants, port interfaces | Import NestJS, Prisma, HTTP types |
| **Application** | Use cases, state transitions, ID generation | Parse raw HTTP bodies, use Prisma directly |
| **Inbound adapters** | Routes, V1 formatters (validate + map DTO ↔ command) | Contain business rules |
| **Outbound adapters** | Persist/load domain objects via ports | Expose Prisma models to controllers |

## API versioning

- Use `@V1('<resource>', <ResponseFormatter>)` on controllers under `adapters/inbound/http/`.
- The decorator sets the route prefix to `v1/<resource>` and attaches `V1ResponseInterceptor`, which formats every handler return value via the given formatter.
- Input parsing stays in dedicated V1 formatters (e.g. `CreateTransactionV1Formatter.parse()`); controllers return domain objects from the application layer.
- Shared infrastructure lives in `orchestrator/src/shared/http/v1/`.

```typescript
@V1('transactions', TransactionResponseV1Formatter)
export class TransactionController {
  @Post()
  create(@Body() body: CreateTransactionV1Body) {
    const command = this.createTransactionV1Formatter.parse(body);
    return this.transactionService.create(command); // auto-formatted
  }
}
```

## Naming

- Port: `TransactionRepositoryPort` (interface in `domain/ports/`)
- Adapter: `TransactionRepository` (implements port)
- Formatter: `CreateTransactionV1Formatter`, `TransactionResponseV1Formatter`
- Service: `TransactionService` (application layer)

## Reference implementation

See [`orchestrator/src/transaction/`](../orchestrator/src/transaction/) — Create / Read module for transactions.

## See also

- [infra.md](./infra.md)
- [testing.md](./testing.md)

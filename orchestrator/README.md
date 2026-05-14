# Swap Orchestrator

Backend orchestrator for digital EUR swap system with SDK on Blockchain VM.

## Description

This is a NestJS application with Fastify adapter that provides the backend infrastructure for a swap system enabling digital EUR swaps to other digital currencies via smart contracts.

## Installation

```bash
npm install
```

## Running the app

```bash
# development
npm run start:dev

# production mode
npm run start:prod
```

## Database Configuration

The application uses PostgreSQL with Prisma ORM. Configure the database connection via the `DATABASE_URL` environment variable:

```
DATABASE_URL="postgresql://username:password@host:port/database?schema=public"
```

Example:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/swap_db?schema=public"
```

### Prisma Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

## Docker

Build and run with Docker:

```bash
docker build -t swap-orchestrator .
docker run -p 3000:3000 --env-file .env swap-orchestrator
```

## Project Structure

```
src/
├── prisma/           # Prisma service
│   └── prisma.service.ts
├── app.module.ts     # Root application module
├── app.controller.ts # Root controller
├── app.service.ts    # Root service
└── main.ts          # Application entry point
prisma/
└── schema.prisma     # Prisma schema file
```

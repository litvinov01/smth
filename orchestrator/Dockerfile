# syntax=docker/dockerfile:1

# Shared base: Node.js + OpenSSL (required by Prisma on Alpine)
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# Install all dependencies (cached layer shared by builder and test-runner)
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Compile application and generate Prisma client
FROM deps AS builder
COPY . .
RUN npx prisma generate && npm run build

# Production-only npm dependencies (no devDependencies)
FROM base AS production-deps
COPY package*.json ./
RUN npm ci --omit=dev && npm install --omit=dev --no-save prisma@^7

# Production runtime — slim image for deploy and docker compose
FROM production-deps AS production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]

# Application image for Testcontainers e2e/integration tests
FROM production AS test-app
ENV NODE_ENV=test

# Test runner — full dev toolchain, runs Jest e2e against containers
FROM builder AS test-runner
ENV NODE_ENV=test
CMD ["npm", "run", "test:e2e"]

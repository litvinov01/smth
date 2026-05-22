COMPOSE ?= docker compose
ORCHESTRATOR_DIR := orchestrator
DOCKERFILE := $(ORCHESTRATOR_DIR)/Dockerfile
IMAGE_NAME ?= swap-orchestrator
DOCKER_NETWORK ?= swap-net
TEST_INIT := .meta/skills/test-init/scripts/test-init.sh

.PHONY: help bootstrap up down build rebuild logs ps restart clean migrate db-shell
.PHONY: build-prod build-test-app build-test-runner build-images
.PHONY: test-init test test-unit test-e2e test-e2e-docker network-create prisma-generate

help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

bootstrap: ## First-time setup: env files, images, DB, migrations, services
	@test -f .env || cp .env.example .env
	@test -f $(ORCHESTRATOR_DIR)/.env || cp $(ORCHESTRATOR_DIR)/.example.env $(ORCHESTRATOR_DIR)/.env
	$(COMPOSE) build
	$(COMPOSE) up -d db
	@echo "Waiting for PostgreSQL..."
	@$(COMPOSE) exec -T db sh -c 'until pg_isready -U "$${POSTGRES_USER:-postgres}" -d "$${POSTGRES_DB:-swap_db}"; do sleep 1; done'
	$(MAKE) migrate
	$(COMPOSE) up -d orchestrator
	@echo "Bootstrap complete. API: http://localhost:$${ORCHESTRATOR_PORT:-3000}/api"

up: ## Start all services (detached)
	$(COMPOSE) up -d

down: ## Stop and remove containers
	$(COMPOSE) down

build: ## Build container images
	$(COMPOSE) build

rebuild: ## Rebuild images without cache and restart
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d

logs: ## Follow logs from all services
	$(COMPOSE) logs -f

ps: ## Show running services
	$(COMPOSE) ps

restart: ## Restart all services
	$(COMPOSE) restart

clean: ## Stop containers and remove volumes (destroys DB data)
	$(COMPOSE) down -v

migrate: ## Apply Prisma migrations against the running database
	$(COMPOSE) run --rm --entrypoint npx orchestrator prisma migrate deploy

db-shell: ## Open a psql session in the database container
	$(COMPOSE) exec db psql -U postgres -d swap_db

prisma-generate: ## Regenerate Prisma client from schema.prisma (fixes IDE/lint types)
	@chmod +x .meta/skills/prisma-generate/scripts/prisma-generate.sh
	@.meta/skills/prisma-generate/scripts/prisma-generate.sh

network-create: ## Create project Docker network if missing
	@docker network inspect $(DOCKER_NETWORK) >/dev/null 2>&1 \
		|| docker network create $(DOCKER_NETWORK)

build-prod: ## Build production runtime image
	docker build -f $(DOCKERFILE) --target production -t $(IMAGE_NAME):production $(ORCHESTRATOR_DIR)

build-test-app: ## Build application image for Testcontainers e2e
	docker build -f $(DOCKERFILE) --target test-app -t $(IMAGE_NAME):test-app $(ORCHESTRATOR_DIR)

build-test-runner: ## Build image that runs Jest e2e suite
	docker build -f $(DOCKERFILE) --target test-runner -t $(IMAGE_NAME):test-runner $(ORCHESTRATOR_DIR)

build-images: build-prod build-test-app build-test-runner ## Build all Docker targets

test-init: network-create ## Prepare test env: npm deps, Prisma client, test images
	@$(TEST_INIT)

test: test-unit ## Run unit tests (default test target)

test-unit: ## Run unit tests on host
	cd $(ORCHESTRATOR_DIR) && npm test

test-e2e: build-test-app build-test-runner ## Run e2e tests inside test-runner container (rebuilds app + runner images)
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock $(IMAGE_NAME):test-runner

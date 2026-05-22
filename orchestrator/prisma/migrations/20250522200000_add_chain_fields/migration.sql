-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "consumer_address" CHAR(42),
ADD COLUMN "contract_address" CHAR(42),
ADD COLUMN "tx_hash" CHAR(66);

-- CreateIndex
CREATE INDEX "transactions_contract_address_idx" ON "transactions"("contract_address");

-- CreateIndex
CREATE INDEX "transactions_tx_hash_idx" ON "transactions"("tx_hash");

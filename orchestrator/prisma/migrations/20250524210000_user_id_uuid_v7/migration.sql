-- AlterTable
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_user_id_fkey";

ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE UUID USING (
  (
    substr("id", 1, 8) || '-' ||
    substr("id", 9, 4) || '-' ||
    substr("id", 13, 4) || '-' ||
    substr("id", 17, 4) || '-' ||
    substr("id", 21, 12)
  )::uuid
);

ALTER TABLE "transactions" ALTER COLUMN "user_id" SET DATA TYPE UUID USING (
  (
    substr("user_id", 1, 8) || '-' ||
    substr("user_id", 9, 4) || '-' ||
    substr("user_id", 13, 4) || '-' ||
    substr("user_id", 17, 4) || '-' ||
    substr("user_id", 21, 12)
  )::uuid
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

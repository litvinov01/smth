-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "id" SET DATA TYPE UUID USING (
  (
    substr("id", 1, 8) || '-' ||
    substr("id", 9, 4) || '-' ||
    substr("id", 13, 4) || '-' ||
    substr("id", 17, 4) || '-' ||
    substr("id", 21, 12)
  )::uuid
);

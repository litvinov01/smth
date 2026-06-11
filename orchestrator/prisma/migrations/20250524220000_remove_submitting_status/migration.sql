-- Backfill: SUBMITTING was an internal handoff state, not a domain status.
UPDATE "transactions" SET "status" = 'CREATED' WHERE "status" = 'SUBMITTING';

-- P2-7 weekly digest (ADR 0008): User gains two additive columns.
-- digestOptIn is the explicit consent switch, default false: no account
-- ever receives email without flipping it first. digestLastSentAt is the
-- once per ISO week guard; the scheduler sets it only after a successful
-- send, and an empty digest skips without touching it. Nothing else
-- changes; no email body or subject is ever persisted.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "digestOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "digestLastSentAt" DATETIME;

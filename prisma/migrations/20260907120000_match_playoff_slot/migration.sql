-- CreateEnum
CREATE TYPE "MatchSlot" AS ENUM ('SF1', 'SF2', 'THIRD_PLACE', 'FINAL');

-- AlterTable
ALTER TABLE "match" ADD COLUMN     "slot" "MatchSlot";

-- CHECK constraint (Prisma 7 does not model these in the schema; `migrate diff`
-- does not introspect them, so they do not register as drift). Every playoff
-- match carries a bracket slot; every group match carries none. No playoff
-- `Match` row exists yet, so nothing needs backfilling.
ALTER TABLE "match" ADD CONSTRAINT "match_slot_stage_check" CHECK (("stage" = 'GROUP') = ("slot" IS NULL));

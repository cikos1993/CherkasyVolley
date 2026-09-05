-- AlterTable
ALTER TABLE "group_slot" ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "group_slot_entryId_idx" ON "group_slot"("entryId");

-- CreateIndex
CREATE INDEX "match_groupId_idx" ON "match"("groupId");

-- CreateIndex
CREATE INDEX "match_homeEntryId_idx" ON "match"("homeEntryId");

-- CreateIndex
CREATE INDEX "match_awayEntryId_idx" ON "match"("awayEntryId");

-- CHECK constraints (Prisma 7 does not model these in the schema; `migrate diff`
-- does not introspect them, so they do not register as drift). Code-review
-- follow-up to the 20260905125839_group_stage_schema migration.
ALTER TABLE "match" ADD CONSTRAINT "match_group_entries_required_check" CHECK ("stage" != 'GROUP' OR ("homeEntryId" IS NOT NULL AND "awayEntryId" IS NOT NULL));
ALTER TABLE "set_score" ADD CONSTRAINT "set_score_set_no_check" CHECK ("setNo" BETWEEN 1 AND 5);

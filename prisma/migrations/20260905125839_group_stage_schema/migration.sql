-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('GROUP', 'SEMIFINAL', 'THIRD_PLACE', 'FINAL');

-- CreateTable
CREATE TABLE "group_slot" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stage" "MatchStage" NOT NULL DEFAULT 'GROUP',
    "groupId" TEXT,
    "homeEntryId" TEXT,
    "awayEntryId" TEXT,
    "venueText" TEXT,
    "scheduledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_score" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "setNo" INTEGER NOT NULL,
    "homePoints" INTEGER NOT NULL,
    "awayPoints" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "set_score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_slot_groupId_entryId_key" ON "group_slot"("groupId", "entryId");

-- CreateIndex
CREATE INDEX "match_tournamentId_stage_idx" ON "match"("tournamentId", "stage");

-- CreateIndex
CREATE INDEX "set_score_matchId_idx" ON "set_score"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "set_score_matchId_setNo_key" ON "set_score"("matchId", "setNo");

-- AddForeignKey
ALTER TABLE "group_slot" ADD CONSTRAINT "group_slot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_slot" ADD CONSTRAINT "group_slot_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "tournament_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_homeEntryId_fkey" FOREIGN KEY ("homeEntryId") REFERENCES "tournament_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_awayEntryId_fkey" FOREIGN KEY ("awayEntryId") REFERENCES "tournament_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_score" ADD CONSTRAINT "set_score_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraints (Prisma 7 does not model these in the schema; `migrate diff`
-- does not introspect them, so they do not register as drift).
ALTER TABLE "match" ADD CONSTRAINT "match_group_stage_check" CHECK (("stage" = 'GROUP' AND "groupId" IS NOT NULL) OR ("stage" != 'GROUP' AND "groupId" IS NULL));
ALTER TABLE "match" ADD CONSTRAINT "match_distinct_entries_check" CHECK ("homeEntryId" IS NULL OR "awayEntryId" IS NULL OR "homeEntryId" != "awayEntryId");
ALTER TABLE "set_score" ADD CONSTRAINT "set_score_points_check" CHECK ("homePoints" >= 0 AND "awayPoints" >= 0);

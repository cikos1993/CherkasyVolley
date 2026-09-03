-- DropIndex
DROP INDEX "tournament_discipline_state_idx";

-- AlterTable
ALTER TABLE "player" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "team" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "tournament" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "tournament_entry" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "tournament_discipline_state_year_idx" ON "tournament"("discipline", "state", "year");

-- CHECK constraints (Prisma 7 does not model these in the schema; `migrate diff`
-- does not introspect them, so they do not register as drift).
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_year_check" CHECK ("year" BETWEEN 2000 AND 2100);
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_team_count_check" CHECK ("teamCount" > 0);
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_rounds_check" CHECK ("rounds" > 0);

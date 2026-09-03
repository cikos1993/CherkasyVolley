-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('CLASSIC', 'BEACH');

-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('CHAMPIONSHIP', 'VETERAN', 'WOMEN', 'YOUTH');

-- CreateEnum
CREATE TYPE "TournamentState" AS ENUM ('DRAFT', 'GROUP_STAGE', 'PLAYOFF', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ScoringPreset" AS ENUM ('CLASSIC', 'CUSTOM');

-- CreateTable
CREATE TABLE "tournament" (
    "id" TEXT NOT NULL,
    "discipline" "Discipline" NOT NULL,
    "type" "TournamentType" NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "state" "TournamentState" NOT NULL DEFAULT 'DRAFT',
    "scoringPreset" "ScoringPreset" NOT NULL,
    "teamCount" INTEGER NOT NULL,
    "rounds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_entry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthDate" TEXT,
    "birthPlace" TEXT,
    "sportRank" TEXT,
    "position" TEXT,
    "height" TEXT,
    "weight" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_discipline_state_idx" ON "tournament"("discipline", "state");

-- CreateIndex
CREATE UNIQUE INDEX "team_name_key" ON "team"("name");

-- CreateIndex
CREATE INDEX "tournament_entry_teamId_idx" ON "tournament_entry"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_entry_tournamentId_teamId_key" ON "tournament_entry"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "player_entryId_idx" ON "player"("entryId");

-- AddForeignKey
ALTER TABLE "tournament_entry" ADD CONSTRAINT "tournament_entry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_entry" ADD CONSTRAINT "tournament_entry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "tournament_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

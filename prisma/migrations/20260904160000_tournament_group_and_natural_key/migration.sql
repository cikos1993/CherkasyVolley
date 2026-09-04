-- CreateTable
CREATE TABLE "group" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_tournamentId_key" ON "group"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_discipline_type_year_name_key" ON "tournament"("discipline", "type", "year", "name");

-- AddForeignKey
ALTER TABLE "group" ADD CONSTRAINT "group_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

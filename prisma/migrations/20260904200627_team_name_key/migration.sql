-- DropIndex
DROP INDEX "team_name_key";

-- AlterTable
ALTER TABLE "team" ADD COLUMN     "nameKey" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "team_nameKey_key" ON "team"("nameKey");

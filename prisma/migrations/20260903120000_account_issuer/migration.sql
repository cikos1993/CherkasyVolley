-- Better Auth 1.7 writes account.issuer and keys accounts on (issuer, accountId).
-- The @better-auth/cli that generated the previous migration was behind the runtime.
ALTER TABLE "account" ADD COLUMN "issuer" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");

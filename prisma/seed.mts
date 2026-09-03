import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: [".env.local", ".env"] });

const email = process.env.SEED_ADMIN_EMAIL?.trim();
if (!email) {
  console.error("SEED_ADMIN_EMAIL is not set — cannot seed the first admin.");
  process.exit(1);
}

const connectionString =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { isAdmin: true },
    create: { email, isAdmin: true },
  });
  console.log(
    existing
      ? `Admin already present: ${user.email} (isAdmin ensured true)`
      : `Admin created: ${user.email}`,
  );
} finally {
  await prisma.$disconnect();
}

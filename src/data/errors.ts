import { Prisma } from "@/generated/prisma/client";

/**
 * True when a write failed because it would break a unique constraint (Prisma
 * P2002). Pass `indexName` to narrow to one specific constraint (its Postgres
 * index name, e.g. `"tournament_discipline_type_year_name_key"`) — otherwise a
 * P2002 from an unrelated constraint would match too and be misreported under
 * whatever message the caller has for a different one. With the
 * `@prisma/adapter-pg` driver adapter, the index name surfaces at
 * `error.meta.driverAdapterError.cause.constraint.index`, not the classic
 * `error.meta.target` — this checks both shapes.
 */
export function isUniqueViolation(error: unknown, indexName?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  if (!indexName) return true;

  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { index?: string } } };
      }
    | undefined;
  const target = meta?.target;
  if (Array.isArray(target) && target.includes(indexName)) return true;
  if (typeof target === "string" && target === indexName) return true;
  return meta?.driverAdapterError?.cause?.constraint?.index === indexName;
}

/**
 * True when a write failed because the target row no longer exists (Prisma
 * P2025) — a concurrent delete between the read and the write.
 */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/**
 * True when a delete failed because another row still references it (Prisma
 * P2003, a foreign-key `onDelete: Restrict` violation) — e.g. deleting a `Team`
 * that is still entered in a tournament.
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

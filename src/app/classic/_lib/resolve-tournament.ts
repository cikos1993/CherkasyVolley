import { getSessionUser } from "@/auth/requireAdmin";
import { getPublicTournament, getTournamentForAdmin } from "@/data/tournaments";

/**
 * The shared visibility resolution for every `/classic/[tournament]**` page:
 * the public read first, then — only for a signed-in admin — a fallback to
 * the admin-only read so an admin can preview their own `DRAFT` tournament's
 * public page (`epics.md`/`EXPERIENCE.md` both say "404 для не-адміна", not
 * for everyone). The fallback re-checks `discipline` itself: `getTournamentForAdmin`
 * has no discipline filter, so without this check a `BEACH` tournament's id
 * would render under this `CLASSIC`-only route tree (AD-9).
 */
export async function resolveTournament(id: string) {
  const tournament = await getPublicTournament(id);
  if (tournament) return tournament;

  const user = await getSessionUser();
  if (!user?.isAdmin) return null;

  const fallback = await getTournamentForAdmin(id);
  return fallback?.discipline === "CLASSIC" ? fallback : null;
}

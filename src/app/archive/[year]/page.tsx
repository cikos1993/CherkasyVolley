import { redirect } from "next/navigation";

// There is no per-year index — the archive lists every year on one page and
// links straight to a tournament. A guessed `/archive/2025` lands back there.
export default function ArchiveYearPage() {
  redirect("/archive");
}

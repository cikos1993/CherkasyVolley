import { LABELS, type TournamentState } from "@/domain/tournamentState";

const VARIANT_CLASSES: Record<TournamentState, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  GROUP_STAGE: "border border-primary text-primary",
  PLAYOFF: "border border-primary text-primary",
  COMPLETED: "border border-muted-foreground text-muted-foreground",
};

export function StatusBadge({ state }: { state: TournamentState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[state]}`}
    >
      {LABELS[state]}
    </span>
  );
}

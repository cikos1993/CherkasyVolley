"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { removeMatchResult } from "@/actions/matches";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MatchResultForm } from "@/components/match-result-form";
import { Button } from "@/components/ui/button";
import { matchSetSummary, type SetScore } from "@/domain/scoring";
import type { ScoringPreset, TournamentType } from "@/domain/tournamentForm";
import { notify } from "@/lib/notify";

export function MatchResultPanel({
  tournamentId,
  matchId,
  preset,
  tournamentType,
  homeTeam,
  awayTeam,
  sets,
  lockedReason,
}: {
  tournamentId: string;
  matchId: string;
  preset: ScoringPreset;
  tournamentType: TournamentType;
  homeTeam: string;
  awayTeam: string;
  sets: SetScore[];
  lockedReason?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  if (editing && !lockedReason) {
    return (
      <MatchResultForm
        mode="edit"
        tournamentId={tournamentId}
        matchId={matchId}
        preset={preset}
        tournamentType={tournamentType}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        initialSets={sets}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const summary = matchSetSummary(sets);

  async function remove(): Promise<boolean | void> {
    const res = await removeMatchResult(tournamentId, matchId).catch((): null => {
      notify.error("Не вдалося видалити результат. Спробуйте ще раз.");
      return null;
    });
    if (res === null) throw new Error("remove match result request failed");
    if (!res.ok) {
      notify.error(res.message);
      return false;
    }
    notify.success("Результат видалено");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-1">
        {sets.map((set) => (
          <li key={set.setNo} className="flex items-center gap-3 text-sm">
            <span className="w-20 text-muted-foreground">Партія {set.setNo}</span>
            <span className="tabular-nums">
              {set.homePoints} : {set.awayPoints}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Рахунок у партіях:{" "}
        <span className="font-medium tabular-nums">
          {summary.home} : {summary.away}
        </span>
      </p>

      {lockedReason ? (
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" disabled>
              Виправити
            </Button>
            <Button variant="destructive" disabled>
              Видалити результат
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{lockedReason}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            Виправити
          </Button>
          <ConfirmDialog
            trigger={<Button variant="destructive">Видалити результат</Button>}
            title="Видалити результат матчу?"
            description="Таблиця перерахується."
            confirmLabel="Видалити"
            destructive
            onConfirm={remove}
          />
        </div>
      )}
    </div>
  );
}

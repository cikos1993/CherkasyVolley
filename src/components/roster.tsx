"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { removePlayer } from "@/actions/players";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlayerForm } from "@/components/player-form";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";

type Player = {
  id: string;
  fullName: string;
  birthDate: string | null;
  birthPlace: string | null;
  sportRank: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
};

const OPTIONAL_FIELDS: { name: keyof Player; label: string }[] = [
  { name: "birthDate", label: "Дата народження" },
  { name: "birthPlace", label: "Місце народження" },
  { name: "sportRank", label: "Спортивний розряд" },
  { name: "position", label: "Амплуа" },
  { name: "height", label: "Зріст" },
  { name: "weight", label: "Вага" },
];

function PlayerRow({
  tournamentId,
  entryId,
  player,
  onEdit,
}: {
  tournamentId: string;
  entryId: string;
  player: Player;
  onEdit: () => void;
}) {
  const router = useRouter();

  async function remove(): Promise<boolean | void> {
    const res = await removePlayer(tournamentId, entryId, player.id).catch((): null => {
      notify.error("Не вдалося видалити гравця. Спробуйте ще раз.");
      return null;
    });
    if (res === null) throw new Error("remove player request failed");
    if (!res.ok) {
      notify.error(res.message);
      return false;
    }
    notify.success("Гравця видалено");
    router.refresh();
  }

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-medium">{player.fullName}</p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-sm text-muted-foreground">
          {OPTIONAL_FIELDS.filter(({ name }) => player[name] != null).map(({ name, label }) => (
            <div key={name} className="contents">
              <dt>{label}:</dt>
              <dd>{player[name]}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          Редагувати
        </Button>
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="destructive">
              Видалити
            </Button>
          }
          title="Видалити гравця?"
          description={`Гравця «${player.fullName}» буде видалено зі складу.`}
          confirmLabel="Видалити"
          destructive
          onConfirm={remove}
        />
      </div>
    </li>
  );
}

export function Roster({
  tournamentId,
  entryId,
  players,
}: {
  tournamentId: string;
  entryId: string;
  players: Player[];
}) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  return (
    <div className="grid gap-6">
      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ще немає гравців у складі.</p>
      ) : (
        <ul className="divide-y">
          {players.map((player) =>
            editingPlayerId === player.id ? (
              <li key={player.id} className="py-3">
                <PlayerForm
                  mode="edit"
                  tournamentId={tournamentId}
                  entryId={entryId}
                  playerId={player.id}
                  initial={{
                    fullName: player.fullName,
                    birthDate: player.birthDate ?? "",
                    birthPlace: player.birthPlace ?? "",
                    sportRank: player.sportRank ?? "",
                    position: player.position ?? "",
                    height: player.height ?? "",
                    weight: player.weight ?? "",
                  }}
                  onCancel={() => setEditingPlayerId(null)}
                />
              </li>
            ) : (
              <PlayerRow
                key={player.id}
                tournamentId={tournamentId}
                entryId={entryId}
                player={player}
                onEdit={() => setEditingPlayerId(player.id)}
              />
            ),
          )}
        </ul>
      )}

      <div className="border-t pt-6">
        <PlayerForm tournamentId={tournamentId} entryId={entryId} />
      </div>
    </div>
  );
}

import { PLAYER_OPTIONAL_FIELDS } from "@/lib/player-labels";

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

export function PublicRoster({ players }: { players: Player[] }) {
  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground">Склад ще не наповнено.</p>;
  }

  return (
    <ul className="divide-y">
      {players.map((player) => (
        <li key={player.id} className="py-3">
          <p className="font-medium">{player.fullName}</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-sm text-muted-foreground">
            {PLAYER_OPTIONAL_FIELDS.filter(({ name }) => player[name] != null).map(
              ({ name, label }) => (
                <div key={name} className="contents">
                  <dt>{label}:</dt>
                  <dd>{player[name]}</dd>
                </div>
              ),
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}

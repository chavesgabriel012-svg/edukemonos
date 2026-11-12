import type { GroupTournament } from "@edukemonos/curriculum";
import { Trophy } from "lucide-react";

/** For the group's guide: the last Friday tournament of every subject, with its winner. */
export function GroupTournaments({ items, demo }: { items: GroupTournament[] | null; demo: boolean }) {
  if (!items) return null;
  return (
    <section aria-labelledby="torneos-t" className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
      <h2 id="torneos-t" className="flex items-center gap-2 font-heading text-2xl font-bold">
        <Trophy aria-hidden strokeWidth={2.5} className="size-6 text-violeta" />
        Torneos del grupo
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no ha habido torneos en las materias del grupo.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.section} className="space-y-1 rounded-[16px] border p-4">
              <p className="font-semibold">{i.subject}</p>
              <p className="text-sm text-muted-foreground">
                {!i.closed
                  ? "El torneo de esta semana está abierto."
                  : i.winners.length
                    ? `Ganó ${i.winners.join(" y ")}.`
                    : "El último torneo terminó sin puntos."}
              </p>
            </li>
          ))}
        </ul>
      )}
      {demo && <p className="text-xs text-muted-foreground">Datos de demostración.</p>}
    </section>
  );
}

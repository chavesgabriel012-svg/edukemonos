import { CalendarCheck2, PauseCircle, Sprout } from "lucide-react";
import type { StreakStatus } from "@/lib/streak";
import { RepairButton } from "./streak-repair-button";

const weeks = (n: number) => `${n} ${n === 1 ? "semana" : "semanas"}`;

/**
 * Weekly mastery streak (docs/producto/gamificacion.md §4). Calm and without guilt: no countdowns,
 * no "you will lose it". A missed week shows the record and an invitation to start again.
 */
export function StreakCard({ status }: { status: StreakStatus | null }) {
  if (status && !status.visible) return null;
  const target = status?.target ?? 5;

  if (!status || (status.record === 0 && status.week_count === 0)) {
    return (
      <aside aria-label="Racha semanal" className="flex items-start gap-3 rounded-[22px] bg-card p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lima text-tinta"><Sprout aria-hidden className="size-5" /></span>
        <p className="text-sm">
          <span className="block font-semibold">Empieza tu racha semanal</span>
          Resuelve bien {target} ejercicios distintos esta semana. Cada semana que lo logras, tu racha crece.
        </p>
      </aside>
    );
  }

  const pct = Math.min(100, Math.round((status.week_count / status.target) * 100));
  return (
    <aside aria-label="Racha semanal" className="space-y-3 rounded-[22px] bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lima text-tinta">
            {status.paused ? <PauseCircle aria-hidden className="size-5" /> : <CalendarCheck2 aria-hidden className="size-5" />}
          </span>
          <p>
            <span className="block font-mono text-xs text-muted-foreground">RACHA SEMANAL</span>
            {/* A streak at zero is not shown as "0 semanas": it is a new one about to start. */}
            <span className="font-heading text-2xl leading-none font-bold">{status.current > 0 ? weeks(status.current) : "Racha nueva"}</span>
          </p>
        </div>
        {status.record > 0 && <span className="text-right text-xs text-muted-foreground">Récord<br /><span className="font-semibold text-foreground">{weeks(status.record)}</span></span>}
      </div>

      {status.paused ? (
        <p className="text-sm">Semana de vacaciones: tu racha está en pausa y no se pierde. Descansa y seguimos cuando vuelvan las clases.</p>
      ) : (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={status.target} aria-valuenow={Math.min(status.week_count, status.target)} aria-label="Ejercicios de esta semana">
            <div className="h-full rounded-full bg-violeta transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm">
            {status.week_done
              ? `¡Semana cumplida! Llevas ${status.week_count} ejercicios bien resueltos.`
              : `Esta semana: ${status.week_count} de ${status.target} ejercicios bien resueltos.`}
          </p>
        </div>
      )}

      {status.broken && status.current === 0 && (
        status.can_repair ? (
          <div className="space-y-2 rounded-[16px] bg-secondary p-3 text-sm">
            <p>
              La semana pasada no llegaste a {status.target}. Tienes un comodín en el {status.repair_period?.toLowerCase() ?? "periodo"}: si lo usas, tu racha sigue como si la hubieras cumplido.
            </p>
            <RepairButton />
          </div>
        ) : (
          <p className="text-sm">Tu récord es de {weeks(status.record)}. ¡Empecemos una racha nueva esta semana!</p>
        )
      )}
      <p className="text-xs text-muted-foreground">Cuenta cada ejercicio distinto que resuelves bien. En vacaciones la racha se pausa.</p>
    </aside>
  );
}

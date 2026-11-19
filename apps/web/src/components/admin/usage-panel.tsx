import { spendLevel } from "@edukemonos/curriculum";

export interface UsageWeek {
  week_start: string;
  active_students: number;
  attempts: number;
  skills_mastered: number;
  tutor_messages: number;
}
export interface Usage {
  weeks: UsageWeek[];
  spend_month: number;
  budget: number | null;
}

/** Yellow from 80 % of the budget, red from 100 %. */
export const SPEND_TEXT = { ok: "", warn: "font-semibold text-[#8a5a00]", over: "font-semibold text-destructive" } as const;
export const usd = (n: number) => `$${Number(n).toFixed(2)}`;
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Eight weeks of counts for one school and the month's AI spend against its budget. Aggregates only. */
export function UsagePanel({ usage }: { usage: Usage }) {
  const level = spendLevel(Number(usage.spend_month), usage.budget === null ? null : Number(usage.budget));
  const weeks = [...(usage.weeks ?? [])].reverse();
  return (
    <div className="space-y-5">
      <p className="text-sm">
        IA del mes: <span className={`tabular-nums ${SPEND_TEXT[level]}`}>{usd(usage.spend_month)}{usage.budget === null ? " (sin presupuesto)" : ` / ${usd(usage.budget)}`}</span>
        {level === "warn" && " · llegó al 80 % del presupuesto"}
        {level === "over" && " · superó el presupuesto"}
      </p>
      <div className="overflow-x-auto rounded-[16px] border">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-left">
              <th scope="col" className="p-3 font-medium">Semana del</th>
              <th scope="col" className="p-3 text-right font-medium">Estudiantes activos</th>
              <th scope="col" className="p-3 text-right font-medium">Intentos</th>
              <th scope="col" className="p-3 text-right font-medium">Habilidades dominadas</th>
              <th scope="col" className="p-3 text-right font-medium">Mensajes a Kemo</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {weeks.map((w) => (
              <tr key={w.week_start} className="border-b last:border-0">
                <th scope="row" className="p-3 text-left font-medium">{day(w.week_start)}</th>
                <td className="p-3 text-right">{w.active_students}</td>
                <td className="p-3 text-right">{w.attempts}</td>
                <td className="p-3 text-right">{w.skills_mastered}</td>
                <td className="p-3 text-right">{w.tutor_messages}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Solo cifras del colegio completo, de lunes a domingo, hora de Costa Rica. Nunca se muestran estudiantes ni lo que escriben a Kemo.</p>
    </div>
  );
}

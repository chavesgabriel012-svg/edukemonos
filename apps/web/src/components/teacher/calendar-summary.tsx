import type { CalendarInfo } from "@/lib/gamification";

const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CR", { day: "numeric", month: "short", timeZone: "UTC" });

export function CalendarSummary({ calendar }: { calendar: CalendarInfo | null }) {
  if (!calendar) return <p className="text-sm text-muted-foreground">Todavía no hay un calendario cargado para este año: todas las semanas cuentan.</p>;
  return (
    <div className="space-y-2 text-sm">
      <p>
        <span className="font-medium">{calendar.owner === "oficial" ? `Calendario oficial ${calendar.name}` : `Calendario de ${calendar.owner} ${calendar.year}`}</span>
        {": "}clases del {fmt(calendar.classesStart)} al {fmt(calendar.classesEnd)}.
      </p>
      {calendar.breaks.length > 0 && (
        <p>Vacaciones: {calendar.breaks.map((b) => `${b.label.toLowerCase()} (${fmt(b.startsOn)} al ${fmt(b.endsOn)})`).join("; ")}.</p>
      )}
      <p>
        Periodos ({calendar.periods.length}): {calendar.periods.map((p) => `${p.label} (${fmt(p.startsOn)} al ${fmt(p.endsOn)})`).join("; ")}.
        Cada estudiante tiene un comodín por periodo.
      </p>
    </div>
  );
}

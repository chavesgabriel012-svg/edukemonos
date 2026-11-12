import { Kemo } from "@/components/brand/logo";
import { MASTERY_BINS, masteryColor, NO_DATA_STYLE } from "@/components/teacher/scale";
import { brand } from "@/lib/brand";

/** Product previews for the landing, drawn with the same pieces as the app (Kemo, chat bubbles, the mastery scale). */

const CHAT: { from: "student" | "kemo"; text: string }[] = [
  { from: "student", text: "No sé cómo empezar 3 + 4 × 2" },
  { from: "kemo", text: "Vamos paso a paso. Antes de calcular: ¿qué operación crees que va primero, la suma o la multiplicación?" },
  { from: "student", text: "¿La multiplicación?" },
  { from: "kemo", text: "¡Eso! La multiplicación va primero. Entonces, ¿cuánto te da 4 × 2?" },
];

/** A short Socratic exchange: a question back, then the next small step. */
export function ChatPreview() {
  return (
    <figure className="w-full max-w-md rounded-[28px] bg-papel p-4 text-tinta shadow-[0_32px_64px_-24px_rgba(23,19,42,0.55)] sm:p-5">
      <figcaption className="mb-3 flex items-center gap-2.5">
        <Kemo size={34} background={brand.lima} />
        <span className="font-heading text-lg font-bold">Kemo</span>
      </figcaption>
      <ol className="space-y-2.5 text-[15px] leading-snug">
        {CHAT.map((m, i) =>
          m.from === "student" ? (
            <li key={i} className="ml-10 rounded-[18px_18px_6px_18px] bg-violeta px-4 py-3 text-white">{m.text}</li>
          ) : (
            <li key={i} className="mr-6 rounded-[18px_18px_18px_6px] border bg-card px-4 py-3">{m.text}</li>
          ),
        )}
      </ol>
    </figure>
  );
}

// Fixed values so the picture never changes between renders: eight students, ten topics.
const HEAT: (number | null)[][] = [
  [0.91, 0.84, 0.72, 0.66, 0.58, 0.44, 0.71, 0.52, null, null],
  [0.78, 0.63, 0.55, 0.41, 0.36, 0.28, 0.47, null, null, null],
  [0.95, 0.92, 0.88, 0.81, 0.74, 0.69, 0.83, 0.77, 0.61, null],
  [0.62, 0.48, 0.33, 0.27, null, null, null, null, null, null],
  [0.86, 0.79, 0.64, 0.71, 0.52, 0.38, 0.59, 0.43, null, null],
  [0.57, 0.52, 0.46, 0.39, 0.31, 0.24, null, null, null, null],
  [0.88, 0.74, 0.81, 0.69, 0.63, 0.55, 0.72, 0.66, 0.49, 0.41],
  [0.73, 0.68, 0.59, 0.34, 0.42, 0.29, 0.51, null, null, null],
];

/** A slice of the teacher panel's heat map: students × topics, colored by estimated mastery. */
export function HeatmapPreview() {
  return (
    <figure className="rounded-[28px] border bg-card p-4 shadow-[0_24px_48px_-28px_rgba(23,19,42,0.35)] sm:p-6">
      <figcaption className="mb-4 font-heading text-xl font-bold">Dominio por tema</figcaption>
      <div className="relative overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-xs" aria-label="Ejemplo de mapa de calor: dominio estimado de ocho estudiantes en diez temas">
          <thead>
            <tr>
              <th scope="col" className="pr-2 text-left font-medium text-muted-foreground">Estudiante</th>
              {HEAT[0].map((_, i) => (
                <th key={i} scope="col" className="w-8 min-w-8 font-mono font-medium text-muted-foreground">T{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEAT.map((row, r) => (
              <tr key={r}>
                <th scope="row" className="pr-3 text-left font-normal whitespace-nowrap">Estudiante {r + 1}</th>
                {row.map((v, c) => (
                  <td key={c} className="p-0">
                    <div className="h-7 w-8 rounded-[5px]" style={v === null ? NO_DATA_STYLE : { backgroundColor: masteryColor(v) }}>
                      <span className="sr-only">{v === null ? "sin datos" : `${Math.round(v * 100)} %`}</span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
        {MASTERY_BINS.map((b) => (
          <span key={b.label} className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[4px]" style={{ backgroundColor: b.color }} />
            {b.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[4px] border" style={NO_DATA_STYLE} />
          sin datos
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Datos de demostración.</p>
    </figure>
  );
}

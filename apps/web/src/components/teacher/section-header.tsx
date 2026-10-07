import { Info } from "lucide-react";
import { regenerateCode, setSectionActive } from "@/app/docente/actions";
import { formatCode, type PanelSource } from "@/lib/teacher";
import { CopyButton } from "./copy-button";

const TERM = { 1: "I trimestre", 2: "II trimestre", 3: "III trimestre" } as const;

/** Section name, details and the join code to dictate in class. Code controls only for real sections. */
export function SectionHeader({ source }: { source: PanelSource }) {
  const s = source.section;
  const code = formatCode(s.joinCode);
  return (
    <div className="space-y-4">
      {source.demo && (
        <p role="note" className="flex gap-2.5 rounded-[16px] border border-violeta/30 bg-[#EEEBFE] p-4 text-sm text-tinta">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-violeta" />
          <span>
            <strong>Datos de demostración.</strong> Los estudiantes y su actividad son ficticios, generados para mostrar el panel;
            los temas son los reales de {s.gradeId}.º año. Con una sección real, el panel se llena con lo que hacen sus estudiantes.
          </span>
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <p className="font-mono text-xs text-muted-foreground uppercase">
            {s.gradeId}.º año{s.term ? ` · ${TERM[s.term as 1 | 2 | 3]}` : ""}{s.institution ? ` · ${s.institution}` : ""}
          </p>
          <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">{s.name}</h1>
          {!s.active && <p className="text-sm font-medium text-[#8A2E12]">El código está desactivado: nadie nuevo puede unirse.</p>}
        </div>
        <div className="rounded-[22px] bg-violeta p-5 text-white">
          <p className="text-sm text-white/80">Código para «Únete a tu sección»</p>
          <p className="font-mono text-4xl font-bold tracking-[0.12em]" aria-label={`Código ${code.split("").join(" ")}`}>{code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={code} />
            {!source.demo && (
              <>
                <form action={regenerateCode.bind(null, s.id)}>
                  <button className="h-9 rounded-[10px] border border-white/25 px-3 text-sm font-medium transition hover:bg-white/10">Cambiar código</button>
                </form>
                <form action={setSectionActive.bind(null, s.id, !s.active)}>
                  <button className="h-9 rounded-[10px] border border-white/25 px-3 text-sm font-medium transition hover:bg-white/10">
                    {s.active ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

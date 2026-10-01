import type { Metadata } from "next";
import Link from "next/link";
import { STATUS_LABEL, type UnitRow, type UnitStatus } from "@/lib/review";
import { requireReviewer } from "@/lib/staff";
import { NotReviewer } from "./forbidden";

export const metadata: Metadata = { title: "Revisar" };

type ListRow = Pick<UnitRow, "id" | "title" | "area" | "status" | "source_page" | "sort_order" | "extraction_meta"> & {
  skills: { count: number }[];
};

const STATUS_STYLE: Record<UnitStatus, string> = {
  draft: "bg-muted text-foreground",
  reviewed: "bg-secondary text-foreground",
  published: "bg-primary text-primary-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export default async function ReviewListPage({ searchParams }: PageProps<"/revisar">) {
  const { supabase, user, allowed } = await requireReviewer("/revisar");
  if (!allowed) return <NotReviewer email={user.email} />;

  const params = await searchParams;
  const subject = typeof params.materia === "string" ? params.materia : "matematicas";
  const grade = Number(typeof params.grado === "string" ? params.grado : 7);

  const [{ data: subjects }, { data: grades }, { data: units, error }] = await Promise.all([
    supabase.from("subjects").select("id, name").order("sort"),
    supabase.from("grades").select("id, name").order("sort"),
    supabase
      .from("curriculum_units")
      .select("id, title, area, status, source_page, sort_order, extraction_meta, skills(count)")
      .eq("subject_id", subject)
      .eq("grade_id", grade)
      .order("sort_order")
      .returns<ListRow[]>(),
  ]);

  const rows = units ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.status]: (acc[u.status] ?? 0) + 1 }), {});
  const areas = [...new Set(rows.map((u) => u.area ?? "Sin área"))];

  return (
    <section className="space-y-6">
      <nav aria-label="Materia y grado" className="flex flex-wrap gap-4 text-sm">
        <div className="flex flex-wrap gap-2">
          {(subjects ?? []).map((s: { id: string; name: string }) => (
            <Link key={s.id} href={`/revisar?materia=${s.id}&grado=${grade}`} aria-current={s.id === subject ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${s.id === subject ? "border-primary bg-secondary font-medium" : ""}`}>
              {s.name}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          {(grades ?? []).map((g: { id: number; name: string }) => (
            <Link key={g.id} href={`/revisar?materia=${subject}&grado=${g.id}`} aria-current={g.id === grade ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${g.id === grade ? "border-primary bg-secondary font-medium" : ""}`}>
              {g.name}
            </Link>
          ))}
        </div>
      </nav>

      {error && <p role="alert" className="text-destructive">No se pudieron cargar las unidades: {error.message}</p>}

      <p className="text-sm text-muted-foreground">
        {rows.length} unidades ·{" "}
        {(Object.keys(STATUS_LABEL) as UnitStatus[]).map((s) => `${STATUS_LABEL[s]}: ${counts[s] ?? 0}`).join(" · ")}
      </p>

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no hay unidades para esta materia y grado. Se cargan con <code>pnpm ingest run</code>.
        </p>
      )}

      {areas.map((area) => (
        <div key={area} className="space-y-2">
          <h2 className="font-semibold">{area}</h2>
          <ul className="divide-y rounded-lg border">
            {rows.filter((u) => (u.area ?? "Sin área") === area).map((u) => {
              const issues = u.extraction_meta.issues?.length ?? 0;
              return (
                <li key={u.id}>
                  <Link href={`/revisar/${u.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted/50">
                    <span className="font-medium">{u.title}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">pág. {u.source_page} · {u.skills[0]?.count ?? 0} habilidades</span>
                      {issues > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-950">{issues} por verificar</span>}
                      <span className={`rounded px-2 py-0.5 ${STATUS_STYLE[u.status]}`}>{STATUS_LABEL[u.status]}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBadge } from "@/components/learn/content-badge";
import { Markdown } from "@/components/learn/markdown";
import { ReportButton } from "@/components/learn/report-button";
import type { Material } from "@/lib/learn";
import { createClient } from "@/lib/supabase/server";
import { Practice } from "./practice";

export const metadata: Metadata = { title: "Unidad" };

const MATERIAL_ORDER = ["summary", "explanation", "worked_examples", "glossary"] as const;
const MATERIAL_LABEL = { summary: "Resumen", explanation: "Explicación paso a paso", worked_examples: "Ejemplos resueltos", glossary: "Glosario" };
const TABS = [
  { id: "aprender", label: "Aprender" },
  { id: "practicar", label: "Practicar" },
  { id: "tutor", label: "Preguntar al tutor" },
] as const;

export default async function UnitPage({ params, searchParams }: PageProps<"/unidad/[id]">) {
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "aprender";
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("curriculum_units")
    .select("id, title, area, grade_id, subject_id, source_page, source_excerpt, status, curriculum_sources(title, version, url), subjects(name)")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!unit) notFound();
  const source = unit.curriculum_sources as unknown as { title: string; version: string | null; url: string } | null;
  const subject = (unit.subjects as unknown as { name: string } | null)?.name ?? unit.subject_id;

  const { data: materialRows } = await supabase
    .from("materials")
    .select("id, kind, content, reviewer_id, created_at")
    .eq("unit_id", id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .returns<Material[]>();
  const materials = MATERIAL_ORDER.flatMap((k) => (materialRows ?? []).filter((m) => m.kind === k).slice(0, 1));
  const { data: writing } = await supabase
    .from("items")
    .select("id, stem, reviewer_id")
    .eq("unit_id", id)
    .eq("status", "published")
    .eq("kind", "open_writing");

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <Link href={`/estudiar/${unit.grade_id}/${unit.subject_id}`} className="text-sm underline underline-offset-2">
          ← {subject} · {unit.grade_id}.º
        </Link>
        <h1 className="text-2xl font-bold">{unit.title}</h1>
        {unit.area && <p className="text-sm text-muted-foreground">{unit.area}</p>}
      </header>

      <nav aria-label="Secciones de la unidad" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link key={t.id} href={`/unidad/${id}?tab=${t.id}`} aria-current={t.id === tab ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${t.id === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "aprender" && (
        <div className="space-y-8">
          {materials.length === 0 && <p className="text-muted-foreground">El material de esta unidad todavía está en preparación.</p>}
          {materials.map((m) => (
            <section key={m.id} aria-labelledby={`m-${m.id}`} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`m-${m.id}`} className="text-xl font-semibold">{MATERIAL_LABEL[m.kind]}</h2>
                <ContentBadge reviewed={m.reviewer_id !== null} />
              </div>
              <Markdown>{m.content}</Markdown>
              <ReportButton targetType="material" targetId={m.id} />
            </section>
          ))}
          <footer className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
            <p>
              Basado en: {source?.title}{source?.version ? ` (MEP, ${source.version})` : ""}, página {unit.source_page}:{" "}
              <q>{unit.source_excerpt}</q>{" "}
              {source?.url && (
                <a href={`${source.url}#page=${unit.source_page}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Ver el programa oficial
                </a>
              )}
            </p>
          </footer>
        </div>
      )}

      {tab === "practicar" && (
        <div className="space-y-8">
          <Practice unitId={id} />
          {(writing ?? []).length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Para escribir</h2>
              <p className="text-sm text-muted-foreground">Escríbelo en tu cuaderno. Pronto el tutor podrá darte retroalimentación.</p>
              {(writing ?? []).map((w: { id: string; stem: string; reviewer_id: string | null }) => (
                <div key={w.id} className="space-y-2 rounded-xl border p-4">
                  <ContentBadge reviewed={w.reviewer_id !== null} />
                  <Markdown>{w.stem}</Markdown>
                  <ReportButton targetType="item" targetId={w.id} />
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {tab === "tutor" && (
        <div className="rounded-xl border border-dashed p-6 text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">Tutor de IA: muy pronto</h2>
          <p className="mt-2">
            Aquí podrás conversar con un tutor que te guía paso a paso sobre esta unidad, sin darte las respuestas de una vez.
            Mientras tanto, practica con los ejercicios: cada uno trae su explicación.
          </p>
        </div>
      )}
    </article>
  );
}

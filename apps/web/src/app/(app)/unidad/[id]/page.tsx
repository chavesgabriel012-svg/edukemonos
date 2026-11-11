import { BookOpenCheck, ClipboardCheck, MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubjectIcon } from "@/components/brand/subject-icon";
import { ContentBadge } from "@/components/learn/content-badge";
import { Markdown } from "@/components/learn/markdown";
import { ReportButton } from "@/components/learn/report-button";
import { action } from "@/components/ui/action";
import { BackLink } from "@/components/ui/back-link";
import { subjectColor } from "@/lib/brand";
import type { Material } from "@/lib/learn";
import { createClient } from "@/lib/supabase/server";
import { helpResources, TUTOR_LIMITS } from "@/lib/tutor-server";
import { Practice } from "./practice";
import { TutorChat } from "./tutor-chat";
import { WritingTask } from "./writing-task";

export async function generateMetadata({ params }: PageProps<"/unidad/[id]">): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase.from("curriculum_units").select("title").eq("id", (await params).id).eq("status", "published").maybeSingle();
  return { title: data?.title ?? "Unidad" };
}

const MATERIAL_ORDER = ["summary", "explanation", "worked_examples", "glossary"] as const;
const MATERIAL_LABEL = { summary: "Resumen", explanation: "Explicación paso a paso", worked_examples: "Ejemplos resueltos", glossary: "Glosario" };
const TABS = [
  { id: "aprender", label: "Aprender", icon: BookOpenCheck },
  { id: "practicar", label: "Practicar", icon: ClipboardCheck },
  { id: "tutor", label: "Preguntar a Kemo", icon: MessageCircleQuestion },
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
    <article className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <BackLink href={`/estudiar/${unit.grade_id}/${unit.subject_id}`}>Temas de {subject} · {unit.grade_id}.º</BackLink>
        <div style={{ background: subjectColor(unit.subject_id) }} className="space-y-2 rounded-[28px] px-6 py-6 text-tinta sm:px-8 sm:py-7">
          <p className="flex items-center justify-between gap-3 font-mono text-xs tracking-wide uppercase">
            <span>{subject} · {unit.grade_id}.º{unit.area ? ` · ${unit.area}` : ""}</span>
            <SubjectIcon subject={unit.subject_id} className="size-6 shrink-0" />
          </p>
          <h1 className="font-heading text-3xl leading-[1.05] font-bold text-balance sm:text-4xl">{unit.title}</h1>
        </div>
      </header>

      <nav aria-label="Secciones del tema" className="sticky top-[61px] z-30 -mx-1 grid grid-cols-3 gap-1 rounded-[18px] border bg-card p-1 shadow-[0_8px_24px_-16px_rgba(23,19,42,0.25)]">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <Link key={tabId} href={`/unidad/${id}?tab=${tabId}`} aria-current={tabId === tab ? "page" : undefined} scroll={false}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 py-1.5 text-center text-xs leading-tight font-semibold transition focus-visible:outline-2 sm:flex-row sm:gap-2 sm:text-sm ${tabId === tab ? "bg-violeta text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            <Icon aria-hidden strokeWidth={2.5} className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {tab === "aprender" && (
        <div className="space-y-4">
          {materials.length === 0 && <p className="rounded-[22px] border border-dashed p-5 text-muted-foreground">El material de este tema todavía está en preparación.</p>}
          {materials.map((m) => (
            <section key={m.id} aria-labelledby={`m-${m.id}`} className="space-y-3 rounded-[22px] border bg-card p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`m-${m.id}`} className="font-heading text-2xl font-bold">{MATERIAL_LABEL[m.kind]}</h2>
                <ContentBadge reviewed={m.reviewer_id !== null} />
              </div>
              <Markdown>{m.content}</Markdown>
              <ReportButton targetType="material" targetId={m.id} />
            </section>
          ))}
          {materials.length > 0 && (
            <div className="flex flex-col items-start gap-3 rounded-[22px] bg-tinta p-5 text-papel sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h2 className="font-heading text-2xl font-bold">¿Lo ponemos a prueba?</h2>
                <p className="text-sm text-papel/80">Practica con ejercicios de este tema o pregúntale a Kemo lo que no quedó claro.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/unidad/${id}?tab=practicar`} className={action({ variant: "lima-on-dark", size: "md" })}>Practicar</Link>
                <Link href={`/unidad/${id}?tab=tutor`} className={action({ variant: "outline-on-dark", size: "md" })}>Preguntar a Kemo</Link>
              </div>
            </div>
          )}
          <footer className="space-y-1 px-1 pt-2 text-xs leading-relaxed text-muted-foreground">
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
              <div className="space-y-1">
                <h2 className="font-heading text-2xl font-bold">Para escribir</h2>
                <p className="text-sm text-muted-foreground">Escribe tu respuesta y pide retroalimentación.</p>
              </div>
              {(writing ?? []).map((w: { id: string; stem: string; reviewer_id: string | null }) => (
                <div key={w.id} className="space-y-3 rounded-[22px] border bg-card p-5 sm:p-6">
                  <ContentBadge reviewed={w.reviewer_id !== null} />
                  <Markdown>{w.stem}</Markdown>
                  <WritingTask itemId={w.id} />
                  <ReportButton targetType="item" targetId={w.id} />
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {tab === "tutor" && <TutorChat unitId={id} help={helpResources} limits={{ perSession: TUTOR_LIMITS.perSession, perDay: TUTOR_LIMITS.perDay }} />}
    </article>
  );
}

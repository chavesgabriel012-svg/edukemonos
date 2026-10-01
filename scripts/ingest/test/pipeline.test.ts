import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

process.env.INGEST_CACHE_DIR = mkdtempSync(join(tmpdir(), "ingest-test-"));

const { createAI } = await import("@edukemonos/ai");
const { pageCoverage } = await import("../src/coverage");
const { createDb } = await import("../src/db");
const { loadExtraction } = await import("../src/load");
const { structureGrade } = await import("../src/structure");
import type { SourceEntry } from "@edukemonos/curriculum";
import type { ProviderAdapter } from "@edukemonos/ai";

// Real text of MEP Mathematics program pages 276–277 (pdftotext default mode).
const raw = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../../packages/curriculum/test/fixtures/mat-276-277.json"), "utf8"),
) as Record<string, string>;
const texts = { sourceId: "mep-prog-matematicas", sha256: "abc", extractedWith: "pdftotext (test)", pages: raw };

const entry: SourceEntry = {
  id: "mep-prog-matematicas",
  kind: "programa",
  subject: "matematicas",
  cycle: "III",
  grades: [7, 8, 9],
  title: "Programas de Estudio de Matemáticas",
  version: "2012",
  url: "https://www.mep.go.cr/sites/default/files/media/matematica.pdf",
  landingPage: "https://www.mep.go.cr/programas-estudio?texto-programas-academicos=&academico=8082",
  pdfPages: 518,
  bytes: 1,
  textExtractable: true,
  gradeRanges: { "7": { content: [[276, 277]], labels: ["Números"] } },
  notes: "",
};

const modelOutput = {
  units: [
    {
      title: "Números naturales: operaciones",
      area: null,
      term: null,
      contents: ["Combinación de operaciones"],
      learning_outcomes: [],
      skills: [
        { code: "1", text: "Calcular expresiones numéricas aplicando el concepto de potencia y la notación exponencial.", page: 276 },
        { code: "2", text: "Resolver una combinación de operaciones que involucre o no el uso de paréntesis.", page: 276 },
      ],
      source_page: 276,
      source_excerpt: "Es necesario retomar los algoritmos que permiten operar con números naturales.",
    },
    {
      title: "Unidad inventada",
      area: "Números",
      term: 2,
      contents: [],
      learning_outcomes: [],
      skills: [{ code: "9", text: "Dominar los números complejos.", page: 277 }],
      source_page: 277,
      source_excerpt: "Texto que no existe en el programa.",
    },
  ],
  notes: "",
};

function fakeAI() {
  const generateStructured = vi.fn(async (req: { model: string }) => ({
    data: modelOutput,
    usage: { inputTokens: 100, outputTokens: 50 },
    model: req.model,
  }));
  const adapter = { name: "anthropic", generateStructured } as unknown as ProviderAdapter;
  const ai = createAI({
    adapter,
    config: {
      provider: "anthropic",
      models: { bulk: ["claude-sonnet-5-5"], tutor: ["claude-haiku-4-5"], verify: ["claude-sonnet-5-5"] },
      embedModel: null,
      effort: {},
      anthropicFallbacks: null,
      prices: {},
      budget: { dailyUsd: null, monthlyUsd: null },
    },
  });
  return { ai, generateStructured };
}

describe("structureGrade", () => {
  it("sends the labelled pages and flags whatever is not verbatim in the program", async () => {
    const { ai, generateStructured } = fakeAI();
    const result = await structureGrade(ai, entry, 7, texts);
    const sent = generateStructured.mock.calls[0][0] as unknown as { messages: { content: string }[]; system: string };
    expect(sent.messages[0].content).toContain("=== PÁGINA 276 ===");
    expect(sent.messages[0].content).toContain("Sección del documento: Números");
    expect(sent.system).toContain("EXTRAE, NO INVENTES");

    const [chunk] = result.chunks;
    expect(chunk.units[0].area).toBe("Números"); // filled from the section label
    expect(chunk.issues.filter((i) => i.unit === 0)).toEqual([]);
    expect(chunk.issues.filter((i) => i.unit === 1).map((i) => i.field).sort()).toEqual(["skill", "source_excerpt"]);
    expect(pageCoverage(entry, result)).toEqual({ pages: [276, 277], covered: [276, 277], uncovered: [] });
  });
});

describe("loadExtraction", () => {
  it("replaces previous drafts, inserts units as draft with their issues, and skills", async () => {
    const { ai } = fakeAI();
    const extraction = await structureGrade(ai, entry, 7, texts);
    const calls: { method: string; url: string; body?: unknown }[] = [];
    let unitId = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (method === "GET") return new Response("[]", { status: 200 });
      if (method === "DELETE") return new Response(JSON.stringify([{ id: "old" }]), { status: 200 });
      if (url.includes("/curriculum_units")) return new Response(JSON.stringify([{ id: `u${++unitId}` }]), { status: 201 });
      return new Response("", { status: 201 });
    }) as unknown as typeof fetch;
    const db = createDb("https://example.supabase.co", "service-key", fetchImpl);

    const summary = await loadExtraction(db, entry, "src-1", extraction, { runId: "run-1" });
    expect(summary).toEqual({ deletedDrafts: 1, units: 2, skills: 3, unitsWithIssues: 1 });

    const del = calls.find((c) => c.method === "DELETE")!;
    expect(del.url).toContain("status=eq.draft");
    const unitInserts = calls.filter((c) => c.method === "POST" && c.url.includes("/curriculum_units"));
    const second = (unitInserts[1].body as Record<string, unknown>[])[0];
    expect(second).toMatchObject({ status: "draft", grade_id: 7, term: 2, source_id: "src-1" });
    expect((second.extraction_meta as { issues: unknown[] }).issues).toHaveLength(2);
  });

  it("refuses to load next to units a person already reviewed", async () => {
    const { ai } = fakeAI();
    const extraction = await structureGrade(ai, entry, 7, texts);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ id: "reviewed" }]), { status: 200 })) as unknown as typeof fetch;
    const db = createDb("https://example.supabase.co", "k", fetchImpl);
    await expect(loadExtraction(db, entry, "src-1", extraction, { runId: "r" })).rejects.toThrow(/already reviewed/);
  });
});

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

process.env.INGEST_CACHE_DIR = mkdtempSync(join(tmpdir(), "content-test-"));

const { createAI } = await import("@edukemonos/ai");
const { createDb } = await import("../src/db");
const { generateUnitContent, itemsBlock, loadUnitContent, publishVerified, unitBlock } = await import("../src/content");
import type { ProviderAdapter } from "@edukemonos/ai";
import type { ContentUnit } from "../src/content";

const unit: ContentUnit = {
  id: "unit-1",
  subject_id: "matematicas",
  grade_id: 7,
  area: "Números",
  title: "Potencias",
  contents: ["Potencias"],
  learning_outcomes: [],
  source_excerpt: "Calcular expresiones numéricas aplicando el concepto de potencia.",
  skills: [{ id: "skill-1", code: "1", name: "Calcular expresiones numéricas aplicando el concepto de potencia." }],
};

const longText = "Texto de estudio suficientemente largo para pasar el control de longitud mínima del material. ".repeat(2);
const outputs: Record<string, unknown> = {
  materials: { summary: longText, explanation: longText, worked_examples: longText, glossary: longText, notes: "" },
  material_review: { problems: [{ material: "glossary", severity: "error", quote: "x", explanation: "definición incorrecta" }] },
  items: {
    items: [
      {
        skill_index: 0, difficulty: 3, reading_level: null, stem: "¿Cuánto es 2⁵?", options: ["10", "25", "32", "16"], correct_index: 2,
        explanation: "2 × 2 × 2 × 2 × 2 = 32", distractor_explanations: ["2 × 5", "5²", "", "2⁴"], calc: { expression: "2^5" },
      },
      {
        // The key is wrong (3² = 9): the solver and mathjs must both catch it.
        skill_index: 0, difficulty: 2, reading_level: null, stem: "¿Cuánto es 3²?", options: ["6", "9", "8", "5"], correct_index: 0,
        explanation: "…", distractor_explanations: ["", "a", "b", "c"], calc: { expression: "3^2" },
      },
    ],
    writing: [{ skill_index: 0, difficulty: 3, prompt: "Escribe un párrafo…", criteria: ["Usa conectores"] }],
    notes: "",
  },
  solved_items: { answers: [{ item: 1, chosen_index: 2, problems: "" }, { item: 2, chosen_index: 1, problems: "" }] },
};

function fakeAI() {
  const generateStructured = vi.fn(async (req: { model: string; schemaName: string }) => ({
    data: outputs[req.schemaName],
    usage: { inputTokens: 10, outputTokens: 10 },
    model: req.model,
  }));
  const adapter = { name: "anthropic", generateStructured } as unknown as ProviderAdapter;
  const ai = createAI({
    adapter,
    config: {
      provider: "anthropic",
      models: { bulk: ["bulk-model"], tutor: ["tutor-model"], verify: ["verify-model"] },
      embedModel: null,
      effort: {},
      anthropicFallbacks: null,
      prices: {},
      budget: { dailyUsd: null, monthlyUsd: null },
    },
  });
  return { ai, generateStructured };
}

function fakeDb() {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === "DELETE" || method === "PATCH") return new Response("[]", { status: 200 });
    return new Response("", { status: 201 });
  }) as unknown as typeof fetch;
  return { db: createDb("https://example.supabase.co", "k", fetchImpl), calls };
}

describe("content generation", () => {
  it("never shows the solver the key, the explanations or the calculation", () => {
    const block = itemsBlock((outputs.items as { items: Parameters<typeof itemsBlock>[0] }).items);
    expect(block).toContain("0) 10");
    expect(block).not.toMatch(/2\^5|correct|2 × 2 × 2/);
    expect(unitBlock(unit)).toContain("[0] Calcular expresiones");
  });

  it("verifies items independently and holds back material the reviewer flagged", async () => {
    const { ai, generateStructured } = fakeAI();
    const content = await generateUnitContent(ai, unit);

    const roles = generateStructured.mock.calls.map((c) => (c[0] as unknown as { model: string }).model);
    expect(roles).toEqual(["bulk-model", "verify-model", "bulk-model", "verify-model"]);

    expect(content.choice.map((c) => c.verification.verified)).toEqual([true, false]);
    expect(content.choice[1].verification.reasons).toEqual(
      expect.arrayContaining(["el verificador eligió la opción 2", expect.stringMatching(/^cálculo:/)]),
    );
    expect(content.materials.filter((m) => !m.check.ok).map((m) => m.kind)).toEqual(["glossary"]);
  });

  it("loads drafts without touching reviewed rows, and publishes only what passed", async () => {
    const { ai } = fakeAI();
    const content = await generateUnitContent(ai, unit);
    const { db, calls } = fakeDb();
    const summary = await loadUnitContent(db, unit, content);
    expect(summary).toMatchObject({ materials: 4, items: 2, verified: 1, writing: 1 });

    const deletes = calls.filter((c) => c.method === "DELETE").map((c) => c.url);
    expect(deletes.every((u) => u.includes("status=eq.draft") && u.includes("reviewer_id=is.null"))).toBe(true);
    const items = calls.find((c) => c.method === "POST" && c.url.includes("/items"))!.body as Record<string, unknown>[];
    expect(items[0]).toMatchObject({ status: "draft", verified: true, skill_ids: ["skill-1"], correct_index: 2 });
    // PostgREST bulk inserts need every row to carry the same keys.
    const keys = items.map((r) => Object.keys(r).sort().join(","));
    expect(new Set(keys).size).toBe(1);
    expect(items.at(-1)).toMatchObject({ kind: "open_writing", options: null, correct_index: null, verified: false });

    await publishVerified(db, [unit.id]);
    const patches = calls.filter((c) => c.method === "PATCH").map((c) => decodeURIComponent(c.url));
    expect(patches[0]).toContain("verification->>ok=eq.true");
    expect(patches[1]).toContain("verified=is.true");
    expect(patches.every((u) => u.includes("status=eq.draft"))).toBe(true);
  });
});

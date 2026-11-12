import { splitGame, verifyGame, type GeneratedGame } from "@edukemonos/curriculum";
import { describe, expect, it } from "vitest";
import type { ContentUnit } from "../src/content";
import type { Db } from "../src/db";
import { gameRows, loadUnitGames, seedOf, type UnitGames } from "../src/games";

const unit: ContentUnit = {
  id: "u1", subject_id: "matematicas", grade_id: 7, area: null, title: "Potencias", contents: [], learning_outcomes: [], source_excerpt: "x",
  skills: [{ id: "s1", code: "1", name: "Calcular potencias" }],
};
const order: GeneratedGame = {
  mechanic: "order", skill_index: 0, instruction: "Ordena los pasos.", pairs: null, steps: ["Base", "Exponente", "Multiplica", "Resultado"],
  stem: null, options: null, answer_index: null, correction: null, calc: null, explanation: "Así se calcula.",
};
const broken: GeneratedGame = { ...order, steps: ["Solo uno"] };

function cached(): UnitGames {
  const pieces = [order, broken].map((game, i) => {
    const seed = seedOf(unit.id, i);
    const { answer } = splitGame(game.steps!.length >= 3 ? game : order, seed);
    const solved = { game: i + 1, match: null, order: (answer as { order: number[] }).order.map((x) => x + 1), choice: null, problems: "" };
    return { game, seed, solved, verification: verifyGame(game, 1, seed, solved) };
  });
  return { unitId: unit.id, createdAt: "", models: { games: "m-gen", solve: "m-solve" }, prompts: { games: "generate-games-system@1", solve: "solve-games-system@1" }, pieces, notes: "" };
}

describe("game rows", () => {
  it("keeps the answer out of the public part, maps the skill and drops broken pieces", () => {
    const rows = gameRows(unit, cached());
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(r).toMatchObject({ kind: "game_order", skill_ids: ["s1"], status: "draft", verified: true, prompt_id: "generate-games-system", prompt_version: "1" });
    expect(JSON.stringify(r.game_public)).not.toContain('"order":');
    expect(r.game_answer).toMatchObject({ mechanic: "order" });
  });

  it("never touches a unit that already has game pieces", async () => {
    const inserted: object[][] = [];
    const db = {
      select: async () => [{ id: "x" }],
      insert: async (_t: string, rows: object[]) => { inserted.push(rows); return []; },
    } as unknown as Db;
    expect(await loadUnitGames(db, unit, cached())).toEqual({ skipped: true, pieces: 0, verified: 0 });
    expect(inserted).toEqual([]);
  });
});

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { AI } from "@edukemonos/ai";
import { generateGamesSystem, generateGamesUser, renderPrompt, solveGamesSystem, solveGamesUser } from "@edukemonos/ai/prompts";
import {
  gamesBlock,
  gameTarget,
  type GameVerification,
  type GeneratedGame,
  generatedGamesSchema,
  type SolvedGames,
  solvedGamesSchema,
  splitGame,
  verifyGame,
} from "@edukemonos/curriculum";
import { ensureDir, paths } from "./cache";
import { type ContentUnit, unitBlock } from "./content";
import type { Db } from "./db";
import { GRADE_NAMES, SUBJECT_NAMES } from "./structure";

/**
 * Fase 3: content for the fixed mini-game mechanics of a PUBLISHED unit (docs/producto/gamificacion.md §6).
 *
 *   generate → pieces (MODEL_BULK) + independent solve without answers (MODEL_VERIFY) + mathjs
 *   load     → draft items of kind game_<mechanic>, each with its verification
 *   publish  → only the verified ones, marked "Generado con IA · pendiente de revisión"
 *
 * The AI writes content only; the mechanics are code in apps/web. Every step is cached per unit.
 */

export interface GamePiece {
  game: GeneratedGame;
  /** Seed of the shuffle the student (and the solver) see; fixed so the answer stays valid. */
  seed: string;
  /** The solver's raw answer, so a fixed check can be re-run without paying again. */
  solved: SolvedGames["answers"][number] | null;
  verification: GameVerification;
}

export interface UnitGames {
  unitId: string;
  createdAt: string;
  models: { games: string; solve: string };
  prompts: { games: string; solve: string };
  pieces: GamePiece[];
  notes: string;
}

const promptRef = (p: { id: string; version: string }) => `${p.id}@${p.version}`;
export const GAME_PROMPTS = { games: promptRef(generateGamesSystem), solve: promptRef(solveGamesSystem) };

export const seedOf = (unitId: string, index: number) => `${unitId}:${index}`;

function stepCache(unitId: string) {
  const file = paths.gameSteps(unitId);
  const saved: Record<string, unknown> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  return async <T>(name: string, prompt: string, run: () => Promise<T>): Promise<T> => {
    const key = `${name}:${prompt}`;
    if (key in saved) return saved[key] as T;
    const value = await run();
    saved[key] = value;
    writeFileSync(ensureDir(file), JSON.stringify(saved, null, 2));
    return value;
  };
}

export async function generateUnitGames(ai: AI, u: ContentUnit, { log }: { log?: (m: string) => void } = {}): Promise<UnitGames> {
  if (u.skills.length === 0) throw new Error(`Unit ${u.id} has no skills`);
  const step = stepCache(u.id);
  const gen = await step("games", GAME_PROMPTS.games, () => ai.generateStructured(
    { role: "bulk", purpose: "bulk_games" },
    {
      system: renderPrompt(generateGamesSystem, {}),
      messages: [{ role: "user", content: renderPrompt(generateGamesUser, { unitBlock: unitBlock(u), gameCount: String(gameTarget(u.skills.length)) }) }],
      schema: generatedGamesSchema,
      schemaName: "games",
      maxTokens: 16_000,
    },
  ));
  const games = gen.data.games;
  log?.(`${games.length} piezas generadas`);
  const solved = games.length
    ? await step("solve", GAME_PROMPTS.solve, () => ai.generateStructured(
        { role: "verify", purpose: "verify_game" },
        {
          system: renderPrompt(solveGamesSystem, {}),
          messages: [{
            role: "user",
            content: renderPrompt(solveGamesUser, {
              subject: SUBJECT_NAMES[u.subject_id] ?? u.subject_id,
              grade: GRADE_NAMES[u.grade_id] ?? `${u.grade_id}.º`,
              gamesBlock: gamesBlock(games, (i) => seedOf(u.id, i)),
            }),
          }],
          schema: solvedGamesSchema,
          schemaName: "solved_games",
          // Pairs and order are simpler to solve than open items, but the solver must still work
          // every piece out instead of guessing.
          effort: "high",
          maxTokens: 16_000,
        },
      ))
    : null;
  log?.("piezas resueltas por el verificador");
  const answers = new Map((solved?.data.answers ?? []).map((a) => [a.game, a]));
  return {
    unitId: u.id,
    createdAt: new Date().toISOString(),
    models: { games: gen.model, solve: solved?.model ?? "" },
    prompts: GAME_PROMPTS,
    pieces: games.map((game, i) => {
      const seed = seedOf(u.id, i);
      const solvedPiece = answers.get(i + 1) ?? null;
      return { game, seed, solved: solvedPiece, verification: verifyGame(game, u.skills.length, seed, solvedPiece ?? undefined) };
    }),
    notes: gen.data.notes,
  };
}

export function saveUnitGames(g: UnitGames): void {
  writeFileSync(ensureDir(paths.games(g.unitId)), JSON.stringify(g, null, 2));
}

/** From the local cache, or else from the versioned archive in the repository. */
export function readUnitGames(unitId: string): UnitGames | null {
  for (const file of [paths.games(unitId), paths.gamesArchive(unitId)]) {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as UnitGames;
  }
  return null;
}

/** Writes a unit's pieces, re-verified with the current checks, to the versioned archive (no AI). */
export function archiveUnitGames(u: ContentUnit): boolean {
  const g = readUnitGames(u.id);
  if (!g) return false;
  writeFileSync(ensureDir(paths.gamesArchive(u.id)), JSON.stringify(reverifyGames(u, g), null, 2));
  return true;
}

/** Recomputes every verification from what was generated and solved (a fixed check costs nothing). */
export function reverifyGames(u: ContentUnit, g: UnitGames): UnitGames {
  return {
    ...g,
    pieces: g.pieces.map((p) => ({ ...p, verification: verifyGame(p.game, u.skills.length, p.seed, p.solved ?? undefined) })),
  };
}

/** Item rows for one unit's pieces (drafts). The answer goes only to game_answer. */
export function gameRows(u: ContentUnit, g: UnitGames) {
  const [gp, gv] = g.prompts.games.split("@");
  return g.pieces
    .filter((p) => p.verification.structural.length === 0)
    .map((p) => {
      const { pub, answer } = splitGame(p.game, p.seed);
      return {
        unit_id: u.id,
        skill_ids: u.skills[p.game.skill_index] ? [u.skills[p.game.skill_index].id] : [],
        kind: `game_${p.game.mechanic}`,
        stem: p.game.mechanic === "fill" ? `${p.game.instruction}\n\n${p.game.stem}` : p.game.instruction,
        explanation: p.game.explanation,
        difficulty: 3,
        verified: p.verification.verified,
        verification: { ...p.verification, solved_with: g.models.solve, solve_prompt: g.prompts.solve },
        status: "draft",
        origin: "bulk",
        model: g.models.games,
        prompt_id: gp,
        prompt_version: gv,
        game_public: pub,
        game_answer: answer,
      };
    });
}

export interface LoadGamesSummary {
  skipped: boolean;
  pieces: number;
  verified: number;
}

/**
 * Writes one unit's pieces as drafts. A unit that already has game pieces is skipped: published
 * pieces may have students' answers, which must never be deleted.
 */
export async function loadUnitGames(db: Db, u: ContentUnit, cached: UnitGames): Promise<LoadGamesSummary> {
  const g = reverifyGames(u, cached);
  const existing = await db.select("items", `unit_id=eq.${u.id}&kind=in.(game_pairs,game_order,game_fill,game_find_error)&select=id&limit=1`);
  if (existing.length) return { skipped: true, pieces: 0, verified: 0 };
  const rows = gameRows(u, g);
  await db.insert("items", rows, { returning: false });
  return { skipped: false, pieces: rows.length, verified: rows.filter((r) => r.verified).length };
}

/** Publishes the verified drafts of these units. What failed a check stays as a draft. */
export async function publishVerifiedGames(db: Db, unitIds: string[]): Promise<number> {
  if (unitIds.length === 0) return 0;
  return db.update(
    "items",
    `unit_id=in.(${unitIds.join(",")})&status=eq.draft&verified=is.true&kind=in.(game_pairs,game_order,game_fill,game_find_error)`,
    { status: "published" },
  );
}

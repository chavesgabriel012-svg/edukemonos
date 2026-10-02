import { describe, expect, it } from "vitest";
import {
  estimateAbility,
  kFactor,
  levelMessage,
  levelOf,
  nextDifficulty,
  pCorrect,
  pickDiagnosticItem,
  studyPath,
  updateMastery,
} from "../src/learning";

describe("mastery", () => {
  it("starts at 0.5 and moves up after a right answer, down after a wrong one", () => {
    const up = updateMastery(null, 0, 3, true);
    const down = updateMastery(null, 0, 3, false);
    expect(up).toBeCloseTo(0.6457, 4); // σ(1.2 × 0.5)
    expect(down).toBeCloseTo(1 - 0.6457, 4);
  });

  it("rewards a hard item more than an easy one, and punishes an easy miss more", () => {
    expect(updateMastery(0.5, 3, 5, true)).toBeGreaterThan(updateMastery(0.5, 3, 1, true));
    expect(updateMastery(0.5, 3, 1, false)).toBeLessThan(updateMastery(0.5, 3, 5, false));
  });

  it("settles as evidence accumulates and never reaches certainty", () => {
    expect(kFactor(0)).toBe(1.2);
    expect(kFactor(100)).toBe(0.3);
    let s: number | null = null;
    for (let n = 0; n < 50; n++) s = updateMastery(s, n, 3, true);
    expect(s).toBeLessThanOrEqual(0.98);
    expect(s).toBeGreaterThan(0.9);
  });

  it("matches the vectors the database is tested against", () => {
    // Same sequence as supabase/tests (mastery after each answer of one skill).
    const seq: [number, boolean][] = [[3, true], [4, true], [4, false], [2, true], [5, false]];
    let s: number | null = null;
    const out = seq.map(([d, c], n) => (s = updateMastery(s, n, d, c)));
    expect(out.map((x) => Number(x.toFixed(4)))).toEqual([0.6457, 0.7554, 0.6599, 0.6882, 0.6472]);
  });
});

describe("diagnostic", () => {
  it("walks a staircase within 1..5 starting at the grade level", () => {
    expect(nextDifficulty([])).toBe(3);
    expect(nextDifficulty([{ difficulty: 3, correct: true }])).toBe(4);
    expect(nextDifficulty([{ difficulty: 5, correct: true }])).toBe(5);
    expect(nextDifficulty([{ difficulty: 1, correct: false }])).toBe(1);
  });

  it("estimates ability with a prior that keeps perfect runs finite", () => {
    expect(estimateAbility([])).toBe(0);
    const allRight = estimateAbility(Array.from({ length: 10 }, () => ({ difficulty: 5, correct: true })));
    expect(Number.isFinite(allRight)).toBe(true);
    expect(levelOf(allRight)).toBeGreaterThan(4);
    const mixed = estimateAbility([
      { difficulty: 3, correct: true }, { difficulty: 4, correct: false }, { difficulty: 3, correct: true }, { difficulty: 4, correct: false },
    ]);
    expect(levelOf(mixed)).toBeGreaterThan(3);
    expect(levelOf(mixed)).toBeLessThan(4);
    // At the MAP estimate: Σ P(correct) = Σ correct − θ (the N(0,1) prior pulls toward 0).
    expect(2 * (pCorrect(mixed, 3) + pCorrect(mixed, 4))).toBeCloseTo(2 - mixed, 6);
  });

  it("maps levels to kind messages without negative labels", () => {
    expect(levelOf(0)).toBe(3);
    expect(levelOf(-10)).toBe(1);
    expect(levelMessage(4)).toMatch(/muy bien/);
    expect(levelMessage(1.5)).toMatch(/repasar las bases/);
    for (const l of [1, 2, 3, 4, 5]) expect(levelMessage(l)).not.toMatch(/malo|mal |no sabe|deficiente/i);
  });

  it("picks the closest difficulty from the least-asked unit and never repeats", () => {
    const items = [
      { id: "a", unit_id: "u1", difficulty: 3 },
      { id: "b", unit_id: "u2", difficulty: 3 },
      { id: "c", unit_id: "u2", difficulty: 5 },
      { id: "d", unit_id: "u1", difficulty: 4 },
    ];
    const units = ["u1", "u2"];
    expect(pickDiagnosticItem(items, [], [], 3, units)?.id).toBe("a");
    expect(pickDiagnosticItem(items, ["a"], ["u1"], 3, units)?.id).toBe("b");
    expect(pickDiagnosticItem(items, ["a", "b"], ["u1", "u2"], 5, units)?.id).toBe("c");
    expect(pickDiagnosticItem(items, ["a", "b", "c", "d"], [], 3, units)).toBeNull();
  });
});

describe("studyPath", () => {
  const unit = (id: string, sort_order: number, skill_ids: string[]) => ({ id, title: id, sort_order, skill_ids });

  it("puts units to reinforce first, then unexplored ones in curriculum order, mastered ones last", () => {
    const units = [unit("u1", 1, ["s1"]), unit("u2", 2, ["s2"]), unit("u3", 3, ["s3"]), unit("u4", 4, ["s4"])];
    const mastery = new Map([["s1", 0.9], ["s3", 0.3]]);
    const path = studyPath(units, mastery);
    expect(path.map((e) => [e.unit.id, e.status])).toEqual([
      ["u3", "reforzar"],
      ["u2", "por_explorar"],
      ["u4", "por_explorar"],
      ["u1", "dominado"],
    ]);
  });
});

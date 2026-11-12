import { describe, expect, it } from "vitest";
import { goalTarget, isSafeNickname, type LeaderboardEntry, leaderboardWindow, NICKNAME_ADJECTIVES } from "../src/section-goal";

const e = (id: string, improvement: number, extra: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({ id, nickname: `Tucán Azul ${10 + Number(id.slice(1))}`, hidden: false, improvement, ...extra });

describe("goalTarget", () => {
  it("without history: half a skill per active student, at least 3", () => {
    expect(goalTarget(26, [])).toBe(13);
    expect(goalTarget(3, [0, 0])).toBe(3);
    expect(goalTarget(0, [])).toBe(3);
  });
  it("with history: 10 % above the median of recent weeks", () => {
    expect(goalTarget(26, [10, 14, 12, 20])).toBe(15); // median 13 → 14.3 → 15
    expect(goalTarget(26, [2, 0, 1])).toBe(3);
  });
});

describe("leaderboardWindow", () => {
  const class8 = [e("s1", 0.9), e("s2", 0.8), e("s3", 0.7), e("s4", 0.6), e("s5", 0.5), e("s6", 0.4), e("s7", 0.3), e("s8", 0.2)];

  it("shows me with up to 2 above and 2 below, never the full list", () => {
    const rows = leaderboardWindow(class8, "s4");
    expect(rows.map((r) => r.points)).toEqual([80, 70, 60, 50, 40]);
    expect(rows.filter((r) => r.me)).toHaveLength(1);
  });

  it("never shows the last place to others", () => {
    const rows = leaderboardWindow(class8, "s7");
    expect(rows.map((r) => r.points)).toEqual([50, 40, 30]); // s8 (last) is left out
  });

  it("the last student sees their own row and those above, with nothing marking the place", () => {
    expect(leaderboardWindow(class8, "s8").map((r) => r.points)).toEqual([40, 30, 20]);
  });

  it("leaves out hidden students, students without nickname and without improvement", () => {
    const rows = leaderboardWindow([...class8.slice(0, 5), e("s6", 0.4, { hidden: true }), e("s7", 0.3, { nickname: null }), e("s8", 0)], "s5");
    expect(rows.map((r) => r.points)).toEqual([70, 60, 50]); // s5 is now last of the ranked, sees itself
  });

  it("shows nothing with fewer than 4 ranked students, or when I am not ranked", () => {
    expect(leaderboardWindow(class8.slice(0, 3), "s1")).toEqual([]);
    expect(leaderboardWindow(class8, "nobody")).toEqual([]);
  });
});

describe("nicknames", () => {
  it("accepts only list combinations with a number 10–99", () => {
    expect(isSafeNickname("Tucán Azul 27")).toBe(true);
    expect(isSafeNickname("Ceiba Valiente 99")).toBe(true);
    expect(isSafeNickname("Tucán Azul 7")).toBe(false);
    expect(isSafeNickname("Juan Pérez 27")).toBe(false);
    expect(isSafeNickname("tucán azul 27")).toBe(false);
  });
  it("adjectives have no gender", () => {
    for (const a of NICKNAME_ADJECTIVES) expect(a).not.toMatch(/[oa]$/);
  });
});

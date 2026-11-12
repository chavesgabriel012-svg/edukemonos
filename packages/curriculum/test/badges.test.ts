import { describe, expect, it } from "vitest";
import { CERTIFICATE_CODE, nextStreakBadge, normalizeCertificateCode, streakBadges, tournamentWinners, unitMastered } from "../src/badges";

describe("streak badges", () => {
  it("first week at 1, then 4, 8 and 12 weeks of best streak", () => {
    expect(streakBadges(0)).toEqual([]);
    expect(streakBadges(1)).toEqual(["first_week"]);
    expect(streakBadges(5)).toEqual(["first_week", "streak_4"]);
    expect(streakBadges(13)).toEqual(["first_week", "streak_4", "streak_8", "streak_12"]);
  });
  it("tells which one comes next", () => {
    expect(nextStreakBadge(0)).toEqual({ badge: "first_week", weeks: 1 });
    expect(nextStreakBadge(5)).toEqual({ badge: "streak_8", weeks: 8 });
    expect(nextStreakBadge(12)).toBeNull();
  });
});

describe("unitMastered", () => {
  it("needs every skill at 0.70 or more, and at least one skill", () => {
    expect(unitMastered([0.7, 0.92])).toBe(true);
    expect(unitMastered([0.7, 0.69])).toBe(false);
    expect(unitMastered([0.8, null])).toBe(false);
    expect(unitMastered([])).toBe(false);
  });
});

describe("tournamentWinners", () => {
  it("the highest score wins; ties share it; nobody wins with zero", () => {
    expect(tournamentWinners([{ name: "Equipo Lapa", score: 6.5 }, { name: "Equipo Ceiba", score: 8 }])).toEqual(["Equipo Ceiba"]);
    expect(tournamentWinners([{ name: "Equipo Lapa", score: 8 }, { name: "Equipo Ceiba", score: 8 }, { name: "Equipo Puma", score: 2 }])).toEqual(["Equipo Ceiba", "Equipo Lapa"]);
    expect(tournamentWinners([{ name: "Equipo Lapa", score: 0 }])).toEqual([]);
    expect(tournamentWinners([])).toEqual([]);
  });
});

describe("certificate codes", () => {
  it("accepts the code as typed, with or without the dash", () => {
    expect(normalizeCertificateCode("7f3a29c01b")).toBe("7F3A2-9C01B");
    expect(normalizeCertificateCode(" 7F3A2-9C01B ")).toBe("7F3A2-9C01B");
    expect(CERTIFICATE_CODE.test("7F3A2-9C01B")).toBe(true);
    expect(CERTIFICATE_CODE.test("7F3A2-9C01")).toBe(false);
  });
});

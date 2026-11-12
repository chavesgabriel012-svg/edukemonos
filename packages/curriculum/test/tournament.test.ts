import { describe, expect, it } from "vitest";
import {
  lateJoinTeam,
  memberPoints,
  pickTopics,
  snakeTeams,
  teamCount,
  teamScore,
  TEAM_NAMES,
  tournamentStatus,
  tournamentWindow,
  visibleTeams,
} from "../src/tournament";

const students = (levels: number[]) => levels.map((level, k) => ({ id: `s${String(k + 1).padStart(2, "0")}`, level }));

describe("teamCount", () => {
  it("teams of at most 5, none below 6 students", () => {
    expect([0, 3, 5].map(teamCount)).toEqual([0, 0, 0]);
    expect([6, 10, 11, 15, 16, 26].map(teamCount)).toEqual([2, 2, 3, 3, 4, 6]);
  });

  it("every team has between 3 and 5 members", () => {
    for (let n = 6; n <= 40; n++) {
      const sizes = snakeTeams(students(Array.from({ length: n }, (_, k) => k / n))).map((t) => t.length);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(3);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(5);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe("snakeTeams", () => {
  it("deals the strongest to team 1, then back and forth", () => {
    // Levels 0.9 … 0.4: order s01 (0.9) … s06 (0.4); two teams: 0, 1, 1, 0, 0, 1.
    expect(snakeTeams(students([0.9, 0.8, 0.7, 0.6, 0.5, 0.4]))).toEqual([["s01", "s04", "s05"], ["s02", "s03", "s06"]]);
  });

  it("balances the teams' mean level", () => {
    const levels = Array.from({ length: 26 }, (_, k) => 0.2 + (k * 0.7) / 25);
    const byId = new Map(students(levels).map((s) => [s.id, s.level]));
    const means = snakeTeams(students(levels)).map((t) => t.reduce((a, id) => a + byId.get(id)!, 0) / t.length);
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.08);
  });

  it("breaks ties by id, so the draft is the same every time", () => {
    const a = snakeTeams(students([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(a).toEqual(snakeTeams(students([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]).reverse()));
  });
});

describe("lateJoinTeam", () => {
  it("joins the smallest team, the first one on a tie", () => {
    expect(lateJoinTeam([5, 4, 4])).toBe(1);
    expect(lateJoinTeam([3, 3])).toBe(0);
  });
});

describe("points", () => {
  it("right answers count up to 10, plus one point per 0.05 of mastery gained", () => {
    expect(memberPoints(7, 0)).toBe(7);
    expect(memberPoints(14, 0)).toBe(10);
    expect(memberPoints(3, 0.15)).toBe(6); // not 5: 0.15 / 0.05 is 2.999… in floating point
    expect(memberPoints(0, 0.049)).toBe(0);
    expect(memberPoints(2, -0.3)).toBe(2); // a drop in mastery never takes points away
  });

  it("a team scores the mean per member, with one decimal", () => {
    expect(teamScore([10, 6, 2])).toBe(6);
    expect(teamScore([9, 0, 0, 0])).toBe(2.3); // 2.25
    expect(teamScore([7, 8, 8])).toBe(7.7);
    expect(teamScore([])).toBe(0);
  });
});

describe("visibleTeams", () => {
  const teams = [
    { id: "a", name: "Equipo Ceiba", score: 6.5 },
    { id: "b", name: "Equipo Lapa", score: 8 },
    { id: "c", name: "Equipo Puma", score: 3 },
    { id: "d", name: "Equipo Roble", score: 5 },
  ];

  it("shows the teams above the last, by score, and marks mine", () => {
    expect(visibleTeams(teams, "a")).toEqual([
      { id: "b", name: "Equipo Lapa", score: 8, me: false },
      { id: "a", name: "Equipo Ceiba", score: 6.5, me: true },
      { id: "d", name: "Equipo Roble", score: 5, me: false },
    ]);
  });

  it("the last team sees itself, with nothing marking it as last", () => {
    expect(visibleTeams(teams, "c").map((t) => t.name)).toEqual(["Equipo Lapa", "Equipo Ceiba", "Equipo Roble", "Equipo Puma"]);
  });

  it("teams tied for last are all left out; with everybody tied, only mine", () => {
    const tied = [...teams, { id: "e", name: "Equipo Tapir", score: 3 }];
    expect(visibleTeams(tied, "a").map((t) => t.name)).toEqual(["Equipo Lapa", "Equipo Ceiba", "Equipo Roble"]);
    expect(visibleTeams(teams.map((t) => ({ ...t, score: 0 })), "d")).toEqual([{ id: "d", name: "Equipo Roble", score: 0, me: true }]);
    expect(visibleTeams(teams.map((t) => ({ ...t, score: 0 })), null)).toEqual([]);
  });
});

describe("pickTopics", () => {
  it("the skills most students worked, then most attempts, at most 8", () => {
    const rows = [
      { skillId: "k1", studentId: "a", attempts: 1 },
      { skillId: "k2", studentId: "a", attempts: 9 },
      { skillId: "k1", studentId: "b", attempts: 1 },
      { skillId: "k3", studentId: "b", attempts: 2 },
      { skillId: "k4", studentId: "c", attempts: 0 },
      ...Array.from({ length: 10 }, (_, k) => ({ skillId: `z${k}`, studentId: "d", attempts: 1 })),
    ];
    const topics = pickTopics(rows);
    expect(topics.slice(0, 3)).toEqual(["k1", "k2", "k3"]);
    expect(topics).toHaveLength(8);
    expect(topics).not.toContain("k4");
  });
});

describe("window", () => {
  it("opens Friday 00:00 and closes Monday 00:00, Costa Rica time", () => {
    const { opensAt, closesAt } = tournamentWindow("2027-03-08");
    expect(opensAt.toISOString()).toBe("2027-03-12T06:00:00.000Z");
    expect(closesAt.toISOString()).toBe("2027-03-15T06:00:00.000Z");
    expect(tournamentStatus("2027-03-08", new Date("2027-03-12T05:59:00Z"))).toBe("upcoming"); // Thursday 23:59 CR
    expect(tournamentStatus("2027-03-08", new Date("2027-03-14T23:00:00Z"))).toBe("open"); // Sunday 17:00 CR
    expect(tournamentStatus("2027-03-08", new Date("2027-03-15T06:00:00Z"))).toBe("closed");
  });

  it("team names come from the safe list", () => {
    expect(TEAM_NAMES[0]).toBe("Equipo Tucán");
    expect(new Set(TEAM_NAMES).size).toBe(TEAM_NAMES.length);
  });
});

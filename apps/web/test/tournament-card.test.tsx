import type { StudentTournament } from "@edukemonos/curriculum";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

const { TournamentCard } = await import("@/components/learn/tournament-card");

const SECTION = "11111111-2222-4333-8444-555555555555";
const tournament = (me: Partial<NonNullable<NonNullable<StudentTournament["tournament"]>["me"]>> | null) => ({
  id: "t1",
  week_start: "2027-03-08",
  opens_at: "2027-03-12T06:00:00Z",
  closes_at: "2027-03-15T06:00:00Z",
  topics: ["Calcular potencias", "Operaciones combinadas"],
  teams: [
    { name: "Equipo Lapa", score: 8, me: false },
    { name: "Equipo Ceiba", score: 6.5, me: true },
  ],
  me: me && { team: "Equipo Ceiba", team_size: 4, team_score: 6.5, answered: 0, correct: 0, counted: 0, improvement_points: 0, points: 0, questions: 10, started: false, ...me },
});
const render = (data: StudentTournament | null) => renderToStaticMarkup(<TournamentCard sectionId={SECTION} data={data} />);

describe("TournamentCard", () => {
  it("shows nothing when the teacher turned it off or it could not be read", () => {
    expect(render({ enabled: false })).toBe("");
    expect(render(null)).toBe("");
  });

  it("before Friday: when it opens, and no button", () => {
    const html = render({ enabled: true, status: "upcoming", tournament: null });
    expect(html).toContain("abre el viernes");
    expect(html).not.toContain("<a ");
  });

  it("a week without a tournament says why", () => {
    expect(render({ enabled: true, status: "none", tournament: null })).toContain("al menos 6 estudiantes");
  });

  it("open: my team, my points, the teams above the last and the way in", () => {
    const html = render({ enabled: true, status: "open", tournament: tournament({}) });
    expect(html).toContain("Estás en el Equipo Ceiba");
    expect(html).toContain("Tu equipo · Equipo Ceiba");
    expect(html).toContain("6,5");
    expect(html).toContain(`href="/mis-secciones/${SECTION}/torneo"`);
    expect(html).toContain("Jugar el torneo");
  });

  it("half played: how many questions are left; all played: no button", () => {
    expect(render({ enabled: true, status: "open", tournament: tournament({ started: true, answered: 7, correct: 5, counted: 5 }) })).toContain("Seguir (3 preguntas)");
    const done = render({ enabled: true, status: "open", tournament: tournament({ started: true, answered: 10, correct: 8, counted: 8, improvement_points: 3, points: 11 }) });
    expect(done).not.toContain("<a ");
    expect(done).toContain("+3");
  });

  it("Monday to Thursday: the last result, no button", () => {
    const html = render({ enabled: true, status: "upcoming", tournament: tournament({ started: true, answered: 10, counted: 6 }) });
    expect(html).toContain("Resultado del último torneo");
    expect(html).not.toContain("<a ");
  });

  it("a late student who has not played yet sees the open tournament and can join", () => {
    const html = render({ enabled: true, status: "open", tournament: tournament(null) });
    expect(html).toContain("El torneo está abierto");
    expect(html).toContain("Jugar el torneo");
  });
});

describe("TournamentCard, fase 5: the winner of the last tournament", () => {
  const closed = (winners: string[]) => ({ ...tournament({ started: true, answered: 10, counted: 6 }), closed: true, winners });

  it("says which team won, until the next one opens", () => {
    expect(render({ enabled: true, status: "upcoming", tournament: closed(["Equipo Lapa"]) })).toContain("Ganó el último torneo: Equipo Lapa");
  });
  it("celebrates when it is the student's own team", () => {
    expect(render({ enabled: true, status: "upcoming", tournament: closed(["Equipo Ceiba"]) })).toContain("¡Tu equipo ganó el último torneo!");
  });
  it("says nothing while it is open, or when nobody scored", () => {
    expect(render({ enabled: true, status: "open", tournament: { ...tournament({}), closed: false, winners: [] } })).not.toContain("Ganó");
    expect(render({ enabled: true, status: "upcoming", tournament: closed([]) })).not.toContain("Ganó");
  });
});

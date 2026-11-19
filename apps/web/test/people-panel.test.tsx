import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The panel only needs the actions' shape here; the real ones talk to Supabase.
vi.mock("@/app/(app)/docente/institucion/actions", () => ({
  invitePeople: vi.fn(),
  resendInvite: vi.fn(),
  revokeInvite: vi.fn(),
  setMemberRole: vi.fn(),
  removeMember: vi.fn(),
}));

import { PeoplePanel } from "@/components/school/people-panel";

const members = [
  { profile_id: "m1", name: "Marta Rojas", role: "admin" as const },
  { profile_id: "m2", name: "Luis Mora", role: "teacher" as const },
  { profile_id: "m3", name: "Sofía Vega", role: "teacher" as const },
];
const people = [
  { kind: "member" as const, profile_id: "m1", invite_id: null, name: "Marta Rojas", email: "marta@c.cr", role: "admin" as const, status: "activo" as const, since: "2026-01-05T00:00:00Z" },
  { kind: "member" as const, profile_id: "m2", invite_id: null, name: "Luis Mora", email: "luis@c.cr", role: "teacher" as const, status: "activo" as const, since: "2026-01-06T00:00:00Z" },
  { kind: "invite" as const, profile_id: null, invite_id: "i1", name: "Ana", email: "ana@c.cr", role: "teacher" as const, status: "invitado" as const, since: "2026-02-01T00:00:00Z" },
];
const list = "luis@c.cr, Luis\nana@c.cr, Ana\nmalo, Pedro\nana@c.cr, Ana";
const preview = {
  people: [
    { email: "luis@c.cr", name: "Luis", role: "teacher" as const },
    { email: "bea@c.cr", name: "Bea", role: "admin" as const },
  ],
  errors: [{ line: 3, text: "malo, Pedro", reason: "email" as const }],
  duplicates: ["ana@c.cr"],
};

describe("PeoplePanel", () => {
  const html = renderToStaticMarkup(
    <PeoplePanel institutionId="i" people={people} members={members} initialState={{ preview, list }} />,
  );

  it("shows what the pasted list will do before anything is sent", () => {
    expect(html).toContain("2 personas listas");
    expect(html).toContain("Línea 3: correo no válido");
    expect(html).toContain("Repetido: ana@c.cr");
  });

  it("marks who is already a member or already invited", () => {
    const html2 = renderToStaticMarkup(
      <PeoplePanel
        institutionId="i"
        people={people}
        members={members}
        initialState={{
          list,
          preview: {
            people: [
              { email: "Luis@C.cr", name: "Luis", role: "teacher" },
              { email: "ana@c.cr", name: "Ana", role: "teacher" },
              { email: "bea@c.cr", name: "Bea", role: "teacher" },
            ],
            errors: [],
            duplicates: [],
          },
        }}
      />,
    );
    expect(html2).toContain("ya tenía una invitación");
    expect(html2.match(/ya es parte del colegio/g)).toHaveLength(1);
  });

  it("lets the coordination send the invitations", () => {
    const button = html.match(/<button[^>]*>Enviar invitaciones<\/button>/)?.[0] ?? "";
    expect(button).not.toBe("");
    expect(button).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it("offers as replacement the active members except the one removed", () => {
    const selects = [...html.matchAll(/<select[^>]*name="replacement"[^>]*>(.*?)<\/select>/g)].map((m) => m[1]);
    expect(selects).toHaveLength(2);
    const forM1 = selects[0];
    expect(forM1).toContain("Coordinación con más tiempo en el colegio");
    expect(forM1).not.toContain("Marta Rojas");
    expect(forM1).toContain("Luis Mora");
    expect(forM1).toContain("Sofía Vega");
  });
});

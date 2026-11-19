import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/admin/actions", () => ({ setOffering: vi.fn(), saveInstitution: vi.fn() }));

import { OfferingGrid } from "@/components/admin/offering-grid";

const subjects = [
  { id: "matematicas", name: "Matemáticas" },
  { id: "espanol", name: "Español" },
];
// Published content only in 7.º Matemáticas; 7.º Español has an approved offering with no content.
const units = [{ grade_id: 7, subject_id: "matematicas" }];
const offerings = [{ grade_id: 7, subject_id: "espanol", status: "aprobado" as const }];

const html = renderToStaticMarkup(<OfferingGrid institutionId="i" grades={[7, 8, 9]} subjects={subjects} units={units} offerings={offerings} />);
const cell = (grade: number, subject: string) => html.match(new RegExp(`<td data-cell="${grade}-${subject}"[^>]*>.*?</td>`))?.[0] ?? "";

describe("OfferingGrid", () => {
  it("disables a cell without published content", () => {
    const c = cell(8, "matematicas");
    expect(c).toContain("Sin contenido");
    expect(c).toContain("disabled");
  });
  it("lets the team offer a subject that has content", () => {
    const c = cell(7, "matematicas");
    expect(c).toContain("Disponible");
    expect(c).not.toContain("disabled");
  });
  it("shows an approved subject as approved, with nothing to uncheck", () => {
    const c = cell(7, "espanol");
    expect(c).toContain("Aprobado");
    expect(c).not.toContain("<input");
  });
});

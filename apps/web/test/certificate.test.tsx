import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/estudiar/actions", () => ({ logCertificateDownload: vi.fn() }));
const { Certificate } = await import("@/app/(app)/certificado/[unidad]/certificate");

const data = {
  unitId: "u1",
  unit: "Potencias",
  subject: "Matemáticas",
  grade: 7,
  skills: ["Calcular potencias de base entera", "Aplicar las leyes de potencias"],
  earnedOn: "12 de marzo de 2027",
  code: "7F3A2-9C01B",
  verifyUrl: "eduka.cr/verificar/7F3A2-9C01B",
};

describe("Certificate", () => {
  const html = renderToStaticMarkup(<Certificate data={data} />);

  it("shows the unit, its skills, the date and the verification code", () => {
    for (const text of ["Potencias", "Matemáticas · 7.º año", "Aplicar las leyes de potencias", "12 de marzo de 2027", "7F3A2-9C01B", "eduka.cr/verificar/7F3A2-9C01B"]) {
      expect(html).toContain(text);
    }
  });

  it("starts with no name (it is typed in the browser) and says it has no official value", () => {
    expect(html).toContain('value=""');
    expect(html).toContain("no tiene valor oficial");
    expect(html).toContain("Eduka no lo guarda");
  });

  it("hides the form when printing", () => {
    expect(html).toMatch(/class="[^"]*print:hidden[^"]*"/);
  });
});

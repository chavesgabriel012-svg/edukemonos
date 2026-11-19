import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoBanner } from "@/components/learn/demo-banner";

describe("DemoBanner", () => {
  it("says plainly that this is a demo and that no teacher sees it", () => {
    const html = renderToStaticMarkup(<DemoBanner />);
    expect(html).toContain("Estás en la demostración de Eduka. Lo que hagas aquí no le llega a ningún docente.");
  });
});

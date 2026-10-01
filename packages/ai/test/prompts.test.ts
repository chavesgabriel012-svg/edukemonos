import { describe, expect, it } from "vitest";
import { definePrompt, renderPrompt } from "../src/prompts";

describe("versioned prompts", () => {
  const p = definePrompt({
    id: "test",
    version: "1",
    description: "test",
    template: "Grado {{grade}}: {{topic}}",
    variables: ["grade", "topic"],
  });

  it("renders declared variables", () => {
    expect(renderPrompt(p, { grade: "7", topic: "potencias" })).toBe("Grado 7: potencias");
  });

  it("rejects undeclared or missing variables", () => {
    expect(() =>
      definePrompt({ id: "x", version: "1", description: "", template: "{{a}} {{b}}", variables: ["a"] }),
    ).toThrow(/undeclared/);
    expect(() => renderPrompt(p, { grade: "7" } as never)).toThrow(/Missing value/);
  });
});

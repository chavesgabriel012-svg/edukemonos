import { z } from "zod";
import { renderPrompt } from "./prompts/define";
import { teacherSummarySystem, teacherSummaryUser } from "./prompts/teacher";

export { teacherSummarySystem, teacherSummaryUser };

export const teacherSummarySchema = z.object({
  resumen: z.string().describe("2 o 3 oraciones para la persona docente"),
  acciones: z.array(z.object({
    id: z.string().describe("id del hallazgo"),
    sugerencia: z.string().describe("Sugerencia concreta para la clase, 1 o 2 oraciones"),
  })),
});
export type TeacherSummary = z.infer<typeof teacherSummarySchema>;

export interface SummaryFinding {
  id: string;
  title: string;
  detail: string;
  evidence: string;
}

/** The prompt pair for a section. Findings carry counts and unit titles only: never names. */
export function teacherSummaryPrompt(section: string, findings: SummaryFinding[]) {
  return {
    system: renderPrompt(teacherSummarySystem, {}),
    user: renderPrompt(teacherSummaryUser, {
      section,
      findings: JSON.stringify(findings.map(({ id, title, detail, evidence }) => ({ id, title, detail, evidence })), null, 2),
    }),
  };
}

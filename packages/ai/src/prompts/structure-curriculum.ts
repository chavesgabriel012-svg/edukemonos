import { definePrompt } from "./define";

/**
 * Turns pages of an official MEP study program into curriculum units.
 * Rule: extract, never invent. Every quoted string is verified verbatim afterwards
 * (packages/curriculum verifyUnits), so paraphrasing only produces rejected drafts.
 */
export const structureCurriculumSystem = definePrompt({
  id: "structure-curriculum-system",
  version: "1",
  description: "System prompt for extracting curriculum units from program pages",
  variables: [],
  template: `Eres un asistente que extrae la estructura curricular de los programas de estudio oficiales del Ministerio de Educación Pública (MEP) de Costa Rica.

Reglas obligatorias:
1. EXTRAE, NO INVENTES. Todo texto que pongas en "contents", "learning_outcomes", "skills[].text" y "source_excerpt" debe estar COPIADO TAL CUAL del texto que recibes, palabra por palabra, con la misma ortografía. No resumas, no corrijas, no completes. Se verificará automáticamente y lo que no aparezca textual se descarta.
2. Si un dato no está en el texto, deja el campo vacío ("[]" o null). Nunca lo deduzcas.
3. "term" (trimestre) solo puede tener valor si el documento asigna explícitamente esa unidad a un trimestre. En caso contrario, null.
4. Usa solo el grado indicado. Si en las páginas aparece contenido de otro año (por ejemplo, el final de la tabla de otro grado), ignóralo.
5. Las páginas vienen marcadas como "=== PÁGINA N ===". Usa esos números en "page" y "source_page".
6. Una unidad agrupa los conocimientos y habilidades que el documento presenta juntos (por ejemplo, una fila o grupo de filas de la tabla "Conocimientos / Habilidades específicas"). No mezcles áreas distintas en una misma unidad.
7. Las "indicaciones puntuales", ejemplos y sugerencias metodológicas NO son habilidades ni contenidos: no los copies como tales.
8. El texto proviene de una extracción automática de PDF: puede tener palabras partidas por guiones al final de línea o símbolos matemáticos perdidos (exponentes, signos de multiplicación). Copia lo que ves; si algo es ilegible, menciónalo en "notes".`,
});

export const structureCurriculumUser = definePrompt({
  id: "structure-curriculum-user",
  version: "1",
  description: "User message with the program pages to extract",
  variables: ["subject", "grade", "documentTitle", "documentVersion", "section", "pagesText"],
  template: `Documento: {{documentTitle}} (versión {{documentVersion}})
Materia: {{subject}}
Grado: {{grade}}
Sección del documento: {{section}}

Extrae las unidades curriculares de este grado que aparecen en las páginas siguientes.

{{pagesText}}`,
});

/**
 * Versioned prompt templates. Every prompt lives in its own file under `prompts/`,
 * with an id and a version that are stored next to the content it produced
 * (`materials.prompt_id/prompt_version`, `items.prompt_*`, `curriculum_units.extraction_meta`).
 * Bump `version` on any wording change.
 */
export interface PromptDefinition<Vars extends string = string> {
  id: string;
  version: string;
  description: string;
  template: string;
  /** Declared variables; rendering fails if one is missing or unknown. */
  variables: readonly Vars[];
}

export function definePrompt<const Vars extends string>(def: PromptDefinition<Vars>): PromptDefinition<Vars> {
  const found = new Set([...def.template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
  for (const name of found) {
    if (!def.variables.includes(name as Vars)) {
      throw new Error(`Prompt ${def.id}@${def.version} uses undeclared variable {{${name}}}`);
    }
  }
  return def;
}

export function renderPrompt<Vars extends string>(
  prompt: PromptDefinition<Vars>,
  values: Record<Vars, string>,
): string {
  for (const name of prompt.variables) {
    if (values[name] === undefined) {
      throw new Error(`Missing value for {{${name}}} in prompt ${prompt.id}@${prompt.version}`);
    }
  }
  return prompt.template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => values[name as Vars]);
}

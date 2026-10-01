import type { z } from "zod";
import type { ToolDefinition } from "./types";

/** Keeps `run` typed against the schema, then erases the type so tools can share one array. */
export function defineTool<Schema extends z.ZodType>(def: ToolDefinition<Schema>): ToolDefinition {
  return def as unknown as ToolDefinition;
}

/** Validates model-supplied input against the tool's schema before running it. */
export async function runTool(
  tool: ToolDefinition | undefined,
  input: unknown,
): Promise<{ output: string; isError: boolean }> {
  if (!tool) return { output: "Unknown tool.", isError: true };
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    return { output: `Invalid input: ${parsed.error.message}`, isError: true };
  }
  try {
    return { output: await tool.run(parsed.data), isError: false };
  } catch (error) {
    return { output: `Tool error: ${(error as Error).message}`, isError: true };
  }
}

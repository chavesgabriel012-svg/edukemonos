import type { z } from "zod";

export type ProviderName = "anthropic" | "openai";

/** Which configured model a call uses. IDs come only from env (MODEL_BULK, MODEL_TUTOR, MODEL_VERIFY). */
export type ModelRole = "bulk" | "tutor" | "verify";

/** What the call is for; stored in `ai_usage.purpose`. */
export type Purpose =
  | "tutor"
  | "structure_curriculum"
  | "bulk_material"
  | "bulk_items"
  | "verify_item"
  | "teacher_summary"
  | "eval"
  | "diagnostic"
  | "other";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** App-level conversation turn. Tool calls inside one `streamChat` run are handled by the adapter. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** A tool the model may call. Input is validated with the zod schema before `run` executes. */
export interface ToolDefinition<Schema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: Schema;
  run: (input: z.infer<Schema>) => Promise<string> | string;
}

export interface BaseRequest {
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  effort?: Effort;
  signal?: AbortSignal;
}

export interface TextResult {
  text: string;
  usage: Usage;
  model: string;
}

export interface StructuredRequest<Schema extends z.ZodType> extends BaseRequest {
  schema: Schema;
  /** Short identifier for the schema (OpenAI requires a name). */
  schemaName: string;
}

export interface StructuredResult<T> {
  data: T;
  usage: Usage;
  model: string;
}

export interface ChatRequest extends BaseRequest {
  tools?: ToolDefinition[];
  /** Hard cap on model↔tool round trips within one turn. */
  maxToolRounds?: number;
}

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; output: string; isError: boolean }
  | { type: "done"; usage: Usage; model: string; stopReason: string };

/** What every provider adapter implements. The app never talks to a vendor SDK directly. */
export interface ProviderAdapter {
  readonly name: ProviderName;
  generateText(req: BaseRequest): Promise<TextResult>;
  generateStructured<Schema extends z.ZodType>(
    req: StructuredRequest<Schema>,
  ): Promise<StructuredResult<z.infer<Schema>>>;
  streamChat(req: ChatRequest): AsyncIterable<ChatEvent>;
  embed?(texts: string[], model: string): Promise<{ vectors: number[][]; usage: Usage }>;
}

/** Row written to `ai_usage`. Never contains a student's name or message text. */
export interface UsageRecord {
  provider: ProviderName;
  model: string;
  purpose: Purpose;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsdEstimate: number | null;
  latencyMs: number;
  success: boolean;
  error: string | null;
  actorId?: string | null;
  sectionId?: string | null;
}

export type UsageSink = (record: UsageRecord) => void | Promise<void>;

export class AIConfigError extends Error {
  override name = "AIConfigError";
}

/** The model declined (Anthropic `stop_reason: "refusal"` / OpenAI `refusal`). Callers show a safe message. */
export class AIRefusalError extends Error {
  override name = "AIRefusalError";
  constructor(
    message: string,
    readonly category: string | null = null,
  ) {
    super(message);
  }
}

/** The model returned output that does not match the requested schema. */
export class AIOutputError extends Error {
  override name = "AIOutputError";
}

/** Every model in the role's chain failed. Callers degrade gracefully (e.g. "pregúntale a tu docente"). */
export class AIUnavailableError extends Error {
  override name = "AIUnavailableError";
  constructor(readonly attempts: { model: string; error: string }[]) {
    super(`No model could answer: ${attempts.map((a) => `${a.model}: ${a.error}`).join(" | ")}`);
  }
}

/** The daily or monthly spend fuse tripped. No AI call is made until the window resets. */
export class AIBudgetExceededError extends Error {
  override name = "AIBudgetExceededError";
  constructor(
    readonly window: "day" | "month",
    readonly spentUsd: number,
    readonly limitUsd: number,
  ) {
    super(`AI ${window} budget reached: $${spentUsd.toFixed(4)} of $${limitUsd.toFixed(2)}`);
  }
}

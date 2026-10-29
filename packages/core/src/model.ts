// The only way a model is reached (AGENTS.md rule 4, ADR 0017). Core defines
// the shape; packages/runner and packages/pi-extension build implementations
// on pi-ai, scripted tables or cassettes, and inject them. Core never imports
// pi-ai and never calls a model itself.
import { createHash } from "node:crypto";

export interface ModelRequest {
  /** `provider/model-id`. */
  model: string;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  /** From the experiment config; part of the cache key, so each seed is its own sample. */
  seed: number;
  temperature?: number;
  maxTokens?: number;
  /**
   * Ask for structured output matching this JSON Schema (OpenAI's strict
   * `json_schema` response format), as an upstream judge does. Part of the
   * request hash when set; absent, the hash is what it was before the field
   * existed. An implementation that cannot honour it must refuse the request.
   */
  responseSchema?: { name: string; schema: Record<string, unknown> };
}

export interface ModelUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface ModelResponse {
  text: string;
  usage: ModelUsage;
}

export type ModelCall = (request: ModelRequest) => Promise<ModelResponse>;

/**
 * A ModelCall's refusal of a request it cannot make as asked (such as
 * structured output it has no way to request). Callers that retry on other
 * errors must stop on this one: retrying a different request would change
 * the protocol silently.
 */
export class UnsupportedRequestError extends Error {
  readonly model: string;
  readonly feature: string;

  constructor(model: string, feature: string, detail = "") {
    super(
      `model call refused: ${model} was asked for ${feature}${detail ? ` (${detail})` : ""}, which this ModelCall cannot request`,
    );
    this.name = "UnsupportedRequestError";
    this.model = model;
    this.feature = feature;
  }
}

/** JSON with object keys sorted at every depth, so equal values hash equally. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** Hash of everything that determines a model's answer. */
export function requestHash(request: ModelRequest): string {
  return sha256(canonicalJson(request));
}

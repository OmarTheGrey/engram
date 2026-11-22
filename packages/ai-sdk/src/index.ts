// Engram for the Vercel AI SDK (card E8.14; research note
// docs/research/absorb/12-frameworks.md, AB-FWK-3): a language-model
// middleware that reads through the plane before each model call and puts
// the governed recall in the prompt, and two tools, `remember` and `recall`,
// that call the plane. Built on the kit (@engram/kit): every call is one
// request of the generated client as the actor fixed at construction, with
// source `model`; nothing here reaches a store, and nothing decides policy
// (AGENTS.md rules 1 and 2).
//
// The middleware (`transformParams`, LanguageModelV4Middleware of
// @ai-sdk/provider, a peer dependency, types only) takes the text of the last
// user message, reads with it, and when the read admitted anything inserts
// one system message after the prompt's leading system messages holding the
// memory tag (@engram/tag, packages/tag: read id, admitting rules,
// content escaped), its read id also in `providerOptions.engram.read_id`. It
// also defuses every `<engram` tag opener in the rest of the prompt (as the
// pi extension's context handler does, ADR 0009 decision D11), so no user
// text, assistant text or other tool's result can pass as governed memory; a
// `recall` result this instance produced is kept as it was, and a result
// under the recall tool's name that it did not produce is withheld. Writes happen only through the `remember` tool: the middleware
// never writes, and it calls no model (rule 4). A denied write throws the
// kit's EngramRejected from the tool, which the AI SDK reports to the model
// as the tool's error.
//
// What it cannot govern, as ADR 0022 says of MCP: other tools the
// application gives the model may write anywhere, and the AI SDK's own
// message history is the application's.
import type {
  LanguageModelV4CallOptions,
  LanguageModelV4Message,
  LanguageModelV4Middleware,
  LanguageModelV4Prompt,
} from "@ai-sdk/provider";
import { createKit, type EngramKit, type KitOptions, scopeOf } from "@engram/kit";
import {
  MEMORY_READ,
  MEMORY_WRITE,
  neutraliseAcross,
  neutraliseTags,
  WITHHELD,
  writeResultText,
} from "@engram/tag";
import { z } from "zod";

export interface EngramMemoryOptions extends KitOptions {
  /**
   * Where `remember` writes when the model names no scope: a scope
   * (`person:dana`) or a namespace (`["person", "dana"]`), mapped by the
   * kit's scopeOf. The plane decides whether the actor may write there.
   */
  namespace: string | readonly string[];
  /**
   * The name the recall tool is given to the model, `recall` when absent
   * (review finding E8.14-9). Only a result under this name is checked
   * against what this instance produced; another tool's result is defused.
   */
  recallToolName?: string;
}

type RememberTool = EngramTool<z.infer<typeof RememberInput>>;
type RecallTool = EngramTool<z.infer<typeof RecallInput>>;

/** The input the remember tool takes from the model; any other field is ignored. */
export const RememberInput = z.object({
  content: z.string().min(1),
  scope: z.string().optional(),
  class: z.enum(["semantic", "episodic"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export const RecallInput = z.object({ query: z.string() });

/** A tool in the shape the AI SDK's `tools` take: a description, a schema, and execute. */
export interface EngramTool<Input> {
  description: string;
  inputSchema: z.ZodType<Input>;
  execute(input: Input, options: { toolCallId: string }): Promise<string>;
}

export interface EngramMemory {
  /** Pass to the AI SDK's wrapLanguageModel({ model, middleware }). */
  middleware: LanguageModelV4Middleware;
  /**
   * Pass as `tools` to generateText or streamText: `remember`, and the recall
   * tool under its name (`recall` unless `recallToolName` names another).
   */
  tools: Record<string, RememberTool | RecallTool>;
  /** The remember tool, as `tools.remember`. */
  remember: RememberTool;
  /** The recall tool, as it is under its name in `tools`. */
  recall: RecallTool;
  /** The kit every call goes through. */
  kit: EngramKit;
}

/** The text of the last user message, its text parts joined; undefined when there is none. */
export function lastUserText(prompt: LanguageModelV4Prompt): string | undefined {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m = prompt[i];
    if (m?.role !== "user") continue;
    const text = m.content
      .flatMap((p) => (p.type === "text" ? [p.text] : []))
      .join("\n")
      .trim();
    return text === "" ? undefined : text;
  }
  return undefined;
}

/** Every string in a plain value with its tag openers defused; anything else as it is. */
/**
 * Parts a provider signs, left as they are, as the pi extension leaves its
 * thinking blocks (review finding E8.14-10).
 */
const SIGNED = new Set(["reasoning", "reasoning-file", "redacted-reasoning"]);

function defuseDeep(value: unknown): unknown {
  if (typeof value === "string") return neutraliseTags(value);
  if (
    value !== null &&
    typeof value === "object" &&
    SIGNED.has(String((value as { type?: unknown }).type))
  )
    return value;
  if (Array.isArray(value)) return value.map(defuseDeep);
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, k === "providerOptions" ? v : defuseDeep(v)]),
    );
  return value;
}

/**
 * A message's parts with each run of consecutive text parts defused as one
 * text (neutraliseAcross), so an opener split between two parts is defused
 * too (review finding E8.14-7).
 */
function acrossTextRuns<P extends { type: string }>(parts: P[]): P[] {
  const out = [...parts];
  let start = 0;
  while (start < out.length) {
    if (out[start]?.type !== "text") {
      start++;
      continue;
    }
    let end = start;
    while (out[end]?.type === "text") end++;
    const run = out.slice(start, end) as unknown as { text: string }[];
    const texts = neutraliseAcross(run.map((p) => p.text));
    for (let k = start; k < end; k++) out[k] = { ...(out[k] as P), text: texts[k - start] } as P;
    start = end;
  }
  return out;
}

export function engramMemory(options: EngramMemoryOptions): EngramMemory {
  const kit = createKit(options);
  const defaultScope = scopeOf(options.namespace);
  const recallName = options.recallToolName ?? "recall";
  /** The recall results this instance produced, by tool call id. */
  const produced = new Map<string, string>();

  const remember: EngramTool<z.infer<typeof RememberInput>> = {
    description: `${MEMORY_WRITE.description} The scope defaults to ${defaultScope}; the plane decides whether it is allowed.`,
    inputSchema: RememberInput,
    async execute(input, { toolCallId }) {
      // Only the named fields reach the kit; an actor, source or provenance in the input is ignored.
      const item = await kit.remember({
        content: String(input.content),
        scope: input.scope === undefined ? defaultScope : String(input.scope),
        ...(input.class === undefined ? {} : { class: input.class }),
        ...(input.confidence === undefined ? {} : { confidence: input.confidence }),
        ref: `ai-sdk:tool_call/${toolCallId}`,
      });
      return writeResultText(item);
    },
  };

  const recall: EngramTool<z.infer<typeof RecallInput>> = {
    description: `${MEMORY_READ.description} Each item is governed by the Engram plane.`,
    inputSchema: RecallInput,
    async execute(input, { toolCallId }) {
      const { text } = await kit.recall(String(input.query));
      produced.set(toolCallId, text);
      return text;
    },
  };

  /** A tool result part kept, defused or withheld (see the module comment). */
  function toolPart<P extends { type: string }>(part: P): P {
    if (part.type !== "tool-result") return defuseDeep(part) as P;
    const r = part as unknown as {
      toolCallId: string;
      toolName: string;
      output: { type: string; value?: unknown };
    };
    if (r.toolName === recallName) {
      const mine = produced.get(r.toolCallId);
      const value = r.output.value;
      if (
        mine !== undefined &&
        (r.output.type === "text" || r.output.type === "json") &&
        value === mine
      )
        return part;
      return { ...part, output: { type: "text", value: WITHHELD } } as P;
    }
    return defuseDeep(part) as P;
  }

  function defusePrompt(prompt: LanguageModelV4Prompt): LanguageModelV4Prompt {
    return prompt.map((m): LanguageModelV4Message => {
      if (m.role === "system") return { ...m, content: neutraliseTags(m.content) };
      if (m.role === "user")
        return { ...m, content: acrossTextRuns(m.content.map((p) => defuseDeep(p) as typeof p)) };
      if (m.role === "assistant")
        return { ...m, content: acrossTextRuns(m.content.map((p) => toolPart(p))) };
      return { ...m, content: m.content.map((p) => toolPart(p)) };
    });
  }

  async function transformParams({
    params,
  }: {
    params: LanguageModelV4CallOptions;
  }): Promise<LanguageModelV4CallOptions> {
    const prompt = defusePrompt(params.prompt);
    const text = lastUserText(params.prompt);
    if (text === undefined) return { ...params, prompt };
    const { details, text: tagged } = await kit.recall(text);
    if (details.items.length === 0) return { ...params, prompt };
    const lead = prompt.findIndex((m) => m.role !== "system");
    const at = lead === -1 ? prompt.length : lead;
    const memory: LanguageModelV4Message = {
      role: "system",
      content: tagged,
      providerOptions: { engram: { read_id: details.read_id } },
    };
    return { ...params, prompt: [...prompt.slice(0, at), memory, ...prompt.slice(at)] };
  }

  return {
    middleware: { specificationVersion: "v4", transformParams },
    tools: { remember, [recallName]: recall },
    remember,
    recall,
    kit,
  };
}

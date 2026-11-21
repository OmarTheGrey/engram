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
// memory tag (packages/pi-extension/src/tag.ts: read id, admitting rules,
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
import { neutraliseTags, WITHHELD } from "@engram/pi-extension/tag";
import { MEMORY_READ, MEMORY_WRITE, writeResultText } from "@engram/pi-extension/tools";
import { z } from "zod";

export interface EngramMemoryOptions extends KitOptions {
  /**
   * Where `remember` writes when the model names no scope: a scope
   * (`person:dana`) or a namespace (`["person", "dana"]`), mapped by the
   * kit's scopeOf. The plane decides whether the actor may write there.
   */
  namespace: string | readonly string[];
}

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
  /** Pass as `tools` to generateText or streamText. */
  tools: {
    remember: EngramTool<z.infer<typeof RememberInput>>;
    recall: EngramTool<z.infer<typeof RecallInput>>;
  };
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
function defuseDeep(value: unknown): unknown {
  if (typeof value === "string") return neutraliseTags(value);
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

export function engramMemory(options: EngramMemoryOptions): EngramMemory {
  const kit = createKit(options);
  const defaultScope = scopeOf(options.namespace);
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
    if (r.toolName === "recall") {
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
        return { ...m, content: m.content.map((p) => defuseDeep(p) as typeof p) };
      if (m.role === "assistant") return { ...m, content: m.content.map((p) => toolPart(p)) };
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
    tools: { remember, recall },
    kit,
  };
}

// The measured shapes behind H1's cost table (docs/tasks/prereg-v1-plan.md,
// PR 4, part A, deliverable 1; plan decision 7: costs come from measured
// shapes, not guesses). No model is called; nothing here prices anything.
//
// - `callShape`: one cassette call's input and output tokens and the memory
//   reads its transcript holds. A cassette request is the transcript the
//   agent loop sent (model/cassette.ts): each message as canonical JSON with
//   the braces in its strings doubled. Each message is decoded and estimated
//   with pi's own estimate (pi-coding-agent's `estimateTokens`, characters
//   over four), the request's sum being the call's input; the recorded
//   reply is the output. A judge request (GateMem's judge, a structured
//   prompt) and a MEM-INV-Bench note request are plain text, estimated the
//   same way.
// - `sessionShapes`: the answer calls of one session (item, condition, store
//   and seed) in transcript order.
// - `gatememPromptChars`: the system and user prompt a GateMem probe sends,
//   per checkpoint (gatemem-probe.ts `probeInputs`), so the prompt part of a
//   fixture session can be scaled to the full set's.
// - `catalogueEntry`: a candidate model as pi-ai's built-in catalogue at the
//   pinned version resolves it (live.ts `builtinLiveModels`, the resolver a
//   live run uses), its prices per million tokens, and whether the runner's
//   answer path accepts it (cassette.ts SEEDED_APIS: an API that carries the
//   seed).
import { estimateTokens } from "@earendil-works/pi-coding-agent";
import { gatemem } from "@engram/bench";
import type { LiveModels } from "../answers.ts";
import { probeInputs, sequentialIds } from "../gatemem-probe.ts";
import type { CacheEntry } from "../model/cached.ts";
import { SEEDED_APIS } from "../model/cassette.ts";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Every string with the cassette's doubled braces made single again. */
function undouble(value: Json): Json {
  if (typeof value === "string") return value.replaceAll("{{", "{").replaceAll("}}", "}");
  if (Array.isArray(value)) return value.map(undouble);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, undouble(v)]));
  }
  return value;
}

/** One request message as the model received it: a transcript message, or plain text. */
export function decodeMessage(content: string): { role: string; [k: string]: unknown } {
  try {
    const parsed = JSON.parse(content) as Json;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "role" in parsed) {
      return undouble(parsed) as { role: string };
    }
  } catch {
    // Not a transcript message: a plain prompt (the judge's, a note's).
  }
  return { role: "user", content };
}

const tokensOf = (message: { role: string }) => estimateTokens(message as never);

/** The recorded reply as an assistant message: a transcript reply, a note's text, or raw text. */
function replyMessage(text: string): { role: string; content: unknown } {
  try {
    const parsed = JSON.parse(text) as { content?: unknown; text?: unknown };
    if (parsed && Array.isArray(parsed.content))
      return { role: "assistant", content: parsed.content };
    if (parsed && typeof parsed.text === "string") {
      return { role: "assistant", content: [{ type: "text", text: parsed.text }] };
    }
  } catch {
    // A raw reply (the judge's verdict as the model wrote it).
  }
  return { role: "assistant", content: [{ type: "text", text }] };
}

const ITEM_TAG = "<engram:item";

export interface CallShape {
  kind: "answer" | "judge" | "note";
  item: string;
  condition: string;
  store: string;
  seed: number;
  model: string;
  /** Messages in the request: the transcript's length when the call was made. */
  messages: number;
  input_tokens: number;
  output_tokens: number;
  /** Each memory_read result in the request: its tokens and the items it shows. */
  reads: { tokens: number; items: number }[];
}

/** One cassette entry's shape; `judgeModel` names the GateMem judge, when the run has one. */
export function callShape(entry: CacheEntry, judgeModel?: string): CallShape {
  const { context, request } = entry;
  const decoded = [
    ...(request.system === undefined ? [] : [{ role: "user", content: request.system }]),
    ...request.messages.map((m) => decodeMessage(m.content)),
  ];
  const kind =
    context.condition === "note"
      ? "note"
      : request.responseSchema !== undefined || request.model === judgeModel
        ? "judge"
        : "answer";
  const reads = decoded.flatMap((m) => {
    if (m.role !== "toolResult" || m.toolName !== "memory_read") return [];
    const text = JSON.stringify(m.content);
    return [{ tokens: tokensOf(m), items: text.split(ITEM_TAG).length - 1 }];
  });
  return {
    kind,
    item: context.item,
    condition: context.condition,
    store: context.store,
    seed: request.seed,
    model: request.model,
    messages: request.messages.length,
    input_tokens: decoded.reduce((n, m) => n + tokensOf(m), 0),
    output_tokens: tokensOf(replyMessage(entry.response.text)),
    reads,
  };
}

export interface SessionShape {
  item: string;
  condition: string;
  store: string;
  seed: number;
  /** The session's answer calls, in transcript order. */
  calls: CallShape[];
}

/** The answer calls grouped by session, sessions sorted by item, condition, store and seed. */
export function sessionShapes(calls: readonly CallShape[]): SessionShape[] {
  const sessions = new Map<string, SessionShape>();
  for (const c of calls) {
    if (c.kind !== "answer") continue;
    const key = JSON.stringify([c.item, c.condition, c.store, c.seed]);
    const session = sessions.get(key) ?? {
      item: c.item,
      condition: c.condition,
      store: c.store,
      seed: c.seed,
      calls: [],
    };
    session.calls.push(c);
    sessions.set(key, session);
  }
  for (const s of sessions.values()) s.calls.sort((a, b) => a.messages - b.messages);
  return [...sessions.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, s]) => s);
}

/** The characters of the system and user prompt a GateMem probe sends, per checkpoint. */
export function gatememPromptChars(data: string): { checkpoint_id: string; chars: number }[] {
  return gatemem.loadDataset(data).flatMap((domain) =>
    domain.checkpoints.map((c) => {
      const { system, user } = probeInputs(domain, c.checkpoint_id, sequentialIds());
      return { checkpoint_id: c.checkpoint_id, chars: system.length + user.length };
    }),
  );
}

export interface CatalogueEntry {
  model: string;
  found: boolean;
  api: string | null;
  /** The runner's answer path accepts it: its API carries the seed (SEEDED_APIS). */
  accepted: boolean;
  /** US dollars per million tokens, pi-ai's catalogue `cost.input` and `cost.output`. */
  input_per_million: number | null;
  output_per_million: number | null;
  reasoning: boolean | null;
  context_window: number | null;
}

/** A `provider/model-id` as pi-ai's built-in providers resolve it. */
export function catalogueEntry(models: LiveModels, name: string): CatalogueEntry {
  const [provider = "", ...rest] = name.split("/");
  const model = models.getModel(provider, rest.join("/"));
  if (!model) {
    return {
      model: name,
      found: false,
      api: null,
      accepted: false,
      input_per_million: null,
      output_per_million: null,
      reasoning: null,
      context_window: null,
    };
  }
  return {
    model: name,
    found: true,
    api: model.api,
    accepted: SEEDED_APIS.includes(model.api),
    input_per_million: model.cost.input,
    output_per_million: model.cost.output,
    reasoning: model.reasoning,
    context_window: model.contextWindow,
  };
}

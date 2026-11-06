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
//   seed). `catalogueSnapshot` says when pi-ai generated its catalogue: the
//   date of the prices.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTokens } from "@earendil-works/pi-coding-agent";
import { gatemem } from "@engram/bench";
import type { Policy } from "@engram/core";
import type { CacheEntry } from "@engram/model";
import type { LiveModels } from "../answers.ts";
import { probeInputs, sequentialIds } from "../gatemem-probe.ts";
import { SEEDED_APIS } from "../model/cassette.ts";
import { walkLists } from "./c4-evidence.ts";

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
/** The text of each item a read shows, inside its memory tag. */
const ITEM_TEXT = /<engram:item[^>]*>([\s\S]*?)<\/engram:item>/g;

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
  reads: { tokens: number; items: number; text_chars: number }[];
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
    const parts = Array.isArray(m.content) ? (m.content as { text?: unknown }[]) : [];
    const text = parts.map((c) => (typeof c.text === "string" ? c.text : "")).join("");
    const shown = [...text.matchAll(ITEM_TEXT)].map((x) => (x[1] ?? "").trim());
    return [
      {
        tokens: tokensOf(m),
        items: text.split(ITEM_TAG).length - 1,
        text_chars: shown.reduce((n, t) => n + t.length, 0),
      },
    ];
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

/**
 * Per checkpoint: the characters of the system and user prompt a GateMem
 * probe sends; the turns up to the as-of turn the probe ingests and their
 * text's characters, so a read item's size can be moved to the full set's;
 * and the characters of GateMem's judge prompt for the checkpoint with an
 * empty answer (judge.ts `renderJudgePrompt`), the part of the judge's input
 * that depends on the checkpoint; and, per condition, how many items its
 * read shows for the checkpoint's own question and their text's characters
 * (C2 and C3 the pipeline's top `readLimit`, C4 the walk, C5 the admitted
 * items' top `readLimit`: c4-evidence.ts `walkLists`, under `policy`). The
 * query type is a hidden label, read only to group the sizes; the probe's
 * prompt, turns and lists come from the stripped checkpoint, and the judge
 * prompt holds the labels, as upstream's judge sees them.
 */
export function gatememPromptChars(
  data: string,
  policy: Policy,
  readLimit?: number,
): {
  checkpoint_id: string;
  kind: string;
  chars: number;
  turns: number;
  turn_chars: number;
  judge_chars: number;
  shown: Record<"C2" | "C3" | "C4" | "C5", { items: number; chars: number }>;
}[] {
  return gatemem.loadDataset(data).flatMap((domain) =>
    domain.checkpoints.map((c) => {
      const { system, user, mapped } = probeInputs(domain, c.checkpoint_id, sequentialIds());
      const lists = walkLists(domain, c, policy, readLimit);
      const textOf = new Map(
        lists.mapped.writes.map(({ item }, i) => [
          item.id,
          (lists.mapped.turns[i] as gatemem.Turn).text,
        ]),
      );
      const shown = (list: readonly { item: { id: string } }[]) => ({
        items: list.length,
        chars: list.reduce((n, r) => n + (textOf.get(r.item.id) ?? "").length, 0),
      });
      return {
        checkpoint_id: c.checkpoint_id,
        kind: c.query_type,
        chars: system.length + user.length,
        turns: mapped.turns.length,
        turn_chars: mapped.turns.reduce((n, t) => n + t.text.length, 0),
        judge_chars: gatemem.renderJudgePrompt(c, {}).length,
        shown: {
          C2: shown(lists.c3),
          C3: shown(lists.c3),
          C4: shown(lists.c4),
          C5: shown(lists.c5),
        },
      };
    }),
  );
}

export interface CatalogueEntry {
  model: string;
  found: boolean;
  api: string | null;
  /** The runner's answer path accepts it: its API carries the seed (SEEDED_APIS). */
  accepted: boolean;
  /** US dollars per million tokens, pi-ai's catalogue `cost.input`, `cost.output` and `cost.cacheRead`. */
  input_per_million: number | null;
  output_per_million: number | null;
  cache_read_per_million: number | null;
  reasoning: boolean | null;
  context_window: number | null;
  /** The catalogue's `compat.thinkingFormat`: how pi-ai asks this model for reasoning. */
  thinking_format: string | null;
  /**
   * The reasoning effort pi-ai sends when the runner asks for thinking off
   * (conditions.ts, `thinkingLevel: "off"`), or null when it sends none.
   */
  off_effort: string | null;
  /**
   * Whether thinking off reaches the model: true for a model without
   * reasoning or one pi-ai sends an off effort for; false when the
   * catalogue maps off to null, so no reasoning parameter is sent and the
   * provider's default effort applies; null for a thinking format this
   * reading of pi-ai does not cover.
   */
  can_turn_reasoning_off: boolean | null;
}

/**
 * What pi-ai 1.3.0 sends for thinking off on OpenRouter's format
 * (api/openai-completions.js): with no requested effort, a reasoning model
 * whose `thinkingLevelMap.off` is not null gets `{ effort: off ?? "none" }`;
 * one whose `off` is null gets no reasoning parameter at all.
 */
function offReasoning(model: {
  reasoning: boolean;
  compat?: { thinkingFormat?: string };
  thinkingLevelMap?: Record<string, string | null> | undefined;
}): { off_effort: string | null; can_turn_reasoning_off: boolean | null } {
  if (!model.reasoning) return { off_effort: null, can_turn_reasoning_off: true };
  if (model.compat?.thinkingFormat !== "openrouter") {
    return { off_effort: null, can_turn_reasoning_off: null };
  }
  const off = model.thinkingLevelMap?.off;
  return off === null
    ? { off_effort: null, can_turn_reasoning_off: false }
    : { off_effort: off ?? "none", can_turn_reasoning_off: true };
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
      cache_read_per_million: null,
      reasoning: null,
      context_window: null,
      thinking_format: null,
      off_effort: null,
      can_turn_reasoning_off: null,
    };
  }
  const described = model as typeof model & {
    compat?: { thinkingFormat?: string };
    thinkingLevelMap?: Record<string, string | null>;
  };
  return {
    model: name,
    found: true,
    api: model.api,
    accepted: SEEDED_APIS.includes(model.api),
    input_per_million: model.cost.input,
    output_per_million: model.cost.output,
    cache_read_per_million: model.cost.cacheRead,
    reasoning: model.reasoning,
    context_window: model.contextWindow,
    thinking_format: described.compat?.thinkingFormat ?? null,
    ...offReasoning(described),
  };
}

/**
 * The catalogue the prices come from: the runner's pinned pi-ai version, the
 * time pi-ai generated its provider data (its data manifest's `generatedAt`),
 * and the sha256 its manifest records for OpenRouter's file.
 */
export function catalogueSnapshot(): {
  package: string;
  version: string;
  generated_at: string;
  openrouter_sha256: string;
} {
  const runner = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { dependencies: Record<string, string> };
  const entry = fileURLToPath(import.meta.resolve("@earendil-works/pi-ai"));
  const manifest = JSON.parse(
    readFileSync(join(dirname(entry), "providers", "data", ".manifest.json"), "utf8"),
  ) as { generatedAt: string; files: Record<string, string> };
  return {
    package: "@earendil-works/pi-ai",
    version: runner.dependencies["@earendil-works/pi-ai"] as string,
    generated_at: manifest.generatedAt,
    openrouter_sha256: manifest.files["openrouter.json"] as string,
  };
}

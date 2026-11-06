// The measured shapes behind H1's cost table (docs/tasks/prereg-v1-plan.md,
// PR 4, part A, deliverable 1): token estimates of each cassette call, the
// calls grouped into sessions, the GateMem prompt sizes, and the candidate
// models as pi-ai's catalogue and the runner's seeded-API rule see them.
import { join } from "node:path";
import { estimateTokens } from "@earendil-works/pi-coding-agent";
import { canonicalJson, loadPreset } from "@engram/core";
import type { CacheEntry } from "@engram/model";
import { describe, expect, test } from "vitest";
import { builtinLiveModels } from "../../src/live.ts";
import {
  callShape,
  catalogueEntry,
  catalogueSnapshot,
  decodeMessage,
  gatememPromptChars,
  sessionShapes,
} from "../../src/research/cost-shapes.ts";

const REPO = join(import.meta.dirname, "../../../..");

/** One cassette call: the transcript messages as the cassette encodes them. */
function entry(
  messages: { role: string; [k: string]: unknown }[],
  reply: unknown,
  context: Partial<CacheEntry["context"]> = {},
  model = "scripted/scripted-1",
): CacheEntry {
  // The cassette doubles every brace inside a string (cassette.ts withoutCwd).
  const double = (v: unknown): unknown =>
    typeof v === "string"
      ? v.replaceAll("{", "{{").replaceAll("}", "}}")
      : Array.isArray(v)
        ? v.map(double)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, double(x)]))
          : v;
  return {
    key: "k",
    context: {
      item: "gatemem/ckpt_01",
      condition: "C2",
      preset: "none",
      store: "fake",
      ...context,
    },
    request: {
      model,
      seed: 1,
      messages: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: canonicalJson(double(m)),
      })),
    },
    response: {
      text: canonicalJson(reply),
      usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    },
  } as CacheEntry;
}

const system = { role: "system", content: "You answer {questions}.", sections: { a: "rules" } };
const user = { role: "user", content: "Who paid?" };
const call = {
  role: "assistant",
  content: [{ type: "toolCall", id: "c1", name: "memory_read", arguments: { query: "paid" } }],
};
const read = {
  role: "toolResult",
  toolCallId: "c1",
  toolName: "memory_read",
  content: [
    {
      type: "text",
      text: '<engram:item rank="1">a</engram:item>\n<engram:item rank="2">b</engram:item>',
    },
  ],
  isError: false,
};
const answer = { content: [{ type: "text", text: "Dana paid." }], stopReason: "stop" };

describe("a cassette call's shape", () => {
  test("a message is decoded with its braces restored, and estimated as pi estimates it", () => {
    const e = entry([system], answer);
    const decoded = decodeMessage((e.request.messages[0] as { content: string }).content);
    expect(decoded).toEqual(system);
    expect(callShape(e).input_tokens).toBe(estimateTokens(system as never));
  });

  test("input is every message of the request, output the recorded reply, reads the memory_read results", () => {
    const shape = callShape(entry([system, user, call, read], answer));
    const each = [system, user, call, read].map((m) => estimateTokens(m as never));
    expect(shape.input_tokens).toBe(each.reduce((a, b) => a + b, 0));
    expect(shape.output_tokens).toBe(estimateTokens({ role: "assistant", ...answer } as never));
    expect(shape.reads).toEqual([
      { tokens: estimateTokens(read as never), items: 2, text_chars: 2 },
    ]);
    expect(shape.kind).toBe("answer");
  });

  test("a judge call and a note call are told apart from answers", () => {
    const judge = entry([], "{}", {}, "scripted/judge-1");
    judge.request = {
      model: "scripted/judge-1",
      seed: 1,
      messages: [{ role: "user", content: "Grade {this}." }],
      responseSchema: { name: "benchmark_judge", schema: {} },
    };
    judge.response = { text: '{"privacy_leak": false}', usage: judge.response.usage };
    const shape = callShape(judge, "scripted/judge-1");
    expect(shape.kind).toBe("judge");
    expect(shape.input_tokens).toBe(Math.ceil("Grade {this}.".length / 4));
    expect(shape.output_tokens).toBe(Math.ceil('{"privacy_leak": false}'.length / 4));
    const note = entry([], { stopReason: "stop", text: "Remit to 7742." }, { condition: "note" });
    note.request = {
      model: "scripted/scripted-1",
      seed: 1,
      messages: [{ role: "user", content: "Rewrite this." }],
    };
    const noteShape = callShape(note);
    expect(noteShape.kind).toBe("note");
    expect(noteShape.output_tokens).toBe(Math.ceil("Remit to 7742.".length / 4));
  });

  test("calls of one session are grouped and ordered by their transcript", () => {
    const first = entry([system, user], { content: call.content, stopReason: "toolUse" });
    const second = entry([system, user, call, read], answer);
    const other = entry([system, user], answer, { item: "gatemem/ckpt_02" });
    const sessions = sessionShapes([second, other, first].map((e) => callShape(e)));
    expect(sessions.map((s) => [s.item, s.calls.length])).toEqual([
      ["gatemem/ckpt_01", 2],
      ["gatemem/ckpt_02", 1],
    ]);
    expect(sessions[0]?.calls.map((c) => c.messages)).toEqual([2, 4]);
  });
});

describe("the GateMem prompt the runner sends", () => {
  test("is measured per checkpoint from the probe's own prompts, with its turns and its judge prompt", () => {
    const sizes = gatememPromptChars(join(REPO, "fixtures/bench/gatemem"), loadPreset("medium"));
    expect(sizes.length).toBe(20);
    for (const s of sizes) {
      expect(s.chars).toBeGreaterThan(0);
      expect(s.turns).toBeGreaterThan(0);
      expect(s.turn_chars).toBeGreaterThan(s.turns);
      expect(s.judge_chars).toBeGreaterThan(0);
      // What each condition's read shows for the checkpoint's own question:
      // C2 and C3 the same list, C4 at least C5's.
      expect(s.shown.C2).toEqual(s.shown.C3);
      expect(s.shown.C4.items).toBeGreaterThanOrEqual(s.shown.C5.items);
      for (const list of Object.values(s.shown)) {
        expect(list.chars > 0).toBe(list.items > 0);
      }
    }
    // The turns are those up to the as-of turn, as the probe ingests them.
    const first = sizes.find((s) => s.checkpoint_id.endsWith("ckpt_13"));
    expect(first?.turns).toBeLessThan(sizes.reduce((n, s) => Math.max(n, s.turns), 0) + 1);
  });
});

describe("the candidate models, as pi-ai 1.3.0's catalogue and the runner see them", () => {
  const models = builtinLiveModels();

  test("a model on OpenRouter's chat completions is accepted, with its catalogue prices", () => {
    expect(catalogueEntry(models, "openrouter/openai/gpt-4o")).toEqual({
      model: "openrouter/openai/gpt-4o",
      found: true,
      api: "openai-completions",
      accepted: true,
      input_per_million: 2.5,
      output_per_million: 10,
      cache_read_per_million: 1.25,
      reasoning: false,
      context_window: 128000,
      thinking_format: "openrouter",
      off_effort: null,
      can_turn_reasoning_off: true,
    });
  });

  test("with thinking off, pi-ai sends the catalogue's off effort, or none at all when it maps off to null", () => {
    // pi-ai 1.3.0 api/openai-completions.js, OpenRouter's format: no requested
    // effort and thinkingLevelMap.off !== null sends { effort: off ?? "none" };
    // off === null sends nothing, so the provider's default effort applies.
    expect(catalogueEntry(models, "openrouter/openai/gpt-6-luna")).toMatchObject({
      reasoning: true,
      off_effort: "none",
      can_turn_reasoning_off: true,
    });
    expect(catalogueEntry(models, "openrouter/qwen/qwen3.8-flash")).toMatchObject({
      reasoning: true,
      off_effort: "none",
      can_turn_reasoning_off: true,
    });
    for (const name of [
      "openai/gpt-6.1-sol",
      "google/gemini-4-argon",
      "google/gemini-3.8-flash",
      "qwen/qwen3.8-max-0902",
      "meta/muse-wonder",
      "meta/muse-glimmer-30b",
    ]) {
      expect(catalogueEntry(models, `openrouter/${name}`)).toMatchObject({
        reasoning: true,
        off_effort: null,
        can_turn_reasoning_off: false,
      });
    }
  });

  test("a model on an API that cannot carry a seed is refused, as the runner refuses it", () => {
    const fable = catalogueEntry(models, "openrouter/anthropic/claude-fable-5");
    expect(fable).toMatchObject({ found: true, api: "anthropic-messages", accepted: false });
    expect(catalogueEntry(models, "openrouter/no/such-model")).toMatchObject({
      found: false,
      accepted: false,
    });
  });

  test("the prices are dated by pi-ai's own catalogue at the runner's pin", () => {
    expect(catalogueSnapshot()).toEqual({
      package: "@earendil-works/pi-ai",
      version: "1.3.0",
      generated_at: "2026-10-15T19:00:55.287Z",
      openrouter_sha256: "d303cf8e4ad2cfd322ea5fc8c9e617d46b21d36d9ebe0454be26ae92d91440aa",
    });
  });
});

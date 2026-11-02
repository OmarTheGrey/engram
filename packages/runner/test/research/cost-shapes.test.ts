// The measured shapes behind H1's cost table (docs/tasks/prereg-v1-plan.md,
// PR 4, part A, deliverable 1): token estimates of each cassette call, the
// calls grouped into sessions, the GateMem prompt sizes, and the candidate
// models as pi-ai's catalogue and the runner's seeded-API rule see them.
import { join } from "node:path";
import { estimateTokens } from "@earendil-works/pi-coding-agent";
import { canonicalJson } from "@engram/core";
import { describe, expect, test } from "vitest";
import { builtinLiveModels } from "../../src/live.ts";
import type { CacheEntry } from "../../src/model/cached.ts";
import {
  callShape,
  catalogueEntry,
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
    expect(shape.reads).toEqual([{ tokens: estimateTokens(read as never), items: 2 }]);
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
  test("is measured per checkpoint from the probe's own prompts", () => {
    const sizes = gatememPromptChars(join(REPO, "fixtures/bench/gatemem"));
    expect(sizes.length).toBe(20);
    for (const s of sizes) expect(s.chars).toBeGreaterThan(0);
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
      reasoning: false,
      context_window: 128000,
    });
  });

  test("a model on an API that cannot carry a seed is refused, as the runner refuses it", () => {
    const fable = catalogueEntry(models, "openrouter/anthropic/claude-fable-5");
    expect(fable).toMatchObject({ found: true, api: "anthropic-messages", accepted: false });
    expect(catalogueEntry(models, "openrouter/no/such-model")).toMatchObject({
      found: false,
      accepted: false,
    });
  });
});

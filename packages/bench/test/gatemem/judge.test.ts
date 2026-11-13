// The GateMem LLM judge port (card B1, PR 6) against upstream's own code:
// upstream-judge-golden.json holds what bench/eval/judge.py and
// score_predictions.py return at the pinned commit on crafted judge replies
// and on the fixture subset with the scripted judge verdicts
// (packages/bench/scripts/upstream-judge-golden.py). No model is reached.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { type ModelRequest, requestHash, UnsupportedRequestError } from "@engram/core";
import { memoryCache, OfflineMissError } from "@engram/model";
import { beforeAll, describe, expect, test } from "vitest";
import type { ModelForItem } from "../../src/gatemem/agents.ts";
import {
  coerceJudgeTriBool,
  JUDGE_JSON_SCHEMA,
  JUDGE_PROMPT_TEMPLATE,
  judgeAttemptOf,
  judgeOne,
  PAPER_JUDGE,
  parseJudgeFromText,
  promoteJudgeMetrics,
  readJudgeScript,
  redactNotes,
  renderJudgePrompt,
  runJudge,
  STRUCTURED_JUDGE_RETRY_SUFFIX,
  scriptedJudge,
} from "../../src/gatemem/judge.ts";
import { UntranslatableLiteral } from "../../src/gatemem/literal.ts";
import { parsePyJson } from "../../src/gatemem/py.ts";
import { readRunConfig, readScript, runGateMem, scriptedByItem } from "../../src/gatemem/run.ts";
import type { PredictionRow } from "../../src/gatemem/schema.ts";
import { scorePredictions } from "../../src/gatemem/score.ts";
import { CONFIG, FIXTURES, fixture, type Manifest, readJson } from "./fixture.ts";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

interface Verdict {
  raw: string;
  parse_ok: boolean;
  parse_mode: string | null;
  parse_error: string | null;
  action_ok_llm: boolean | null;
  utility_ok: boolean | null;
  privacy_leak: boolean | null;
  deletion_leak: boolean | null;
  notes: string;
}

interface GoldenRun {
  rows: {
    checkpoint_id: string;
    episode_id: string;
    query_type: string;
    judge: Record<string, unknown>;
    structured_request: boolean;
    calls: { attempt: number; structured: boolean; prompt_sha256: string }[];
  }[];
  summary: Record<string, unknown>;
  promoted: Record<string, unknown>;
}

interface Golden {
  upstream_commit: string;
  judge_prompt_sha256: string;
  parse_cases: Verdict[];
  redact_cases: { notes: string; redacted: string }[];
  runs: { ungated: GoldenRun; gated: GoldenRun };
}

const golden = readJson<Golden>("upstream-judge-golden.json");
const config = readRunConfig(CONFIG);
const checkpoints = fixture().flatMap((d) => d.checkpoints);
const judgeScript = readJudgeScript(`${FIXTURES}judge-script.json`);
const SETTINGS = { ...PAPER_JUDGE, seed: 1 };

/** The fixture's predictions, from the scripted answer model (upstream.test.ts holds them to upstream's). */
let predictions: PredictionRow[];
beforeAll(async () => {
  const run = await runGateMem(config, {
    model: scriptedByItem(readScript(config.script as string)),
    cache: memoryCache(),
    offline: false,
  });
  predictions = run.predictions;
});

/** The scripted judge, recording every request it is sent. */
function recording() {
  const seen = new Map<string, ModelRequest[]>();
  const scripted = scriptedJudge(judgeScript);
  const model: ModelForItem = (id) => async (request) => {
    seen.set(id, [...(seen.get(id) ?? []), request]);
    return scripted(id)(request);
  };
  return { model, seen };
}

describe("the vendored judge prompt", () => {
  test("is upstream's bench/prompts/judge_prompt.txt at the pinned commit", () => {
    const manifest = readJson<Manifest>("manifest.json");
    expect(golden.upstream_commit).toBe(manifest.source.commit);
    expect(sha256(JUDGE_PROMPT_TEMPLATE)).toBe(
      manifest.upstream_sha256["bench/prompts/judge_prompt.txt"],
    );
    expect(sha256(JUDGE_PROMPT_TEMPLATE)).toBe(golden.judge_prompt_sha256);
  });

  test("has exactly the named fields upstream fills, and no other brace", () => {
    const fields = [...JUDGE_PROMPT_TEMPLATE.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
    expect(new Set(fields)).toEqual(
      new Set([
        "query_type",
        "attack_type",
        "as_of_turn_id",
        "asker_principal_id",
        "asker_role",
        "query_text",
        "pred_action",
        "pred_answer",
        "pred_answer_structured",
        "judge_spec_json",
        "leak_targets_json",
      ]),
    );
    expect(JUDGE_PROMPT_TEMPLATE.replaceAll(/\{[a-z_]+\}/g, "")).not.toMatch(/[{}]/);
  });
});

describe("parsing a judge reply as upstream's _judge_one does", () => {
  test.each(golden.parse_cases.map((c, i) => [i, c] as const))("case %i", (_i, c) => {
    const { parsed, parseOk, parseMode } = parseJudgeFromText(c.raw);
    expect({
      parse_ok: parseOk,
      parse_mode: parseOk ? parseMode : null,
      parse_error: parseOk ? null : parseMode,
      action_ok_llm: coerceJudgeTriBool(parsed.action_ok),
      utility_ok: coerceJudgeTriBool(parsed.utility_ok),
      privacy_leak: coerceJudgeTriBool(parsed.privacy_leak),
      deletion_leak: coerceJudgeTriBool(parsed.deletion_leak),
    }).toEqual({
      parse_ok: c.parse_ok,
      parse_mode: c.parse_mode,
      parse_error: c.parse_error,
      action_ok_llm: c.action_ok_llm,
      utility_ok: c.utility_ok,
      privacy_leak: c.privacy_leak,
      deletion_leak: c.deletion_leak,
    });
  });

  test.each(golden.redact_cases.map((c, i) => [i, c] as const))("redact case %i", (_i, c) => {
    expect(redactNotes(c.notes)).toBe(c.redacted);
  });
});

describe("the judge prompt, as upstream's str.format fills it", () => {
  // Parsed as Python parses JSON, so 2.0 stays a float and prints as 2.0.
  const cases = (
    parsePyJson(readFileSync(`${FIXTURES}upstream-judge-golden.json`, "utf8")) as {
      prompt_cases: { output: Record<string, unknown>; prompt_sha256: string }[];
    }
  ).prompt_cases;

  test.each(cases.map((c, i) => [i, c] as const))("crafted output %i", (_i, c) => {
    const first = checkpoints.find((k) => k.checkpoint_id === predictions[0]?.checkpoint_id);
    if (!first) throw new Error("no first checkpoint");
    expect(sha256(renderJudgePrompt(first, c.output))).toBe(c.prompt_sha256);
  });
});

describe("the judge on the fixture subset, as upstream's run_llm_judge", () => {
  test.each([
    ["ungated", false],
    ["gated", true],
  ] as const)("%s: every call, verdict and summary equals upstream's", async (name, gate) => {
    const want = golden.runs[name];
    const { model, seen } = recording();
    const { rows, summary } = await runJudge(checkpoints, predictions, model, SETTINGS, gate);
    expect(rows.map((r) => r.checkpoint_id)).toEqual(want.rows.map((r) => r.checkpoint_id));
    for (const [i, row] of rows.entries()) {
      const w = want.rows[i] as GoldenRun["rows"][number];
      const calls = (seen.get(row.checkpoint_id) ?? []).map((r) => ({
        attempt: judgeAttemptOf(r),
        structured: r.responseSchema !== undefined,
        prompt_sha256: sha256(r.messages[0]?.content ?? ""),
      }));
      expect(calls, row.checkpoint_id).toEqual(w.calls);
      expect(row.judge, row.checkpoint_id).toEqual(w.judge);
      expect(row.llm.structured_request).toBe(w.structured_request);
      expect(row.episode_id).toBe(w.episode_id);
      expect(row.query_type).toBe(w.query_type);
    }
    const { llm: _llm, ...rest } = summary;
    expect(rest).toEqual(want.summary);
    const rule = scorePredictions(checkpoints, predictions, gate).summary;
    const promoted = promoteJudgeMetrics(rule, summary);
    for (const [k, v] of Object.entries(want.promoted)) expect(promoted[k], k).toEqual(v);
  });
});

describe("the judge request", () => {
  test("has the paper's settings: gpt-4o at temperature 0, no system prompt, the strict schema", async () => {
    expect(PAPER_JUDGE).toEqual({ model: "openai/gpt-4o", temperature: 0, maxTokens: 4096 });
    const { model, seen } = recording();
    const ckpt = checkpoints.find((c) => c.checkpoint_id.endsWith("note_ckpt_09"));
    const pred = predictions.find((p) => p.checkpoint_id === ckpt?.checkpoint_id);
    if (!ckpt || !pred) throw new Error("fixture lacks household ckpt_09");
    await judgeOne(model(ckpt.checkpoint_id), ckpt, pred.output, SETTINGS, false);
    const [a1, a2, a3] = seen.get(ckpt.checkpoint_id) as [ModelRequest, ModelRequest, ModelRequest];
    for (const r of [a1, a2, a3]) {
      expect(r.model).toBe("openai/gpt-4o");
      expect(r.temperature).toBe(0);
      expect(r.maxTokens).toBe(4096);
      expect(r.seed).toBe(1);
      expect(r.system).toBeUndefined();
      expect(r.messages).toHaveLength(1);
    }
    expect(a1.responseSchema).toEqual({ name: "benchmark_judge", schema: JUDGE_JSON_SCHEMA });
    expect(a2.responseSchema).toEqual(a1.responseSchema);
    expect(a3.responseSchema).toBeUndefined();
    expect(a2.messages[0]?.content).toBe(
      `${a1.messages[0]?.content}${STRUCTURED_JUDGE_RETRY_SUFFIX}`,
    );
    expect(a3.messages[0]?.content).toBe(a2.messages[0]?.content);
    // Three attempts, three distinct requests, so three cache keys.
    expect(new Set([a1, a2, a3].map(requestHash)).size).toBe(3);
  });

  test("an offline cache miss stops the judge; it is never recorded as a failed attempt", async () => {
    const ckpt = checkpoints[0];
    const pred = predictions[0];
    if (!ckpt || !pred) throw new Error("empty fixture");
    let calls = 0;
    const missing = async (): Promise<never> => {
      calls++;
      throw new OfflineMissError("k", { item: "i", condition: "c", preset: "p", store: "s" });
    };
    await expect(judgeOne(missing, ckpt, pred.output, SETTINGS, false)).rejects.toBeInstanceOf(
      OfflineMissError,
    );
    expect(calls).toBe(1);
  });

  test("a model call that refuses the structured request stops the judge (P6-1)", async () => {
    const ckpt = checkpoints[0];
    const pred = predictions[0];
    if (!ckpt || !pred) throw new Error("empty fixture");
    // As piModelCall does: refuse a schema request, answer a plain one.
    let plain = 0;
    const piLike = async (request: ModelRequest) => {
      if (request.responseSchema !== undefined) {
        throw new UnsupportedRequestError(request.model, "structured output");
      }
      plain++;
      return {
        text: '{"action_ok": true, "utility_ok": null, "privacy_leak": false, "deletion_leak": null, "notes": "ok"}',
        usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      };
    };
    await expect(judgeOne(piLike, ckpt, pred.output, SETTINGS, false)).rejects.toBeInstanceOf(
      UnsupportedRequestError,
    );
    expect(plain).toBe(0);
  });

  test.each([
    [
      "bytes",
      "{'action_ok': True, 'utility_ok': True, 'privacy_leak': False, 'deletion_leak': b'x', 'notes': 'n'}",
    ],
    [
      "a set",
      "{'action_ok': True, 'utility_ok': True, 'privacy_leak': False, 'deletion_leak': {1, 2}, 'notes': 'n'}",
    ],
    [
      "a complex number",
      "{'action_ok': True, 'utility_ok': True, 'privacy_leak': False, 'deletion_leak': 1j, 'notes': 'n'}",
    ],
  ])(
    "a reply holding %s the port cannot represent stops the judge (P6-2)",
    async (_what, reply) => {
      const ckpt = checkpoints[0];
      const pred = predictions[0];
      if (!ckpt || !pred) throw new Error("empty fixture");
      let calls = 0;
      const call = async () => {
        calls++;
        // Upstream stops at attempt 1; judging attempt 2's reply would change the verdict.
        const text =
          calls === 1
            ? reply
            : '{"action_ok": true, "utility_ok": true, "privacy_leak": true, "deletion_leak": true, "notes": "n"}';
        return { text, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
      };
      await expect(judgeOne(call, ckpt, pred.output, SETTINGS, false)).rejects.toBeInstanceOf(
        UntranslatableLiteral,
      );
      expect(calls).toBe(1);
    },
  );

  test("any other failing attempt is recorded and the next attempt runs, as upstream", async () => {
    const ckpt = checkpoints[0];
    const pred = predictions[0];
    if (!ckpt || !pred) throw new Error("empty fixture");
    let n = 0;
    const flaky = async () => {
      n++;
      if (n === 1) throw new Error("rate limited");
      return {
        text: '{"action_ok": true, "utility_ok": null, "privacy_leak": false, "deletion_leak": null, "notes": "ok"}',
        usage: { input_tokens: 3, output_tokens: 2, cost_usd: 0 },
      };
    };
    const row = await judgeOne(flaky, ckpt, pred.output, SETTINGS, false);
    expect(row.judge.attempts).toEqual([
      { attempt: 1, structured: true, parse_ok: false, error: "rate limited" },
      { attempt: 2, structured: true, parse_ok: true, parse_mode: "json" },
    ]);
    expect(row.llm.usage).toEqual({ input_tokens: 3, output_tokens: 2, total_tokens: 5 });
    const dead = async (): Promise<never> => {
      throw new Error("down");
    };
    await expect(judgeOne(dead, ckpt, pred.output, SETTINGS, false)).rejects.toThrow(
      "LLM judge failed before producing any response",
    );
  });
});

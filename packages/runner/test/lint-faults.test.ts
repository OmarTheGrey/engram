// Card L3: the model-based lints on a fault set, through the runner. The
// pipeline config (research/configs/l3-lint-fixture.json) replays its
// committed cassettes with zero new calls and the same rows a recording from
// its script gives; the pilot config (research/configs/l3-pilot.json, the
// live variance run) is an experiment that runs only on a named model, or is
// counted without a call. The live lint call is checked on a fake model
// collection that records what it is asked to send: no provider is reached.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import {
  appendEvent,
  GROUNDED_PROMPTS,
  LINT_PROMPTS,
  LINT_SCHEMAS,
  MODEL_LINT_SETTINGS,
  migrate,
  openSqlite,
  planModelLints,
} from "@engram/core";
import { memoryCache } from "@engram/model";
import { afterAll, describe, expect, test } from "vitest";
import type { LiveModels } from "../src/answers.ts";
import { liveJudgeCall } from "../src/judge.ts";
import {
  countLintConfig,
  type LintRow,
  loadFaultFixtures,
  parseLintConfig,
  readLintConfig,
  runLintConfig,
  scriptedLintCall,
  withEvidence,
} from "../src/lint-faults.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const FIXTURE = join(REPO, "research/configs/l3-lint-fixture.json");
const PILOT = join(REPO, "research/configs/l3-pilot.json");
const GROUNDING = join(REPO, "research/configs/l9-grounding-fixture.json");

const temp: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-l3-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const d of temp) rmSync(d, { recursive: true, force: true });
});

const runScript = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [join(REPO, "packages/runner/scripts/run.ts"), ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

const byFixtureSeed = (rows: readonly LintRow[], fixture: string, seed: number) =>
  rows.find((r) => r.fixture === fixture && r.seed === seed) as LintRow;

describe("the lint configs", () => {
  test("the pipeline config lints every model fixture at seeds 1 to 3 on its scripted model", () => {
    const config = readLintConfig(FIXTURE);
    expect(config).toMatchObject({ kind: "pipeline", model: "scripted/lint-1", seeds: [1, 2, 3] });
    expect(loadFaultFixtures(config).map((f) => f.name)).toEqual([
      "contradiction.flag",
      "contradiction.near-miss",
      "unsupported-claim.flag",
      "unsupported-claim.near-miss",
    ]);
  });

  test("the pilot is an experiment on the model slot M1 at seeds 1 to 3 over the same fixtures", () => {
    const pilot = readLintConfig(PILOT);
    const fixture = readLintConfig(FIXTURE);
    expect(pilot).toMatchObject({ kind: "experiment", model: "prereg/M1", seeds: [1, 2, 3] });
    expect(pilot.data).toBe(fixture.data);
    expect(pilot.items).toEqual(fixture.items);
    expect(pilot.script).toBeUndefined();
  });

  test("an experiment on a scripted model or a script, and a scripted model without one, are refused", () => {
    const base = {
      name: "x",
      kind: "pipeline",
      benchmark: "lint-faults",
      data: ".",
      items: "all",
      model: "scripted/lint-1",
      seeds: [1],
      cassettes: ".",
    };
    expect(() => parseLintConfig(base)).toThrow("a scripted model needs a script");
    expect(() => parseLintConfig({ ...base, kind: "experiment", script: "s.json" })).toThrow(
      "never a scripted one",
    );
    expect(() =>
      parseLintConfig({ ...base, model: "m/x", kind: "experiment", script: "s" }),
    ).toThrow("never a scripted one");
  });

  test("a named deterministic fixture is refused; `all` skips them", () => {
    const config = { ...readLintConfig(FIXTURE), data: join(REPO, "fixtures/faults") };
    expect(() => loadFaultFixtures({ ...config, items: ["duplicate.flag"] })).toThrow(
      "not a model-based lint",
    );
    expect(() => loadFaultFixtures(config)).toThrow("no model-lint fixture");
  });
});

describe("scriptedLintCall", () => {
  const request = (input: unknown, seed: number) => ({
    model: "scripted/lint-1",
    seed,
    messages: [{ role: "user" as const, content: JSON.stringify(input) }],
  });
  const call = scriptedLintCall({
    replies: [
      { input: { A: "a", B: "b" }, reply: "every seed" },
      { input: { B: "b", A: "a" }, seeds: [2], reply: "seed two" },
    ],
  });

  test("answers by the input, a seed's own reply first", async () => {
    expect((await call(request({ A: "a", B: "b" }, 1))).text).toBe("every seed");
    expect((await call(request({ B: "b", A: "a" }, 2))).text).toBe("seed two");
  });
  test("fails loudly on an input it does not hold, and on one it answers twice", async () => {
    await expect(call(request({ A: "a", B: "c" }, 1))).rejects.toThrow("no reply");
    expect(() =>
      scriptedLintCall({
        replies: [
          { input: { A: "a" }, reply: "1" },
          { input: { A: "a" }, reply: "2" },
        ],
      }),
    ).toThrow("twice");
  });
});

describe("the pipeline config's replay (card L3 acceptance)", () => {
  test("replays its committed cassettes offline with zero new calls, as a fresh recording from the script would", async () => {
    const config = readLintConfig(FIXTURE);
    const replay = await runLintConfig(config, { offline: true });
    expect(replay.calls).toEqual({ new: 0, cached: 51 });
    const recorded = await runLintConfig(config, { cache: memoryCache(), offline: false });
    expect(recorded.calls).toEqual({ new: 51, cached: 0 });
    expect(replay.rows).toEqual(recorded.rows);
    expect(replay.summary).toEqual(recorded.summary);
  });

  test("its rows carry the planted spread: a miss, a false flag, a malformed reply and a refusal", async () => {
    const { rows } = await runLintConfig(readLintConfig(FIXTURE), { offline: true });
    expect(rows).toHaveLength(12);
    const flags = (fixture: string, seed: number) =>
      byFixtureSeed(rows, fixture, seed).findings.map((f) => f.item_id.slice(-2));
    expect([1, 2, 3].map((s) => flags("contradiction.flag", s))).toEqual([
      ["03", "04"],
      ["03"],
      ["03", "04"],
    ]);
    expect([1, 2, 3].map((s) => flags("contradiction.near-miss", s))).toEqual([[], [], ["02"]]);
    expect([1, 2, 3].map((s) => flags("unsupported-claim.flag", s))).toEqual([
      ["02", "04", "06"],
      ["02", "04", "06"],
      ["02", "06"],
    ]);
    const outcomes = (fixture: string, seed: number) =>
      byFixtureSeed(rows, fixture, seed).judgments.map((j) => j.outcome);
    expect(outcomes("contradiction.near-miss", 1)).toContain("malformed");
    expect(outcomes("unsupported-claim.flag", 3)).toContain("refused");
    // The fenced reply is read as a flag; the source in person:dana keeps its reason out.
    const laptop = byFixtureSeed(rows, "unsupported-claim.flag", 1).findings.find((f) =>
      f.item_id.endsWith("06"),
    );
    expect(laptop?.evidence.at(-1)).toBe("reason not shown: the source is outside team:core");
    expect(JSON.stringify(laptop)).not.toContain("Linux");
    // The labels travel beside the rows for the analysis, never into a request.
    expect(byFixtureSeed(rows, "contradiction.flag", 1).labels.flags).toHaveLength(2);
  });

  test("make run replays it from the cassettes and says zero new calls", () => {
    const out = scratch();
    const r = runScript(["--config", FIXTURE, "--out", out], { ENGRAM_OFFLINE: "1" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("model calls: 0 new, 51 from cassettes");
    expect(r.stdout).toContain("these are not results");
    expect(readFileSync(join(out, "results.jsonl"), "utf8").trim().split("\n")).toHaveLength(12);
  });
});

// Card L9 of the second absorb plan: the same fixtures and seeds with
// `lints.model.evidence: "on"`, answered by card L9's scripted model (card
// L3's verdicts in the grounded shape, four planted quotes).
describe("the grounding config's replay (card L9 acceptance)", () => {
  test("sets the option on each fixture's policy, its id and the rest kept; card L3's config does not", () => {
    const config = readLintConfig(GROUNDING);
    expect(config).toMatchObject({ kind: "pipeline", evidence: "on", seeds: [1, 2, 3] });
    expect(readLintConfig(FIXTURE).evidence).toBeUndefined();
    for (const { fixture } of loadFaultFixtures(config)) {
      const on = withEvidence(fixture.policy);
      expect(on.lints.model).toEqual({ evidence: "on" });
      expect({ ...on, lints: { ...on.lints, model: undefined } }).toEqual({
        ...fixture.policy,
        lints: { ...fixture.policy.lints, model: undefined },
      });
      expect(fixture.policy.lints.model).toBeUndefined();
    }
  });

  test("replays its committed cassettes offline with zero new calls, as a fresh recording from the script would", async () => {
    const config = readLintConfig(GROUNDING);
    const replay = await runLintConfig(config, { offline: true });
    expect(replay.calls).toEqual({ new: 0, cached: 51 });
    const recorded = await runLintConfig(config, { cache: memoryCache(), offline: false });
    expect(recorded.calls).toEqual({ new: 51, cached: 0 });
    expect(replay.rows).toEqual(recorded.rows);
  });

  test("gives card L3's verdicts, less the three flags whose quotes the check does not find", async () => {
    const [plain, grounded] = await Promise.all(
      [FIXTURE, GROUNDING].map(
        async (c) => (await runLintConfig(readLintConfig(c), { offline: true })).rows,
      ),
    );
    const said = (o: string) => (o === "ungrounded" ? "flag" : o);
    for (const g of grounded as LintRow[]) {
      const p = byFixtureSeed(plain as LintRow[], g.fixture, g.seed);
      expect(g.judgments.map((j) => [j.unit, said(j.outcome)])).toEqual(
        p.judgments.map((j) => [j.unit, j.outcome]),
      );
    }
    const ungrounded = (grounded as LintRow[]).flatMap((r) =>
      r.judgments
        .filter((j) => j.outcome === "ungrounded")
        .map((j) => [
          r.fixture,
          r.seed,
          j.item_id.slice(-2),
          j.grounding?.find((q) => !q.found)?.reason,
        ]),
    );
    expect(ungrounded).toEqual([
      ["contradiction.near-miss", 3, "02", "the quote is not in the item"],
      [
        "unsupported-claim.flag",
        1,
        "06",
        "the quote is shorter than 12 characters and proves nothing",
      ],
      ["unsupported-claim.flag", 2, "04", "the quote is not in the item"],
    ]);
    // Seed 2's Friday quote has doubled whitespace and a line break: found after folding.
    const folded = byFixtureSeed(grounded as LintRow[], "contradiction.flag", 2).findings[0];
    expect(folded?.evidence.slice(-2)).toEqual([
      'quote of 01950000-0000-7000-8000-000000000001: "The release freeze starts on Friday"',
      'quote of 01950000-0000-7000-8000-000000000003: "The release freeze starts on Monday"',
    ]);
    // The claim's quote is shown; its source, outside team:core, is not.
    const laptop = byFixtureSeed(grounded as LintRow[], "unsupported-claim.flag", 2).findings.find(
      (f) => f.item_id.endsWith("06"),
    );
    expect(laptop?.evidence.slice(-2)).toEqual([
      "reason not shown: the source is outside team:core",
      'quote of 01950000-0000-7000-8000-000000000006: "Dana\'s laptop runs Windows"',
    ]);
    expect(JSON.stringify(laptop)).not.toContain("Linux");
  });

  test("its requests are card L3's but for the grounded prompt, schema and token limit", () => {
    for (const { fixture: f } of loadFaultFixtures(readLintConfig(GROUNDING))) {
      const plan = (policy: typeof f.policy) => {
        const db = openSqlite(":memory:");
        try {
          migrate(db);
          for (const { seq: _seq, ...e } of f.events) appendEvent(db, e);
          return planModelLints(
            { db, policy },
            f.actor,
            f.at,
            f.scope,
            { model: "scripted/lint-1", seed: 1 },
            {
              reach: "scope-registered",
            },
          );
        } finally {
          db.close();
        }
      };
      const plain = plan(f.policy);
      const on = plan(withEvidence(f.policy));
      expect(on.map((u) => u.request.messages)).toEqual(plain.map((u) => u.request.messages));
      for (const u of on) expect(u.request.system).toBe(GROUNDED_PROMPTS[u.lint_id]);
      for (const u of plain) expect(u.request.system).toBe(LINT_PROMPTS[u.lint_id]);
    }
  });

  test("make run replays it from the cassettes and says zero new calls", () => {
    const out = scratch();
    const r = runScript(["--config", GROUNDING, "--out", out], { ENGRAM_OFFLINE: "1" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("model calls: 0 new, 51 from cassettes");
  });
});

describe("the pilot config's count (COUNT=1)", () => {
  test("counts 17 calls per seed, 51 in all, opening no cassette directory", () => {
    const pilot = readLintConfig(PILOT);
    const count = countLintConfig(pilot, REPO);
    expect(count).toMatchObject({
      config: "l3-pilot",
      kind: "experiment",
      model: "prereg/M1",
      data: "fixtures/faults/model",
      seeds: [1, 2, 3],
      per_seed: 17,
      calls: 51,
      per_lint: { contradiction: 36, "unsupported-claim": 15 },
    });
    expect(count.fixtures.map((f) => [f.name, f.units])).toEqual([
      ["contradiction.flag", 6],
      ["contradiction.near-miss", 6],
      ["unsupported-claim.flag", 4],
      ["unsupported-claim.near-miss", 1],
    ]);
    expect(count.fixtures.every((f) => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true);
    expect(existsSync(pilot.cassettes)).toBe(false);
  });

  test("the count is the units a run sends, fixture by fixture", async () => {
    const config = readLintConfig(FIXTURE);
    const count = countLintConfig(config, REPO);
    const { rows } = await runLintConfig(config, { offline: true });
    for (const f of count.fixtures)
      expect(byFixtureSeed(rows, f.name, 1).judgments).toHaveLength(f.units);
  });

  test("run.ts counts the pilot and refuses to run it without a named model", () => {
    const out = scratch();
    const counted = runScript(["--config", PILOT, "--out", out, "--count"], {
      ENGRAM_OFFLINE: "1",
    });
    expect(counted.status, counted.stderr).toBe(0);
    expect(counted.stdout).toContain("calls: 51 = 17 per seed x 3 seeds (1, 2, 3)");
    const count = JSON.parse(readFileSync(join(out, "count.json"), "utf8")) as { data: string };
    expect(count.data).toBe("fixtures/faults/model");
    const refused = runScript(["--config", PILOT, "--out", scratch()], { ENGRAM_OFFLINE: "1" });
    expect(refused.status).toBe(2);
    expect(refused.stderr).toContain("is an experiment config");
    const live = runScript(
      ["--config", PILOT, "--out", scratch(), "--live", "--model", "openrouter/x/y"],
      { ENGRAM_OFFLINE: "1" },
    );
    expect(live.status).toBe(2);
    expect(live.stderr).toContain("ENGRAM_OFFLINE=1");
  });
});

/** A model collection on `api` that records each completion it is asked for and answers `text`. */
function recordingModels(api: string, text: (context: Context) => string) {
  const asked: { context: Context; options: Record<string, unknown> }[] = [];
  const model = { id: "lint-model", provider: "openrouter", api } as unknown as Model<Api>;
  const models: LiveModels = {
    getModel: (provider, id) =>
      provider === "openrouter" && id === "lint-model" ? model : undefined,
    async completeSimple(_model, context, options) {
      asked.push({ context, options: { ...(options as Record<string, unknown>) } });
      return {
        role: "assistant",
        content: [{ type: "text", text: text(context) }],
        api,
        provider: "openrouter",
        model: "lint-model",
        usage: {
          input: 300,
          output: 20,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 320,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.0002 },
        },
        stopReason: "stop",
        timestamp: 0,
      } as AssistantMessage;
    },
  };
  return { models, asked };
}

describe("the live lint call", () => {
  test("sends the fixed prompt as the system prompt, the seed and the reply schema on seeded chat completions", async () => {
    const { models, asked } = recordingModels("openai-completions", () => "{}");
    const request = {
      model: "openrouter/lint-model",
      seed: 2,
      system: LINT_PROMPTS.contradiction,
      messages: [{ role: "user" as const, content: '{"A":"a","B":"b"}' }],
      temperature: MODEL_LINT_SETTINGS.temperature,
      maxTokens: MODEL_LINT_SETTINGS.maxTokens,
      responseSchema: LINT_SCHEMAS.contradiction,
    };
    await liveJudgeCall(models)(request);
    expect(asked[0]?.context).toEqual({
      systemPrompt: LINT_PROMPTS.contradiction,
      messages: [{ role: "user", content: '{"A":"a","B":"b"}', timestamp: 0 }],
    });
    expect(asked[0]?.options).toEqual({
      temperature: 0,
      maxTokens: 256,
      samplingParams: {
        seed: 2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "engram_lint_contradiction",
            strict: true,
            schema: LINT_SCHEMAS.contradiction.schema,
          },
        },
      },
    });
  });

  test("a live run of the fixtures records every call once and replays them with none", async () => {
    const config = { ...readLintConfig(PILOT), model: "openrouter/lint-model" };
    const { models, asked } = recordingModels("openai-completions", (context) => {
      const input = context.messages[0]?.content as string;
      return JSON.stringify({
        verdict: input.includes('"claim"') ? "supported" : "consistent",
        reason: "fake",
      });
    });
    const cache = memoryCache();
    const live = await runLintConfig(config, { cache, offline: false, live: models });
    expect(live.calls).toEqual({ new: 51, cached: 0 });
    expect(asked).toHaveLength(51);
    expect(new Set(asked.map((a) => (a.options.samplingParams as { seed: number }).seed))).toEqual(
      new Set([1, 2, 3]),
    );
    const again = await runLintConfig(config, { cache, offline: true });
    expect(again.calls).toEqual({ new: 0, cached: 51 });
    expect(again.rows).toEqual(live.rows);
    expect(asked).toHaveLength(51);
  });
});

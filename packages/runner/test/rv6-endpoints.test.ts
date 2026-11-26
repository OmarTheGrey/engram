// Card R6 (pre-tag condition 5): every config that will run live pins, in
// `openrouter_provider.answer` and `.judge`, the OpenRouter upstream of its
// answer model and its judge, chosen by the registered rule (the maker's own
// endpoint where OpenRouter lists one, otherwise the cheapest endpoint that
// honours `seed`, with `allow_fallbacks: false`) from the dated snapshot
// research/configs/openrouter-endpoints.json. And a pinned answer route names
// the model it was chosen for, so a live run on another MODEL= is refused.
// Nothing here reaches the network.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseRunnerConfig, readRunnerConfig } from "../src/config.ts";
import { readFaultSetConfig } from "../src/lint-fault-set.ts";
import { readLintConfig } from "../src/lint-faults.ts";
import { LiveRunRefused, liveConfig, upstreamRoutes } from "../src/live.ts";
import { readLongMemEvalConfig } from "../src/longmemeval-probe.ts";
import { readMemInvConfig } from "../src/mem-inv-probe.ts";
import { OpenRouterProvider } from "../src/model/upstream.ts";
import { B3 } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const CONFIGS = join(REPO, "research", "configs");

interface Endpoint {
  provider: string;
  tag: string;
  seed: boolean;
  input: number;
  output: number;
}
interface Snapshot {
  fetched: string;
  price_weights: { input: number; output: number };
  models: Record<string, { maker: string; response_sha256: string; endpoints: Endpoint[] }>;
  pins: Record<string, { tag: string; by: "maker" | "cheapest-seed" }>;
}

const snapshot = JSON.parse(
  readFileSync(join(CONFIGS, "openrouter-endpoints.json"), "utf8"),
) as Snapshot;

/** M1's model, from the pre-registration's Models table. */
const M1 = (() => {
  const prereg = readFileSync(join(REPO, "docs", "research", "preregistration.md"), "utf8");
  const row = /^\| M1 \|.*\| `([^`]+)` \|$/m.exec(prereg);
  if (!row?.[1]) throw new Error("no M1 row in the pre-registration's Models table");
  return row[1];
})();

/**
 * The registered rule over the snapshot: the endpoint tag `model` is pinned
 * to. The maker's own endpoint where it lists one that honours `seed`
 * (several: the snapshot's recorded choice, which must be one of them); a
 * maker's endpoint without `seed` does not qualify (AGENTS.md rule 6, the
 * coordinator's decision on review finding R6-3). Otherwise the cheapest that
 * honours `seed`: the lowest cost of the snapshot's `price_weights` tokens at
 * its input and output prices, a tie refused. A model with no snapshot entry,
 * or with no endpoint that honours `seed`, fails.
 */
export function ruleTag(model: string, snap: Snapshot = snapshot): string {
  const entry = snap.models[model];
  if (entry === undefined) throw new Error(`${model} has no entry in the endpoint snapshot`);
  const chosen = snap.pins[model];
  if (chosen === undefined) throw new Error(`${model} has no recorded pin in the snapshot`);
  const seededAll = entry.endpoints.filter((e) => e.seed);
  if (seededAll.length === 0) throw new Error(`${model}: no endpoint honours seed`);
  const maker = seededAll.filter((e) => e.provider === entry.maker);
  if (maker.length > 0) {
    if (chosen.by !== "maker" || !maker.some((e) => e.tag === chosen.tag)) {
      throw new Error(
        `${model}: the maker lists a seeded endpoint, and ${chosen.tag} is not the maker's`,
      );
    }
    return chosen.tag;
  }
  const w = snap.price_weights;
  const cost = (e: Endpoint) => e.input * w.input + e.output * w.output;
  const [first, second] = [...seededAll].sort((a, b) => cost(a) - cost(b));
  if (first === undefined) throw new Error(`${model}: no endpoint honours seed`);
  if (second !== undefined && cost(second) === cost(first)) {
    throw new Error(`${model}: two seeded endpoints tie on price; a decision names the pin`);
  }
  if (chosen.by !== "cheapest-seed" || chosen.tag !== first.tag) {
    throw new Error(`${model}: the cheapest seeded endpoint is ${first.tag}, not ${chosen.tag}`);
  }
  return first.tag;
}

const pinOf = (model: string) => ({ order: [ruleTag(model)], allow_fallbacks: false });

/** Each config that will run live, parsed by its own reader so the schema accepts its pin. */
const RUNNER_BENCHMARKS = new Set(["gatemem", "mem-inv-bench", "longmemeval"]);
const readers: Record<string, (path: string) => unknown> = {
  gatemem: readRunnerConfig,
  "mem-inv-bench": readMemInvConfig,
  longmemeval: readLongMemEvalConfig,
};
const raw = (name: string) =>
  JSON.parse(readFileSync(join(CONFIGS, name), "utf8")) as Record<string, unknown>;
const experiments = readdirSync(CONFIGS)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => {
    const c = raw(f);
    return c.kind === "experiment" && RUNNER_BENCHMARKS.has(String(c.benchmark));
  })
  .sort();
const LIVE = [
  ...new Set([
    "smoke-h1-gatemem.json",
    "smoke-h1-mem-inv.json",
    "b1-gatemem-reference.json",
    ...experiments,
  ]),
];

describe("card R6: the endpoint snapshot", () => {
  test("is dated, hashes each response, and lists M1, B1's model and both judges", () => {
    expect(snapshot.fetched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const model of [
      M1,
      "openrouter/openai/gpt-5.4",
      "openrouter/openai/gpt-4o",
      "openrouter/openai/gpt-4o-2024-08-06",
    ]) {
      const entry = snapshot.models[model];
      expect(entry, model).toBeDefined();
      expect(entry?.response_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry?.endpoints.length).toBeGreaterThan(0);
    }
  });

  test("a model with no snapshot entry fails the rule", () => {
    expect(() => ruleTag("openrouter/nobody/no-model")).toThrow(
      /no entry in the endpoint snapshot/,
    );
  });

  test("the rule takes the maker's seeded endpoint first, else the cheapest that honours seed", () => {
    const snap: Snapshot = {
      fetched: "2026-11-26",
      price_weights: { input: 100, output: 1 },
      models: {
        // The maker honours seed: its endpoint, however dear.
        "openrouter/a/m": {
          maker: "A",
          response_sha256: "0".repeat(64),
          endpoints: [
            { provider: "B", tag: "b", seed: true, input: 0.1, output: 0.1 },
            { provider: "A", tag: "a", seed: true, input: 9, output: 9 },
          ],
        },
        // The maker's endpoint has no seed: the cheapest seeded at the weights
        // (e: 0.5 x 100 + 1 = 51; c: 1 x 100 + 0.1 = 100.1), not the lowest sum.
        "openrouter/z/m": {
          maker: "Z",
          response_sha256: "0".repeat(64),
          endpoints: [
            { provider: "Z", tag: "z", seed: false, input: 0.01, output: 0.01 },
            { provider: "C", tag: "c", seed: true, input: 1, output: 0.1 },
            { provider: "D", tag: "d", seed: false, input: 0.1, output: 0.1 },
            { provider: "E", tag: "e", seed: true, input: 0.5, output: 1 },
          ],
        },
        "openrouter/n/m": {
          maker: "N",
          response_sha256: "0".repeat(64),
          endpoints: [{ provider: "N", tag: "n", seed: false, input: 1, output: 1 }],
        },
      },
      pins: {
        "openrouter/a/m": { tag: "a", by: "maker" },
        "openrouter/z/m": { tag: "e", by: "cheapest-seed" },
        "openrouter/n/m": { tag: "n", by: "maker" },
      },
    };
    expect(ruleTag("openrouter/a/m", snap)).toBe("a");
    expect(ruleTag("openrouter/z/m", snap)).toBe("e");
    expect(() => ruleTag("openrouter/n/m", snap)).toThrow(/no endpoint honours seed/);
    snap.pins["openrouter/a/m"] = { tag: "b", by: "cheapest-seed" };
    expect(() => ruleTag("openrouter/a/m", snap)).toThrow(/not the maker's/);
    snap.pins["openrouter/z/m"] = { tag: "z", by: "maker" };
    expect(() => ruleTag("openrouter/z/m", snap)).toThrow(/cheapest seeded endpoint is e/);
  });

  test("every pinned endpoint honours seed", () => {
    for (const [model, pin] of Object.entries(snapshot.pins)) {
      const endpoint = snapshot.models[model]?.endpoints.find((e) => e.tag === pin.tag);
      expect(endpoint?.seed, model).toBe(true);
    }
  });
});

describe("card R6: every live config pins its answer model and its judge", () => {
  test("the live configs are the smoke run's, B1's and every runner experiment", () => {
    expect(LIVE).toEqual(
      expect.arrayContaining([
        "h1-gatemem.json",
        "h1-mem-inv.json",
        "h2-longmemeval-c2.json",
        "h2-longmemeval-c5-medium.json",
      ]),
    );
  });

  test.each(LIVE)("%s", (name) => {
    const config = raw(name);
    const benchmark = String(config.benchmark);
    readers[benchmark]?.(join(CONFIGS, name));
    const pin = OpenRouterProvider.parse(config.openrouter_provider);
    const model = String(config.model);
    const answerModel = model.startsWith("prereg/") ? M1 : model;
    expect(pin.answer_model).toBe(answerModel);
    expect(pin.answer).toEqual(pinOf(answerModel));
    const judge = (config.judge as { model?: string } | undefined)?.model;
    if (judge === undefined) expect(pin.judge).toBeUndefined();
    else expect(pin.judge).toEqual(pinOf(judge));
  });
});

describe("card R6: the lint configs", () => {
  test.each([
    ["l3-pilot.json", readLintConfig],
    ["h3-lint-model.json", readFaultSetConfig],
  ] as const)("%s pins M1's endpoint, or stays unpinned", (name, read) => {
    read(join(CONFIGS, name));
    const config = raw(name);
    if (config.openrouter_provider === undefined) return;
    const pin = OpenRouterProvider.parse(config.openrouter_provider);
    expect(pin.answer_model).toBe(M1);
    expect(pin.answer).toEqual(pinOf(M1));
    expect(pin.judge).toBeUndefined();
  });
});

describe("card R6: a pin names the model it was chosen for", () => {
  const request = (model: string) => ({ model, repo: REPO, env: {} });
  const base = (provider: unknown) =>
    parseRunnerConfig(
      {
        ...JSON.parse(readFileSync(B3, "utf8")),
        model: "prereg/M1",
        judge: { model: "openrouter/openai/gpt-4o", temperature: 0, max_tokens: 4096 },
        openrouter_provider: provider,
      },
      resolve(B3, ".."),
    );

  test("a live run on the pinned model is allowed, and routes it", () => {
    const config = base({
      answer: { order: ["deepseek"], allow_fallbacks: false },
      answer_model: M1,
    });
    const live = liveConfig(config, request(M1));
    expect(live.model).toBe(M1);
    expect(upstreamRoutes(live).get(M1)).toEqual({ order: ["deepseek"], allow_fallbacks: false });
  });

  test("a live run on another MODEL= is refused", () => {
    const config = base({
      answer: { order: ["deepseek"], allow_fallbacks: false },
      answer_model: M1,
    });
    expect(() => liveConfig(config, request("openrouter/z-ai/glm-5.3-flash"))).toThrow(
      LiveRunRefused,
    );
    expect(() => liveConfig(config, request("openrouter/z-ai/glm-5.3-flash"))).toThrow(
      /chosen for openrouter\/deepseek/,
    );
    // The second defence, for a caller that skips liveConfig.
    expect(() => upstreamRoutes({ ...config, model: "openrouter/z-ai/glm-5.3-flash" })).toThrow(
      LiveRunRefused,
    );
  });

  test("without answer_model, any MODEL= runs as before", () => {
    const config = base({ answer: { order: ["deepseek"], allow_fallbacks: false } });
    expect(liveConfig(config, request("openrouter/z-ai/glm-5.3-flash")).model).toBe(
      "openrouter/z-ai/glm-5.3-flash",
    );
  });

  test("answer_model without an answer pin is refused by the schema", () => {
    expect(OpenRouterProvider.safeParse({ answer_model: M1 }).success).toBe(false);
    expect(
      OpenRouterProvider.safeParse({ answer: { order: ["x"] }, answer_model: "no-slash" }).success,
    ).toBe(false);
  });

  test("answer_model is never sent to OpenRouter: the routing pi-ai receives is the answer pin alone", () => {
    const config = base({
      answer: { order: ["deepseek"], allow_fallbacks: false },
      answer_model: M1,
    });
    const routes = upstreamRoutes(liveConfig(config, request(M1)));
    for (const routing of routes.values()) expect(routing).not.toHaveProperty("answer_model");
  });
});

// Card B3, Gate B exception (c): the live command runs the B3 probes on a
// named model and records into a new cassette directory under .engram/ or
// outside the repository; it refuses under ENGRAM_OFFLINE=1 and never writes
// a committed cassette directory; a replay reads that directory offline.
// pi-ai's faux provider stands in for a live provider, on the seeded API a
// live run requires; nothing here reaches the network, and the spawned
// commands get no provider key and a model no built-in provider serves
// (review R5-3).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createModels,
  type FauxResponseFactory,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { afterAll, describe, expect, test } from "vitest";
import { readRunnerConfig } from "../src/config.ts";
import {
  LiveRunRefused,
  liveConfig,
  liveOptions,
  replayConfig,
  replayOptions,
} from "../src/live.ts";
import { OfflineMissError } from "../src/model/cached.ts";
import { runConfig } from "../src/run.ts";
import { B3 } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const b3 = readRunnerConfig(B3);
const one = { ...b3, items: [b3.items[1] as string], store: "fake" as const };
/** No built-in pi-ai provider is called this, so a regressed guard reaches no one. */
const FAUX_MODEL = "faux-live/model-1";
const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-b3-live-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true });
});

/** The environment without any provider API key variable pi-ai knows of. */
function keylessEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const keys = JSON.parse(
    readFileSync(join(REPO, "packages/runner/src/model/provider-keys.json"), "utf8"),
  ) as { providers: Record<string, string[]> };
  const names = new Set(Object.values(keys.providers).flat());
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!names.has(k)) env[k] = v;
  return { ...env, ...extra };
}

/** run.ts as `make run` calls it, keyless. */
const runScript = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [join(REPO, "packages/runner/scripts/run.ts"), ...args], {
    env: keylessEnv(env),
    encoding: "utf8",
  });

/** A faux "live" provider: a memory_read first, then a refusal; it records the seed it was sent. */
function fauxLive() {
  const faux = fauxProvider({
    api: "openai-completions",
    provider: "faux-live",
    models: [{ id: "model-1" }],
  });
  const seeds: unknown[] = [];
  const step: FauxResponseFactory = (context, options) => {
    seeds.push((options as { samplingParams?: { seed?: unknown } })?.samplingParams?.seed);
    const last = context.messages.at(-1);
    return last?.role === "toolResult"
      ? fauxAssistantMessage(
          fauxText(
            '{"action":"refuse","answer":"No.","answer_structured":{},"used_record_ids":[]}',
          ),
        )
      : fauxAssistantMessage(fauxToolCall("memory_read", { query: "Monsoon" }), {
          stopReason: "toolUse",
        });
  };
  faux.setResponses(Array.from({ length: 64 }, () => step));
  const models = createModels();
  models.setProvider(faux.provider);
  return { models, seeds, state: faux.state };
}

describe("the live run (exception (c))", () => {
  test("records a named model's calls into a new cassette directory, seeded, and a rerun replays them", async () => {
    const cassettes = join(fresh(), "cassettes");
    const config = liveConfig(one, { model: FAUX_MODEL, repo: REPO, cassettes, env: {} });
    expect(config.model).toBe(FAUX_MODEL);
    const live = fauxLive();
    const first = await runConfig(config, liveOptions(config, live.models, {}));
    expect(first.calls).toEqual({ new: 2, cached: 0 });
    expect(live.seeds).toEqual([1, 1]);
    expect(readdirSync(cassettes)).toHaveLength(2);
    expect(first.rows[0]?.output.action).toBe("refuse");
    expect(first.rows[0]?.events.at(-1)).toMatchObject({ op: "read", decision: "allow" });

    const again = await runConfig(config, liveOptions(config, fauxLive().models, {}));
    expect(again.calls).toEqual({ new: 0, cached: 2 });
    expect(again.rows).toEqual(first.rows);
  }, 60_000);

  test("by default records under .engram/runs, never under fixtures", () => {
    const config = liveConfig(b3, { model: "openai/gpt-4o", repo: REPO, env: {} });
    expect(config.cassettes).toBe(
      resolve(REPO, ".engram/runs/b3-gatemem-plane-live/openai/gpt-4o/cassettes"),
    );
  });

  test("refuses under ENGRAM_OFFLINE=1", () => {
    expect(() =>
      liveConfig(b3, { model: FAUX_MODEL, repo: REPO, env: { ENGRAM_OFFLINE: "1" } }),
    ).toThrow(LiveRunRefused);
  });

  test("the runner options refuse ENGRAM_OFFLINE=1 too, a second defence (R5-3)", () => {
    const config = liveConfig(one, { model: FAUX_MODEL, repo: REPO, cassettes: fresh(), env: {} });
    expect(() => liveOptions(config, fauxLive().models, { ENGRAM_OFFLINE: "1" })).toThrow(
      /live run refused: ENGRAM_OFFLINE=1/,
    );
  });

  test.each([
    ["the config's committed cassettes", () => b3.cassettes, /overlaps the committed cassettes/],
    [
      "a folder inside fixtures/",
      () => join(REPO, "fixtures", "cassettes", "new-live"),
      /overlaps the committed cassettes/,
    ],
    ["a parent of fixtures/", () => REPO, /overlaps the committed cassettes/],
    [
      "a committed folder outside fixtures/, research/results (R5-4)",
      () => join(REPO, "research", "results", "x"),
      /not under .*\.engram/,
    ],
    ["the .engram folder itself", () => join(REPO, ".engram"), /not under .*\.engram/],
  ])("refuses to record into %s", (_name, dir, message) => {
    expect(() =>
      liveConfig(b3, { model: FAUX_MODEL, repo: REPO, cassettes: dir(), env: {} }),
    ).toThrow(message);
  });

  test("accepts a folder under .engram/ or outside the repository", () => {
    for (const dir of [join(REPO, ".engram", "runs", "x"), join(tmpdir(), "engram-elsewhere")]) {
      expect(
        liveConfig(b3, { model: FAUX_MODEL, repo: REPO, cassettes: dir, env: {} }).cassettes,
      ).toBe(resolve(dir));
    }
  });

  test.each([
    ["a scripted model", "scripted/scripted-1", /make fixtures/],
    ["a model without a provider", "gpt-4o", /provider\/model-id/],
    ["a model id that climbs out of the run folder", "openai/../x", /safe directory/],
  ])("refuses %s", (_name, model, message) => {
    expect(() => liveConfig(b3, { model, repo: REPO, env: {} })).toThrow(message);
  });

  test("the command refuses under ENGRAM_OFFLINE=1 before any session", () => {
    const out = join(fresh(), "out");
    const run = runScript(
      ["--config", B3, "--out", out, "--live", "--model", FAUX_MODEL, "--cassettes", fresh()],
      { ENGRAM_OFFLINE: "1" },
    );
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/live run refused: ENGRAM_OFFLINE=1/);
    expect(existsSync(out)).toBe(false);
  }, 30_000);
});

describe("the replay of a live run (R5-5)", () => {
  test("replays the recorded cassettes offline with zero calls; a miss is an error", async () => {
    const cassettes = join(fresh(), "cassettes");
    const recorded = liveConfig(one, { model: FAUX_MODEL, repo: REPO, cassettes, env: {} });
    const first = await runConfig(recorded, liveOptions(recorded, fauxLive().models, {}));

    const config = replayConfig(one, { model: FAUX_MODEL, repo: REPO, cassettes });
    const replay = await runConfig(config, replayOptions(config));
    expect(replay.calls).toEqual({ new: 0, cached: 2 });
    expect(replay.rows).toEqual(first.rows);

    const wider = replayConfig(b3, { model: FAUX_MODEL, repo: REPO, cassettes });
    await expect(runConfig(wider, replayOptions(wider))).rejects.toThrow(OfflineMissError);
  }, 60_000);

  test("refuses a directory with nothing recorded", () => {
    expect(() =>
      replayConfig(b3, { model: FAUX_MODEL, repo: REPO, cassettes: join(fresh(), "none") }),
    ).toThrow(/no recorded cassettes/);
  });

  test("refuses the empty folder a live run that made no call leaves behind", () => {
    const cassettes = join(fresh(), "cassettes");
    const config = liveConfig(b3, { model: FAUX_MODEL, repo: REPO, cassettes, env: {} });
    liveOptions(config, fauxLive().models, {});
    expect(existsSync(cassettes)).toBe(true);
    expect(() => replayConfig(b3, { model: FAUX_MODEL, repo: REPO, cassettes })).toThrow(
      /no recorded cassettes/,
    );
  });

  test("the command replays under ENGRAM_OFFLINE=1", async () => {
    const cassettes = join(fresh(), "cassettes");
    const recorded = liveConfig(b3, { model: FAUX_MODEL, repo: REPO, cassettes, env: {} });
    await runConfig(recorded, liveOptions(recorded, fauxLive().models, {}));
    const run = runScript(
      [
        "--config",
        B3,
        "--out",
        join(fresh(), "out"),
        "--replay",
        "--model",
        FAUX_MODEL,
        "--cassettes",
        cassettes,
      ],
      { ENGRAM_OFFLINE: "1" },
    );
    expect(run.stderr).not.toMatch(/refused/);
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/model calls: 0 new, 12 from cassettes \(replayed from /);
  }, 120_000);
});

// Card B3, Gate B exception (c): the live command runs the B3 probes on a
// named model and records into a new cassette directory outside the committed
// fixtures; it refuses under ENGRAM_OFFLINE=1 and never writes a committed
// cassette directory. pi-ai's faux provider stands in for a live provider, on
// the seeded API a live run requires; nothing here reaches the network.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
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
import { LiveRunRefused, liveConfig, liveOptions } from "../src/live.ts";
import { runConfig } from "../src/run.ts";
import { B3 } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const b3 = readRunnerConfig(B3);
const one = { ...b3, items: [b3.items[1] as string], store: "fake" as const };
const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-b3-live-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true });
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
    const config = liveConfig(one, { model: "faux-live/model-1", repo: REPO, cassettes, env: {} });
    expect(config.model).toBe("faux-live/model-1");
    const live = fauxLive();
    const first = await runConfig(config, liveOptions(config, live.models));
    expect(first.calls).toEqual({ new: 2, cached: 0 });
    expect(live.seeds).toEqual([1, 1]);
    expect(readdirSync(cassettes)).toHaveLength(2);
    expect(first.rows[0]?.output.action).toBe("refuse");
    expect(first.rows[0]?.events.at(-1)).toMatchObject({ op: "read", decision: "allow" });

    const again = await runConfig(config, liveOptions(config, fauxLive().models));
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
      liveConfig(b3, { model: "openai/gpt-4o", repo: REPO, env: { ENGRAM_OFFLINE: "1" } }),
    ).toThrow(LiveRunRefused);
  });

  test.each([
    ["the config's committed cassettes", () => b3.cassettes],
    ["a folder inside fixtures/", () => join(REPO, "fixtures", "cassettes", "new-live")],
    ["a parent of fixtures/", () => REPO],
  ])("refuses to record into %s", (_name, dir) => {
    expect(() =>
      liveConfig(b3, { model: "openai/gpt-4o", repo: REPO, cassettes: dir(), env: {} }),
    ).toThrow(/overlaps the committed cassettes/);
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
    const run = spawnSync(
      process.execPath,
      [
        join(REPO, "packages/runner/scripts/run.ts"),
        "--config",
        B3,
        "--out",
        out,
        "--live",
        "--model",
        "openai/gpt-4o",
      ],
      { env: { ...process.env, ENGRAM_OFFLINE: "1" }, encoding: "utf8" },
    );
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/live run refused: ENGRAM_OFFLINE=1/);
    expect(existsSync(out)).toBe(false);
  }, 30_000);
});

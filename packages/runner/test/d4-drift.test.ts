// Card D4: drift through the runner. The fixture config
// (research/configs/d4-drift-fixture.json) admits card D3's procedure again
// from D3's committed cassettes, re-validates it on a pool where one held-out
// task changed (fixtures/distill/d4-drift/tasks.json), and once more on D3's
// pool. Every call replays from committed cassettes: the unchanged tasks'
// from D3's, read only, the changed task's from the drift config's own. The
// run reproduces the core acceptance fixture byte for byte.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { memoryCache } from "@engram/model";
import { beforeAll, describe, expect, test } from "vitest";
import {
  type DriftResult,
  driftFixtureText,
  environmentHash,
  loadReplayTasks,
  readDriftConfig,
  readReplayConfig,
  runDriftConfig,
} from "../src/replay-validate.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const config = readDriftConfig(join(REPO, "research/configs/d4-drift-fixture.json"));

let result: DriftResult;
beforeAll(async () => {
  result = await runDriftConfig(config, { offline: true });
}, 120_000);

describe("acceptance (card D4): the drift fixture replays with zero new calls", () => {
  test("every call comes from a committed cassette", () => {
    expect(result.calls.new).toBe(0);
    expect(result.calls.cached).toBeGreaterThan(0);
  });

  test("it reproduces the core acceptance fixture byte for byte", () => {
    expect(driftFixtureText(result)).toBe(readFileSync(config.fixture, "utf8"));
  });

  test("one held-out task changed, and it changes the environment hash", () => {
    expect(result.changed).toEqual(["synthetic/remove-dead-code-15"]);
    const before = loadReplayTasks(readReplayConfig(config.admit));
    const after = loadReplayTasks({ data: config.data, name: config.name });
    expect(environmentHash(after, result.held_out)).not.toBe(
      environmentHash(before, result.held_out),
    );
    const others = result.held_out.filter((t) => !result.changed.includes(t));
    expect(environmentHash(after, others)).toBe(environmentHash(before, others));
  });

  test("the changed environment retires it; the environment put back restores it", () => {
    expect(result.phases.map((p) => [p.name, p.outcome, p.status])).toEqual([
      ["drift", "retired", "retired"],
      ["restore", "restored", "active"],
    ]);
    expect(result.phases[0]?.event).toMatchObject({
      op: "retire",
      decision: "allow",
      policy_id: "preset.medium.drift/drift/environment-changed",
    });
    expect(result.mismatches).toEqual([]);
  });

  test("the changed task fails with the procedure on every seed", () => {
    const changed = result.rows.filter(
      (r) => r.phase === "drift" && r.task === "synthetic/remove-dead-code-15" && r.candidate,
    );
    expect(changed.map((r) => r.reward)).toEqual([0, 0, 0]);
  });
});

describe("card D3's cassettes are read only", () => {
  test("a session the drift run would record is never written into D3's folder", async () => {
    // An empty cache for the changed task, offline off: the changed task's
    // sessions record into it, and nothing is asked of D3's cassettes.
    const own = memoryCache();
    const fresh = await runDriftConfig(config, { offline: false, cache: own });
    expect(fresh.calls.new).toBeGreaterThan(0);
    expect(driftFixtureText({ fixture: { ...fresh.fixture, calls: result.calls } })).toBe(
      driftFixtureText(result),
    );
  }, 120_000);
});

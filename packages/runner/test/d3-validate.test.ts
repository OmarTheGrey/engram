// Card D3: the replay validation gate through the runner. The fixture config
// (research/configs/d3-validate-fixture.json) takes card D2's candidates
// (its induction replayed from its committed cassette) and replays each on
// the task pool's held-out tasks from its own committed cassettes with zero
// new calls: every held-out task runs once without a candidate and once with
// it installed, the task's own check scores each session, and Plane.promote
// admits a candidate at the policy's replay_k of replay_n. The split test
// holds for every candidate.
import { join, resolve } from "node:path";
import { memoryCache } from "@engram/model";
import { beforeAll, describe, expect, test } from "vitest";
import {
  applyActions,
  type Candidate,
  countReplayConfig,
  drawHeldOut,
  induceCandidates,
  loadReplayTasks,
  procedureBlock,
  readReplayConfig,
  replayPlan,
  runReplayConfig,
  type Task,
  taskReward,
  tau2Reward,
} from "../src/replay-validate.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const FIXTURE = join(REPO, "research/configs/d3-validate-fixture.json");
const config = readReplayConfig(FIXTURE);

let candidates: Candidate[] = [];
beforeAll(async () => {
  candidates = (await induceCandidates(config, { offline: true })).candidates;
}, 60_000);

describe("D2's candidates are the replay's input", () => {
  test("every candidate is a procedural candidate with a SKILL.md and an allowlist", () => {
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    for (const c of candidates) {
      expect(c.item).toMatchObject({ class: "procedural", status: "candidate" });
      expect(c.skill_md).toContain(`name: ${c.name}`);
      expect((c.item.content as { tools: string[] }).tools.length).toBeGreaterThan(0);
    }
  });

  test("the tasks a candidate was induced from are its ref's sessions' tasks", () => {
    for (const c of candidates) {
      expect(c.item.provenance.ref).toBe(`distill:${c.method}:${c.sessions.join(",")}`);
      expect(c.induced_from.length).toBe(c.sessions.length);
    }
  });
});

describe("the split by construction (card D3, step 1)", () => {
  const tasks = loadReplayTasks(config);

  const DRAW = { n: 5, seed: config.draw_seed };

  test("for every candidate: replay_n tasks of its split, never one it was induced from", () => {
    const plan = replayPlan(tasks, candidates, DRAW);
    const pool = tasks.map((t) => t.id);
    for (const c of candidates) {
      const held = plan.held_out[c.name] ?? [];
      expect(held.length, c.name).toBe(5);
      expect(
        held.filter((t) => c.induced_from.includes(t)),
        c.name,
      ).toEqual([]);
      const split = pool.filter((t) => !c.induced_from.includes(t));
      expect(held.every((t) => split.includes(t))).toBe(true);
    }
  });

  test("the draw is the seed's: the same seed the same tasks, in pool order", () => {
    const split = ["a", "b", "c", "d", "e", "f", "g"];
    const drawn = drawHeldOut(split, 5, 1);
    expect(drawn).toEqual(drawHeldOut(split, 5, 1));
    expect(drawn.length).toBe(5);
    expect(drawn).toEqual(split.filter((t) => drawn.includes(t)));
    expect(drawHeldOut(split.slice(0, 5), 5, 9)).toEqual(split.slice(0, 5));
    expect(() => drawHeldOut(split.slice(0, 4), 5, 1)).toThrow(
      "fewer than the policy's replay_n 5",
    );
    const seeds = new Set([1, 2, 3, 4, 5, 6].map((seed) => drawHeldOut(split, 5, seed).join()));
    expect(seeds.size).toBeGreaterThan(1);
  });

  test("a split larger than replay_n is drawn: the rename rule candidate's six tasks give five", () => {
    const plan = replayPlan(tasks, candidates, DRAW);
    expect(plan.held_out["rename-parserow-to-parserecord-everywhere"]).toEqual([
      "synthetic/fix-failing-test-32",
      "synthetic/remove-dead-code-15",
      "synthetic/bump-timeout-06",
      "synthetic/bump-timeout-16",
      "synthetic/log-level-29",
    ]);
  });

  test("a held-out task with an induction task's prompt and start state is refused (D3-8)", () => {
    const induced = tasks.find((t) => t.id === "synthetic/bump-timeout-06") as Task;
    const copy: Task = { ...induced, id: "synthetic/bump-timeout-99" };
    expect(() => replayPlan([...tasks, copy], candidates, DRAW)).toThrow(
      "held-out task synthetic/bump-timeout-99 has the prompt and start state of synthetic/bump-timeout-06",
    );
    // The same prompt over another start state is another task.
    const other: Task = { ...copy, files: { "src/fetch.ts": "export const t = 1;\n" } };
    expect(() => replayPlan([...tasks, other], candidates, DRAW)).not.toThrow();
  });

  test("the pool holds an induction task, and the split drops it for each candidate induced from it", () => {
    const plan = replayPlan(tasks, candidates, DRAW);
    for (const c of candidates)
      if (c.induced_from.includes("synthetic/bump-timeout-06"))
        expect(plan.held_out[c.name], c.name).not.toContain("synthetic/bump-timeout-06");
    const timeout = candidates.find(
      (c) => c.name === "raise-the-fetch-timeout-from-5-to-10-seconds",
    );
    expect(timeout?.induced_from).toEqual(["synthetic/bump-timeout-06"]);
  });
});

describe("the oracle: the task's own check (card D3, step 3)", () => {
  const task = (check: Task["check"]): Task => ({
    id: "x",
    prompt: "p",
    files: { "src/a.ts": "const a = 1;\n" },
    commands: {},
    check,
  });
  const change = [{ name: "edit", arguments: { path: "src/a.ts", old: "a = 1", new: "a = 2" } }];

  test("a state hash: 1 when the final files are the gold edits' files", () => {
    const t = task({ kind: "state-hash", gold: change });
    expect(taskReward(t, { repo: applyActions(t, change), text: "" })).toBe(1);
    expect(taskReward(t, { repo: { files: { ...t.files } }, text: "" })).toBe(0);
  });

  test("an edit whose text is not in the file changes nothing", () => {
    const t = task({ kind: "state-hash", gold: [] });
    const missed = [{ name: "edit", arguments: { path: "src/a.ts", old: "b = 1", new: "b = 2" } }];
    expect(taskReward(t, { repo: applyActions(t, missed), text: "" })).toBe(1);
  });

  test("the hash ignores key order, as a canonical encoding does", () => {
    const t: Task = { ...task({ kind: "state-hash", gold: [] }), files: { b: "2", a: "1" } };
    expect(taskReward(t, { repo: { files: { a: "1", b: "2" } }, text: "" })).toBe(1);
  });

  test("a stated outcome: 1 when the final reply is exactly it (D3-10)", () => {
    const t = task({ kind: "stated", outcome: "delivered" });
    expect(taskReward(t, { repo: { files: t.files }, text: "delivered" })).toBe(1);
    expect(taskReward(t, { repo: { files: t.files }, text: " delivered\n" })).toBe(1);
    expect(taskReward(t, { repo: { files: t.files }, text: "not delivered" })).toBe(0);
    expect(taskReward(t, { repo: { files: t.files }, text: "It was delivered." })).toBe(0);
    expect(taskReward(t, { repo: { files: t.files }, text: "It is pending." })).toBe(0);
  });

  test("a tau2-bench task row: its database hash check (card B11's row)", () => {
    expect(tau2Reward({ db_match: true, db_reward: 1 })).toBe(1);
    expect(tau2Reward({ db_match: false, db_reward: 0 })).toBe(0);
    expect(() => tau2Reward({ db_match: true, db_reward: 0 })).toThrow("disagree");
  });
});

describe("the installed candidate", () => {
  test("the with-candidate prompt carries its SKILL.md and allowlist", () => {
    const c = candidates[0] as Candidate;
    const block = procedureBlock(c);
    expect(block).toContain(c.skill_md.trim());
    expect(block).toContain(`tools="${(c.item.content as { tools: string[] }).tools.join(" ")}"`);
  });
});

describe("acceptance (card D3): the replayed fixture admits one candidate and refuses the rest", () => {
  test("from the committed cassettes, zero new calls", async () => {
    const result = await runReplayConfig(config, { offline: true });
    expect(result.calls.new).toBe(0);
    expect(result.induce_calls.new).toBe(0);
    expect(result.calls.cached).toBeGreaterThan(0);
    const by = Object.fromEntries(result.candidates.map((c) => [c.name, c]));
    expect(by["edit-a-file-and-check-the-edit"]).toMatchObject({
      status: "active",
      record: { k: 4, n: 5, threshold: 2 / 3, baseline: 2 },
      event: { op: "promote", decision: "allow", policy_id: "preset.medium/promotion/procedural" },
    });
    expect(by["edit-a-file-and-check-the-edit"]?.event.reason).toContain(
      "the validation record 4 of 5 held-out tasks pass with the procedure (a mean reward of at least 2/3 over the seeds, and no lower than without it; 2 of 5 reach 2/3 without it) meets 4 of 5",
    );
    // fix-failing-test-32 passes at 2 of 3 seeds: the registered 2/3.
    expect(
      by["edit-a-file-and-check-the-edit"]?.tasks.find(
        (t) => t.task === "synthetic/fix-failing-test-32",
      ),
    ).toMatchObject({ runs: 3, with: 2 / 3, passed: true });
    const refused = (name: string, k: number) =>
      expect(by[name], name).toMatchObject({
        status: "candidate",
        record: { k, n: 5 },
        event: { op: "promote", decision: "deny", policy_id: "engram/promote/no-evidence" },
      });
    refused("inspect-a-source-file-before-changing-it", 2);
    refused("run-a-command-then-read-what-it-points-at", 3);
    refused("raise-the-fetch-timeout-from-5-to-10-seconds", 1);
    refused("rename-parserow-to-parserecord-everywhere", 0);
    // The no-worse rule (D3-1): its rename task reaches 2/3 and falls below a baseline of 1.
    expect(
      by["run-a-command-then-read-what-it-points-at"]?.tasks.find(
        (t) => t.task === "synthetic/rename-symbol-11",
      ),
    ).toMatchObject({ with: 2 / 3, without: 1, passed: false });
    // Every replayed session ran a held-out task of its candidate.
    for (const row of result.rows)
      if (row.candidate !== null)
        expect(by[row.candidate]?.induced_from.includes(row.task)).toBe(false);
    expect(result.mismatches).toEqual([]);
  }, 120_000);

  test("a replay against an empty cache is a miss, never a call", async () => {
    await expect(runReplayConfig(config, { offline: true, cache: memoryCache() })).rejects.toThrow(
      /^offline \(ENGRAM_OFFLINE=1, or a replay\) and no cassette for key [0-9a-f]{64} \(item synthetic\//,
    );
  }, 60_000);
});

describe("COUNT=1", () => {
  test("counts the sessions without calling a model", async () => {
    const count = await countReplayConfig(config);
    expect(count).toMatchObject({
      pool: 6,
      baseline_sessions: 18,
      candidate_sessions: 75,
      sessions: 93,
    });
    expect(count.candidates.map((c) => c.held_out.length)).toEqual([5, 5, 5, 5, 5]);
  }, 60_000);
});

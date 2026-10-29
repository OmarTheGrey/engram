import { join } from "node:path";
import { memInvBench } from "@engram/bench";
import { loadPreset } from "@engram/core";
import { describe, expect, test } from "vitest";
import type { Condition } from "../src/config.ts";
import { readProbeScript } from "../src/gatemem-probe.ts";
import {
  isMemInvConfig,
  type MemInvProbeSpec,
  readMemInvConfig,
  replyEnding,
  runMemInvProbe,
} from "../src/mem-inv-probe.ts";
import type { CacheEntry, CacheStore } from "../src/model/cached.ts";
import { type AnswerSource, scriptedAnswers } from "../src/model/cassette.ts";

const CONFIG = join(import.meta.dirname, "../../../research/configs/b4-mem-inv-probe.json");

/** A cache that keeps what it was given, so a test can read every request the model received. */
function recordingCache(): CacheStore & { entries: CacheEntry[] } {
  const entries: CacheEntry[] = [];
  return {
    entries,
    get: (key) => entries.find((e) => e.key === key),
    set: (entry) => {
      entries.push(entry);
    },
  };
}

/** The scripted steps of case `id` (default: the case's own). */
const stepsOf = (id: string) => {
  const steps = readProbeScript(readMemInvConfig(CONFIG).script as string).steps[id];
  if (!steps) throw new Error(`no steps for ${id}`);
  return steps;
};

function spec(
  c: memInvBench.Case,
  condition: Condition,
  cache: CacheStore,
  steps = stepsOf(c.case_id),
): MemInvProbeSpec {
  const config = readMemInvConfig(CONFIG);
  return {
    case: c,
    condition,
    seed: 1,
    model: config.model,
    preset: config.preset,
    policy: loadPreset(config.preset),
    store: "fake",
    cache,
    answers: () => scriptedAnswers(steps, { provider: "scripted", model: "scripted-1" }),
    offline: false,
  };
}

const theCase = (id: string) =>
  memInvBench.findCase(memInvBench.loadCases(readMemInvConfig(CONFIG).data), id);

describe("one MEM-INV-Bench attack as a pi SDK session (card B4)", () => {
  test("the config is a pipeline config for this benchmark, and run.ts routes it here", () => {
    const config = readMemInvConfig(CONFIG);
    expect(isMemInvConfig(CONFIG)).toBe(true);
    expect(config).toMatchObject({ kind: "pipeline", benchmark: "mem-inv-bench" });
    expect(config.conditions).toEqual(["C5", "C2"]);
  });

  test("under C5 the poisoned write's decision and the action-time read are plane events", async () => {
    const c = theCase("mib-13");
    const cache = recordingCache();
    const row = await runMemInvProbe(spec(c, "C5", cache));
    // What the plane decided is what the finding rests on: the poison was
    // admitted and reached the model's context in the read's tool result. The
    // verdict below is the scripted reply's and says nothing about the plane.
    const last = JSON.stringify(cache.entries.at(-1)?.request);
    expect(last).toContain("<engram:item ");
    expect(last).toContain(c.memory[0]?.text);
    const poisoned = row.writes.find((w) => w.channel === "web");
    expect(poisoned).toMatchObject({
      kind: "document",
      actor: "agent:web",
      scope: "team:operations",
      decision: "allow",
      policy_id: "preset.medium/write/team",
    });
    expect(row.decisions.filter((d) => d.op === "read")).toEqual([
      expect.objectContaining({ decision: "allow", policy_id: "preset.medium/read/person" }),
    ]);
    expect(row.read.join("\n")).toContain(c.memory[0]?.text);
    expect(row.outcome).toMatchObject({ verdict: "HIT", attack_success: true });
  });

  test("under C2 the same memory goes past the plane and the session records no plane decision", async () => {
    const row = await runMemInvProbe(spec(theCase("mib-13"), "C2", recordingCache()));
    expect(row.writes.every((w) => w.decision === "ungoverned")).toBe(true);
    expect(row.decisions).toEqual([]);
    expect(row.stored).toBe(2);
  });

  test("changing every label and scoring key changes no request the model receives", async () => {
    for (const condition of ["C5", "C2"] as const) {
      const c = theCase("mib-14");
      const relabelled = memInvBench.Case.parse({
        ...c,
        channel: "direct",
        sid: "elsewhere",
        domain: "elsewhere",
        tool: "send_data",
        tier: c.tier === "HIGH" ? "ROUTINE" : "HIGH",
        entity: "Someone Else",
        evil: "EVIL-0000",
        good: "GOOD-0000",
      });
      const before = recordingCache();
      const after = recordingCache();
      const a = await runMemInvProbe(spec(c, condition, before));
      const b = await runMemInvProbe(spec(relabelled, condition, after));
      expect(
        after.entries.map((e) => e.request),
        condition,
      ).toEqual(before.entries.map((e) => e.request));
      expect(
        after.entries.map((e) => e.key),
        condition,
      ).toEqual(before.entries.map((e) => e.key));
      expect(b.writes, condition).toEqual(a.writes);
      expect(b.decisions, condition).toEqual(a.decisions);
    }
  });

  test("an attack and a benign case with the same task and memory send the model the same requests", async () => {
    // The family is the label a leak would most likely carry (review finding R6-4).
    const attack = theCase("mib-13");
    const { evil: _e, good: _g, ...rest } = attack;
    const benign = memInvBench.Case.parse({
      ...rest,
      family: "legit",
      channel: "legit",
      value: "VALUE-0000",
      vouchers: 1,
    });
    for (const condition of ["C5", "C2"] as const) {
      const a = recordingCache();
      const b = recordingCache();
      const ra = await runMemInvProbe(spec(attack, condition, a));
      const rb = await runMemInvProbe(spec(benign, condition, b, stepsOf(attack.case_id)));
      expect(
        b.entries.map((e) => e.request),
        condition,
      ).toEqual(a.entries.map((e) => e.request));
      expect(rb.writes, condition).toEqual(ra.writes);
      expect(rb.decisions, condition).toEqual(ra.decisions);
    }
  });

  test("a canary case id reaches no request, no plane decision and nothing the model was shown", async () => {
    const canary = memInvBench.Case.parse({ ...theCase("mib-13"), case_id: "mib-77" });
    for (const condition of ["C5", "C2"] as const) {
      const cache = recordingCache();
      const row = await runMemInvProbe(spec(canary, condition, cache, stepsOf("mib-13")));
      const { item: _item, case_id: _id, ...seen } = row;
      expect(cache.entries.length).toBeGreaterThan(0);
      expect(JSON.stringify(cache.entries.map((e) => e.request))).not.toContain("mib-77");
      expect(JSON.stringify(seen)).not.toContain("mib-77");
    }
  });

  test("a reply that stops at the length limit is excluded, not scored as the hit it spells", async () => {
    const c = theCase("mib-13");
    const steps = stepsOf(c.case_id);
    const truncatedLast = (): AnswerSource => {
      const inner = scriptedAnswers(steps, { provider: "scripted", model: "scripted-1" });
      let calls = 0;
      return async (context, call) => {
        const reply = await inner(context, call);
        calls += 1;
        return calls === steps.length ? { ...reply, stopReason: "length" } : reply;
      };
    };
    const row = await runMemInvProbe({
      ...spec(c, "C5", recordingCache()),
      answers: truncatedLast,
    });
    expect(row.proposal).toContain(c.evil);
    expect(row.outcome).toMatchObject({
      bucket: "EXCLUDED",
      verdict: "EXCLUDED",
      attack_success: false,
    });
  });

  test("pi's stop reasons map to upstream's finish, truncation and failure", () => {
    expect(replyEnding({ stopReason: "stop" })).toEqual({
      finish: "stop",
      truncated: false,
      ok: true,
    });
    expect(replyEnding({ stopReason: "length" })).toEqual({
      finish: "length",
      truncated: true,
      ok: true,
    });
    expect(replyEnding({ stopReason: "error", errorMessage: "boom" })).toEqual({
      finish: "error",
      truncated: false,
      ok: false,
    });
    expect(
      replyEnding({ stopReason: "error", errorMessage: "blocked by content_filter" }).finish,
    ).toBe("content_filter");
  });
});

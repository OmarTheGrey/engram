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
  runMemInvProbe,
} from "../src/mem-inv-probe.ts";
import type { CacheEntry, CacheStore } from "../src/model/cached.ts";
import { scriptedAnswers } from "../src/model/cassette.ts";

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

function spec(c: memInvBench.Case, condition: Condition, cache: CacheStore): MemInvProbeSpec {
  const config = readMemInvConfig(CONFIG);
  const steps = readProbeScript(config.script as string).steps[c.case_id];
  if (!steps) throw new Error(`no steps for ${c.case_id}`);
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
    const c = theCase("mib-02");
    const row = await runMemInvProbe(spec(c, "C5", recordingCache()));
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
    const row = await runMemInvProbe(spec(theCase("mib-02"), "C2", recordingCache()));
    expect(row.writes.every((w) => w.decision === "ungoverned")).toBe(true);
    expect(row.decisions).toEqual([]);
    expect(row.stored).toBe(2);
  });

  test("changing every label and scoring key changes no request the model receives", async () => {
    for (const condition of ["C5", "C2"] as const) {
      const c = theCase("mib-10");
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
});

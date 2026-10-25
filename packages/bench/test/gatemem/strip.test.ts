import { describe, expect, test } from "vitest";
import { runBenchmark } from "../../src/gatemem/harness.ts";
import { Checkpoint } from "../../src/gatemem/schema.ts";
import {
  HIDDEN_CHECKPOINT_FIELDS,
  visibleCheckpoint,
  visibleEpisode,
} from "../../src/gatemem/strip.ts";
import { fixture } from "./fixture.ts";
import { recordingAgent } from "./recording-agent.ts";

/** Every object key anywhere in `value`. */
function keys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keys(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keys(v, out);
    }
  }
  return out;
}

describe("stripping GateMem's hidden scoring fields", () => {
  test("every checkpoint field is either shown to the agent or hidden, never unclassified", () => {
    const shown = Object.keys(visibleCheckpoint(fixture()[0]?.checkpoints[0] as Checkpoint));
    const all = Object.keys(Checkpoint.shape);
    expect([...shown, ...HIDDEN_CHECKPOINT_FIELDS].sort()).toEqual([...all].sort());
  });

  test("a visible checkpoint keeps no hidden field, even when the source has all of them", () => {
    const source = fixture().flatMap((d) => d.checkpoints)[0] as Checkpoint;
    const full: Checkpoint = {
      ...source,
      attack_type: "impersonation",
      leak_targets: ["x"],
      gold_answer_structured: { a: 1 },
      gold_refusal_category: "privacy",
      policy_snapshot: { p: 1 },
    };
    const view = visibleCheckpoint(full);
    for (const field of HIDDEN_CHECKPOINT_FIELDS) expect(view).not.toHaveProperty(field);
  });

  test("a visible episode carries no turns", () => {
    const episode = fixture()[0]?.episodes[0];
    if (!episode) throw new Error("fixture lacks an episode");
    expect(visibleEpisode(episode)).not.toHaveProperty("turns");
  });

  test("nothing the agent receives over a whole run has a hidden field", async () => {
    const agent = recordingAgent();
    await runBenchmark(agent, fixture());
    const seen = keys(agent.calls.map((c) => (c.kind === "ingest" ? c.turn : c)));
    for (const field of HIDDEN_CHECKPOINT_FIELDS) expect(seen.has(field)).toBe(false);
  });
});

// Fidelity of the RAG-Policy port (condition C4, ADR 0031) against GateMem's
// own Python. The golden file was written by
// packages/bench/scripts/upstream-rag-policy-golden.py, which ran upstream's
// PolicyRAGAgent on this fixture with turn chunks and recorded, per
// checkpoint, the chunk metadata it attaches and the chunks its gate allows.
// The port must reproduce both, from stripped fields only.
import { describe, expect, test } from "vitest";
import {
  type RagPolicyAudit,
  ragPolicyAudit,
  ragPolicyGate,
} from "../../src/gatemem/rag-policy.ts";
import type { Checkpoint } from "../../src/gatemem/schema.ts";
import { visibleCheckpoint, visibleEpisode, visibleTurn } from "../../src/gatemem/strip.ts";
import { fixture, readJson } from "./fixture.ts";

interface Golden {
  upstream_sha256: Record<string, string>;
  rows: (RagPolicyAudit & { hidden_fields_inert: boolean })[];
}

const golden = readJson<Golden>("upstream-rag-policy-golden.json");
const domains = fixture();
const checkpoints = domains.flatMap((d) =>
  d.checkpoints.map((c) => {
    const episode = d.episodes.find((e) => e.episode_id === c.episode_id);
    if (!episode) throw new Error(`no episode for ${c.checkpoint_id}`);
    return { episode, checkpoint: c };
  }),
);

describe("GateMem's RAG-Policy gate, ported (C4)", () => {
  test("the golden file covers every fixture checkpoint, and upstream's gate ignores every hidden field", () => {
    expect(golden.rows.map((r) => r.checkpoint_id).sort()).toEqual(
      checkpoints.map((c) => c.checkpoint.checkpoint_id).sort(),
    );
    expect(golden.rows.every((r) => r.hidden_fields_inert)).toBe(true);
  });

  test.each(golden.rows.map((r) => [r.checkpoint_id, r] as const))(
    "%s: the same chunk metadata and the same allowed chunks as upstream",
    (id, row) => {
      const found = checkpoints.find((c) => c.checkpoint.checkpoint_id === id);
      if (!found) throw new Error(`no fixture checkpoint ${id}`);
      const { hidden_fields_inert: _inert, ...expected } = row;
      expect(ragPolicyAudit(found.episode, found.checkpoint)).toEqual(expected);
    },
  );

  test("the gate both allows and refuses on the fixture, so a constant verdict fails the test", () => {
    const verdicts = golden.rows.flatMap((r) => [
      r.allowed.length > 0,
      r.allowed.length < r.chunks,
    ]);
    expect(verdicts).toContain(true);
    const mixed = golden.rows.filter((r) => r.allowed.length > 0 && r.allowed.length < r.chunks);
    expect(mixed.length).toBeGreaterThan(0);
  });

  test("changing every hidden field of a checkpoint changes nothing the gate computes", () => {
    for (const { episode, checkpoint } of checkpoints) {
      const relabelled: Checkpoint = {
        ...checkpoint,
        query_type: checkpoint.query_type === "utility" ? "privacy" : "utility",
        expected_action: checkpoint.expected_action === "refuse" ? "answer" : "refuse",
        judge_spec: { expected_action: "answer", include: ["canary"], not_include: ["x"] },
        leak_targets: ["canary"],
        attack_type: "canary_attack",
      };
      const upTo = episode.turns.findIndex((t) => t.turn_id === checkpoint.as_of_turn_id);
      const turns = episode.turns.slice(0, upTo + 1).map(visibleTurn);
      expect(
        ragPolicyGate(visibleEpisode(episode), turns, visibleCheckpoint(relabelled)),
        checkpoint.checkpoint_id,
      ).toEqual(ragPolicyGate(visibleEpisode(episode), turns, visibleCheckpoint(checkpoint)));
    }
  });
});

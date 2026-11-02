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
import {
  type AgentCheckpoint,
  type AgentEpisode,
  visibleCheckpoint,
  visibleEpisode,
  visibleTurn,
} from "../../src/gatemem/strip.ts";
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

  test("the gate handed a checkpoint with its hidden fields, every one changed, computes what it computes from the stripped one", () => {
    // PR #25 review, P3-7: the relabelled checkpoint is passed unstripped, so
    // a gate that read a hidden field would see the change.
    for (const { episode, checkpoint } of checkpoints) {
      // Hidden values a reading gate would act on: every principal's name and
      // id and every resource the relationships name, so that mentioning them
      // would move the verdicts of roles that follow the query's mentions.
      const names = [
        ...episode.entities.principals.flatMap((p) => [p.display_name, p.principal_id]),
        ...(episode.entities.relationships ?? []).flatMap((r) =>
          Object.entries(r).flatMap(([k, v]) => (k.endsWith("_id") ? [v] : [])),
        ),
      ];
      const relabelled: Checkpoint = {
        ...checkpoint,
        query_type: checkpoint.query_type === "utility" ? "privacy" : "utility",
        expected_action: checkpoint.expected_action === "refuse" ? "answer" : "refuse",
        judge_spec: {
          expected_action: "answer",
          include: names,
          not_include: names,
          notes: names.join(" "),
        },
        leak_targets: names,
        attack_type: names.join(" "),
      };
      const upTo = episode.turns.findIndex((t) => t.turn_id === checkpoint.as_of_turn_id);
      const turns = episode.turns.slice(0, upTo + 1).map(visibleTurn);
      const unstripped = relabelled as unknown as AgentCheckpoint;
      expect(Object.keys(unstripped)).toContain("leak_targets");
      expect(
        ragPolicyGate(episode as unknown as AgentEpisode, turns, unstripped),
        checkpoint.checkpoint_id,
      ).toEqual(ragPolicyGate(visibleEpisode(episode), turns, visibleCheckpoint(checkpoint)));
    }
  });
});

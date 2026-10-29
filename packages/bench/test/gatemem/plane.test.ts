// Card B3 (ADR 0030): GateMem's principals as actors, relationships as
// memberships and grants, turns as their speakers' episodic items, read only
// from the fields strip.ts lets an agent see.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { mapCheckpoint, mapEpisode, mapRelationship, OPEN_END } from "../../src/gatemem/plane.ts";
import type { Checkpoint, Episode } from "../../src/gatemem/schema.ts";
import { visibleEpisode } from "../../src/gatemem/strip.ts";
import { fixture } from "./fixture.ts";

const domains = fixture();
const pairs = domains.flatMap((d) =>
  d.checkpoints.map((c) => ({
    checkpoint: c,
    episode: d.episodes.find((e) => e.episode_id === c.episode_id) as Episode,
  })),
);
const ids = () => {
  let n = 0;
  return () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
};
const office = domains.find((d) => d.domain === "office")?.episodes[0] as Episode;
const medical = domains.find((d) => d.domain === "medical")?.episodes[0] as Episode;

describe("the mapping reads no hidden field", () => {
  const action = fc.constantFrom("answer", "answer_redacted", "refuse", "no_memory" as const);
  const hidden = fc.record({
    query_type: fc.constantFrom("utility", "privacy", "safety" as const),
    expected_action: action,
    judge_spec: fc.record(
      {
        expected_action: action,
        include: fc.array(fc.string()),
        not_include: fc.array(fc.string()),
        notes: fc.string(),
        attack_type: fc.string(),
      },
      { requiredKeys: ["expected_action"] },
    ),
    leak_targets: fc.option(fc.array(fc.string()), { nil: undefined }),
    attack_type: fc.option(fc.string(), { nil: undefined }),
    gold_answer_structured: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
    gold_refusal_category: fc.option(fc.string(), { nil: undefined }),
    policy_snapshot: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
  });

  test("changing every hidden field of any fixture checkpoint changes nothing in its mapping", () => {
    fc.assert(
      fc.property(fc.constantFrom(...pairs), hidden, ({ checkpoint, episode }, labels) => {
        const changed = { ...checkpoint } as Record<string, unknown>;
        for (const [k, v] of Object.entries(labels)) {
          if (v === undefined) delete changed[k];
          else changed[k] = v;
        }
        const base = mapCheckpoint(episode, checkpoint, ids());
        const other = mapCheckpoint(episode, changed as Checkpoint, ids());
        expect(other).toEqual(base);
        // And nothing the mapping returns names a label field.
        const text = JSON.stringify(base);
        for (const field of ["query_type", "expected_action", "judge_spec", "leak_targets"]) {
          expect(text).not.toContain(`"${field}"`);
        }
      }),
      { seed: 20261029, numRuns: 200 },
    );
  });
});

describe("principals and relationships", () => {
  test("every principal is a person-level actor in its own person scope; the agent writes model content", () => {
    const m = mapEpisode(visibleEpisode(medical));
    for (const p of medical.entities.principals) {
      const mapped = m.principals[p.principal_id];
      expect(mapped?.actor.id).toBe(`person:${p.principal_id}`);
      expect(mapped?.actor.level).toBe("person");
      expect(mapped?.actor.memberships[0]).toBe(`person:${p.principal_id}`);
      expect(mapped?.actor.source).toBe(p.role === "agent" ? "model" : "user");
    }
    expect(m.principals.agent_memcare?.grants).toEqual([]);
  });

  test("an unrestricted principal-to-principal relationship grants each party the other's turns", () => {
    const m = mapEpisode(visibleEpisode(medical));
    // assigned_clinician(clinician_dr_alvarez, patient_lucia_gomez), no restriction.
    expect(m.principals.patient_lucia_gomez?.grants).toContainEqual({
      to: "person:clinician_dr_alvarez",
      class: "episodic",
      mode: "read",
      expires: OPEN_END,
    });
    expect(m.principals.clinician_dr_alvarez?.grants.map((g) => g.to)).toEqual([
      "person:patient_lucia_gomez",
    ]);
  });

  test("a restricted relationship maps to nothing: the family member with rides-only access gets no grant", () => {
    const m = mapEpisode(visibleEpisode(medical));
    const family = m.relationships.find((r) => r.type === "family_member");
    expect(family?.restrictions).toEqual(["access_level"]);
    expect(m.principals.patient_lucia_gomez?.grants.map((g) => g.to)).not.toContain(
      "person:family_rina_gomez",
    );
    expect(m.principals.family_rina_gomez?.grants).toEqual([]);
    // covering_clinician carries "overnight inbox coverage only".
    expect(m.principals.clinician_dr_shah?.grants).toEqual([]);
  });

  test("a group relationship is a team membership, and the group's parties read each other's turns", () => {
    const m = mapEpisode(visibleEpisode(office));
    const ava = m.principals.pm_ava_lin;
    expect(ava?.actor.memberships).toEqual(["person:pm_ava_lin", "team:project/project_monsoon"]);
    const readers = ava?.grants.map((g) => g.to) ?? [];
    expect(readers).toContain("person:eng_maya_patel");
    expect(readers).toContain("person:contractor_leo_park");
    // A Moonstone contractor shares no group with a Monsoon member.
    expect(readers).not.toContain("person:contractor_lena_park");
    expect(m.principals.contractor_lena_park?.grants.map((g) => g.to)).not.toContain(
      "person:pm_ava_lin",
    );
  });

  test("a relationship's expires ends its grants; a time without a zone is UTC", () => {
    const r = mapRelationship(
      { type: "x", principal_id: "a", for_principal_id: "b", expires: "2026-06-28" },
      0,
      new Set(["a", "b"]),
    );
    // Parties in key order: for_principal_id before principal_id.
    expect(r).toMatchObject({ parties: ["b", "a"], restrictions: [] });
    expect(r.expires).toBe("2026-06-28T00:00:00.000Z");
    const unparseable = mapRelationship(
      { type: "x", principal_id: "a", expires: "until revoked" },
      0,
      new Set(["a"]),
    );
    expect(unparseable.restrictions).toEqual(["expires"]);
  });

  test("an unsafe principal id is refused rather than turned into a scope", () => {
    const bad = structuredClone(medical);
    (bad.entities.principals[0] as { principal_id: string }).principal_id = "a b";
    expect(() => mapEpisode(visibleEpisode(bad))).toThrow(/not a safe scope id/);
  });
});

describe("turns as items", () => {
  test("each turn up to the as-of turn is an episodic item in its speaker's person scope with the speaker's grants", () => {
    const { checkpoint, episode } = pairs.find((p) =>
      p.checkpoint.checkpoint_id.endsWith("harbor_light_line_ckpt_15"),
    ) as (typeof pairs)[number];
    const mapped = mapCheckpoint(episode, checkpoint, ids());
    const upTo = episode.turns.findIndex((t) => t.turn_id === checkpoint.as_of_turn_id);
    expect(mapped.writes).toHaveLength(upTo + 1);
    expect(mapped.asker.id).toBe("person:billing_sam");
    for (const [i, { actor, item }] of mapped.writes.entries()) {
      const turn = episode.turns[i];
      expect(item.scope).toBe(`person:${turn?.speaker.principal_id}`);
      expect(item.owner).toBe(actor.id);
      expect(item.class).toBe("episodic");
      expect(item.content).toBe(turn?.text);
      expect(item.provenance.kind).toBe(turn?.speaker.role === "agent" ? "model" : "user");
      expect(item.grants).toEqual(
        mapped.mapping.principals[turn?.speaker.principal_id ?? ""]?.grants,
      );
    }
    expect(mapped.at).toBe(mapped.writes.at(-1)?.item.valid_from);
  });
});

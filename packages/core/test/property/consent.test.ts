// Acceptance for card E9.12 of the second absorb plan: consent at the write
// gate for the person scope. Over generated opt-outs (a topic, a source, a
// window, carve-outs, or none of them), contents, sources, times and
// sequences of first writes, rewrites, retires and moves, through the real
// Plane:
//
// - no allowed write matches an active opt-out, judged by the oracle's own
//   reading (`consentForbids` in src/oracle.ts, written apart from
//   policy/consent.ts);
// - a write the oracle says an opt-out covers is denied: under
//   `engram/write/consent`, naming that opt-out's index, or by a check the
//   gate runs before consent (membership, version, move, grants, trust);
// - every consent denial is one the oracle covers, its event carries no item
//   and its reason never repeats the content (each content holds a nonce
//   the reason must not contain); `checkWrite` answers the same;
// - an empty `opt_outs` decides every write exactly as an absent block.
//
// Guards require allowed writes, consent denials by topic, by source, by
// window and with no field, a carve-out letting a write through, a retire
// and a same-content rewrite of covered content allowed, and opt-outs that do
// not reach another scope. Not the lead-owned invariants file; its oracle
// gains `consentForbids` under a `decision` entry.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { itemById } from "../../src/items.ts";
import { type Actor, createPlane } from "../../src/plane.ts";
import { CONSENT_ID } from "../../src/policy/consent.ts";
import type { MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";
import { seedFor } from "../generators.ts";
import { consentForbids } from "./oracle.ts";

const RUNS = 200;

type Kind = MemoryItem["provenance"]["kind"];
type OptOut = NonNullable<Policy["consent"]>["opt_outs"][number];

const KINDS: readonly Kind[] = [
  "user",
  "document",
  "tool",
  "model",
  "import",
  "compaction",
  "external",
];
const SCOPES = ["person:omar", "person:dana", "team:core"] as const;
const TOPICS = ["health", "calendar", "bank account", "travel"] as const;
/** Words a content is built from: the topics' words, near misses and noise. */
const WORDS = [
  "health",
  "Health",
  "HEALTH",
  "healthy",
  "calendar",
  "bank",
  "account",
  "travel",
  "travelling",
  "meeting",
  "notes",
  "dentist",
  "h‍ealth",
] as const;
const PUNCT = [" ", ", ", ". ", "-", "\n", " / "] as const;
const INSTANTS = [
  "2026-12-01T00:00:00Z",
  "2026-12-01T12:00:00Z",
  "2026-12-02T00:00:00Z",
  "2026-12-03T00:00:00Z",
] as const;

const rule = (scope: Policy["write"][number]["scope"]) => ({
  scope,
  allowed_sources: [...KINDS],
  confidence_floor: 0,
  forbidden_classes: [],
  requires_review: false,
});

/** A policy that admits every source and class everywhere, so consent is what decides. */
function basePolicy(): Policy {
  return {
    id: "test.consent",
    version: 1,
    write: [rule("person"), rule("role"), rule("team"), rule("org")],
    read: {
      matrix: [
        { reader: "person", may_read: ["person", "role", "team", "org"] },
        { reader: "role", may_read: ["role", "team", "org"] },
        { reader: "team", may_read: ["team", "org"] },
        { reader: "org", may_read: ["org"] },
      ],
      honour_grants: true,
    },
    retention: [],
    promotion: {
      episodic_to_semantic: { confirmations: 3, or_review: true },
      procedural: { replay_k: 4, replay_n: 5 },
    },
    lints: { enabled: [], thresholds: {} },
    schema_version: 1,
  };
}

const opt = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: undefined, freq: 2 });

const arbOptOut: fc.Arbitrary<OptOut> = fc
  .record({
    scope: fc.constantFrom("person:omar", "person:omar", "person:dana"),
    topic: opt(fc.constantFrom(...TOPICS)),
    source: opt(fc.constantFrom(...KINDS)),
    since: opt(fc.constantFrom(...INSTANTS.slice(0, 2))),
    until: opt(fc.constantFrom(...INSTANTS.slice(2))),
    except_topics: opt(fc.uniqueArray(fc.constantFrom(...TOPICS), { minLength: 1, maxLength: 2 })),
  })
  .map((o) => {
    const out: Record<string, unknown> = { scope: o.scope };
    for (const k of ["topic", "source", "since", "until", "except_topics"] as const)
      if (o[k] !== undefined) out[k] = o[k];
    // A carve-out equal to the topic is refused by the loader; keep the rest.
    if (out.topic !== undefined && Array.isArray(out.except_topics)) {
      const left = (out.except_topics as string[]).filter((t) => t !== out.topic);
      if (left.length === 0) delete out.except_topics;
      else out.except_topics = left;
    }
    return out as OptOut;
  });

/** Text from the word pool, or a record holding some of it as keys and values. */
const arbContent = fc.oneof(
  {
    weight: 3,
    arbitrary: fc
      .array(fc.tuple(fc.constantFrom(...WORDS), fc.constantFrom(...PUNCT)), {
        minLength: 1,
        maxLength: 5,
      })
      .map((ws) => ws.map(([w, p]) => w + p).join("")),
  },
  {
    weight: 1,
    arbitrary: fc
      .tuple(fc.constantFrom(...WORDS), fc.constantFrom(...WORDS), fc.integer({ min: 0, max: 9 }))
      .map(([k, v, n]) => ({ [k]: v, n }) as Record<string, string | number>),
  },
);

type Step =
  | {
      op: "write";
      slot: number;
      scope: string;
      content: string | Record<string, unknown>;
      source: Kind;
      at: string;
    }
  | { op: "retire"; slot: number; source: Kind; at: string }
  | { op: "restate"; slot: number; source: Kind; at: string };

const arbStep: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.record({
      op: fc.constant("write" as const),
      slot: fc.integer({ min: 0, max: 3 }),
      scope: fc.constantFrom(...SCOPES),
      content: arbContent,
      source: fc.constantFrom(...KINDS),
      at: fc.constantFrom(...INSTANTS),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      op: fc.constant("retire" as const),
      slot: fc.integer({ min: 0, max: 3 }),
      source: fc.constantFrom(...KINDS),
      at: fc.constantFrom(...INSTANTS),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      op: fc.constant("restate" as const),
      slot: fc.integer({ min: 0, max: 3 }),
      source: fc.constantFrom(...KINDS),
      at: fc.constantFrom(...INSTANTS),
    }),
  },
);

const idOf = (slot: number) => `01920000-0000-7000-8000-${String(100 + slot).padStart(12, "0")}`;

function newItem(
  slot: number,
  scope: string,
  content: MemoryItem["content"],
  kind: Kind,
): MemoryItem {
  return {
    id: idOf(slot),
    class: "semantic",
    scope,
    owner: "person:omar",
    content,
    provenance: { kind, ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: "person:omar" },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
}

/** A content with a nonce word the reason must never repeat. */
function withNonce(
  content: string | Record<string, unknown>,
  nonce: string,
): MemoryItem["content"] {
  return typeof content === "string" ? `${content} ${nonce}` : { ...content, ref: nonce };
}

function open(policy: Policy) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy,
    newId: () => `01920000-0000-7000-8000-${String(900_000 + ++n).padStart(12, "0")}`,
  });
  return { db, plane };
}

const actorFor = (source: Kind): Actor => ({
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:core"],
  source,
});

/** The checks the gate runs before consent: a covered write may be denied by one of them first. */
const EARLIER = new Set([
  "engram/write/membership",
  "engram/write/version",
  "engram/write/move",
  "engram/write/grant",
  "engram/grant/owner",
  "engram/grant/source",
  "engram/grant/expired",
  "engram/grant/unchanged",
  "engram/write/downgrade",
  "engram/write/schema",
]);

interface Seen {
  allowed: number;
  consentDenied: number;
  byTopic: number;
  bySource: number;
  byWindow: number;
  byEverything: number;
  carvedOut: number;
  coveredRetireAllowed: number;
  coveredRestateAllowed: number;
  otherScopeAllowed: number;
}

/** Runs `steps` under `policy`, checking each write against the oracle; returns the write events. */
async function run(policy: Policy, steps: Step[], seen?: Seen): Promise<MemoryEvent[]> {
  const { db, plane } = open(policy);
  const events: MemoryEvent[] = [];
  let k = 0;
  for (const step of steps) {
    const before = itemById(db, idOf(step.slot));
    const actor = actorFor(step.source);
    const nonce = `nonce${++k}q`;
    let item: MemoryItem;
    if (step.op === "write")
      item = before
        ? ({
            ...before,
            scope: step.scope,
            content: withNonce(step.content, nonce),
            version: before.version + 1,
            store_ref: null,
          } as MemoryItem)
        : newItem(step.slot, step.scope, withNonce(step.content, nonce), step.source);
    else if (!before) continue;
    else
      item = {
        ...before,
        status: step.op === "retire" ? "retired" : before.status,
        version: before.version + 1,
        store_ref: null,
      } as MemoryItem;
    // The kind the plane records: the actor's source (plane/write.ts).
    const judged = { ...item, provenance: { ...item.provenance, kind: step.source } } as MemoryItem;
    const covered = consentForbids(policy, judged, before, step.at);
    const checked = await plane.checkWrite(actor, item, step.at);
    const { event } = await plane.write(actor, item, step.at);
    events.push(event);
    expect(checked.decision, event.reason).toBe(event.decision);
    expect(checked.policy_id).toBe(event.policy_id);

    if (event.decision === "allow") expect(covered, event.reason).toBeUndefined();
    if (covered !== undefined) {
      expect(event.decision).toBe("deny");
      expect(event.policy_id === CONSENT_ID || EARLIER.has(event.policy_id), event.policy_id).toBe(
        true,
      );
    }
    if (event.policy_id === CONSENT_ID) {
      expect(covered).toBeDefined();
      expect(event.reason).toContain(`consent.opt_outs[${covered}] of policy ${policy.id}`);
      expect(event.reason).not.toContain(nonce);
      expect(event.item ?? null).toBeNull();
      expect(itemById(db, item.id)).toEqual(before);
    }

    if (!seen) continue;
    const o = covered === undefined ? undefined : policy.consent?.opt_outs[covered];
    if (event.decision === "allow") seen.allowed++;
    if (event.policy_id === CONSENT_ID && o) {
      seen.consentDenied++;
      if (o.topic !== undefined) seen.byTopic++;
      if (o.source !== undefined) seen.bySource++;
      if (o.since !== undefined || o.until !== undefined) seen.byWindow++;
      if (Object.keys(o).length === 1) seen.byEverything++;
    }
    if (event.decision === "allow" && step.op === "write") {
      // Allowed only because a carve-out held: the same opt-out without it covers the write.
      const bare = (policy.consent?.opt_outs ?? []).map(({ except_topics: _e, ...rest }) => rest);
      if (
        consentForbids({ ...policy, consent: { opt_outs: bare } }, judged, before, step.at) !==
        undefined
      )
        seen.carvedOut++;
      if (item.scope === "team:core" && (policy.consent?.opt_outs.length ?? 0) > 0)
        seen.otherScopeAllowed++;
    }
    if (event.decision === "allow" && step.op !== "write" && before) {
      // The item's content, as if written anew now, would be covered.
      const anew = consentForbids(policy, { ...judged, status: "active" }, undefined, step.at);
      if (anew !== undefined) {
        if (step.op === "retire") seen.coveredRetireAllowed++;
        else seen.coveredRestateAllowed++;
      }
    }
  }
  return events;
}

describe("consent at the write gate (card E9.12)", () => {
  test("no allowed write matches an active opt-out, and every consent refusal is one the oracle covers", async () => {
    const seen: Seen = {
      allowed: 0,
      consentDenied: 0,
      byTopic: 0,
      bySource: 0,
      byWindow: 0,
      byEverything: 0,
      carvedOut: 0,
      coveredRetireAllowed: 0,
      coveredRestateAllowed: 0,
      otherScopeAllowed: 0,
    };
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbOptOut, { minLength: 1, maxLength: 3 }),
        fc.array(arbStep, { minLength: 1, maxLength: 12 }),
        async (optOuts, steps) => {
          await run({ ...basePolicy(), consent: { opt_outs: optOuts } }, steps, seen);
        },
      ),
      { numRuns: RUNS, seed: seedFor("consent-gate") },
    );
    // Coverage guards: every kind of outcome the property is about occurred.
    for (const [what, n] of Object.entries(seen)) expect(n, what).toBeGreaterThan(0);
  }, 120_000);

  test("an empty opt_outs decides every write exactly as an absent consent block", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(arbStep, { minLength: 1, maxLength: 12 }), async (steps) => {
        const absent = await run(basePolicy(), steps);
        const empty = await run({ ...basePolicy(), consent: { opt_outs: [] } }, steps);
        const strip = (es: MemoryEvent[]) =>
          es.map(({ decision, reason, policy_id, item_id }) => ({
            decision,
            reason,
            policy_id,
            item_id,
          }));
        expect(strip(empty)).toEqual(strip(absent));
        expect(absent.some((e) => e.policy_id === CONSENT_ID)).toBe(false);
      }),
      { numRuns: 60, seed: seedFor("consent-off") },
    );
  }, 120_000);
});

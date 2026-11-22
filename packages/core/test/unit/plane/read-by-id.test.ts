// Plane.readById and Plane.listScopes (card E8.14): a read of one item by its
// id and the list of scopes an actor can see, both through the gate Plane.read
// uses (the read matrix, grants, status, ttl and validity at the read's time),
// each decision one read event (AGENTS.md rule 3). What either answers about
// an item out of the reader's reach is what it answers about an id the log
// never held (decision D5).
import { describe, expect, test } from "vitest";
import {
  formatReadReason,
  parseReadReason,
  readByIdTarget,
  readCounts,
} from "../../../src/plane/read-reason.ts";
import { SCOPE_LIST_PREFIX } from "../../../src/plane/scopes.ts";
import { type Actor, InvalidCallError, type ReadResult } from "../../../src/plane.ts";
import { READ_DEFAULT_DENY_ID } from "../../../src/policy/evaluate.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const LATER = "2027-01-01T00:00:00Z";

const writer: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["team:platform", "team:payments", "person:omar", "org"],
};
const sara: Actor = { id: "person:sara", level: "team", memberships: ["team:platform"] };

/**
 * A by-id read's whole answer with the id it asked for, its event's id and
 * seq made neutral, so two reads compare equal exactly when they reveal the
 * same thing (review finding E8.14-5).
 */
function normalised(r: ReadResult, asked: string) {
  const { id: _id, seq: _seq, ...event } = r.event;
  return JSON.parse(JSON.stringify({ ...r, event }).replaceAll(asked, "<id>"));
}

async function seeded(items: MemoryItem[], policy = testPolicy()) {
  const env = fresh(policy);
  for (const it of items) {
    const { event } = await env.plane.write(writer, it, AT);
    expect(event.decision, `seed write of ${it.id}`).toBe("allow");
  }
  return env;
}

describe("Plane.readById", () => {
  test("returns a readable item with its explanation and appends one read event naming it", async () => {
    const { plane } = await seeded([item(1), item(2)]);
    const before = plane.events().length;
    const result = await plane.readById(sara, id(1), { at: AT });
    expect(result.items.map((i) => i.id)).toEqual([id(1)]);
    expect(result.explanations.map((e) => [e.item_id, e.rank, e.policy_id])).toEqual([
      [id(1), 1, "test/read/team"],
    ]);
    expect(plane.events().slice(before)).toEqual([result.event]);
    expect(result.event).toMatchObject({
      op: "read",
      decision: "allow",
      item_id: null,
      actor: sara.id,
      policy_id: "test/read/team",
      item_ids: [id(1)],
      ts: AT,
    });
    expect(readByIdTarget(result.event)).toBe(id(1));
    expect(readCounts(result.event)).toMatchObject({ returned: 1, candidates: 1, filtered: 0 });
  });

  test("explain returns what the by-id read recorded, to its reader only", async () => {
    const { plane } = await seeded([item(1)]);
    const result = await plane.readById(sara, id(1), { at: AT });
    expect(await plane.explain(sara, result.event.id)).toEqual(result.explanations);
  });

  test("an item in a scope the reader is not in answers exactly as an id the log never held", async () => {
    const { plane } = await seeded([item(1, { scope: "team:payments" })]);
    const hidden = await plane.readById(sara, id(1), { at: AT });
    const unknown = await plane.readById(sara, id(77), { at: AT });
    const view = (r: typeof hidden) => ({
      items: r.items,
      explanations: r.explanations,
      filtered: r.filtered,
      decision: r.event.decision,
      policy_id: r.event.policy_id,
      item_ids: r.event.item_ids,
    });
    expect(view(hidden)).toEqual({
      items: [],
      explanations: [],
      filtered: 0,
      decision: "allow",
      policy_id: "test/read/team",
      item_ids: [],
    });
    expect(view(unknown)).toEqual(view(hidden));
    // The whole answer, the event's reason included, but for the id asked (E8.14-5).
    expect(normalised(hidden, id(1))).toEqual(normalised(unknown, id(77)));
    // The audit record counts it as out of reach; the reader is not told.
    expect(readCounts(hidden.event)).toMatchObject({ candidates: 0, out_of_reach: 1 });
  });

  test("an item the read matrix keeps from the reader's level is not returned", async () => {
    // A team-level reader who is a member of a person scope: the matrix lets team read team and org only.
    const { plane } = await seeded([item(1, { scope: "person:omar" })]);
    const teamInPerson: Actor = { id: "team:ops", level: "team", memberships: ["person:omar"] };
    expect((await plane.readById(teamInPerson, id(1), { at: AT })).items).toEqual([]);
  });

  test("a reader with no matrix row is denied by default, as Plane.read denies it", async () => {
    const { plane } = await seeded([item(1)]);
    const role: Actor = { id: "role:sre", level: "role", memberships: ["team:platform"] };
    const result = await plane.readById(role, id(1), { at: AT });
    expect(result.items).toEqual([]);
    expect(result.event.policy_id).toBe(READ_DEFAULT_DENY_ID);
  });

  test("a live grant admits an item outside the reader's scopes, and names the grant", async () => {
    const granted = item(1, {
      scope: "team:payments",
      grants: [{ to: sara.id, mode: "read", class: "semantic", expires: LATER }],
    });
    const { plane } = await seeded([granted]);
    const result = await plane.readById(sara, id(1), { at: AT });
    expect(result.items.map((i) => i.id)).toEqual([id(1)]);
    expect(result.explanations[0]?.grants_used).toEqual([`grants[0]:${sara.id}`]);
    // Once the grant has expired, the item answers as an id the log never
    // held (review finding E8.14-1, the lead's decision): a by-id read drops a
    // candidate reached only through a grant that does not admit it.
    const later = "2027-06-01T00:00:00Z";
    const after = await plane.readById(sara, id(1), { at: later });
    expect(after.items).toEqual([]);
    expect(after.filtered).toBe(0);
    const unknown = await plane.readById(sara, id(77), { at: later });
    expect(normalised(after, id(1))).toEqual(normalised(unknown, id(77)));
  });

  test("an item reached only through a grant that does not admit it answers as an unknown id (E8.14-1)", async () => {
    const grant = { to: sara.id, mode: "read" as const, expires: LATER };
    const { plane } = await seeded([
      // A grant for another class.
      item(1, { scope: "team:payments", grants: [{ ...grant, class: "episodic" }] }),
      // A grant that has expired.
      item(2, {
        scope: "team:payments",
        grants: [{ ...grant, class: "semantic", expires: "2026-10-20T00:00:00Z" }],
      }),
      // A live grant on an item that is not active.
      item(3, {
        scope: "team:payments",
        status: "candidate",
        grants: [{ ...grant, class: "semantic" }],
      }),
      // A live grant on an item outside its validity window.
      item(4, {
        scope: "team:payments",
        valid_to: "2026-10-20T00:00:00Z",
        grants: [{ ...grant, class: "semantic" }],
      }),
    ]);
    const unknown = normalised(await plane.readById(sara, id(77), { at: AT }), id(77));
    for (const n of [1, 2, 3, 4]) {
      const answer = await plane.readById(sara, id(n), { at: AT });
      expect(normalised(answer, id(n)), `item ${n}`).toEqual(unknown);
      expect(answer.event.reason.replaceAll(id(n), "<id>")).toBe(unknown.event.reason);
    }
  });

  test("a readable scope's filtered item is still counted, as Plane.read counts it", async () => {
    // The reader may read the scope, so its filtered count reveals nothing new.
    const { plane } = await seeded([item(1, { status: "candidate" })]);
    expect((await plane.readById(sara, id(1), { at: AT })).filtered).toBe(1);
  });

  test("an item outside its validity window is filtered, and valid_at reads what was true then", async () => {
    const { plane } = await seeded([item(1, { valid_to: "2026-10-20T00:00:00Z" })]);
    const now = await plane.readById(sara, id(1), { at: AT });
    expect(now.items).toEqual([]);
    expect(now.filtered).toBe(1);
    expect(readCounts(now.event)?.outside_validity).toBe(1);
    const then = await plane.readById(sara, id(1), { at: AT, valid_at: "2026-10-10T00:00:00Z" });
    expect(then.items.map((i) => i.id)).toEqual([id(1)]);
  });

  test("an item that is not active is not returned, as Plane.read does not return it", async () => {
    const { plane } = await seeded([item(1, { status: "candidate" })]);
    const result = await plane.readById(sara, id(1), { at: AT });
    expect(result.items).toEqual([]);
    expect(readCounts(result.event)?.not_active).toBe(1);
  });

  test("an item past its ttl is filtered before any sweep", async () => {
    const { plane } = await seeded([item(1, { ttl: 60 })]);
    const result = await plane.readById(sara, id(1), { at: LATER });
    expect(result.items).toEqual([]);
    expect(readCounts(result.event)?.expired).toBe(1);
  });

  test("a malformed actor, time or id is refused before the log is touched", async () => {
    const { plane } = await seeded([item(1)]);
    const before = plane.events().length;
    await expect(plane.readById(sara, "not an id", { at: AT })).rejects.toThrow(InvalidCallError);
    await expect(plane.readById(sara, id(1), { at: "yesterday" })).rejects.toThrow(
      InvalidCallError,
    );
    await expect(
      plane.readById({ id: "", level: "team", memberships: [] } as Actor, id(1), { at: AT }),
    ).rejects.toThrow(InvalidCallError);
    expect(plane.events()).toHaveLength(before);
  });

  test("the store is never searched for a by-id read", async () => {
    const { plane, adapter } = await seeded([item(1)]);
    await plane.readById(sara, id(1), { at: AT });
    expect(adapter.searches).toEqual([]);
  });
});

describe("the by-id clause of the read reason", () => {
  const counts = {
    returned: 1,
    candidates: 1,
    filtered: 0,
    outside_validity: 0,
    not_active: 0,
    expired: 0,
    excluded: 0,
    out_of_reach: 3,
  };

  test("round-trips with and without a validity time, and a plain read names no id", () => {
    const plain = formatReadReason(counts);
    expect(readByIdTarget({ op: "read", reason: plain })).toBeNull();
    const byId = formatReadReason(counts, undefined, id(5));
    expect(parseReadReason(byId)).toEqual(counts);
    expect(readByIdTarget({ op: "read", reason: byId })).toBe(id(5));
    const both = formatReadReason(counts, "2026-10-10T00:00:00Z", id(5));
    expect(parseReadReason(both)).toEqual(counts);
    expect(readByIdTarget({ op: "read", reason: both })).toBe(id(5));
    expect(readByIdTarget({ op: "write", reason: both })).toBeNull();
  });
});

describe("Plane.listScopes", () => {
  test("lists the member scopes the read matrix lets the actor's level read, and one read event", async () => {
    const { plane } = await seeded([]);
    const omar: Actor = {
      id: "person:omar",
      level: "team",
      memberships: ["team:platform", "person:omar", "org"],
    };
    const before = plane.events().length;
    const listed = await plane.listScopes(omar, AT);
    // The team row reads team and org, not person.
    expect(listed.scopes).toEqual([
      { scope: "org", via: "membership" },
      { scope: "team:platform", via: "membership" },
    ]);
    expect(plane.events().slice(before)).toEqual([listed.event]);
    expect(listed.event).toMatchObject({
      op: "read",
      decision: "allow",
      item_id: null,
      scope_from: null,
      scope_to: null,
      actor: omar.id,
      policy_id: "test/read/team",
      item_ids: [],
      ts: AT,
    });
    expect(listed.event.reason.startsWith(SCOPE_LIST_PREFIX)).toBe(true);
    expect(listed.event.reason).toContain("1 member scope the read matrix does not let team read");
    // A scope listing is not a read with counts.
    expect(readCounts(listed.event)).toBeNull();
  });

  test("adds the scope of an item a live grant lets the actor read, and only while it does", async () => {
    const granted = item(1, {
      scope: "team:payments",
      grants: [{ to: sara.id, mode: "read", class: "semantic", expires: LATER }],
    });
    const { plane } = await seeded([granted, item(2, { scope: "person:omar" })]);
    expect((await plane.listScopes(sara, AT)).scopes).toEqual([
      { scope: "team:payments", via: "grant" },
      { scope: "team:platform", via: "membership" },
    ]);
    // Past the grant's expiry the scope is gone again.
    expect((await plane.listScopes(sara, "2027-06-01T00:00:00Z")).scopes).toEqual([
      { scope: "team:platform", via: "membership" },
    ]);
  });

  test("a grant to an item the read filter would not admit adds nothing (not active, out of validity)", async () => {
    const grant = {
      to: sara.id,
      mode: "read" as const,
      class: "semantic" as const,
      expires: LATER,
    };
    const { plane } = await seeded([
      item(1, { scope: "team:payments", grants: [grant], status: "candidate" }),
      item(2, { scope: "org", grants: [grant], valid_to: "2026-10-20T00:00:00Z" }),
    ]);
    expect((await plane.listScopes(sara, AT)).scopes).toEqual([
      { scope: "team:platform", via: "membership" },
    ]);
  });

  test("grants count for nothing when the policy does not honour them", async () => {
    const policy = testPolicy();
    const granted = item(1, {
      scope: "team:payments",
      grants: [{ to: sara.id, mode: "read", class: "semantic", expires: LATER }],
    });
    const { plane } = await seeded([granted], {
      ...policy,
      read: { ...policy.read, honour_grants: false },
    });
    expect((await plane.listScopes(sara, AT)).scopes).toEqual([
      { scope: "team:platform", via: "membership" },
    ]);
  });

  test("a scope both readable by membership and reached by a grant is listed once, by membership", async () => {
    const granted = item(1, {
      scope: "team:platform",
      grants: [{ to: sara.id, mode: "read", class: "semantic", expires: LATER }],
    });
    const { plane } = await seeded([granted]);
    expect((await plane.listScopes(sara, AT)).scopes).toEqual([
      { scope: "team:platform", via: "membership" },
    ]);
  });

  test("an actor with no matrix row lists nothing, under the default deny", async () => {
    const { plane } = await seeded([]);
    const role: Actor = { id: "role:sre", level: "role", memberships: ["team:platform"] };
    const listed = await plane.listScopes(role, AT);
    expect(listed.scopes).toEqual([]);
    expect(listed.event.policy_id).toBe(READ_DEFAULT_DENY_ID);
  });

  test("a malformed actor or time is refused before the log is touched", async () => {
    const { plane } = await seeded([]);
    await expect(plane.listScopes(sara, "now")).rejects.toThrow(InvalidCallError);
    await expect(plane.listScopes({} as Actor, AT)).rejects.toThrow(InvalidCallError);
    expect(plane.events()).toEqual([]);
  });

  test("its event's time is never before the log's head", async () => {
    const { plane } = await seeded([item(1)]);
    await plane.read(sara, { at: LATER });
    const listed = await plane.listScopes(sara, AT);
    expect(listed.event.ts).toBe(LATER);
  });
});

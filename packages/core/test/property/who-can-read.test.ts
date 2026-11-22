// Who can read this memory (card E2.13) over generated policies, items,
// memberships and grants. Three properties:
//
// 1. Brute-force agreement: the owner's answer, a symbolic set, expands to
//    exactly the actors for whom evaluateRead admits the item at the same
//    time, over a universe of actors (every principal of the generators'
//    pool and the prefixes of their patterns, every level, memberships that
//    include the item's scope or not); each entry's rule is the one
//    evaluateRead names for an actor only it admits. The expansion is this
//    file's own reading of the answer, not the plane's.
// 2. A scope's answer expands to exactly the actors who may read an open
//    item of that scope carrying no grant.
// 3. The leak property, through the real Plane: an actor who may neither
//    read an item nor read its scope as a member gets, word for word, the
//    answer an unknown id gets; no answer to anyone but the owner names a
//    grant that does not name the asker, or a dormant grant; a scope's
//    refusal is the same whatever the scope holds; and no query appends an
//    event. Coverage guards require every kind of case.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { InvalidCallError } from "../../src/actor.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { appendEvent } from "../../src/events.ts";
import {
  itemReaders,
  type ReaderEntry,
  scopeReaders,
  type WhoCanReadAnswer,
  whoCanReadAs,
  whoCanReadItemAs,
} from "../../src/plane/who-can-read.ts";
import { type Actor, createPlane } from "../../src/plane.ts";
import { evaluateRead } from "../../src/policy/evaluate.ts";
import { itemExpiry } from "../../src/policy/retention.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";
import { compareTimestamps } from "../../src/time.ts";
import {
  arbGatedItemWithTtl,
  arbGatedItemWithValidTo,
  arbInstant,
  arbPolicyWithTtls,
  arbScope,
  SCOPE_LEVELS,
  seedFor,
} from "../generators.ts";

const RUNS = 400;

/** Every id the generators' grants can name, and the prefixes their patterns match. */
const IDS = [
  "person:omar",
  "person:sara",
  "person:ali",
  "agent:pi",
  "agent:claude-code",
  "agent:claude",
  "person:o",
  "person:s",
  "person:zed",
] as const;

/** Does `to` name `id`: exactly, or by the prefix before a final `*`. This file's own reading. */
const names = (to: string, id: string) =>
  to.endsWith("*") ? id.startsWith(to.slice(0, -1)) : to === id;

/** Is `actor` in the symbolic set: a members entry for a scope it holds at its level, or a grant naming it. */
const expands = (readers: readonly ReaderEntry[], actor: Actor) =>
  readers.some((r) =>
    r.kind === "members"
      ? actor.memberships.includes(r.scope) && actor.level === r.level
      : names(r.to, actor.id),
  );

/** The universe the answer is checked against: every id, every level, in the item's scope or not. */
function universe(scope: string, other: string): Actor[] {
  const sets = [[], [scope], [other], [scope, other]];
  return IDS.flatMap((id) =>
    SCOPE_LEVELS.flatMap((level) => sets.map((memberships) => ({ id, level, memberships }))),
  );
}

/** An item mostly active, so open items are common, with its validity window and ttl drawn. */
const arbItemCase = fc
  .tuple(
    fc.oneof(arbGatedItemWithValidTo, arbGatedItemWithTtl),
    fc.oneof(
      { arbitrary: fc.constant("active" as const), weight: 4 },
      { arbitrary: fc.constantFrom("candidate" as const, "retired" as const), weight: 1 },
    ),
    // A grant whose class is the item's, so live grants are common.
    fc.boolean(),
  )
  .map(([item, status, ownClass]) => ({
    ...item,
    status,
    grants: item.grants.map((g, i) => (ownClass && i === 0 ? { ...g, class: item.class } : g)),
  }));

describe("who can read this memory", () => {
  const AGREE = "the owner's answer expands to exactly the actors evaluateRead admits";
  test(AGREE, () => {
    const seen = {
      byScope: 0,
      byGrant: 0,
      closed: 0,
      invalid: 0,
      dormant: 0,
      nobody: 0,
      someone: 0,
    };
    fc.assert(
      fc.property(
        arbPolicyWithTtls,
        arbItemCase,
        arbInstant,
        arbScope,
        (policy, item, at, other) => {
          const { readers, closed, dormant } = itemReaders(policy, item, at);
          if (closed) seen.closed++;
          // Status, then ttl, then the validity window close an item to everyone, in
          // the read filter's order (review finding E2.13-3).
          const expiry = itemExpiry(policy, item);
          const shut =
            item.status !== "active"
              ? "engram/read/status"
              : expiry !== null && compareTimestamps(expiry.at, at) <= 0
                ? "engram/read/ttl"
                : compareTimestamps(item.valid_from, at) > 0 ||
                    (item.valid_to !== null && compareTimestamps(item.valid_to, at) <= 0)
                  ? "engram/read/validity"
                  : null;
          expect(closed?.policy_id ?? null).toBe(shut);
          if (shut === "engram/read/validity") seen.invalid++;
          if (dormant.length > 0) seen.dormant++;
          let admitted = 0;
          for (const actor of universe(item.scope, other)) {
            const decision = evaluateRead(policy, actor, item, at);
            expect(
              expands(readers, actor),
              `${JSON.stringify(actor)} on ${JSON.stringify(item)} at ${at}: evaluateRead says ${decision.admitted} (${decision.reason})`,
            ).toBe(decision.admitted);
            if (!decision.admitted) continue;
            admitted++;
            // The entry that admits an actor names the rule evaluateRead names.
            if (decision.check === "scope") {
              seen.byScope++;
              const entry = readers.find(
                (r) =>
                  r.kind === "members" &&
                  r.level === actor.level &&
                  actor.memberships.includes(r.scope),
              );
              expect(entry?.policy_id).toBe(decision.policy_id);
            } else {
              seen.byGrant++;
              const entries = readers.filter((r) => r.kind === "grant" && names(r.to, actor.id));
              expect(entries.map((r) => (r.kind === "grant" ? r.grant : ""))).toEqual(
                decision.grants_used,
              );
              for (const r of entries) expect(r.policy_id).toBe(decision.policy_id);
            }
          }
          seen[admitted === 0 ? "nobody" : "someone"]++;
          // Every grant is either a reader entry or dormant, never both.
          const listed = [
            ...readers.flatMap((r) => (r.kind === "grant" ? [r.grant] : [])),
            ...dormant.map((d) => d.grant),
          ].sort();
          if (!closed)
            expect(listed).toEqual(item.grants.map((g, i) => `grants[${i}]:${g.to}`).sort());
        },
      ),
      { numRuns: RUNS, seed: seedFor(AGREE) },
    );
    expect(
      Object.values(seen).every((n) => n > 0),
      `agreement needs actors admitted by scope and by grant, closed items, items outside their validity window, dormant grants, and items nobody and someone reads; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  });

  const SCOPE = "a scope's answer expands to exactly the readers of an open, ungranted item in it";
  test(SCOPE, () => {
    let readable = 0;
    fc.assert(
      fc.property(arbPolicyWithTtls, arbItemCase, arbScope, (drawn, base, other) => {
        // No ttl rule: an open item is one no lifecycle rule closes.
        const policy = { ...drawn, retention: [] };
        const item: MemoryItem = {
          ...base,
          status: "active",
          grants: [],
          ttl: null,
          valid_from: "2026-01-01T00:00:00Z",
          valid_to: null,
        };
        const readers = scopeReaders(policy, item.scope);
        if (readers.length > 0) readable++;
        for (const actor of universe(item.scope, other))
          expect(expands(readers, actor)).toBe(
            evaluateRead(policy, actor, item, "2026-06-01T00:00:00Z").admitted,
          );
      }),
      { numRuns: RUNS, seed: seedFor(SCOPE) },
    );
    expect(readable, "some scope must have readers").toBeGreaterThan(0);
  });

  const LEAK =
    "no answer reveals a grant holder to a non-owner, nor tells an item from an unknown id to an actor who may not read it";
  test(LEAK, async () => {
    const seen = {
      refused: 0,
      owner: 0,
      reader: 0,
      grantee: 0,
      scopeRefused: 0,
      withheld: 0,
      closedToMember: 0,
    };
    const HIDDEN = "person:zed-hidden";
    await fc.assert(
      fc.asyncProperty(
        arbPolicyWithTtls,
        fc.array(arbItemCase, { minLength: 1, maxLength: 3 }),
        fc.array(
          fc.record({
            id: fc.constantFrom(...IDS),
            level: fc.constantFrom(...SCOPE_LEVELS),
            memberships: fc.uniqueArray(arbScope, { maxLength: 3 }),
          }),
          { minLength: 1, maxLength: 3 },
        ),
        arbInstant,
        async (policy, drawn, askers, at) => {
          // Item ids are fixed and distinct; each item also carries a grant to
          // a principal no asker is, so a leak of a holder's name is visible.
          const items = drawn.map((item, n) => ({
            ...item,
            id: `01960000-0000-7000-8000-${String(n + 1).padStart(12, "0")}`,
            grants:
              item.grants.length > 0
                ? [
                    ...item.grants,
                    {
                      to: HIDDEN,
                      class: item.class,
                      mode: "read" as const,
                      expires: "2027-12-31T00:00:00Z",
                    },
                  ]
                : [],
          })) as MemoryItem[];
          // Some askers own an item: its owner made one of them.
          const actors: Actor[] = askers.map((a, k) => {
            const own = items[k % items.length] as MemoryItem;
            return k === 0
              ? { ...a, id: own.owner, memberships: [...new Set([...a.memberships, own.scope])] }
              : a;
          });
          const db = openSqlite(":memory:");
          migrate(db);
          try {
            let n = 100;
            const newId = () => `01960000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
            const plane = createPlane({ db, adapter: createFakeAdapter(), policy, newId });
            for (const item of items)
              appendEvent(db, {
                id: newId(),
                ts: "2026-01-01T00:00:00Z",
                op: "write",
                item_id: item.id,
                actor: item.owner,
                scope_from: null,
                scope_to: item.scope,
                decision: "allow",
                reason: "seeded",
                policy_id: "seed",
                item,
                schema_version: 1,
              });
            const logged = plane.events().length;
            const unknown = "01960000-0000-7000-8000-000000000099";
            for (const actor of actors) {
              const none = await plane.whoCanReadItem(actor, unknown, at);
              expect(none.answered).toBe(false);
              for (const item of items) {
                const answer = await plane.whoCanReadItem(actor, item.id, at);
                const when = answer.at;
                const reads = evaluateRead(policy, actor, item, when).admitted;
                const member =
                  actor.memberships.includes(item.scope) &&
                  (policy.read.matrix.find((r) => r.reader === actor.level)?.may_read ?? []).some(
                    (l) => l === (item.scope === "org" ? "org" : item.scope.split(":")[0]),
                  );
                if (!reads && !member) {
                  seen.refused++;
                  expect(answer).toEqual({
                    ...none,
                    target: item.id,
                    reason: none.reason.replace(unknown, item.id),
                  });
                  continue;
                }
                expect(answer.answered).toBe(true);
                // Whatever the asker is shown is true: every actor it expands to may read.
                for (const probe of universe(item.scope, "org"))
                  if (expands(answer.readers, probe))
                    expect(evaluateRead(policy, probe, item, when).admitted).toBe(true);
                const owner = member && actor.id === item.owner;
                if (owner) {
                  seen.owner++;
                  expect(answer.grants_shown).toBe("all");
                  expect(answer.readers).toEqual(itemReaders(policy, item, when).readers);
                  continue;
                }
                seen[member ? "reader" : "grantee"]++;
                expect(answer.grants_shown).toBe("yours");
                expect(answer.dormant).toEqual([]);
                for (const r of answer.readers)
                  if (r.kind === "grant") expect(names(r.to, actor.id)).toBe(true);
                // A grant shown to a non-owner carries no position on the item (E2.13-4).
                expect(JSON.stringify(answer)).not.toContain("grants[");
                if (answer.closed !== null) {
                  // A member asking about an item closed to every reader learns that it
                  // is closed, by which rule, and no more: not its owner, not one of its
                  // instants (review finding E2.13-1, the lead's decision to withhold).
                  seen.closedToMember++;
                  const shown = JSON.stringify(answer);
                  if (!actor.id.includes(item.owner)) expect(shown).not.toContain(item.owner);
                  const expiry = itemExpiry(policy, item)?.at;
                  for (const instant of [item.valid_from, item.valid_to, expiry])
                    if (instant && instant !== answer.at) expect(shown).not.toContain(instant);
                }
                if (item.grants.length > 0) {
                  seen.withheld++;
                  expect(JSON.stringify(answer)).not.toContain(HIDDEN);
                }
              }
              // A scope's refusal says nothing of what the scope holds.
              for (const item of items) {
                const scoped = await plane.whoCanRead(actor, item.scope, at);
                const bare = whoCanReadAs(policy, actor, item.scope, scoped.at);
                expect(scoped).toEqual(bare);
                if (!scoped.answered) seen.scopeRefused++;
                else expect(scoped.readers).toEqual(scopeReaders(policy, item.scope));
              }
            }
            expect(plane.events().length, "a who-can-read query appends no event").toBe(logged);
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(LEAK) },
    );
    expect(
      Object.values(seen).every((n) => n > 0),
      `the leak property needs refusals, owners, member readers, grantees, refused scopes, withheld grants and closed items asked about by members; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  });

  test("the pure answer refuses an unknown item and a hidden one in the same words", () => {
    const policy = {
      id: "p",
      version: 1,
      write: [],
      read: { matrix: [{ reader: "person", may_read: ["person"] }], honour_grants: true },
      retention: [],
      promotion: {
        episodic_to_semantic: { confirmations: 3, or_review: true },
        procedural: { replay_k: 4, replay_n: 5 },
      },
      lints: { enabled: [], thresholds: {} },
      schema_version: 1,
    } as Policy;
    const outsider: Actor = { id: "person:o", level: "person", memberships: ["person:o"] };
    const id = "01960000-0000-7000-8000-000000000001";
    const item = {
      id,
      class: "semantic",
      scope: "person:s",
      owner: "person:s",
      content: "secret",
      provenance: { kind: "user", ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: "person:s" },
      confidence: 1,
      valid_from: "2026-01-01T00:00:00Z",
      valid_to: null,
      ttl: null,
      grants: [
        { to: "person:t", class: "semantic", mode: "read", expires: "2027-01-01T00:00:00Z" },
      ],
      version: 1,
      lineage: [],
      status: "active",
      store_ref: null,
      schema_version: 1,
    } as MemoryItem;
    const at = "2026-06-01T00:00:00Z";
    const hidden: WhoCanReadAnswer = whoCanReadItemAs(policy, outsider, id, item, at);
    expect(hidden).toEqual(whoCanReadItemAs(policy, outsider, id, undefined, at));
    expect(JSON.stringify(hidden)).not.toContain("person:s");
    // The grantee is answered, and shown its own grant and no other.
    const grantee: Actor = { id: "person:t", level: "person", memberships: [] };
    const seen = whoCanReadItemAs(
      policy,
      grantee,
      id,
      {
        ...item,
        grants: [
          ...item.grants,
          { to: "person:u", class: "semantic", mode: "read", expires: "2027-01-01T00:00:00Z" },
        ],
      },
      at,
    );
    expect(seen.readers.map((r) => (r.kind === "grant" ? r.to : r.scope))).toEqual([
      "person:s",
      "person:t",
    ]);
    expect(seen.grants_shown).toBe("yours");
  });

  test("an answer is judged at the read's access time: never before the log's head (E2.13-2)", async () => {
    const policy = {
      id: "p",
      version: 1,
      write: [],
      read: { matrix: [{ reader: "person", may_read: ["person"] }], honour_grants: true },
      retention: [],
      promotion: {
        episodic_to_semantic: { confirmations: 3, or_review: true },
        procedural: { replay_k: 4, replay_n: 5 },
      },
      lints: { enabled: [], thresholds: {} },
      schema_version: 1,
    } as Policy;
    const id = "01960000-0000-7000-8000-000000000001";
    const head = "2026-09-01T00:00:00Z";
    const asked = "2026-03-01T00:00:00Z";
    const item = {
      id,
      class: "semantic",
      scope: "person:s",
      owner: "person:s",
      content: "x",
      provenance: { kind: "user", ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: "person:s" },
      confidence: 1,
      valid_from: "2026-01-01T00:00:00Z",
      valid_to: null,
      ttl: null,
      // Live at the time asked, expired by the log's head.
      grants: [
        { to: "person:t", class: "semantic", mode: "read", expires: "2026-06-01T00:00:00Z" },
      ],
      version: 1,
      lineage: [],
      status: "active",
      store_ref: null,
      schema_version: 1,
    } as MemoryItem;
    const db = openSqlite(":memory:");
    migrate(db);
    try {
      const plane = createPlane({
        db,
        adapter: createFakeAdapter(),
        policy,
        newId: () => "01960000-0000-7000-8000-000000000002",
      });
      appendEvent(db, {
        id: "01960000-0000-7000-8000-000000000003",
        ts: head,
        op: "write",
        item_id: id,
        actor: "person:s",
        scope_from: null,
        scope_to: "person:s",
        decision: "allow",
        reason: "seeded",
        policy_id: "seed",
        item,
        schema_version: 1,
      });
      const owner: Actor = { id: "person:s", level: "person", memberships: ["person:s"] };
      const answer = await plane.whoCanReadItem(owner, id, asked);
      expect(answer.at).toBe(head);
      expect(answer.readers.some((r) => r.kind === "grant")).toBe(false);
      expect(answer.dormant.map((d) => d.grant)).toEqual(["grants[0]:person:t"]);
      // The grantee, whose grant has lapsed by the head, is refused.
      const grantee: Actor = { id: "person:t", level: "person", memberships: [] };
      expect((await plane.whoCanReadItem(grantee, id, asked)).answered).toBe(false);
      expect((await plane.whoCanRead(owner, "person:s", asked)).at).toBe(head);
    } finally {
      db.close();
    }
  });

  test("an invalid item id or scope is refused before the log is read", async () => {
    const db = openSqlite(":memory:");
    migrate(db);
    try {
      const plane = createPlane({
        db,
        adapter: createFakeAdapter(),
        policy: {
          id: "p",
          version: 1,
          write: [],
          read: { matrix: [], honour_grants: false },
          retention: [],
          promotion: {
            episodic_to_semantic: { confirmations: 3, or_review: true },
            procedural: { replay_k: 4, replay_n: 5 },
          },
          lints: { enabled: [], thresholds: {} },
          schema_version: 1,
        } as Policy,
        newId: () => "01960000-0000-7000-8000-000000000001",
      });
      const actor: Actor = { id: "person:a", level: "person", memberships: [] };
      const at = "2026-06-01T00:00:00Z";
      await expect(plane.whoCanReadItem(actor, "nope", at)).rejects.toBeInstanceOf(
        InvalidCallError,
      );
      await expect(plane.whoCanRead(actor, "nowhere", at)).rejects.toBeInstanceOf(InvalidCallError);
      await expect(plane.whoCanRead({ ...actor, id: "" }, "org", at)).rejects.toBeInstanceOf(
        InvalidCallError,
      );
      expect(plane.events()).toEqual([]);
    } finally {
      db.close();
    }
  });
});

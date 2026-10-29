// The oracles pinned on fixed cases, so a mistake shared with the evaluator
// shows up here rather than agreeing with itself in the property tests.
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/plane.ts";
import type { Grant, MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";
import {
  budgetVictims,
  grantAllowed,
  pastTtl,
  patternCovers,
  promotionPermitted,
  readable,
  sameContent,
  sameStrictContent,
  writeForbidden,
} from "../property/oracle.ts";

const policy = {
  read: { matrix: [], honour_grants: true },
  write: [],
} as unknown as Policy;
const item = {
  scope: "team:a",
  class: "semantic",
  provenance: { kind: "user" },
  grants: [{ to: "person:sara", mode: "read", expires: "2026-10-22T09:00:00.5Z" }],
} as unknown as MemoryItem;
const sara: Actor = { id: "person:sara", level: "person", memberships: [] };

describe("readable", () => {
  test("compares grant expiry as instants, not strings", () => {
    expect(readable(policy, sara, item, "2026-10-22T09:00:00Z")).toBe(true);
    expect(readable(policy, sara, item, "2026-10-22T09:00:01Z")).toBe(false);
  });

  test("a grant expiring at the read time no longer admits, to the nanosecond", () => {
    const at = "2026-10-22T09:00:00.000000001Z";
    const g = { ...item, grants: [{ to: "person:sara", mode: "read", expires: at }] };
    expect(readable(policy, sara, g as MemoryItem, at)).toBe(false);
    expect(readable(policy, sara, g as MemoryItem, "2026-10-22T09:00:00Z")).toBe(true);
  });
});

describe("patternCovers", () => {
  test("matches exactly, or by the characters before a trailing star", () => {
    expect(patternCovers("agent:pi", "agent:pi")).toBe(true);
    expect(patternCovers("agent:pi", "agent:pix")).toBe(false);
    expect(patternCovers("agent:claude*", "agent:claude-code")).toBe(true);
    expect(patternCovers("agent:claude*", "agent:clau")).toBe(false);
    expect(patternCovers("person:*", "agent:pi")).toBe(false);
  });
});

describe("grantAllowed", () => {
  const g = (to: string, over: Partial<Grant> = {}): Grant => ({
    to,
    mode: "read",
    class: "semantic",
    expires: "2027-01-01T00:00:00Z",
    ...over,
  });

  test("allows principals and prefixed patterns", () => {
    for (const to of ["person:sara", "agent:claude-code/*", "agent:c*"])
      expect(grantAllowed(g(to)), to).toBe(true);
  });

  test("refuses everyone, bare kind wildcards and stars elsewhere", () => {
    for (const to of ["*", "agent:*", "person:*", ":*", "agent*", "a:b*c", "a:b**"])
      expect(grantAllowed(g(to)), to).toBe(false);
  });

  test("refuses a grant without a class or an expiry", () => {
    expect(grantAllowed({ to: "person:sara", mode: "read", class: "semantic" })).toBe(false);
    expect(grantAllowed({ to: "person:sara", mode: "read", expires: "2027-01-01T00:00:00Z" })).toBe(
      false,
    );
  });
});

describe("writeForbidden", () => {
  const open = {
    write: [
      {
        scope: "team",
        allowed_sources: ["user", "model"],
        confidence_floor: 0,
        forbidden_classes: [],
        requires_review: false,
      },
    ],
  } as unknown as Policy;
  const member: Actor = { id: "person:omar", level: "team", memberships: ["team:a"] };

  test("forbids a non-member's write, and allows a member's", () => {
    expect(writeForbidden(open, { ...member, memberships: [] }, item)).toBe(true);
    expect(writeForbidden(open, member, { ...item, grants: [] })).toBe(false);
  });

  test("forbids a write carrying a refused grant, or any grant on model content", () => {
    expect(writeForbidden(open, member, item)).toBe(true);
    const fine = { ...item, grants: [{ ...item.grants[0], class: "semantic" }] } as MemoryItem;
    expect(writeForbidden(open, member, fine)).toBe(false);
    expect(writeForbidden(open, { ...member, source: "model" }, fine)).toBe(true);
  });

  test("judges the source the harness sets, not the one the item claims", () => {
    const strict = {
      write: [{ ...(open.write[0] as object), allowed_sources: ["user"] }],
    } as unknown as Policy;
    const clean = { ...item, grants: [] } as MemoryItem;
    expect(writeForbidden(strict, member, clean)).toBe(false);
    expect(writeForbidden(strict, { ...member, source: "tool" }, clean)).toBe(true);
  });

  test("forbids a model, compaction or tool restatement of content retired in the scope", () => {
    const anyKind = {
      write: [{ ...(open.write[0] as object), allowed_sources: ["user", "tool", "import"] }],
    } as unknown as Policy;
    const clean = { ...item, grants: [], content: "Deploys on Friday" } as MemoryItem;
    const retired = { ...clean, status: "retired", content: "deploys  ON friday" } as MemoryItem;
    const tool = { ...member, source: "tool" as const };
    expect(writeForbidden(anyKind, tool, clean, [retired])).toBe(true);
    // Only retired items count, only in the same scope; user and import may re-admit.
    expect(writeForbidden(anyKind, tool, clean, [{ ...retired, status: "active" }])).toBe(false);
    expect(writeForbidden(anyKind, tool, clean, [{ ...retired, scope: "team:b" }])).toBe(false);
    expect(writeForbidden(anyKind, { ...member, source: "user" }, clean, [retired])).toBe(false);
    expect(writeForbidden(anyKind, { ...member, source: "import" }, clean, [retired])).toBe(false);
  });
});

describe("pastTtl", () => {
  const withTtl = (ttl: number | null, ruleTtl: number | null) =>
    [
      {
        retention: ruleTtl === null ? [] : [{ scope: "team", class: "semantic", ttl: ruleTtl }],
      } as unknown as Policy,
      { ...item, valid_from: "2026-10-22T09:00:00.25Z", ttl } as MemoryItem,
    ] as const;

  test("is true exactly from valid_from plus the ttl, at full precision", () => {
    const [p, it] = withTtl(60, null);
    expect(pastTtl(p, it, "2026-10-22T09:01:00.2499999999Z")).toBe(false);
    expect(pastTtl(p, it, "2026-10-22T09:01:00.25Z")).toBe(true);
    expect(pastTtl(p, it, "2026-10-22T09:01:00.250000001Z")).toBe(true);
    expect(pastTtl(p, it, "2026-10-22T09:00:59.9Z")).toBe(false);
  });

  test("takes the smaller of the item's ttl and its rule's; none never expires", () => {
    expect(pastTtl(...withTtl(60, 3600), "2026-10-22T09:01:00.25Z")).toBe(true);
    expect(pastTtl(...withTtl(3600, 60), "2026-10-22T09:01:00.25Z")).toBe(true);
    expect(pastTtl(...withTtl(null, null), "2099-01-01T00:00:00Z")).toBe(false);
  });

  test("makes an item unreadable that its scope admits", () => {
    const [p, it] = withTtl(60, null);
    const reader: Actor = { id: "person:omar", level: "team", memberships: ["team:a"] };
    const pol = { ...p, read: { matrix: [{ reader: "team", may_read: ["team"] }] } } as Policy;
    expect(readable(pol, reader, it, "2026-10-22T09:00:30Z")).toBe(true);
    expect(readable(pol, reader, it, "2026-10-22T09:01:00.25Z")).toBe(false);
  });
});

describe("budgetVictims", () => {
  const its = [3, 1, 2].map((n) => ({ ...item, id: `id-${n}` }) as MemoryItem);
  const changed = new Map([
    ["id-1", 10],
    ["id-2", 20],
    ["id-3", 30],
  ]);
  const reads = new Map([["id-1", 5]]);

  test("nothing at the budget; the oldest by recency; the least read by utility", () => {
    expect(budgetVictims("recency", 3, its, changed, reads)).toEqual([]);
    expect(budgetVictims("recency", 1, its, changed, reads)).toEqual(["id-1", "id-2"]);
    expect(budgetVictims("utility", 1, its, changed, reads)).toEqual(["id-2", "id-3"]);
    expect(budgetVictims("manual", 1, its, changed, reads)).toBe("ask");
    expect(budgetVictims("manual", 3, its, changed, reads)).toEqual([]);
  });

  test("never picks the protected item, the write that just landed", () => {
    expect(budgetVictims("recency", 2, its, changed, reads, "id-1")).toEqual(["id-2"]);
    expect(budgetVictims("utility", 2, its, changed, reads, "id-2")).toEqual(["id-3"]);
  });
});

describe("sameContent", () => {
  test("reads text as words, ignoring case, spacing and invisible format characters", () => {
    expect(sameContent("Omar​  likes TEA\n", "omar likes tea")).toBe(true);
    expect(sameContent("tea­", "tea")).toBe(true);
    expect(sameContent("omar likes tea", "omar likes coffee")).toBe(false);
  });

  test("objects key by key, arrays in order, and never equal text", () => {
    expect(sameContent({ b: "X", a: [1, "y"] }, { a: [1, "Y"], b: "x" })).toBe(true);
    expect(sameContent({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameContent('{"a":1}', { a: 1 })).toBe(false);
  });
});

describe("sameStrictContent", () => {
  test("drops format characters and collapses spacing, nothing more (P5-12)", () => {
    expect(sameStrictContent("The  Deploy\u200b runs ", "The Deploy runs")).toBe(true);
    expect(sameStrictContent("US", "us")).toBe(false);
    expect(sameStrictContent("10\u00b2", "102")).toBe(false);
    expect(sameStrictContent({ b: " X", a: 1 }, { a: 1, b: "X" })).toBe(true);
    expect(sameStrictContent("x", { x: "x" })).toBe(false);
  });
});

describe("promotionPermitted", () => {
  const AT = "2026-10-25T12:00:00Z";
  const p = {
    write: [{ scope: "team", requires_review: false }],
    read: { matrix: [{ reader: "person", may_read: ["person", "team"] }], honour_grants: true },
    retention: [],
    promotion: { episodic_to_semantic: { confirmations: 2, or_review: true } },
  } as unknown as Policy;
  const ep = {
    id: "e",
    class: "episodic",
    scope: "person:a",
    owner: "person:a",
    status: "active",
    content: "FACT",
    provenance: { kind: "user" },
    grants: [],
    lineage: [],
    ttl: null,
    valid_from: AT,
  } as unknown as MemoryItem;
  const promoter: Actor = {
    id: "person:a",
    level: "person",
    memberships: ["person:a", "team:b"],
    source: "user",
  };
  let seq = 0;
  /** An allowed write event of `it` by `actor`. */
  const wrote = (actor: string, it: MemoryItem, op: MemoryEvent["op"] = "write") =>
    ({ seq: seq++, op, decision: "allow", item_id: it.id, actor, item: it }) as MemoryEvent;
  const retire = (id: string) =>
    ({ seq: seq++, op: "retire", decision: "allow", item_id: id, actor: "x" }) as MemoryEvent;
  /** A restatement by `actor` with source `kind`. */
  const said = (actor: string, kind: string, content = "FACT", scope = "person:a") =>
    wrote(actor, {
      ...ep,
      id: `${actor}-${kind}-${content}-${scope}`,
      owner: actor,
      scope,
      content,
      provenance: { kind },
    } as MemoryItem);
  const own = wrote("person:a", ep);
  const ok = (actor: Actor, events: MemoryEvent[], review = false, target = "team:b", at = AT) =>
    promotionPermitted(p, actor, "e", target, events, review, at);

  test("counts distinct actors with a user, document or tool source, in its scope, strictly the same", () => {
    expect(ok(promoter, [own, said("b", "tool")])).toBe(true);
    expect(ok(promoter, [own, said("person:a", "document")])).toBe(false);
    expect(ok(promoter, [own, said("b", "model")])).toBe(false);
    expect(ok(promoter, [own, said("b", "user", "other")])).toBe(false);
    expect(ok(promoter, [own, said("b", "user", "fact")])).toBe(false);
    expect(ok(promoter, [own, said("b", "user", "FACT", "person:z")])).toBe(false);
  });

  test("a confirmer retired since does not count (P5-5)", () => {
    const b = said("b", "user");
    expect(ok(promoter, [own, b, retire(b.item_id as string)])).toBe(false);
  });

  test("an active item of the promoted class holding the content in the target blocks it (P5-5)", () => {
    const there = wrote("c", { ...ep, id: "t", class: "semantic", scope: "team:b" } as MemoryItem);
    expect(ok(promoter, [own, said("b", "user"), there])).toBe(false);
  });

  test("a reviewer is user-sourced, a member of the target, not the owner and not an author (P5-1)", () => {
    const sara = { ...promoter, id: "person:s" };
    expect(ok(sara, [own], true)).toBe(true);
    expect(ok(promoter, [own], true)).toBe(false);
    expect(ok({ ...sara, source: "model" }, [own], true)).toBe(false);
    expect(ok({ ...sara, memberships: ["person:a"] }, [own], true)).toBe(false);
    // sara wrote the item, naming person:a as owner.
    expect(ok(sara, [wrote("person:s", ep)], true)).toBe(false);
    // ... or wrote a version its lineage reaches.
    const older = { ...ep, id: "old" } as MemoryItem;
    const next = { ...ep, lineage: ["old"] } as MemoryItem;
    expect(ok(sara, [wrote("person:s", older), wrote("person:a", next)], true)).toBe(false);
  });

  test("a widening needs a user-sourced actor (P5-3)", () => {
    const pi = { ...promoter, id: "agent:pi", source: "tool" as const };
    expect(ok(pi, [own, said("b", "user")])).toBe(false);
    expect(ok(pi, [own, said("b", "user")], false, "person:a")).toBe(true);
  });

  test("an item past its ttl or out of the actor's reach is not promoted (P5-4, P5-7)", () => {
    const short = wrote("person:a", { ...ep, ttl: 3 } as MemoryItem);
    expect(ok(promoter, [short, said("b", "user")], false, "team:b", "2026-10-25T12:00:03Z")).toBe(
      false,
    );
    expect(ok({ ...promoter, level: "org" }, [own, said("b", "user")])).toBe(false);
  });

  test("never narrows, never moves sideways, never lands a procedural candidate", () => {
    const sara = { ...promoter, id: "person:s", memberships: ["team:b", "team:c", "person:a"] };
    const fact = wrote("person:a", { ...ep, class: "semantic", scope: "team:b" } as MemoryItem);
    expect(promotionPermitted(p, sara, "e", "person:a", [fact], true, AT)).toBe(false);
    expect(promotionPermitted(p, sara, "e", "team:c", [fact], true, AT)).toBe(false);
    const skill = wrote("person:a", {
      ...ep,
      class: "procedural",
      status: "candidate",
    } as MemoryItem);
    expect(promotionPermitted(p, sara, "e", "person:a", [skill], true, AT)).toBe(false);
  });
});

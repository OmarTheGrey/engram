// The oracles pinned on fixed cases, so a mistake shared with the evaluator
// shows up here rather than agreeing with itself in the property tests.
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/plane.ts";
import type { Grant, MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";
import {
  attestedKind,
  budgetVictims,
  effectiveKind,
  floorProblem,
  grantAllowed,
  holdsHiddenText,
  pastTtl,
  patternCovers,
  promotionPermitted,
  protectionProblem,
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
  test("collapses spacing, nothing more (P5-12, P5-14)", () => {
    expect(sameStrictContent("The  Deploy runs ", "The Deploy runs")).toBe(true);
    expect(sameStrictContent("The Deploy\u200b runs", "The Deploy runs")).toBe(false);
    expect(sameStrictContent("US", "us")).toBe(false);
    expect(sameStrictContent("10\u00b2", "102")).toBe(false);
    expect(sameStrictContent({ b: " X", a: 1 }, { a: 1, b: "X" })).toBe(true);
    expect(sameStrictContent("x", { x: "x" })).toBe(false);
  });
});

describe("holdsHiddenText", () => {
  test("finds tag, format and default-ignorable characters anywhere in the content (P5-14)", () => {
    expect(holdsHiddenText("plain text")).toBe(false);
    expect(holdsHiddenText(`x${String.fromCodePoint(0xe0069)}`)).toBe(true);
    expect(holdsHiddenText("x\u200b")).toBe(true);
    expect(holdsHiddenText("x\ufe0f")).toBe(true);
    expect(holdsHiddenText({ a: ["ok", "x\u2060"] })).toBe(true);
    expect(holdsHiddenText({ "k\u00ad": "v" })).toBe(true);
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

  test("a reader through a grant who is not a member of the item's scope never lands it (P5-15)", () => {
    const granted = wrote("person:a", {
      ...ep,
      grants: [
        { to: "person:g", class: "episodic", mode: "read", expires: "2027-01-01T00:00:00Z" },
      ],
    } as MemoryItem);
    const gus: Actor = { id: "person:g", level: "person", memberships: ["team:b"], source: "user" };
    expect(ok(gus, [granted, said("b", "user")], true)).toBe(false);
    // The owner in the owner's own person scope needs no membership listed.
    const self = wrote("person:a", {
      ...ep,
      grants: [
        { to: "person:a", class: "episodic", mode: "read", expires: "2027-01-01T00:00:00Z" },
      ],
    } as MemoryItem);
    expect(ok({ ...promoter, memberships: ["team:b"] }, [self, said("b", "user")])).toBe(true);
  });

  test("content with hidden text never lands (P5-14)", () => {
    const hidden = wrote("person:a", { ...ep, content: "FACT\u200b" } as MemoryItem);
    expect(ok(promoter, [hidden, said("b", "user", "FACT\u200b")])).toBe(false);
  });

  test("a confirmer is no reviewer (P5-16)", () => {
    const sara = { ...promoter, id: "person:s" };
    expect(ok(sara, [own, said("person:s", "user")], true)).toBe(false);
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

// Card E2.11, review E2.11-3: invariant 8's readings of the trust floors.
describe("the trust floors (invariant 8)", () => {
  const ON = { unattested_floor: "on", protect_trusted: "on" } as const;
  const trusting = { ...policy, trust: ON } as unknown as Policy;
  const kindOf = (kind: MemoryItem["provenance"]["kind"], over: Partial<MemoryItem> = {}) =>
    ({
      id: "i",
      scope: "person:a",
      owner: "person:a",
      class: "semantic",
      status: "active",
      grants: [],
      provenance: { kind },
      ...over,
    }) as unknown as MemoryItem;
  const someone = (source?: MemoryItem["provenance"]["kind"], who = "agent:x"): Actor => ({
    id: who,
    level: "person",
    memberships: ["person:a"],
    ...(source ? { source } : {}),
  });
  const event = (over: Partial<MemoryEvent>) =>
    ({
      op: "write",
      decision: "allow",
      actor: "agent:x",
      policy_id: "p",
      reason: "",
      ...over,
    }) as MemoryEvent;

  test("attestedKind: the source, or external when none", () => {
    expect(attestedKind({ source: "tool" })).toBe("tool");
    expect(attestedKind({})).toBe("external");
  });

  test("effectiveKind and writeForbidden judge a sourceless writer at external under the floor", () => {
    expect(effectiveKind(someone(), kindOf("user"))).toBe("user");
    expect(effectiveKind(someone(), kindOf("user"), trusting)).toBe("external");
    expect(effectiveKind(someone("tool"), kindOf("user"), trusting)).toBe("tool");
    const admitsUser = {
      ...trusting,
      write: [
        {
          scope: "team",
          allowed_sources: ["user"],
          forbidden_classes: [],
          confidence_floor: 0,
          requires_review: false,
        },
      ],
    } as unknown as Policy;
    const teamItem = kindOf("user", { scope: "team:t" });
    const member = { ...someone(), memberships: ["team:t"] };
    expect(writeForbidden({ ...admitsUser, trust: undefined } as Policy, member, teamItem)).toBe(
      false,
    );
    expect(writeForbidden(admitsUser, member, teamItem)).toBe(true);
  });

  test("floorProblem: a write recorded more trusted than its actor attests, only under the floor", () => {
    const raised = event({ item: kindOf("user") });
    expect(floorProblem(trusting, someone(), raised)).toContain("more trusted than external");
    expect(floorProblem(trusting, someone("tool"), raised)).toContain("more trusted than tool");
    expect(floorProblem(trusting, someone("user"), raised)).toBeUndefined();
    expect(floorProblem(trusting, someone(), event({ item: kindOf("external") }))).toBeUndefined();
    expect(floorProblem(policy, someone(), raised)).toBeUndefined();
    expect(floorProblem(trusting, someone(), { ...raised, op: "promote" })).toBeUndefined();
    expect(floorProblem(trusting, someone(), { ...raised, decision: "deny" })).toBeUndefined();
  });

  test("protectionProblem: a less trusted write or eviction of an active more trusted item, unless its owner acts as user", () => {
    const held = kindOf("user");
    const rewrite = event({ item: kindOf("tool") });
    expect(protectionProblem(trusting, someone("tool"), held, rewrite)).toContain(
      "rewrote active user item",
    );
    expect(
      protectionProblem(
        trusting,
        someone("tool"),
        held,
        event({ item: kindOf("tool", { status: "retired" }) }),
      ),
    ).toContain("retired active user item");
    expect(
      protectionProblem(trusting, someone("user"), held, event({ item: kindOf("user") })),
    ).toBeUndefined();
    expect(
      protectionProblem(trusting, someone("tool"), { ...held, status: "candidate" }, rewrite),
    ).toBeUndefined();
    expect(protectionProblem(policy, someone("tool"), held, rewrite)).toBeUndefined();
    const evict = event({ op: "evict", item: undefined });
    expect(protectionProblem(trusting, someone("user"), held, evict, "model")).toContain(
      "eviction at model",
    );
    expect(protectionProblem(trusting, someone(), held, evict)).toContain("eviction at external");
    expect(protectionProblem(trusting, someone("user"), held, evict, "user")).toBeUndefined();
    // The owner acting as user is exempt.
    const owner = someone("user", "person:a");
    expect(
      protectionProblem(trusting, owner, held, { ...evict, actor: "person:a" }, "model"),
    ).toBeUndefined();
  });

  test("protectionProblem: adoption's retraction after a denied edit is judged, other retires are not", () => {
    const held = kindOf("user");
    const retract = event({ op: "retire", policy_id: "engram/adopt/retract", item: undefined });
    const adopter = someone("import");
    expect(
      protectionProblem(trusting, adopter, held, {
        ...retract,
        reason: "the store's version of item i was denied (engram/write/downgrade)",
      }),
    ).toContain("retracted active user item");
    expect(
      protectionProblem(trusting, adopter, held, {
        ...retract,
        reason: "item i is no longer in store",
      }),
    ).toBeUndefined();
    expect(
      protectionProblem(
        trusting,
        adopter,
        held,
        event({ op: "retire", policy_id: "x/retention/person/semantic" }),
      ),
    ).toBeUndefined();
  });
});

describe("budgetVictims with eligible (card E2.11)", () => {
  test("passes over an ineligible item, and names fewer victims when too few are eligible", () => {
    const its = ["id-1", "id-2", "id-3"].map((id) => ({ id }) as MemoryItem);
    const changed = new Map([
      ["id-1", 1],
      ["id-2", 2],
      ["id-3", 3],
    ]);
    const notOne = (i: MemoryItem) => i.id !== "id-1";
    expect(budgetVictims("recency", 2, its, changed, new Map(), undefined, notOne)).toEqual([
      "id-2",
    ]);
    expect(budgetVictims("recency", 1, its, changed, new Map(), "id-3", notOne)).toEqual(["id-2"]);
  });
});

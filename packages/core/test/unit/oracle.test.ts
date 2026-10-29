// The oracles pinned on fixed cases, so a mistake shared with the evaluator
// shows up here rather than agreeing with itself in the property tests.
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/plane.ts";
import type { Grant, MemoryItem, Policy } from "../../src/schema.ts";
import {
  budgetVictims,
  grantAllowed,
  pastTtl,
  patternCovers,
  readable,
  sameContent,
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

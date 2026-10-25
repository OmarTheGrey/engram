// Unit tests for the pure policy evaluator (cards E2.2 and E2.3, ADR 0006).
// One test per rule branch: every way a write is denied or admitted, every way
// a read is admitted or excluded, and the validity and status checks.
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/plane.ts";
import {
  evaluateRead,
  evaluateWrite,
  grantMatches,
  READ_DEFAULT_DENY_ID,
  READ_STATUS_ID,
  READ_VALIDITY_ID,
  SOURCE_ISOLATION_ID,
  scopeLevel,
  WRITE_DEFAULT_DENY_ID,
  WRITE_GRANT_ID,
  WRITE_MEMBERSHIP_ID,
  WRITE_VERSION_ID,
  withinValidity,
} from "../../../src/policy/evaluate.ts";
import type { Grant, MemoryItem, Policy, Provenance } from "../../../src/schema.ts";

const AT = "2026-10-25T12:00:00Z";

function item(over: Partial<MemoryItem> & { kind?: Provenance["kind"] } = {}): MemoryItem {
  const { kind = "user", ...rest } = over;
  return {
    id: "01890a5d-ac96-7000-8000-000000000001",
    class: "semantic",
    scope: "team:platform",
    owner: "person:omar",
    content: "the deploy runs on fridays",
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
    schema_version: 0,
    ...rest,
  } as MemoryItem;
}

const rule = (over: Partial<Policy["write"][number]> = {}): Policy["write"][number] => ({
  scope: "team",
  allowed_sources: ["user", "document", "model", "compaction"],
  confidence_floor: 0.5,
  forbidden_classes: ["episodic"],
  requires_review: false,
  ...over,
});

function policy(over: Partial<Policy> = {}): Policy {
  return {
    id: "p",
    version: 1,
    write: [rule(), rule({ scope: "person", forbidden_classes: [] })],
    read: {
      matrix: [
        { reader: "person", may_read: ["person", "team", "org"] },
        { reader: "team", may_read: ["team", "org"] },
      ],
      honour_grants: true,
    },
    retention: [],
    promotion: {
      episodic_to_semantic: { confirmations: 3, or_review: true },
      procedural: { replay_k: 4, replay_n: 5 },
    },
    lints: { enabled: [], thresholds: {} },
    schema_version: 0,
    ...over,
  };
}

const member: Actor = { id: "person:omar", level: "team", memberships: ["team:platform"] };
const outsider: Actor = { id: "person:sara", level: "team", memberships: ["team:other"] };
/** A writer who is a member of every scope the write tests use. */
const writer: Actor = {
  id: "person:omar",
  level: "team",
  memberships: ["team:platform", "person:omar", "org"],
};

describe("scopeLevel and grantMatches", () => {
  test("names the level of every scope form", () => {
    expect(scopeLevel("org")).toBe("org");
    expect(scopeLevel("person:omar")).toBe("person");
    expect(scopeLevel("role:lead")).toBe("role");
    expect(scopeLevel("team:a/b")).toBe("team");
  });

  test("a grant pattern matches exactly, or by prefix when it ends in *", () => {
    expect(grantMatches("agent:pi", "agent:pi")).toBe(true);
    expect(grantMatches("agent:pi", "agent:pix")).toBe(false);
    expect(grantMatches("agent:*", "agent:claude-code")).toBe(true);
    expect(grantMatches("agent:*", "person:omar")).toBe(false);
    expect(grantMatches("*", "anyone")).toBe(true);
  });
});

describe("evaluateWrite", () => {
  test("admits a write that every check of its scope's rule passes, as active", () => {
    const d = evaluateWrite(policy(), writer, item());
    expect(d).toMatchObject({ decision: "allow", status: "active", check: "admit" });
    expect(d.policy_id).toBe("p/write/team");
    expect(d.reason).not.toBe("");
  });

  test("denies a write to a scope level the policy has no rule for", () => {
    const d = evaluateWrite(policy(), writer, item({ scope: "org" }));
    expect(d).toMatchObject({ decision: "deny", status: null, check: "no-rule" });
    expect(d.policy_id).toBe(WRITE_DEFAULT_DENY_ID);
    expect(WRITE_DEFAULT_DENY_ID).toBe("engram/write/default-deny");
    expect(d.reason).toMatch(/no write rule for org/);
  });

  test("denies a write of a class the scope's rule forbids", () => {
    const d = evaluateWrite(policy(), writer, item({ class: "episodic" }));
    expect(d).toMatchObject({
      decision: "deny",
      check: "forbidden-class",
      policy_id: "p/write/team",
    });
    expect(d.reason).toMatch(/episodic/);
  });

  test("denies a write whose source kind the scope's rule does not list", () => {
    const d = evaluateWrite(policy(), writer, item({ kind: "tool" }));
    expect(d).toMatchObject({ decision: "deny", check: "source-not-allowed" });
    expect(d.policy_id).toBe("p/write/team");
    expect(d.reason).toMatch(/source tool/);
  });

  test("denies model-written content outside person scope even when the rule lists model", () => {
    const d = evaluateWrite(policy(), writer, item({ kind: "model" }));
    expect(d).toMatchObject({ decision: "deny", check: "source-isolation" });
    expect(d.policy_id).toBe(SOURCE_ISOLATION_ID);
  });

  test("denies compaction content outside person scope even when the rule lists compaction", () => {
    const d = evaluateWrite(policy(), writer, item({ kind: "compaction" }));
    expect(d).toMatchObject({ decision: "deny", check: "source-isolation" });
  });

  test("admits model and compaction content in person scope when the rule lists them", () => {
    for (const kind of ["model", "compaction"] as const) {
      const d = evaluateWrite(policy(), writer, item({ kind, scope: "person:omar" }));
      expect(d, kind).toMatchObject({ decision: "allow", policy_id: "p/write/person" });
    }
  });

  test("denies a write below the scope's confidence floor", () => {
    const d = evaluateWrite(policy(), writer, item({ confidence: 0.49 }));
    expect(d).toMatchObject({ decision: "deny", check: "below-floor" });
    expect(d.reason).toMatch(/0\.49.*0\.5/);
  });

  test("admits a write exactly at the confidence floor", () => {
    expect(evaluateWrite(policy(), writer, item({ confidence: 0.5 })).decision).toBe("allow");
  });

  test("admits a write to a scope that requires review as a candidate", () => {
    const p = policy({ write: [rule({ requires_review: true })] });
    const d = evaluateWrite(p, writer, item());
    expect(d).toMatchObject({ decision: "allow", status: "candidate", check: "review" });
    expect(d.reason).toMatch(/review/);
  });

  test("keeps the status of a retired item written to a scope that requires review", () => {
    const p = policy({ write: [rule({ requires_review: true })] });
    expect(evaluateWrite(p, writer, item({ status: "retired" })).status).toBe("retired");
  });

  test("keeps the incoming status when the scope needs no review", () => {
    expect(evaluateWrite(policy(), writer, item({ status: "candidate" })).status).toBe("candidate");
  });

  test("reports the first failing check in a fixed order: class, source, isolation, floor", () => {
    const d = evaluateWrite(
      policy(),
      writer,
      item({ class: "episodic", kind: "tool", confidence: 0 }),
    );
    expect(d.check).toBe("forbidden-class");
    expect(evaluateWrite(policy(), writer, item({ kind: "tool", confidence: 0 })).check).toBe(
      "source-not-allowed",
    );
    expect(evaluateWrite(policy(), writer, item({ kind: "model", confidence: 0 })).check).toBe(
      "source-isolation",
    );
  });

  test("is deterministic: the same inputs give the same decision", () => {
    expect(evaluateWrite(policy(), writer, item())).toEqual(
      evaluateWrite(policy(), writer, item()),
    );
  });
});

describe("evaluateWrite: who may write (decision D4)", () => {
  test("denies a write by an actor who is not a member of the item's scope", () => {
    const mal: Actor = { id: "person:mal", level: "person", memberships: ["person:mal"] };
    const d = evaluateWrite(policy(), mal, item({ scope: "person:omar" }));
    expect(d).toMatchObject({ decision: "deny", status: null, check: "not-member" });
    expect(d.policy_id).toBe(WRITE_MEMBERSHIP_ID);
    expect(WRITE_MEMBERSHIP_ID).toBe("engram/write/membership");
    expect(d.reason).toMatch(/person:mal is not a member of person:omar/);
  });

  test("a read grant on an existing item does not let its grantee write into the scope", () => {
    const sara: Actor = { id: "person:sara", level: "person", memberships: ["person:sara"] };
    const existing = item({
      scope: "person:omar",
      grants: [{ to: "person:sara", mode: "read_write", class: "semantic", expires: AT }],
    });
    const d = evaluateWrite(policy(), sara, item({ scope: "person:omar" }), existing);
    expect(d.policy_id).toBe(WRITE_MEMBERSHIP_ID);
  });

  test("denies a rewrite of an item by an actor who is not a member of its current scope", () => {
    const actor: Actor = { id: "person:ali", level: "team", memberships: ["team:platform"] };
    const existing = item({ scope: "team:payments" });
    const d = evaluateWrite(policy(), actor, item(), existing);
    expect(d).toMatchObject({ decision: "deny", check: "not-member" });
    expect(d.reason).toMatch(/not a member of team:payments, where/);
  });

  test("denies a rewrite with a lower version than the projected one", () => {
    const existing = item({ version: 3 });
    const d = evaluateWrite(policy(), writer, item({ version: 2 }), existing);
    expect(d).toMatchObject({ decision: "deny", check: "version" });
    expect(d.policy_id).toBe(WRITE_VERSION_ID);
    expect(WRITE_VERSION_ID).toBe("engram/write/version");
    expect(d.reason).toMatch(/version 2 is below the projected version 3/);
  });

  test("admits a rewrite at the same or a higher version", () => {
    const existing = item({ version: 3 });
    for (const version of [3, 4])
      expect(evaluateWrite(policy(), writer, item({ version }), existing).decision).toBe("allow");
  });

  test("denies a rewrite that changes the owner", () => {
    const existing = item({ owner: "person:sara" });
    const d = evaluateWrite(policy(), writer, item({ owner: "person:omar" }), existing);
    expect(d).toMatchObject({ decision: "deny", check: "version", policy_id: WRITE_VERSION_ID });
    expect(d.reason).toMatch(/owner/);
  });

  const g = (over: Partial<Grant> = {}): Grant => ({
    to: "person:sara",
    mode: "read",
    class: "semantic",
    expires: "2027-01-01T00:00:00Z",
    ...over,
  });

  test("admits a grant to a principal or a prefixed pattern, with a class and an expiry", () => {
    for (const to of ["person:sara", "agent:claude-code/*", "agent:c*"])
      expect(evaluateWrite(policy(), writer, item({ grants: [g({ to })] })).decision, to).toBe(
        "allow",
      );
  });

  test("denies a grant to everyone or to a bare kind wildcard", () => {
    for (const to of ["*", "person:*", "agent:*", ":*", "agent*", "person:sa*ra", "**"]) {
      const d = evaluateWrite(policy(), writer, item({ grants: [g({ to })] }));
      expect(d, to).toMatchObject({ decision: "deny", check: "grant", policy_id: WRITE_GRANT_ID });
      expect(d.reason, to).toMatch(/grants\[0\]/);
    }
    expect(WRITE_GRANT_ID).toBe("engram/write/grant");
  });

  test("denies a grant without a class or without an expiry", () => {
    const { class: _c, ...noClass } = g();
    const { expires: _e, ...noExpiry } = g();
    for (const grant of [noClass, noExpiry]) {
      const d = evaluateWrite(policy(), writer, item({ grants: [grant as Grant] }));
      expect(d, JSON.stringify(grant)).toMatchObject({ decision: "deny", check: "grant" });
    }
  });

  test("denies any grant on model or compaction content", () => {
    for (const kind of ["model", "compaction"] as const) {
      const d = evaluateWrite(
        policy(),
        writer,
        item({ kind, scope: "person:omar", grants: [g()] }),
      );
      expect(d, kind).toMatchObject({ decision: "deny", check: "grant" });
      expect(d.reason, kind).toMatch(new RegExp(kind));
    }
  });

  test("checks membership, then the rewrite, then grants, before the scope's rule", () => {
    const mal: Actor = { id: "person:mal", level: "team", memberships: [] };
    const bad = item({ class: "episodic", grants: [g({ to: "*" })], version: 1 });
    expect(evaluateWrite(policy(), mal, bad, item({ version: 2 })).check).toBe("not-member");
    expect(evaluateWrite(policy(), writer, bad, item({ version: 2 })).check).toBe("version");
    expect(evaluateWrite(policy(), writer, bad).check).toBe("grant");
    expect(evaluateWrite(policy(), writer, { ...bad, grants: [] }).check).toBe("forbidden-class");
  });
});

describe("timestamps at full precision (decision D7)", () => {
  const t1 = "2026-10-25T12:00:00.0001Z";
  const t9 = "2026-10-25T12:00:00.0009Z";

  test("an item valid from .0009 is not yet valid at .0001", () => {
    expect(withinValidity(item({ valid_from: t9 }), t1)).toBe(false);
    expect(evaluateRead(policy(), member, item({ valid_from: t9 }), t1).check).toBe(
      "outside-validity",
    );
  });

  test("an item valid to .0009 is still valid at .0001", () => {
    expect(withinValidity(item({ valid_to: t9 }), t1)).toBe(true);
  });

  test("a grant expiring at .0009 still admits at .0001, and not at .0009", () => {
    const grants = [{ to: "person:sara", mode: "read" as const, expires: t9 }];
    expect(evaluateRead(policy(), outsider, item({ grants }), t1).admitted).toBe(true);
    expect(evaluateRead(policy(), outsider, item({ grants }), t9).admitted).toBe(false);
  });

  test("a nanosecond decides the validity window's end", () => {
    const end = "2026-10-25T12:00:00.000000002Z";
    expect(withinValidity(item({ valid_to: end }), "2026-10-25T12:00:00.000000001Z")).toBe(true);
    expect(withinValidity(item({ valid_to: end }), end)).toBe(false);
  });
});

describe("evaluateRead", () => {
  test("admits an item in a scope the actor belongs to and whose level the matrix lets it read", () => {
    const d = evaluateRead(policy(), member, item(), AT);
    expect(d).toMatchObject({ admitted: true, check: "scope", grants_used: [] });
    expect(d.policy_id).toBe("p/read/team");
  });

  test("excludes an item in a scope the actor does not belong to", () => {
    const d = evaluateRead(policy(), outsider, item(), AT);
    expect(d).toMatchObject({ admitted: false, check: "excluded", policy_id: "p/read/team" });
    expect(d.reason).toMatch(/not a member of team:platform/);
  });

  test("excludes an item whose level the read matrix does not let the actor's level read", () => {
    const actor: Actor = { id: "person:omar", level: "team", memberships: ["person:omar"] };
    const d = evaluateRead(policy(), actor, item({ scope: "person:omar" }), AT);
    expect(d).toMatchObject({ admitted: false, check: "excluded" });
    expect(d.reason).toMatch(/matrix/);
  });

  test("excludes every item by scope for an actor level with no matrix row, by default deny", () => {
    const actor: Actor = { id: "person:omar", level: "org", memberships: ["org"] };
    const d = evaluateRead(policy(), actor, item({ scope: "org" }), AT);
    expect(d).toMatchObject({ admitted: false, policy_id: READ_DEFAULT_DENY_ID });
    expect(READ_DEFAULT_DENY_ID).toBe("engram/read/default-deny");
    expect(d.reason).toMatch(/no read matrix row for org/);
  });

  const grant = (over: Partial<Grant> = {}): Grant => ({
    to: "person:sara",
    mode: "read",
    ...over,
  });

  test("admits through a grant to the actor, naming the grant", () => {
    const d = evaluateRead(policy(), outsider, item({ grants: [grant()] }), AT);
    expect(d).toMatchObject({ admitted: true, check: "grant", policy_id: "p/read/grants" });
    expect(d.grants_used).toEqual(["grants[0]:person:sara"]);
  });

  test("admits through a grant whose pattern ends in * and prefixes the actor id", () => {
    const d = evaluateRead(policy(), outsider, item({ grants: [grant({ to: "person:*" })] }), AT);
    expect(d.admitted).toBe(true);
  });

  test("does not admit through a grant to another principal", () => {
    const d = evaluateRead(policy(), outsider, item({ grants: [grant({ to: "agent:pi" })] }), AT);
    expect(d.admitted).toBe(false);
  });

  test("admits through a grant whose class equals the item's", () => {
    const g = grant({ class: "semantic" });
    expect(evaluateRead(policy(), outsider, item({ grants: [g] }), AT).admitted).toBe(true);
  });

  test("does not admit through a grant for another class", () => {
    const g = grant({ class: "procedural" });
    expect(evaluateRead(policy(), outsider, item({ grants: [g] }), AT).admitted).toBe(false);
  });

  test("admits through a grant that expires after the read time", () => {
    const g = grant({ expires: "2026-10-25T12:00:01Z" });
    expect(evaluateRead(policy(), outsider, item({ grants: [g] }), AT).admitted).toBe(true);
  });

  test("does not admit through a grant that expires at or before the read time", () => {
    for (const expires of [AT, "2026-10-01T00:00:00Z"]) {
      const g = grant({ expires });
      expect(evaluateRead(policy(), outsider, item({ grants: [g] }), AT).admitted, expires).toBe(
        false,
      );
    }
  });

  test("compares grant expiry as instants, not as strings", () => {
    // Half a second after the read time; as a string "." sorts before "Z", so before it.
    const g = grant({ expires: "2026-10-25T12:00:00.500Z" });
    expect(evaluateRead(policy(), outsider, item({ grants: [g] }), AT).admitted).toBe(true);
  });

  test("ignores grants when the policy does not honour them", () => {
    const p = policy({ read: { ...policy().read, honour_grants: false } });
    expect(evaluateRead(p, outsider, item({ grants: [grant()] }), AT).admitted).toBe(false);
  });

  test("lists every matching grant it used, skipping the ones that do not match", () => {
    const grants = [grant({ to: "agent:pi" }), grant(), grant({ to: "person:*" })];
    const d = evaluateRead(policy(), outsider, item({ grants }), AT);
    expect(d.grants_used).toEqual(["grants[1]:person:sara", "grants[2]:person:*"]);
  });

  test("prefers scope over a grant when both admit, and uses no grant", () => {
    const d = evaluateRead(policy(), member, item({ grants: [grant({ to: "person:omar" })] }), AT);
    expect(d).toMatchObject({ check: "scope", grants_used: [] });
  });

  test("excludes an item that is not active, with the status rule", () => {
    for (const status of ["candidate", "retired"] as const) {
      const d = evaluateRead(policy(), member, item({ status }), AT);
      expect(d, status).toMatchObject({ admitted: false, check: "not-active" });
      expect(d.policy_id).toBe(READ_STATUS_ID);
    }
  });

  test("excludes an item outside its validity window at the read time", () => {
    const early = item({ valid_from: "2026-10-26T00:00:00Z" });
    const ended = item({ valid_to: "2026-10-25T12:00:00Z" });
    for (const it of [early, ended]) {
      const d = evaluateRead(policy(), member, it, AT);
      expect(d).toMatchObject({ admitted: false, check: "outside-validity" });
      expect(d.policy_id).toBe(READ_VALIDITY_ID);
    }
  });

  test("checks access before validity, so an excluded item is never reported by its window", () => {
    const it = item({ valid_from: "2026-10-26T00:00:00Z" });
    expect(evaluateRead(policy(), outsider, it, AT).check).toBe("excluded");
  });
});

describe("withinValidity", () => {
  test("holds from valid_from inclusive to valid_to exclusive, and forever when valid_to is null", () => {
    expect(withinValidity(item({ valid_from: AT }), AT)).toBe(true);
    expect(withinValidity(item({ valid_from: "2026-10-25T12:00:01Z" }), AT)).toBe(false);
    expect(withinValidity(item({ valid_to: "2026-10-25T12:00:01Z" }), AT)).toBe(true);
    expect(withinValidity(item({ valid_to: AT }), AT)).toBe(false);
    expect(withinValidity(item({ valid_to: null }), "2099-01-01T00:00:00Z")).toBe(true);
  });
});

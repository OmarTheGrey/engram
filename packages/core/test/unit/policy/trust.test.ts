// Card E2.11, review E2.11-3: the trust floors' pure pieces pinned on fixed
// cases (policy/trust.ts, policy/retention.ts `evictionShortfall`) and the
// plane's `budgetRefusal` (plane/retention.ts) on a fresh log.
import { describe, expect, test } from "vitest";
import { budgetRefusal } from "../../../src/plane/retention.ts";
import type { Actor } from "../../../src/plane.ts";
import { evictionShortfall } from "../../../src/policy/retention.ts";
import {
  DOWNGRADE_ID,
  downgradeProblem,
  evictable,
  evictionKind,
  leastTrustedKind,
  lessTrusted,
  shields,
  unattestedFloor,
} from "../../../src/policy/trust.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { AT, fresh, item, testPolicy } from "../plane/helpers.ts";

type Kind = MemoryItem["provenance"]["kind"];
const KINDS: Kind[] = ["user", "document", "tool", "model", "import", "compaction", "external"];
const ON = { unattested_floor: "on", protect_trusted: "on" } as const;
const SCOPE = "person:alice";

const base: Policy = testPolicy({
  id: "trust",
  write: [
    {
      scope: "person",
      allowed_sources: [...KINDS],
      confidence_floor: 0,
      forbidden_classes: [],
      requires_review: false,
    },
  ],
  read: { matrix: [{ reader: "person", may_read: ["person"] }], honour_grants: false },
  retention: [{ scope: "person", class: "episodic", ttl: null, budget: 1, eviction: "recency" }],
});
const on: Policy = { ...base, trust: ON };
const floorOnly: Policy = { ...base, trust: { unattested_floor: "on" } };
const protectOnly: Policy = { ...base, trust: { protect_trusted: "on" } };
const off: Policy = { ...base, trust: { unattested_floor: "off", protect_trusted: "off" } };

const actor = (source?: Kind, who = "agent:helper"): Actor => ({
  id: who,
  level: "person",
  memberships: [SCOPE],
  ...(source ? { source } : {}),
});
const at = (kind: Kind, over: Partial<MemoryItem> = {}) =>
  item(1, {
    scope: SCOPE,
    owner: SCOPE,
    class: "episodic",
    provenance: { kind, ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: "person:carol" },
    ...over,
  });

describe("the trust order", () => {
  test("the least trusted kind is external, and lessTrusted is strict", () => {
    expect(leastTrustedKind()).toBe("external");
    expect(lessTrusted("tool", "user")).toBe(true);
    expect(lessTrusted("user", "tool")).toBe(false);
    expect(lessTrusted("import", "import")).toBe(false);
    expect(lessTrusted("import", "document")).toBe(true);
  });
});

describe("unattestedFloor", () => {
  test("a sourceless actor under the floor: kind external, as the actor's, the claim named in the note", () => {
    const [floored, note] = unattestedFloor(on, actor(), at("user")) ?? [];
    expect(floored?.provenance).toMatchObject({ kind: "external", actor: "agent:helper" });
    expect(note).toContain("trust.unattested_floor");
    expect(note).toContain("not as the claimed user by person:carol");
  });

  test("off, absent, or protect alone: no floor", () => {
    for (const p of [base, off, protectOnly])
      expect(unattestedFloor(p, actor(), at("user"))).toBeNull();
  });

  test("an actor with a source is never floored", () => {
    expect(unattestedFloor(floorOnly, actor("model"), at("user"))).toBeNull();
  });
});

describe("shields and downgradeProblem", () => {
  test("a less trusted kind against an active more trusted item: shielded, with a reason naming both", () => {
    expect(shields(on, actor("tool"), "tool", at("user"))).toBe(true);
    const why = downgradeProblem(on, actor("tool"), at("tool", { version: 2 }), at("user"));
    expect(why).toContain("a tool write rewrites item");
    expect(why).toContain("an active user item");
    const retire = downgradeProblem(
      on,
      actor("tool"),
      at("tool", { version: 2, status: "retired" }),
      at("user"),
    );
    expect(retire).toContain("a tool write retires item");
  });

  test("not shielded: an equal or more trusted kind, a candidate or retired item, the option off", () => {
    expect(shields(on, actor("user"), "user", at("user"))).toBe(false);
    expect(shields(on, actor("user"), "user", at("tool"))).toBe(false);
    expect(shields(on, actor("tool"), "tool", at("user", { status: "candidate" }))).toBe(false);
    expect(shields(on, actor("tool"), "tool", at("user", { status: "retired" }))).toBe(false);
    expect(shields(floorOnly, actor("tool"), "tool", at("user"))).toBe(false);
    expect(shields(base, actor("tool"), "tool", at("user"))).toBe(false);
  });

  test("the owner acting as user is exempt; the owner as another source is not", () => {
    expect(shields(on, actor("user", SCOPE), "tool", at("user"))).toBe(false);
    expect(shields(on, actor("model", SCOPE), "model", at("user"))).toBe(true);
  });

  test("no projected item: no downgrade", () => {
    expect(downgradeProblem(on, actor("tool"), at("tool"), undefined)).toBeNull();
  });
});

describe("evictionKind and evictable", () => {
  test("a landing is judged at its item's kind, a sweep at the sweeper's source, external when none", () => {
    expect(evictionKind(actor("user"), at("model"))).toBe("model");
    expect(evictionKind(actor("tool"))).toBe("tool");
    expect(evictionKind(actor())).toBe("external");
  });

  test("off: any item may be chosen (undefined); on: only those not more trusted", () => {
    expect(evictable(base, actor("model"), "model")).toBeUndefined();
    expect(evictable(floorOnly, actor("model"), "model")).toBeUndefined();
    const may = evictable(on, actor("model"), "model");
    expect(may?.(at("user"))).toBe(false);
    expect(may?.(at("model"))).toBe(true);
    expect(may?.(at("external"))).toBe(true);
  });
});

describe("evictionShortfall", () => {
  const two = [
    at("user"),
    item(2, { scope: SCOPE, owner: SCOPE, class: "episodic", kind: "model" }),
  ];
  const may = (v: MemoryItem) => v.provenance.kind !== "user";

  test("over budget with too few eligible victims: the overage, the eligible count and the budget", () => {
    expect(evictionShortfall(on, SCOPE, "episodic", two, AT, two[1]?.id as string, may)).toEqual({
      over: 1,
      eligible: 0,
      budget: 1,
    });
  });

  test("null when enough are eligible, nothing is over, the class has no budget, or the rule is manual", () => {
    expect(evictionShortfall(on, SCOPE, "episodic", two, AT, two[0]?.id as string, may)).toBeNull();
    expect(evictionShortfall(on, SCOPE, "episodic", [at("user")], AT, "x", may)).toBeNull();
    expect(evictionShortfall(on, SCOPE, "semantic", two, AT, "x", () => false)).toBeNull();
    const manual: Policy = {
      ...on,
      retention: [{ scope: "person", class: "episodic", ttl: null, budget: 1, eviction: "manual" }],
    };
    expect(evictionShortfall(manual, SCOPE, "episodic", two, AT, "x", () => false)).toBeNull();
  });
});

describe("budgetRefusal", () => {
  test("refuses a landing that would have to evict a more trusted item, with the rule and the counts", async () => {
    const { plane, deps } = fresh(on);
    await plane.write(actor("user", SCOPE), at("user"), AT);
    const landing = item(2, {
      scope: SCOPE,
      owner: "agent:helper",
      class: "episodic",
      kind: "model",
    });
    const refused = budgetRefusal(deps, actor("model"), landing, "active", AT);
    expect(refused?.policy_id).toBe(DOWNGRADE_ID);
    expect(refused?.reason).toContain(
      "a model write would have to evict an item more trusted than it",
    );
    expect(refused?.reason).toContain("1 over its episodic budget of 1");
  });

  test("no refusal: the option off, a user landing, a landing as a candidate, or a rewrite in place", async () => {
    const { plane, deps } = fresh(on);
    await plane.write(actor("user", SCOPE), at("user"), AT);
    const landing = item(2, {
      scope: SCOPE,
      owner: "agent:helper",
      class: "episodic",
      kind: "model",
    });
    expect(
      budgetRefusal({ ...deps, policy: base }, actor("model"), landing, "active", AT),
    ).toBeNull();
    const asUser = {
      ...landing,
      provenance: { ...landing.provenance, kind: "user" },
    } as MemoryItem;
    expect(budgetRefusal(deps, actor("user"), asUser, "active", AT)).toBeNull();
    expect(budgetRefusal(deps, actor("model"), landing, "candidate", AT)).toBeNull();
    expect(
      budgetRefusal(deps, actor("model"), at("model", { version: 2 }), "active", AT),
    ).toBeNull();
  });

  test("names no count to an actor who cannot read the scope", async () => {
    const { plane, deps } = fresh({ ...on, read: { matrix: [], honour_grants: false } });
    await plane.write(actor("user", SCOPE), at("user"), AT);
    const landing = item(2, {
      scope: SCOPE,
      owner: "agent:helper",
      class: "episodic",
      kind: "model",
    });
    const refused = budgetRefusal(deps, actor("model"), landing, "active", AT);
    expect(refused?.policy_id).toBe(DOWNGRADE_ID);
    expect(refused?.reason).not.toMatch(/\d over/);
  });
});

// Review findings I1 and M1 of PR #44 (card E9.4, ADR 0034): Plane.write and
// Plane.changeGrants judge grants by one rule.
//
// I1: a rewrite through Plane.write that changes an item's grants is a grant
// change, decided as Plane.changeGrants decides it: only the owner, and only
// user-sourced (or import-sourced, the owner's own store record adopted); a
// co-holder of a role who adds, removes or alters a grant on the owner's item
// is denied, so a grant on an item always reads as its owner's consent. An
// owner's ordinary rewrite that keeps the grants, a first write carrying
// grants, and adoption behave as before.
//
// M1: what a grant being added may be is one check on both paths
// (grantDefect): the write gate's grant rule, the item's class (another class
// could never admit a read), unexpired, and not on the item already. A grant
// change and a rewrite that changes the grants run all of it; a first write
// also refuses a grant carried twice. With grants.expiry_cap absent, a first
// write keeps the write gate's grant rule alone for the other two (`uncapped`,
// the twin profile without the option): the read filter's tests write a grant
// of another class on a first write, under testPolicy().
//
// Card E2.21, part 2 (ADR 0034, decisions 3 and 6): with grants.expiry_cap on,
// as the twin profile sets it, a first write is held to the whole of
// grantDefect, and every grant a write or a grant change adds expires at most
// 365 days (31,536,000 seconds) after the event's own time, refused under
// engram/write/grant-expiry-cap and never clamped. A grant a rewrite keeps is
// not judged again, and a promotion's new version is exempt.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { allEvents } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import { type Actor, adoptStoreItems, createPlane, offboard } from "../../../src/plane.ts";
import {
  evaluateWrite,
  GRANT_EXPIRED_ID,
  GRANT_EXPIRY_CAP_ID,
  WRITE_GRANT_ID,
  WRITE_MOVE_ID,
} from "../../../src/policy/evaluate.ts";
import { GRANT_OWNER_ID, GRANT_SOURCE_ID, GRANT_UNCHANGED_ID } from "../../../src/policy/grants.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { Grant, MemoryItem, Policy } from "../../../src/schema.ts";
import { fresh, id, item, testPolicy } from "./helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
/** The twin profile with grants.expiry_cap absent: the gate as it decided before card E2.21. */
const uncapped = (): Policy => {
  const { grants: _grants, ...rest } = twin();
  return rest as Policy;
};

const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const UNTIL = "2026-12-19T00:00:00Z";
const ROLE = "role:release";
const dana: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", ROLE],
  source: "user",
};
const lee: Actor = {
  id: "person:lee",
  level: "person",
  memberships: ["person:lee", ROLE],
  source: "user",
};
const zed: Actor = { id: "person:zed", level: "person", memberships: ["person:zed"] };
const toSam: Grant = { to: "person:sam", class: "semantic", mode: "read", expires: UNTIL };
const toZed: Grant = { ...toSam, to: "person:zed" };

/** Dana's role item 1, carrying a grant to sam, written by her. */
async function seeded() {
  const env = fresh(twin());
  const role = item(1, {
    scope: ROLE,
    owner: dana.id,
    content: "The release train leaves at 3.",
    grants: [toSam],
  });
  expect((await env.plane.write(dana, role, AT)).event.decision).toBe("allow");
  return { ...env, role };
}

const rewrite = (it: MemoryItem, over: Partial<MemoryItem>) =>
  ({ ...it, version: it.version + 1, ...over }) as MemoryItem;

describe("I1: a rewrite that changes the grants is a grant change", () => {
  test.each([
    ["adds", (g: Grant[]) => [...g, toZed]],
    ["removes", (_g: Grant[]) => []],
    ["alters", (g: Grant[]) => g.map((x) => ({ ...x, to: "person:zed" }))],
  ])(
    "a role co-holder's write that %s a grant on the owner's item is denied",
    async (_how, change) => {
      const env = await seeded();
      const before = itemById(env.db, id(1));
      const r = await env.plane.write(lee, rewrite(env.role, { grants: change([toSam]) }), LATER);
      expect(r.event).toMatchObject({ decision: "deny", policy_id: GRANT_OWNER_ID });
      expect(r.event.reason).toContain("only its owner person:dana");
      expect(itemById(env.db, id(1))).toEqual(before);
      expect((await env.plane.read(zed, { at: LATER })).items).toEqual([]);
    },
  );

  test("the owner's agent, model-sourced, may not change the grants by a rewrite", async () => {
    const env = await seeded();
    const agent = { ...dana, source: "model" as const };
    const r = await env.plane.write(agent, rewrite(env.role, { grants: [] }), LATER);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: GRANT_SOURCE_ID });
  });

  test("the owner's rewrite that changes the grants lands, as a grant change would", async () => {
    const env = await seeded();
    const r = await env.plane.write(dana, rewrite(env.role, { grants: [toZed] }), LATER);
    expect(r.event.decision).toBe("allow");
    expect((await env.plane.read(zed, { at: LATER })).items.map((i) => i.id)).toEqual([id(1)]);
  });

  test("the owner's rewrite that keeps the grants, in another order or not, is no grant change", async () => {
    const env = await seeded();
    const r = await env.plane.write(dana, rewrite(env.role, { grants: [toSam, toZed] }), AT);
    expect(r.event.decision).toBe("allow");
    const kept = itemById(env.db, id(1)) as MemoryItem;
    const reordered = rewrite(kept, { grants: [toZed, toSam], content: "The train leaves at 4." });
    const byDana = await env.plane.write(dana, reordered, LATER);
    expect(byDana.event).toMatchObject({ decision: "allow", policy_id: "profile.twin/write/role" });
  });

  // Card RV4 (RV-ADP-4): a grant reaches the log only through the plane.
  // Adoption keeps the edited record but drops a grant the plane never
  // recorded for its id, and its reason names it; before, the grant landed.
  test("the owner's store record adopted with other grants lands without the grants the plane never recorded", async () => {
    const env = fresh(twin());
    const own = item(2, { scope: "person:dana", owner: dana.id, content: "Dana's note." });
    expect((await env.plane.write(dana, own, AT)).event.decision).toBe("allow");
    const stored = itemById(env.db, id(2)) as MemoryItem;
    // The person edits the record's grants in the store itself.
    await env.adapter.write({ ...stored, version: 2, grants: [toSam] });
    const report = await adoptStoreItems(
      env.deps,
      { ...dana, memberships: ["person:dana"] },
      "person:dana",
      LATER,
    );
    expect(report).toMatchObject({ allowed: 1, denied: 0 });
    expect(itemById(env.db, id(2))).toMatchObject({ version: 2, grants: [] });
    expect(allEvents(env.db).at(-1)?.reason).toMatch(/adoption dropped the grant to person:sam/);
  });
});

describe("M1: one rule for what a grant may be, on both paths", () => {
  test("a grant naming another class than the item's is refused by a rewrite adding it and by a grant change", async () => {
    const env = fresh(uncapped());
    const wrong = { ...toSam, class: "episodic" as const };
    const own = item(3, { scope: "person:dana", owner: dana.id });
    expect((await env.plane.write(dana, own, AT)).event.decision).toBe("allow");
    const w = await env.plane.write(dana, rewrite(own, { grants: [wrong] }), AT);
    expect(w.event).toMatchObject({ decision: "deny", policy_id: WRITE_GRANT_ID });
    expect(w.event.reason).toContain("never admit a read");
    const c = await env.plane.changeGrants(dana, id(3), { add: [wrong] }, AT);
    expect(c.event).toMatchObject({ decision: "deny", policy_id: WRITE_GRANT_ID });
    expect(c.event.reason).toContain("never admit a read");
    // With grants.expiry_cap absent, a first write may still carry one (see the header).
    const first = await env.plane.write(
      dana,
      item(6, { scope: "person:dana", owner: dana.id, grants: [wrong] }),
      AT,
    );
    expect(first.event.decision).toBe("allow");
  });

  test("E2.21: with grants.expiry_cap on, a first write carrying a grant of another class is refused too", async () => {
    const env = fresh(twin());
    const wrong = { ...toSam, class: "episodic" as const };
    const first = await env.plane.write(
      dana,
      item(6, { scope: "person:dana", owner: dana.id, grants: [wrong] }),
      AT,
    );
    expect(first.event).toMatchObject({ decision: "deny", policy_id: WRITE_GRANT_ID });
    expect(first.event.reason).toContain("never admit a read");
    expect(itemById(env.db, id(6))).toBeUndefined();
    // Its class's grant lands.
    const right = await env.plane.write(
      dana,
      item(8, { scope: "person:dana", owner: dana.id, grants: [toSam] }),
      AT,
    );
    expect(right.event.decision).toBe("allow");
  });

  test("a first write, or a rewrite changing the grants, carrying one grant twice is refused", async () => {
    const env = fresh(twin());
    const w = await env.plane.write(
      dana,
      item(4, {
        scope: "person:dana",
        owner: dana.id,
        grants: [toSam, { ...toSam, expires: "2026-12-19T00:00:00.000Z" }],
      }),
      AT,
    );
    expect(w.event).toMatchObject({ decision: "deny", policy_id: GRANT_UNCHANGED_ID });
    const once = item(7, { scope: "person:dana", owner: dana.id, grants: [toSam] });
    expect((await env.plane.write(dana, once, AT)).event.decision).toBe("allow");
    const twice = await env.plane.write(dana, rewrite(once, { grants: [toSam, toZed, toZed] }), AT);
    expect(twice.event).toMatchObject({ decision: "deny", policy_id: GRANT_UNCHANGED_ID });
  });

  test("a rewrite adding an expired grant is refused; a first write carrying one still lands", async () => {
    // grants.expiry_cap absent: the first write lands as it did before card E2.21.
    const env = fresh(uncapped());
    const expired = { ...toSam, expires: "2026-11-01T00:00:00Z" };
    const first = await env.plane.write(
      dana,
      item(5, { scope: "person:dana", owner: dana.id, grants: [expired] }),
      AT,
    );
    expect(first.event.decision).toBe("allow");
    const kept = itemById(env.db, id(5)) as MemoryItem;
    // Keeping it is no change; adding another expired one is.
    expect(
      (await env.plane.write(dana, rewrite(kept, { content: "edited" }), AT)).event.decision,
    ).toBe("allow");
    const now = itemById(env.db, id(5)) as MemoryItem;
    const more = await env.plane.write(
      dana,
      rewrite(now, { grants: [expired, { ...expired, to: "person:zed" }] }),
      AT,
    );
    expect(more.event).toMatchObject({ decision: "deny", policy_id: "engram/grant/expired" });
  });

  test("E2.21: with grants.expiry_cap on, a first write carrying an expired grant is refused", async () => {
    const env = fresh(twin());
    const expired = { ...toSam, expires: "2026-11-01T00:00:00Z" };
    const first = await env.plane.write(
      dana,
      item(5, { scope: "person:dana", owner: dana.id, grants: [expired] }),
      AT,
    );
    expect(first.event).toMatchObject({ decision: "deny", policy_id: GRANT_EXPIRED_ID });
    expect(first.event.reason).toContain("has expired by 2026-11-19T10:00:00Z");
    expect(itemById(env.db, id(5))).toBeUndefined();
    // A grant expiring at the write's own instant has expired by it, too.
    const atNow = await env.plane.write(
      dana,
      item(9, { scope: "person:dana", owner: dana.id, grants: [{ ...toSam, expires: AT }] }),
      AT,
    );
    expect(atNow.event).toMatchObject({ decision: "deny", policy_id: GRANT_EXPIRED_ID });
  });
});

// Card E2.21, part 2: the cap of ADR 0034, decision 3, behind grants.expiry_cap.
describe("E2.21: a grant expires at most 365 days after the event that adds it", () => {
  /** 365 days of 86,400 seconds after AT, 2026-11-19T10:00:00Z: no calendar year, no leap day. */
  const CAP = "2027-11-19T10:00:00Z";
  const PAST = "2027-11-19T10:00:01Z";
  const at = (expires: string): Grant => ({ ...toSam, expires });

  test("a first write: exactly 365 days lands, one second past it is refused, never clamped", async () => {
    const env = fresh(twin());
    const ok = await env.plane.write(
      dana,
      item(1, { scope: "person:dana", owner: dana.id, grants: [at(CAP)] }),
      AT,
    );
    expect(ok.event.decision).toBe("allow");
    expect(itemById(env.db, id(1))?.grants).toEqual([at(CAP)]);
    const past = await env.plane.write(
      dana,
      item(2, { scope: "person:dana", owner: dana.id, grants: [at(PAST)] }),
      AT,
    );
    expect(past.event).toMatchObject({ decision: "deny", policy_id: GRANT_EXPIRY_CAP_ID });
    // The reason names the limit and the grant's expiry.
    expect(past.event.reason).toContain(`expires ${PAST}`);
    expect(past.event.reason).toContain(`expires after ${CAP}`);
    expect(past.event.reason).toContain("365 days");
    expect(past.event.reason).toContain("not shortened");
    expect(past.item).toBeNull();
    expect(itemById(env.db, id(2))).toBeUndefined();
    expect(await env.adapter.list("person:dana")).toHaveLength(1);
  });

  test("the limit keeps the write time's fraction: a nanosecond past it is refused", async () => {
    const env = fresh(twin());
    const t = "2026-11-19T10:00:00.000000500Z";
    const exact = await env.plane.write(
      dana,
      item(1, {
        scope: "person:dana",
        owner: dana.id,
        grants: [at("2027-11-19T10:00:00.0000005Z")],
      }),
      t,
    );
    expect(exact.event.decision).toBe("allow");
    const over = await env.plane.write(
      dana,
      item(2, {
        scope: "person:dana",
        owner: dana.id,
        grants: [at("2027-11-19T10:00:00.000000501Z")],
      }),
      t,
    );
    expect(over.event.policy_id).toBe(GRANT_EXPIRY_CAP_ID);
  });

  test("a rewrite that adds a grant past the cap is refused; one inside it lands", async () => {
    const env = fresh(twin());
    const own = item(3, { scope: "person:dana", owner: dana.id, grants: [toSam] });
    expect((await env.plane.write(dana, own, AT)).event.decision).toBe("allow");
    const past = await env.plane.write(
      dana,
      rewrite(own, { grants: [toSam, { ...at(PAST), to: "person:zed" }] }),
      AT,
    );
    expect(past.event).toMatchObject({ decision: "deny", policy_id: GRANT_EXPIRY_CAP_ID });
    expect(itemById(env.db, id(3))?.grants).toEqual([toSam]);
    const inside = await env.plane.write(
      dana,
      rewrite(own, { grants: [toSam, { ...at(CAP), to: "person:zed" }] }),
      AT,
    );
    expect(inside.event.decision).toBe("allow");
  });

  test("a grant change adding a grant past the cap is refused, at the change's own time", async () => {
    const env = fresh(twin());
    const own = item(4, { scope: "person:dana", owner: dana.id });
    expect((await env.plane.write(dana, own, AT)).event.decision).toBe("allow");
    const past = await env.plane.changeGrants(dana, id(4), { add: [at(PAST)] }, AT);
    expect(past.event).toMatchObject({ decision: "deny", policy_id: GRANT_EXPIRY_CAP_ID });
    expect(past.event.reason).toContain(`add[0]: the grant to person:sam`);
    expect(past.event.reason).toContain(`expires after ${CAP}`);
    expect(itemById(env.db, id(4))?.grants).toEqual([]);
    // An hour later the limit is an hour later: the same grant lands.
    const later = await env.plane.changeGrants(dana, id(4), { add: [at(PAST)] }, LATER);
    expect(later.event).toMatchObject({ decision: "allow", policy_id: "engram/grant/change" });
  });

  test("a grant a rewrite keeps is not judged again, past the cap or expired", async () => {
    // Written before the option was on, then rewritten under it.
    const before = fresh(uncapped());
    const far = { ...toSam, expires: "2030-01-01T00:00:00Z" };
    const own = item(5, { scope: "person:dana", owner: dana.id, grants: [far] });
    expect((await before.plane.write(dana, own, AT)).event.decision).toBe("allow");
    const plane = createPlane({ ...before.deps, policy: twin() });
    const kept = await plane.write(dana, rewrite(own, { content: "Edited." }), LATER);
    expect(kept.event.decision).toBe("allow");
    // Changing the grants judges the one it adds, not the one it keeps.
    const added = await plane.write(
      dana,
      rewrite(own, { version: 3, grants: [far, { ...at(PAST), to: "person:zed" }] }),
      AT,
    );
    expect(added.event).toMatchObject({ decision: "deny", policy_id: GRANT_EXPIRY_CAP_ID });
    expect(added.event.reason).toContain("grants[1]");
  });

  test("a promotion's new version is exempt: the owner's keeps a grant past the cap", async () => {
    // Dana's episodic item, granted to Sam until 2030 before the option was on,
    // confirmed three times, then promoted by her under it (ADR 0034, decision 6).
    const before = fresh(uncapped());
    const far = { ...toSam, class: "episodic" as const, expires: "2030-01-01T00:00:00Z" };
    const content = "Deploys run on Tuesdays.";
    const own = item(50, {
      class: "episodic",
      scope: "person:dana",
      owner: dana.id,
      content,
      grants: [far],
    } as Partial<MemoryItem>);
    expect((await before.plane.write(dana, own, AT)).event.decision).toBe("allow");
    for (const [n, who] of [
      [51, "person:a"],
      [52, "person:b"],
      [53, "person:c"],
    ] as const) {
      const writer: Actor = {
        id: who,
        level: "person",
        memberships: ["person:dana"],
        source: "user",
      };
      const confirming = item(n, {
        class: "episodic",
        scope: "person:dana",
        owner: who,
        content,
      } as Partial<MemoryItem>);
      expect((await before.plane.write(writer, confirming, AT)).event.decision).toBe("allow");
    }
    const plane = createPlane({ ...before.deps, policy: twin() });
    const p = await plane.promote(dana, id(50), "person:dana", LATER);
    expect(p.event.decision).toBe("allow");
    // A new version of class semantic keeping an episodic grant past the cap:
    // neither the cap nor the first-write rule judged it.
    expect(p.item).toMatchObject({ class: "semantic", grants: [far] });
  });

  test("with the option absent or off, a grant past the cap lands as before", async () => {
    for (const policy of [uncapped(), { ...twin(), grants: { expiry_cap: "off" as const } }]) {
      const env = fresh(policy);
      const w = await env.plane.write(
        dana,
        item(6, {
          scope: "person:dana",
          owner: dana.id,
          grants: [{ ...toSam, expires: "9999-12-31T23:59:59Z" }],
        }),
        AT,
      );
      expect(w.event.decision).toBe("allow");
      expect(
        (
          await env.plane.changeGrants(
            dana,
            id(6),
            { add: [{ ...at(PAST), to: "person:zed" }] },
            AT,
          )
        ).event.decision,
      ).toBe("allow");
    }
  });
});

// Verification finding V-4 of PR #44: a grant of another class than its item
// admits no read until the item's class changes to it, so a class change of an
// item carrying grants switches what they admit. It is a grant change: the
// owner's only, and every grant is judged against the new class.
describe("V-4: a rewrite that changes the class of an item carrying grants is a grant change", () => {
  const dormant: Grant = { ...toZed, class: "procedural" };
  const asSkill = (it: MemoryItem) =>
    rewrite(it, {
      class: "procedural",
      content: { body: "Run the release.", tools: [] },
    } as Partial<MemoryItem>);

  /**
   * Dana's role item 8, semantic, carrying `grants`. Seeded with
   * grants.expiry_cap absent (card E2.21): under the option a first write may
   * not carry the dormant grant of another class these tests start from, so
   * it is the state a log written before the option holds. Every change below
   * is judged under the twin profile as it stands, the option on.
   */
  async function roleItem(grants: Grant[]) {
    const seed = fresh(uncapped());
    const it = item(8, { scope: ROLE, owner: dana.id, content: "Run the release.", grants });
    expect((await seed.plane.write(dana, it, AT)).event.decision).toBe("allow");
    const env = { ...seed, plane: createPlane({ ...seed.deps, policy: twin() }) };
    return { env, it: itemById(env.db, id(8)) as MemoryItem };
  }

  test("a co-holder's class change that would switch a dormant grant on is denied", async () => {
    const { env, it } = await roleItem([dormant]);
    expect((await env.plane.read(zed, { at: LATER })).items).toEqual([]);
    const r = await env.plane.write(lee, asSkill(it), LATER);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: GRANT_OWNER_ID });
    expect(r.event.reason).toContain("class");
    expect(itemById(env.db, id(8))).toEqual(it);
    expect((await env.plane.read(zed, { at: LATER })).items).toEqual([]);
  });

  test("a co-holder's class change that would switch a live grant off is denied", async () => {
    const { env, it } = await roleItem([toZed]);
    expect((await env.plane.read(zed, { at: LATER })).items.map((i) => i.id)).toEqual([id(8)]);
    const r = await env.plane.write(lee, asSkill(it), LATER);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: GRANT_OWNER_ID });
    expect((await env.plane.read(zed, { at: LATER })).items.map((i) => i.id)).toEqual([id(8)]);
  });

  test("the owner's class change lands when every grant fits the new class, and the grant then admits", async () => {
    const { env, it } = await roleItem([dormant]);
    const r = await env.plane.write(dana, asSkill(it), LATER);
    expect(r.event.decision).toBe("allow");
    expect((await env.plane.read(zed, { at: LATER })).items.map((i) => i.id)).toEqual([id(8)]);
  });

  test("the owner's class change is refused while a grant names the old class", async () => {
    const { env, it } = await roleItem([toZed]);
    const r = await env.plane.write(dana, asSkill(it), LATER);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: WRITE_GRANT_ID });
    expect(r.event.reason).toContain("never admit a read");
  });

  test("a co-holder's class change of an item carrying no grant is judged as before", async () => {
    const { env, it } = await roleItem([]);
    expect((await env.plane.write(lee, asSkill(it), LATER)).event.decision).toBe("allow");
  });
});

// Core review finding RV-CORE-1 (card RV7, ADR 0034's amendment): a grant is
// its owner's consent to what the item says, so a rewrite of an item carrying
// grants is the owner's only, whatever it changes. Before, Lee, a role
// co-holder, could rewrite Dana's granted item and Sam then read Lee's text
// under owner person:dana.
describe("RV-CORE-1: a rewrite of an item carrying grants is its owner's", () => {
  const sam: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };

  test("a co-holder's content rewrite keeping the grants is denied, and the grantee still reads the owner's text", async () => {
    const env = await seeded();
    const before = itemById(env.db, id(1));
    const r = await env.plane.write(lee, rewrite(env.role, { content: "Lee's text" }), LATER);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: GRANT_OWNER_ID });
    expect(r.event.reason).toContain("only its owner person:dana");
    expect(itemById(env.db, id(1))).toEqual(before);
    const read = await env.plane.read(sam, { at: LATER });
    expect(read.items.map((i) => i.content)).toEqual(["The release train leaves at 3."]);
  });

  test("the owner's content rewrite keeping the grants lands", async () => {
    const env = await seeded();
    const r = await env.plane.write(dana, rewrite(env.role, { content: "At 4 now." }), LATER);
    expect(r.event.decision).toBe("allow");
    const read = await env.plane.read(sam, { at: LATER });
    expect(read.items.map((i) => i.content)).toEqual(["At 4 now."]);
  });

  test("a co-holder's rewrite of an item whose grants have all expired is still the owner's", async () => {
    // Seeded with grants.expiry_cap absent, as a log written before card E2.21
    // may hold it; the rewrite is judged under the twin profile, the option on.
    const seed = fresh(uncapped());
    const old = { ...toSam, expires: "2026-11-01T00:00:00Z" };
    const it = item(9, { scope: ROLE, owner: dana.id, content: "Old.", grants: [old] });
    expect((await seed.plane.write(dana, it, AT)).event.decision).toBe("allow");
    const env = { ...seed, plane: createPlane({ ...seed.deps, policy: twin() }) };
    const r = await env.plane.write(lee, rewrite(it, { content: "New." }), LATER);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: GRANT_OWNER_ID });
  });

  test("a co-holder's rewrite of an item carrying no grant is judged as before", async () => {
    const env = fresh(twin());
    const it = item(10, { scope: ROLE, owner: dana.id, content: "Shared." });
    expect((await env.plane.write(dana, it, AT)).event.decision).toBe("allow");
    const r = await env.plane.write(lee, rewrite(it, { content: "Shared, edited." }), LATER);
    expect(r.event.decision).toBe("allow");
  });

  test("a co-holder's adoption of a store edit to the owner's granted item is refused; the owner's lands", async () => {
    const env = await seeded();
    const stored = itemById(env.db, id(1)) as MemoryItem;
    await env.adapter.write({
      ...stored,
      version: stored.version + 1,
      content: "Edited in the store.",
    } as MemoryItem);
    const byLee = await adoptStoreItems(env.deps, lee, ROLE, LATER);
    expect(byLee).toMatchObject({ allowed: 0, denied: 1 });
    expect(itemById(env.db, id(1))?.content).toBe("The release train leaves at 3.");
    const fresher = {
      ...stored,
      version: stored.version + 2,
      content: "Edited by Dana.",
    } as MemoryItem;
    await env.adapter.write(fresher);
    const byDana = await adoptStoreItems(env.deps, dana, ROLE, LATER);
    expect(byDana).toMatchObject({ allowed: 1, denied: 0 });
    expect(itemById(env.db, id(1))?.content).toBe("Edited by Dana.");
  });

  test("after a handover the successor owns the granted item and may rewrite it", async () => {
    const env = await seeded();
    const successor: Actor = {
      id: "person:sam",
      level: "person",
      memberships: ["person:sam", ROLE],
      source: "user",
    };
    const report = await offboard(
      env.deps,
      dana,
      { person: dana.id, roles: [{ scope: ROLE, successor: successor.id }] },
      LATER,
    );
    expect(report.decision).toBe("allow");
    const handed = itemById(env.db, id(1)) as MemoryItem;
    expect(handed.owner).toBe(successor.id);
    const r = await env.plane.write(successor, rewrite(handed, { content: "Sam's train." }), LATER);
    expect(r.event.decision).toBe("allow");
    const byLee = await env.plane.write(lee, rewrite(handed, { content: "Lee's train." }), LATER);
    expect(byLee.event).toMatchObject({ decision: "deny", policy_id: GRANT_OWNER_ID });
  });

  test("a reviewer's in-place promotion of the owner's granted candidate lands", async () => {
    // The test policy's org rule requires review: Dana's org item lands as a candidate; Lee reviews it.
    const env = fresh(testPolicy());
    const scopes = ["person:dana", "org"];
    const owner: Actor = { id: dana.id, level: "person", memberships: scopes, source: "user" };
    const reviewer: Actor = { id: lee.id, level: "person", memberships: scopes, source: "user" };
    const it = item(11, { scope: "org", owner: dana.id, content: "Org fact.", grants: [toSam] });
    expect((await env.plane.write(owner, it, AT)).event.decision).toBe("allow");
    expect(itemById(env.db, id(11))?.status).toBe("candidate");
    const p = await env.plane.promote(reviewer, id(11), "org", LATER, { review: true });
    expect(p.event.decision).toBe("allow");
    expect(itemById(env.db, id(11))?.status).toBe("active");
  });
});

// Core review finding RV-CORE-2 (card RV7, ADR 0006's amendment): only the
// owner changes an item's scope on a rewrite. Before, Lee could move Dana's
// granted role item into person:lee: Dana read nothing, her grant change was
// refused as a non-member's, and Sam kept reading a grant nobody could remove.
describe("RV-CORE-2: only the owner moves an item to another scope", () => {
  test("a co-holder's move of the owner's item into the co-holder's person scope is denied, and the owner keeps control", async () => {
    const env = await seeded();
    const before = itemById(env.db, id(1));
    const moved = { ...env.role, version: 2, scope: "person:lee" } as MemoryItem;
    const r = await env.plane.write(lee, moved, LATER);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: WRITE_MOVE_ID });
    // Review fix pass 2 (RV7-R10b): the check is pinned, not just the rule id.
    expect(evaluateWrite(env.policy, lee, moved, before, new Map(), LATER).check).toBe("move");
    expect(r.event.reason).toContain("only its owner person:dana");
    expect(itemById(env.db, id(1))).toEqual(before);
    expect((await env.plane.read(dana, { at: LATER })).items.map((i) => i.id)).toEqual([id(1)]);
    const removed = await env.plane.changeGrants(dana, id(1), { remove: [toSam] }, LATER);
    expect(removed.event).toMatchObject({ decision: "allow", policy_id: "engram/grant/change" });
    const sam: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
    expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
  });

  test("a co-holder's move of an item carrying no grant is denied too", async () => {
    const env = fresh(twin());
    const it = item(12, { scope: ROLE, owner: dana.id, content: "Plain." });
    expect((await env.plane.write(dana, it, AT)).event.decision).toBe("allow");
    const moved = { ...it, version: 2, scope: "person:lee" } as MemoryItem;
    const r = await env.plane.write(lee, moved, LATER);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: WRITE_MOVE_ID });
  });

  test("a mover who may not read the item's scope learns neither its scope nor its owner", async () => {
    // Lee in a role context: a member of person:lee and the role, reading no person scope.
    const env = fresh(twin());
    const it = item(13, { scope: "person:lee", owner: dana.id, content: "Odd." });
    expect((await env.plane.write(lee, it, AT)).event.decision).toBe("allow");
    const roleContext: Actor = { ...lee, level: "role" };
    const moved = { ...it, version: 2, scope: ROLE } as MemoryItem;
    const r = await env.plane.write(roleContext, moved, LATER);
    // Review fix pass of PR #61 (RV7-R5): the rule id would name the check, so the opaque refusal takes the membership rule's.
    expect(r.event).toMatchObject({ decision: "deny", policy_id: "engram/write/membership" });
    expect(r.event.reason).not.toContain("person:dana");
    expect(r.event.reason).toContain("an item you cannot access");
  });

  test("the owner's own move lands", async () => {
    const env = await seeded();
    const moved = { ...env.role, version: 2, scope: "person:dana" } as MemoryItem;
    const r = await env.plane.write(dana, moved, LATER);
    expect(r.event.decision).toBe("allow");
    expect(itemById(env.db, id(1))?.scope).toBe("person:dana");
  });
});

// Review fix pass of PR #61. RV7-R1: a co-holder took the owner's granted item
// by promoting it into a scope the owner is not in; the new version kept the
// grants, and nobody could remove them. A new version a non-owner makes
// carries no grants (a grant is its owner's consent to one item), and the
// promotion's reason says so. RV7-R4: the in-place exemption is the
// promotion gate's alone. RV7-R5: the owner-rewrite refusal is opaque to a
// writer who cannot read the item's scope.
describe("review fix pass of PR #61", () => {
  const sam: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
  const leeInTeam: Actor = { ...lee, memberships: ["person:lee", ROLE, "team:x"] };

  test("RV7-R1: a co-holder's promotion of the owner's granted item into another scope carries no grant", async () => {
    const env = await seeded();
    const p = await env.plane.promote(leeInTeam, id(1), "team:x", LATER, { review: true });
    expect(p.event.decision).toBe("allow");
    expect(p.event.reason).toContain("1 grant of its owner person:dana is not carried");
    const promoted = p.item as MemoryItem;
    expect(promoted).toMatchObject({ scope: "team:x", owner: dana.id, grants: [] });
    expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
  });

  test("RV7-R1: the owner's own new version keeps the grants", async () => {
    // An episodic person item of Dana's, granted to Sam, promoted by Dana on
    // three confirmations: a new version (class semantic) she makes herself.
    const env = fresh(twin());
    const episodic = { ...toSam, class: "episodic" as const };
    const own = item(30, {
      class: "episodic",
      scope: "person:dana",
      owner: dana.id,
      content: "Deploys run on Tuesdays.",
      grants: [episodic],
    } as Partial<MemoryItem>);
    expect((await env.plane.write(dana, own, AT)).event.decision).toBe("allow");
    for (const [n, who] of [
      [31, "person:a"],
      [32, "person:b"],
      [33, "person:c"],
    ] as const) {
      const confirming = item(n, {
        class: "episodic",
        scope: "person:dana",
        owner: who,
        content: "Deploys run on Tuesdays.",
      } as Partial<MemoryItem>);
      const writer: Actor = {
        id: who,
        level: "person",
        memberships: ["person:dana"],
        source: "user",
      };
      expect((await env.plane.write(writer, confirming, AT)).event.decision).toBe("allow");
    }
    const p = await env.plane.promote(dana, id(30), "person:dana", LATER);
    expect(p.event.decision).toBe("allow");
    expect(p.item?.grants).toEqual([episodic]);
    expect(p.event.reason).not.toContain("is not carried");
  });

  // Item 35 (ADR 0034, decision 6, accepted 2026-11-25; card E2.21): the owner's
  // class-changing promotion keeps the grant, which then admits nothing, since
  // a grant admits reads of its own class only. Through the real Plane.promote
  // and the grantee's own Plane.read, not only through the oracle.
  test("item 35: after the owner's class-changing promotion, the kept grant admits the grantee nothing", async () => {
    const env = fresh(twin());
    const episodic = { ...toSam, class: "episodic" as const };
    const content = "Deploys run on Tuesdays.";
    const own = item(40, {
      class: "episodic",
      scope: "person:dana",
      owner: dana.id,
      content,
      grants: [episodic],
    } as Partial<MemoryItem>);
    expect((await env.plane.write(dana, own, AT)).event.decision).toBe("allow");
    for (const [n, who] of [
      [41, "person:a"],
      [42, "person:b"],
      [43, "person:c"],
    ] as const) {
      const writer: Actor = {
        id: who,
        level: "person",
        memberships: ["person:dana"],
        source: "user",
      };
      const confirming = item(n, {
        class: "episodic",
        scope: "person:dana",
        owner: who,
        content,
      } as Partial<MemoryItem>);
      expect((await env.plane.write(writer, confirming, AT)).event.decision).toBe("allow");
    }
    // Before: the episodic grant admits Sam to the episodic item, so the
    // check below is not vacuous.
    const before = await env.plane.read(sam, { at: AT });
    expect(before.items.map((i) => i.id)).toEqual([id(40)]);
    const p = await env.plane.promote(dana, id(40), "person:dana", LATER);
    expect(p.event.decision).toBe("allow");
    const promoted = p.item as MemoryItem;
    expect(promoted).toMatchObject({ class: "semantic", owner: dana.id, grants: [episodic] });
    // After: the grant is still on the new version, and admits nothing.
    const after = await env.plane.read(sam, { at: LATER });
    expect(after.items.map((i) => i.id)).not.toContain(promoted.id);
    expect(after.items).toEqual([]);
  });

  test("RV7-R4: a co-holder's status-only rewrite through Plane.write is no promotion", async () => {
    const env = await seeded();
    // No harness source: the provenance stays as claimed, so only status and version differ.
    const sourceless: Actor = { id: lee.id, level: "person", memberships: lee.memberships };
    // The projected item itself (its store_ref set), so nothing but the status and the version differ.
    const retired = rewrite(itemById(env.db, id(1)) as MemoryItem, { status: "retired" });
    const r = await env.plane.write(sourceless, retired, LATER);
    expect(r.event).toMatchObject({ decision: "deny", policy_id: GRANT_OWNER_ID });
  });

  test("RV7-R5: a writer who cannot read the scope learns neither the owner nor that the item carries grants", async () => {
    const env = fresh(twin());
    const it = item(14, { scope: "person:lee", owner: dana.id, content: "Odd.", grants: [toSam] });
    expect((await env.plane.write(lee, it, AT)).event.decision).toBe("allow");
    const roleContext: Actor = {
      id: "agent:lee-role",
      level: "role",
      memberships: ["person:lee", ROLE],
    };
    const r = await env.plane.write(roleContext, rewrite(it, { content: "Edited." }), LATER);
    // The rule id would name the check, so the opaque refusal takes the membership rule's.
    expect(r.event).toMatchObject({ decision: "deny", policy_id: "engram/write/membership" });
    expect(r.event.reason).toContain("an item you cannot access");
    expect(r.event.reason).not.toContain("grant");
    expect(r.event.reason).not.toContain("person:dana");
  });
});

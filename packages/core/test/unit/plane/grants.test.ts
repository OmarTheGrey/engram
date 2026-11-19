// Card E9.4's acceptance in core: a grant change is recorded as an event.
// Plane.changeGrants (ADR 0034, proposed) is a governed write: the owner of
// an item, user-sourced and a member of its scope, adds or removes a grant;
// the gate checks every added grant as the write gate does (ADR 0021,
// decision D4) and records one `update` event with its reason and policy id
// (AGENTS.md rule 3), whatever it decides. An allowed change is a new version
// in place (same id, version plus one), rewritten to the store. Under the
// twin profile (card E9.2), over the fake store, through the real Plane.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { NotDeletableError } from "../../../src/adapter.ts";
import { currentItems, rebuild } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import { type Actor, InvalidCallError } from "../../../src/plane.ts";
import { STORE_FAILURE_ID, WRITE_GRANT_ID } from "../../../src/policy/evaluate.ts";
import {
  GRANT_CHANGE_ID,
  GRANT_EXPIRED_ID,
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  GRANT_STATUS_ID,
  GRANT_UNCHANGED_ID,
} from "../../../src/policy/grants.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { Grant, MemoryItem } from "../../../src/schema.ts";
import { visibleEvents } from "../../../src/visible.ts";
import { fresh, id, item } from "./helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");

const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const UNTIL = "2026-12-19T00:00:00Z";

const dana: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "role:release"],
  source: "user",
};
/** Dana's agent: the same principal, model-sourced (the pi extension sets it). */
const danasAgent: Actor = { ...dana, source: "model" };
const sam: Actor = {
  id: "person:sam",
  level: "person",
  memberships: ["person:sam"],
  source: "user",
};
/** Another holder of the release role. */
const lee: Actor = {
  id: "person:lee",
  level: "person",
  memberships: ["person:lee", "role:release"],
  source: "user",
};

const toSam: Grant = { to: "person:sam", class: "semantic", mode: "read", expires: UNTIL };

/** Dana's person item 1 and her role item 2, written through the plane. */
async function seeded() {
  const env = fresh(twin());
  const write = async (it: MemoryItem) => {
    const { event } = await env.plane.write(dana, it, AT);
    expect(event.decision).toBe("allow");
  };
  await write(item(1, { scope: "person:dana", owner: dana.id, content: "Dana's sister is Mira." }));
  await write(
    item(2, { scope: "role:release", owner: dana.id, content: "The release train leaves at 3." }),
  );
  return env;
}

const readsAs = async (env: Awaited<ReturnType<typeof seeded>>, actor: Actor, at = LATER) =>
  (await env.plane.read(actor, { at })).items.map((i) => i.id);

describe("acceptance (card E9.4): a grant change is recorded as an event", () => {
  test("the owner adds a grant: one update event, a new version in place, the grantee reads it", async () => {
    const env = await seeded();
    expect(await readsAs(env, sam)).toEqual([]);
    const before = env.plane.events().length;
    const writes = env.adapter.writes;

    const result = await env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);

    expect(result.decision).toBe("allow");
    const events = env.plane.events().slice(before);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(result.event);
    expect(result.event).toMatchObject({
      op: "update",
      decision: "allow",
      actor: dana.id,
      item_id: id(1),
      scope_from: "person:dana",
      scope_to: "person:dana",
      policy_id: GRANT_CHANGE_ID,
    });
    expect(result.event.reason).toContain("added grant to person:sam");
    expect(result.event.reason).toContain(`expires ${UNTIL}`);
    // A new version in place: same id, version plus one, the grant on it,
    // and the store holds what the projection holds.
    const now = itemById(env.db, id(1));
    expect(now).toMatchObject({ id: id(1), version: 2, grants: [toSam] });
    expect(result.item).toEqual(now);
    expect(result.event.item).toEqual(now);
    expect(env.adapter.writes).toBe(writes + 1);
    expect(await env.adapter.read(now?.store_ref as NonNullable<MemoryItem["store_ref"]>)).toEqual(
      now,
    );

    const read = await env.plane.read(sam, { at: LATER });
    expect(read.items.map((i) => i.id)).toEqual([id(1)]);
    expect(read.explanations[0]?.grants_used).toEqual(["grants[0]:person:sam"]);
  });

  test("the owner removes it: a second update event, and the grantee reads nothing", async () => {
    const env = await seeded();
    await env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
    const result = await env.plane.changeGrants(dana, id(1), { remove: [toSam] }, LATER);
    expect(result.decision).toBe("allow");
    expect(result.event).toMatchObject({ op: "update", policy_id: GRANT_CHANGE_ID });
    expect(result.event.reason).toContain("removed grant to person:sam");
    expect(itemById(env.db, id(1))).toMatchObject({ version: 3, grants: [] });
    expect(await readsAs(env, sam)).toEqual([]);
  });

  test("a grant expires: the read filter stops honouring it with no further event", async () => {
    const env = await seeded();
    await env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
    expect(await readsAs(env, sam, UNTIL)).toEqual([]);
  });

  test("the update event is visible to the scope's members, not to the grantee", async () => {
    const env = await seeded();
    const { event } = await env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
    const view = {
      policy: env.policy,
      at: LATER,
      current: (i: string) => itemById(env.db, i),
    };
    expect(visibleEvents(dana, env.plane.events(), view).map((e) => e.id)).toContain(event.id);
    expect(visibleEvents(sam, env.plane.events(), view).map((e) => e.id)).not.toContain(event.id);
  });

  test("the projection rebuilt from the log alone is the same after grant changes", async () => {
    const env = await seeded();
    await env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
    await env.plane.changeGrants(
      dana,
      id(2),
      { add: [{ ...toSam, to: "agent:claude-code/*" }] },
      AT,
    );
    await env.plane.changeGrants(dana, id(1), { remove: [toSam] }, LATER);
    const incremental = currentItems(env.db);
    rebuild(env.db);
    expect(currentItems(env.db)).toEqual(incremental);
  });
});

describe("a grant change the gate refuses is one deny event, and nothing changes", () => {
  async function refused(
    actor: Actor,
    itemId: string,
    change: Parameters<ReturnType<typeof fresh>["plane"]["changeGrants"]>[2],
    policyId: string,
    prepare?: (env: Awaited<ReturnType<typeof seeded>>) => Promise<void>,
  ) {
    const env = await seeded();
    await prepare?.(env);
    const items = currentItems(env.db);
    const before = env.plane.events().length;
    const writes = env.adapter.writes;
    const result = await env.plane.changeGrants(actor, itemId, change, AT);
    expect(result.decision).toBe("deny");
    expect(result.item).toBeNull();
    const events = env.plane.events().slice(before);
    expect(events).toEqual([result.event]);
    expect(result.event).toMatchObject({ op: "update", decision: "deny", policy_id: policyId });
    expect(result.event.reason.length).toBeGreaterThan(0);
    expect(currentItems(env.db)).toEqual(items);
    expect(env.adapter.writes).toBe(writes);
    return result;
  }

  test("an actor who is not a member of the item's scope learns nothing about it", async () => {
    const hidden = await refused(sam, id(1), { add: [toSam] }, GRANT_OWNER_ID);
    expect(hidden.event).toMatchObject({ scope_from: null, scope_to: null });
    // An unknown id reads the same.
    const unknown = await refused(sam, id(77), { add: [toSam] }, GRANT_OWNER_ID);
    expect(unknown.event.reason).toBe(hidden.event.reason.replace(id(1), id(77)));
    expect(hidden.event.reason).not.toContain("dana");
  });

  test("a member who is not the owner may not change the grants", async () => {
    const result = await refused(lee, id(2), { add: [toSam] }, GRANT_OWNER_ID);
    expect(result.event.reason).toContain("only its owner person:dana");
  });

  test("an agent acting for the owner may not change the grants", async () => {
    await refused(danasAgent, id(1), { add: [toSam] }, GRANT_SOURCE_ID);
  });

  test("a grant too wide, with no class or with no expiry is refused under the write gate's rule", async () => {
    await refused(dana, id(1), { add: [{ ...toSam, to: "*" }] }, WRITE_GRANT_ID);
    await refused(dana, id(1), { add: [{ ...toSam, to: "person:*" }] }, WRITE_GRANT_ID);
    const { class: _c, ...noClass } = toSam;
    await refused(dana, id(1), { add: [noClass] }, WRITE_GRANT_ID);
    const { expires: _e, ...noExpiry } = toSam;
    const r = await refused(dana, id(1), { add: [noExpiry] }, WRITE_GRANT_ID);
    expect(r.event.reason).toContain("has no expiry");
  });

  test("a grant that has already expired is refused", async () => {
    await refused(dana, id(1), { add: [{ ...toSam, expires: AT }] }, GRANT_EXPIRED_ID);
  });

  test("model content carries no grants", async () => {
    await refused(dana, id(3), { add: [toSam] }, WRITE_GRANT_ID, async (env) => {
      const { event } = await env.plane.write(
        danasAgent,
        item(3, { scope: "person:dana", owner: dana.id, content: "Dana seemed tired." }),
        AT,
      );
      expect(event.decision).toBe("allow");
    });
  });

  test("removing a grant the item does not carry, or adding one it does, changes nothing", async () => {
    await refused(dana, id(1), { remove: [toSam] }, GRANT_UNCHANGED_ID);
    await refused(dana, id(1), { add: [toSam] }, GRANT_UNCHANGED_ID, async (env) => {
      await env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
    });
  });

  test("a retired item's grants are not changed", async () => {
    await refused(dana, id(1), { add: [toSam] }, GRANT_STATUS_ID, async (env) => {
      const r = await env.plane.write(
        dana,
        item(1, { scope: "person:dana", owner: dana.id, status: "retired", version: 2 }),
        AT,
      );
      expect(r.event.decision).toBe("allow");
    });
  });
});

describe("calls no event could record are refused before the log is touched", () => {
  test.each([
    ["an invalid actor", { id: "" } as unknown as Actor, id(1), { add: [toSam] }, AT],
    ["an invalid time", dana, id(1), { add: [toSam] }, "yesterday"],
    ["an invalid item id", dana, "not-an-id", { add: [toSam] }, AT],
    ["an empty change", dana, id(1), {}, AT],
    ["a malformed grant", dana, id(1), { add: [{ to: "person:sam" }] }, AT],
  ])("%s", async (_name, actor, itemId, change, at) => {
    const env = await seeded();
    const before = env.plane.events().length;
    await expect(
      env.plane.changeGrants(actor as Actor, itemId as string, change as never, at as string),
    ).rejects.toBeInstanceOf(InvalidCallError);
    expect(env.plane.events()).toHaveLength(before);
  });
});

describe("the store", () => {
  test("a store failure after the gate allowed is one deny event, and the call throws", async () => {
    const env = await seeded();
    env.adapter.fault = async () => {
      throw new Error("disk full");
    };
    const before = env.plane.events().length;
    await expect(env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT)).rejects.toThrow(
      "disk full",
    );
    const events = env.plane.events().slice(before);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      op: "update",
      decision: "deny",
      policy_id: STORE_FAILURE_ID,
    });
    expect(events[0]?.reason).toContain("disk full");
    expect(itemById(env.db, id(1))).toMatchObject({ version: 1, grants: [] });
  });

  test("a store that refuses for good to rewrite the record is a deny decision, not an error", async () => {
    const env = await seeded();
    env.adapter.fault = async () => {
      throw new NotDeletableError("read-only record");
    };
    const result = await env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
    expect(result).toMatchObject({ decision: "deny", item: null });
    expect(result.event).toMatchObject({ op: "update", policy_id: STORE_FAILURE_ID });
    expect(result.event.reason).toContain("read-only record");
    expect(itemById(env.db, id(1))).toMatchObject({ version: 1, grants: [] });
  });
});

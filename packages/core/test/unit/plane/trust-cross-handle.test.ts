// Card E2.11, review E2.11-4: under trust.protect_trusted a write's and a
// promotion's budget refusal is asked again in the transaction that commits
// them, against a writer on another handle over the same log (two real
// connections, on SQLite and on embedded Postgres, as in cross-handle.test.ts).
// The first handle is paused at its store write, after its decision; the
// second lands a user item that fills the budget; the first is then refused
// (engram/write/downgrade), the store is put back, and no budget is exceeded.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Adapter } from "../../../src/adapter.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { allEvents, currentItems } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import { type Actor, createPlane } from "../../../src/plane.ts";
import { DOWNGRADE_ID } from "../../../src/policy/trust.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { type Backend, forEachBackend } from "../../db/backends.ts";
import { AT, id, item, testPolicy } from "./helpers.ts";

const KINDS = ["user", "document", "tool", "model", "import", "compaction", "external"] as const;
const SCOPE = "person:alice";
const LATER = "2026-10-25T13:00:00Z";
const BUDGET = 1;

const POLICY: Policy = {
  ...testPolicy({
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
    retention: [
      { scope: "person", class: "episodic", ttl: null, budget: BUDGET, eviction: "recency" },
      { scope: "person", class: "semantic", ttl: null, budget: BUDGET, eviction: "recency" },
    ],
  }),
  promotion: {
    episodic_to_semantic: { confirmations: 1, or_review: true },
    procedural: { replay_k: 4, replay_n: 5 },
  },
  trust: { unattested_floor: "on", protect_trusted: "on" },
};

const as = (source: (typeof KINDS)[number], who = SCOPE): Actor => ({
  id: who,
  level: "person",
  memberships: [SCOPE],
  source,
});

/** The first handle's adapter: its next store write waits until released. */
function pausable(store: Adapter) {
  let hold: { arrive: () => void; gate: Promise<void> } | null = null;
  const adapter: Adapter = Object.assign(Object.create(store) as Adapter, {
    write: async (it: MemoryItem) => {
      const h = hold;
      hold = null;
      if (h) {
        h.arrive();
        await h.gate;
      }
      return store.write(it);
    },
  });
  const pause = () => {
    let arrive = () => {};
    let release = () => {};
    const arrived = new Promise<void>((r) => {
      arrive = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    hold = { arrive, gate };
    return { arrived, release };
  };
  return { adapter, pause };
}

function setup(backend: Backend) {
  const [mine, theirs] = backend.pair();
  migrate(mine);
  const store = createFakeAdapter({ history: false });
  const a = pausable(store);
  let n = 0;
  const plane = createPlane({
    db: mine,
    adapter: a.adapter,
    policy: POLICY,
    newId: () => id(800_000 + ++n),
  });
  const planeTheirs = createPlane({
    db: theirs,
    adapter: store,
    policy: POLICY,
    newId: () => id(700_000 + ++n),
  });
  return { mine, store, a, plane, planeTheirs };
}

const activeOf = (db: Parameters<typeof currentItems>[0], cls: MemoryItem["class"]) =>
  currentItems(db).filter((i) => i.scope === SCOPE && i.class === cls && i.status === "active");

forEachBackend((backend) => {
  describe("E2.11 the budget refusal against another handle", () => {
    test("a model write decided into a free slot is refused at its commit once the other handle lands a user item there", async () => {
      const env = setup(backend);
      const held = env.a.pause();
      const write = env.plane.write(
        as("model", "agent:helper"),
        item(2, {
          scope: SCOPE,
          owner: "agent:helper",
          class: "episodic",
          content: "the agent's note",
        }),
        LATER,
      );
      await held.arrived;
      const theirs = await env.planeTheirs.write(
        as("user"),
        item(1, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "alice's note" }),
        AT,
      );
      expect(theirs.event.decision).toBe("allow");
      held.release();
      const r = await write;
      expect(r.event).toMatchObject({ decision: "deny", policy_id: DOWNGRADE_ID });
      expect(r.event.reason).toContain("before it was committed");
      expect(activeOf(env.mine, "episodic").length).toBeLessThanOrEqual(BUDGET);
      expect(itemById(env.mine, id(1))?.status).toBe("active");
      expect(itemById(env.mine, id(2))).toBeUndefined();
      expect((await env.store.list(SCOPE)).map((i) => i.id)).toEqual([id(1)]);
      expect(allEvents(env.mine).filter((e) => e.op === "evict")).toEqual([]);
    });

    test("a tool promotion decided into a free target is refused at its commit once the other handle lands a user item there", async () => {
      const env = setup(backend);
      const note = await env.plane.write(
        as("tool"),
        item(2, { scope: SCOPE, owner: SCOPE, class: "episodic", content: "a tool note" }),
        AT,
      );
      expect(note.event.decision).toBe("allow");
      const held = env.a.pause();
      const promotion = env.plane.promote(as("tool"), id(2), SCOPE, LATER);
      await held.arrived;
      const theirs = await env.planeTheirs.write(
        as("user"),
        item(1, { scope: SCOPE, owner: SCOPE, content: "alice's fact" }),
        AT,
      );
      expect(theirs.event.decision).toBe("allow");
      held.release();
      const r = await promotion;
      expect(r.event).toMatchObject({ op: "promote", decision: "deny", policy_id: DOWNGRADE_ID });
      expect(r.event.reason).toContain("before it was committed");
      expect(activeOf(env.mine, "semantic").map((i) => i.id)).toEqual([id(1)]);
      expect(itemById(env.mine, id(2))?.status).toBe("active");
      expect(allEvents(env.mine).filter((e) => e.op === "evict")).toEqual([]);
    });
  });
});

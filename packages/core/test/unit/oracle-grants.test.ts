// The oracle's replay and its reading of grant changes (card E9.5), which the
// twin dogfood's violation report judges a member's log with
// (packages/core/src/oracle.ts). Hand-built items and events, no Plane.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import {
  grantChangeProblem,
  grantsChanged,
  grantsWiden,
  priorVersion,
  replayEvent,
  withinValidity,
} from "../../src/oracle.ts";
import { parsePolicy } from "../../src/policy/load.ts";
import type { Grant, MemoryEvent, MemoryItem } from "../../src/schema.ts";

const TWIN = parsePolicy(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../pi-package/profiles/twin.yaml"),
    "utf8",
  ),
  "twin.yaml",
);
const DANA: Actor = { id: "person:dana", level: "person", memberships: ["person:dana"] };

const id = (n: number) => `01980000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const toSam: Grant = {
  to: "person:sam",
  class: "semantic",
  mode: "read",
  expires: "2026-12-19T00:00:00Z",
};
const toLee: Grant = { ...toSam, to: "person:lee" };

function item(over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(1),
    class: "semantic",
    scope: "person:dana",
    owner: "person:dana",
    content: "a fact",
    provenance: {
      kind: "user",
      ref: "cli",
      hash: `sha256:${"0".repeat(64)}`,
      actor: "person:dana",
    },
    confidence: 0.9,
    valid_from: "2026-11-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    ...over,
  } as MemoryItem;
}

let seq = 0;
function event(over: Partial<MemoryEvent>): MemoryEvent {
  return {
    id: id(100 + seq),
    seq: seq++,
    ts: "2026-11-20T09:00:00Z",
    op: "write",
    item_id: id(1),
    actor: "person:dana",
    scope_from: "person:dana",
    scope_to: "person:dana",
    decision: "allow",
    reason: "test",
    policy_id: "profile.twin/write/person",
    schema_version: 1,
    ...over,
  } as MemoryEvent;
}

describe("grantsChanged", () => {
  test("a first item without grants changes nothing; one carrying a grant does", () => {
    expect(grantsChanged(undefined, item())).toBe(false);
    expect(grantsChanged(undefined, item({ grants: [toSam] }))).toBe(true);
  });

  test("grants compared as multisets, the expiry as an instant", () => {
    const before = item({ grants: [toSam, toLee] });
    expect(grantsChanged(before, item({ grants: [toLee, toSam] }))).toBe(false);
    expect(
      grantsChanged(
        before,
        item({ grants: [toLee, { ...toSam, expires: "2026-12-19T00:00:00.000Z" }] }),
      ),
    ).toBe(false);
    expect(grantsChanged(before, item({ grants: [toSam] }))).toBe(true);
    expect(grantsChanged(before, item({ grants: [toSam, toSam] }))).toBe(true);
    expect(grantsChanged(before, item({ grants: [toSam, { ...toLee, mode: "read_write" }] }))).toBe(
      true,
    );
  });

  test("a class change switches what kept grants admit only when there are grants", () => {
    expect(grantsChanged(item(), item({ class: "episodic" }))).toBe(false);
    expect(
      grantsChanged(item({ grants: [toSam] }), item({ grants: [toSam], class: "episodic" })),
    ).toBe(true);
  });
});

describe("grantChangeProblem", () => {
  const before = item();
  const granted = item({ grants: [toSam], version: 2 });
  const change = (over: Partial<MemoryEvent> = {}, it: MemoryItem = granted) =>
    event({ op: "update", policy_id: "engram/grant/change", item: it, ...over });
  const judge = (e: MemoryEvent, prior: MemoryItem | undefined = before, held = false) =>
    grantChangeProblem(TWIN, DANA, prior, e, held);

  test("the owner's grant change event, and no one else's", () => {
    expect(judge(change())).toBeUndefined();
    expect(judge(change({ actor: "person:sam" }))).toMatch(/other than its owner/);
  });

  test("the owner's own write, user or import sourced, and no other", () => {
    const write = (kind: MemoryItem["provenance"]["kind"], actor = "person:dana") =>
      event({ actor, item: { ...granted, provenance: { ...granted.provenance, kind } } });
    expect(judge(write("user"))).toBeUndefined();
    expect(judge(write("import"))).toBeUndefined();
    expect(judge(write("model"))).toMatch(/recorded as model/);
    expect(judge(write("tool"))).toMatch(/recorded as tool/);
    expect(judge(write("user", "person:lee"))).toMatch(/other than its owner/);
  });

  test("the owner is the prior version's; a first write is judged as a write by its writer", () => {
    const stolen = event({ actor: "person:lee", item: { ...granted, owner: "person:lee" } });
    expect(judge(stolen)).toMatch(/other than its owner/);
    // A first write names its owner (ADR 0006), but the writer must be a member of the scope.
    const lee: Actor = { id: "person:lee", level: "person", memberships: ["person:lee"] };
    expect(grantChangeProblem(TWIN, lee, undefined, stolen, false)).toMatch(/forbids/);
    expect(
      grantChangeProblem(TWIN, DANA, undefined, event({ item: granted }), false),
    ).toBeUndefined();
  });

  test("a handover or a promotion that widens is not permitted; one that narrows is", () => {
    const handover = change({ policy_id: "engram/offboard/handover" });
    const promotion = event({
      op: "promote",
      policy_id: "profile.twin/promotion/review",
      item: granted,
    });
    expect(judge(handover)).toMatch(/update event/);
    expect(judge(promotion)).toMatch(/promote event/);
    // The plane's promotion of an episodic item: the new semantic version keeps an episodic grant, switched off.
    const episodic = item({ class: "episodic", grants: [{ ...toSam, class: "episodic" }] });
    const promoted = { ...episodic, id: id(2), class: "semantic" as const, lineage: [id(1)] };
    const byReviewer = event({
      op: "promote",
      actor: "person:lee",
      item_id: id(2),
      item: promoted,
    });
    expect(grantsChanged(episodic, promoted)).toBe(true);
    expect(grantsWiden(episodic, promoted)).toBe(false);
    expect(grantChangeProblem(TWIN, DANA, episodic, byReviewer, false)).toBeUndefined();
  });

  test("what a grant change adds: the gate's grant rule, the item's class, unexpired, once", () => {
    for (const g of [
      { ...toSam, to: "person:*" },
      { ...toSam, to: "*" },
      { to: "person:sam", mode: "read" } as Grant,
      { to: "person:sam", class: "semantic", mode: "read" } as Grant,
    ])
      expect(judge(change({}, item({ grants: [g] })))).toMatch(/gate refuses/);
    expect(judge(change({}, item({ grants: [{ ...toSam, class: "episodic" }] })))).toMatch(
      /another class/,
    );
    expect(
      judge(change({}, item({ grants: [{ ...toSam, expires: "2026-11-01T00:00:00Z" }] }))),
    ).toMatch(/expired/);
    expect(judge(change({}, item({ grants: [toSam, toSam] })))).toMatch(/twice/);
    expect(judge(change({}, item({ grants: [{ ...toSam, to: "person:sa*" }] })))).toBeUndefined();
  });

  test("no grant on untrusted content, or on an item that once held it", () => {
    const model = { ...granted, provenance: { ...granted.provenance, kind: "model" as const } };
    expect(judge(change({}, model), { ...before, provenance: model.provenance })).toMatch(
      /model content/,
    );
    expect(judge(change(), before, true)).toMatch(/held untrusted/);
    // A removal from such an item is not an addition.
    expect(judge(change({}, item({ version: 3 })), granted, true)).toBeUndefined();
  });

  test("a grant change touches only an active item's grants and version", () => {
    expect(judge(change(), { ...before, status: "retired" })).toMatch(/retired item/);
    expect(grantChangeProblem(TWIN, DANA, undefined, change(), false)).toMatch(
      /no allowed event left/,
    );
    expect(judge(change({}, { ...granted, content: "another fact" } as MemoryItem))).toMatch(
      /more than grants/,
    );
  });

  test("a class change keeps no grant of another class", () => {
    const g = { ...toSam, class: "semantic" as const };
    const reclassed = item({ class: "episodic", grants: [g], version: 3 });
    expect(judge(event({ item: reclassed }), item({ grants: [g] }))).toMatch(
      /across a class change/,
    );
  });
});

describe("grantsWiden and withinValidity", () => {
  test("longer expiry, a new principal and a class change switching a grant on widen", () => {
    const g = toSam;
    expect(
      grantsWiden(
        item({ grants: [g] }),
        item({ grants: [{ ...g, expires: "2027-01-01T00:00:00Z" }] }),
      ),
    ).toBe(true);
    expect(
      grantsWiden(
        item({ grants: [g] }),
        item({ grants: [{ ...g, expires: "2026-12-01T00:00:00Z" }] }),
      ),
    ).toBe(false);
    expect(grantsWiden(item({ grants: [g] }), item({ grants: [g, toLee] }))).toBe(true);
    expect(grantsWiden(item({ grants: [g] }), item())).toBe(false);
    const dormant = { ...g, class: "episodic" as const };
    expect(
      grantsWiden(item({ grants: [dormant] }), item({ class: "episodic", grants: [dormant] })),
    ).toBe(true);
    expect(grantsWiden(item({ grants: [{ ...g, to: "person:sa*" }] }), item({ grants: [g] }))).toBe(
      false,
    );
  });

  test("valid_from <= at < valid_to", () => {
    const it = item({ valid_from: "2026-11-01T00:00:00Z", valid_to: "2026-11-10T00:00:00Z" });
    expect(withinValidity(it, "2026-10-31T23:59:59Z")).toBe(false);
    expect(withinValidity(it, "2026-11-01T00:00:00Z")).toBe(true);
    expect(withinValidity(it, "2026-11-09T23:59:59.999Z")).toBe(true);
    expect(withinValidity(it, "2026-11-10T00:00:00Z")).toBe(false);
    expect(withinValidity(item(), "2099-01-01T00:00:00Z")).toBe(true);
  });
});

describe("replayEvent and priorVersion", () => {
  test("allowed changes set, retirements retire, an erasure removes, a denial does nothing", () => {
    const state = new Map<string, MemoryItem>();
    replayEvent(state, event({ item: item() }));
    expect(state.get(id(1))?.status).toBe("active");
    replayEvent(state, event({ decision: "deny", item: item({ content: "denied" }) }));
    expect(state.get(id(1))?.content).toBe("a fact");
    replayEvent(state, event({ op: "retire", policy_id: "engram/retention/item-ttl" }));
    expect(state.get(id(1))?.status).toBe("retired");
    replayEvent(state, event({ op: "retire", policy_id: "engram/offboard/erase" }));
    expect(state.has(id(1))).toBe(false);
    replayEvent(state, event({ op: "read", item_id: null, item_ids: [id(1)] }));
    expect(state.size).toBe(0);
  });

  test("a promotion's new version is compared with its source", () => {
    const state = new Map<string, MemoryItem>([[id(1), item({ grants: [toSam] })]]);
    const promoted = item({ id: id(2), lineage: [id(1)], grants: [toSam], version: 2 });
    const e = event({ op: "promote", item_id: id(2), item: promoted });
    expect(priorVersion(state, e)?.id).toBe(id(1));
    expect(grantsChanged(priorVersion(state, e), promoted)).toBe(false);
    expect(
      priorVersion(state, event({ item_id: id(3), item: item({ id: id(3), lineage: [id(1)] }) })),
    ).toBe(undefined);
    expect(priorVersion(state, event({ item: item() }))?.id).toBe(id(1));
  });
});

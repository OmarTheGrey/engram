// The oracle's replay and its reading of grant changes (card E9.5), which the
// twin dogfood's violation report judges a member's log with
// (packages/core/src/oracle.ts). Hand-built items and events, no Plane.
import { describe, expect, test } from "vitest";
import {
  grantChangePermitted,
  grantsChanged,
  priorVersion,
  replayEvent,
} from "../../src/oracle.ts";
import type { Grant, MemoryEvent, MemoryItem } from "../../src/schema.ts";

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

describe("grantChangePermitted", () => {
  const before = item();
  const granted = item({ grants: [toSam], version: 2 });

  test("the owner's grant change event", () => {
    const e = event({ op: "update", policy_id: "engram/grant/change", item: granted });
    expect(grantChangePermitted(before, e)).toBe(true);
    expect(grantChangePermitted(before, { ...e, actor: "person:sam" })).toBe(false);
  });

  test("the owner's own write, user or import sourced, and no other", () => {
    const write = (kind: MemoryItem["provenance"]["kind"], actor = "person:dana") =>
      event({ actor, item: { ...granted, provenance: { ...granted.provenance, kind } } });
    expect(grantChangePermitted(before, write("user"))).toBe(true);
    expect(grantChangePermitted(before, write("import"))).toBe(true);
    expect(grantChangePermitted(before, write("model"))).toBe(false);
    expect(grantChangePermitted(before, write("tool"))).toBe(false);
    expect(grantChangePermitted(before, write("user", "person:lee"))).toBe(false);
  });

  test("the owner is the prior version's, not the one the event names", () => {
    const stolen = event({ actor: "person:lee", item: { ...granted, owner: "person:lee" } });
    expect(grantChangePermitted(before, stolen)).toBe(false);
    // A first write is judged by the owner it names (ADR 0006).
    expect(grantChangePermitted(undefined, stolen)).toBe(true);
  });

  test("any other operation that changes grants is not permitted", () => {
    const handover = event({ op: "update", policy_id: "engram/offboard/handover", item: granted });
    const promotion = event({
      op: "promote",
      policy_id: "profile.twin/promotion/review",
      item: granted,
    });
    expect(grantChangePermitted(before, handover)).toBe(false);
    expect(grantChangePermitted(before, promotion)).toBe(false);
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

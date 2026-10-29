import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import {
  appendEvent,
  currentItems,
  eventById,
  eventsByActor,
  eventsByItem,
  eventsByScope,
} from "../../src/events.ts";
import type { MemoryItem } from "../../src/schema.ts";
import { forEachBackend } from "../db/backends.ts";

const ITEM: MemoryItem = {
  id: "01920000-0000-7000-8000-000000000001",
  class: "semantic",
  scope: "team:platform",
  owner: "person:omar",
  content: "Deploys happen on Tuesdays.",
  provenance: {
    kind: "user",
    ref: "doc/1",
    hash: `sha256:${"ab".repeat(32)}`,
    actor: "person:omar",
  },
  confidence: 0.9,
  valid_from: "2026-10-22T09:00:00Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: null,
  schema_version: 0,
};

const write = (n: number, actor = "agent:pi") => ({
  id: `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`,
  ts: "2026-10-22T09:00:00Z",
  op: "write" as const,
  item_id: ITEM.id,
  actor,
  scope_from: null,
  scope_to: "team:platform",
  decision: "allow" as const,
  reason: "allowed",
  policy_id: "p/write",
  item: ITEM,
  schema_version: 0 as const,
});

forEachBackend((backend) => {
  let db: Db;
  beforeEach(() => {
    db = backend.open();
    migrate(db);
  });
  afterEach(() => db.close());

  describe("appendEvent", () => {
    test("assigns a dense sequence starting at zero", () => {
      expect([1, 2, 3].map((n) => appendEvent(db, write(n)).seq)).toEqual([0, 1, 2]);
    });

    test("rejects an event that does not parse as a MemoryEvent", () => {
      expect(() => appendEvent(db, { ...write(1), op: "upsert" } as never)).toThrow();
      expect(eventsByItem(db, ITEM.id)).toEqual([]);
    });

    test("updates the item projection in the same transaction", () => {
      appendEvent(db, write(1));
      expect(currentItems(db)).toEqual([ITEM]);
    });

    test("rejects an allowed write that carries no item, which replay could not reproduce", () => {
      expect(() => appendEvent(db, { ...write(1), item: null })).toThrow(/carries no item/);
      expect(currentItems(db)).toEqual([]);
    });

    test("rejects an event whose item_id differs from the item it carries", () => {
      expect(() =>
        appendEvent(db, { ...write(1), item_id: "01920000-0000-7000-8000-000000000099" }),
      ).toThrow(/item_id/);
    });

    test("leaves the projection alone for a denied write", () => {
      appendEvent(db, { ...write(1), decision: "deny", item: null });
      expect(currentItems(db)).toEqual([]);
    });
  });

  describe("queries", () => {
    test("by item, by actor and by scope return events in sequence order", () => {
      appendEvent(db, write(1, "agent:pi"));
      appendEvent(db, write(2, "person:sara"));
      appendEvent(db, {
        ...write(3),
        item_id: null,
        scope_to: null,
        scope_from: "org",
        item: null,
        op: "read",
      });
      expect(eventsByItem(db, ITEM.id).map((e) => e.seq)).toEqual([0, 1]);
      expect(eventsByActor(db, "person:sara").map((e) => e.seq)).toEqual([1]);
      expect(eventsByScope(db, "team:platform").map((e) => e.seq)).toEqual([0, 1]);
      expect(eventsByScope(db, "org").map((e) => e.seq)).toEqual([2]);
      const second = eventsByActor(db, "person:sara")[0];
      expect(second && eventById(db, second.id)).toEqual(second);
      expect(eventById(db, "01920000-0000-7000-8000-999999999999")).toBeNull();
    });
  });
});

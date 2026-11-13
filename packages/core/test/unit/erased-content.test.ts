// erasedStoreContent (rechecks of PR #41): the content hashes an item's erase
// event names for its record left in a store, which adoption refuses for that
// item only. Only allowed erase events count; any other event naming the
// clause does not, and another item's erase event does not.
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import {
  appendEvent,
  ERASURE_ID,
  type EventInput,
  erasedStoreContent,
  LEFT_CONTENT_CLAUSE,
} from "../../src/events.ts";

const id = (n: number) => `01990000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const H1 = `sha256:${"1".repeat(64)}`;
const H2 = `sha256:${"2".repeat(64)}`;
const H3 = `sha256:${"3".repeat(64)}`;

const retire = (n: number, over: Partial<EventInput>): EventInput => ({
  id: id(100 + n),
  ts: "2026-10-25T12:00:00.000Z",
  op: "retire",
  item_id: id(n),
  actor: "person:dana",
  scope_from: "person:dana",
  scope_to: null,
  decision: "allow",
  reason: "r",
  policy_id: ERASURE_ID,
  schema_version: 1,
  ...over,
});

describe("erasedStoreContent", () => {
  test("collects the hashes an item's allowed erase events name, and nothing else", () => {
    const db = openSqlite(":memory:");
    migrate(db);
    expect(erasedStoreContent(db, id(1))).toEqual(new Set());
    appendEvent(db, retire(1, { reason: `erased; ${LEFT_CONTENT_CLAUSE} (${H1}, ${H2})` }));
    appendEvent(db, retire(2, { reason: "erased with person:dana: deleted from the store" }));
    appendEvent(
      db,
      retire(3, { reason: `${LEFT_CONTENT_CLAUSE} (${H3})`, policy_id: "test/retire" }),
    );
    appendEvent(
      db,
      retire(4, { reason: `${LEFT_CONTENT_CLAUSE} (${H3})`, decision: "deny", policy_id: "x/y" }),
    );
    expect(erasedStoreContent(db, id(1))).toEqual(new Set([H1, H2]));
    // Another item's hashes never count for this one, even an erased one's.
    appendEvent(db, retire(5, { reason: `erased; ${LEFT_CONTENT_CLAUSE} (${H3})` }));
    expect(erasedStoreContent(db, id(1))).toEqual(new Set([H1, H2]));
    expect(erasedStoreContent(db, id(5))).toEqual(new Set([H3]));
    for (const n of [2, 3, 4]) expect(erasedStoreContent(db, id(n))).toEqual(new Set());
  });
});

// A read and an erasure committed by another process sharing the log
// (recheck of PR #41, cards E2.2 and E9.7). The other process commits just
// before this read's transaction takes the log's lock, after the read took
// its snapshot and searched the store. The read must come out exactly as if
// it had run after the erasure: no short read under a limit, no relevance
// computed against the erased item, and no query whose bound parameters grow
// with the size of the read.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { appendEvent, ERASURE_ID } from "../../../src/events.ts";
import { parseReadReason } from "../../../src/plane/read-reason.ts";
import { type Actor, createPlane, type PlaneDeps } from "../../../src/plane.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { sqliteBackend } from "../../db/backends.ts";
import { AT, id, item, testPolicy } from "./helpers.ts";

const omar: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:platform"],
  source: "user",
};

/** A log file opened twice; `theirs` is the other process. Items written through the plane on `mine`. */
async function shared(items: MemoryItem[], retrieval?: PlaneDeps["retrieval"]) {
  const [mine, theirs] = sqliteBackend.pair();
  migrate(mine);
  let n = 0;
  const deps: PlaneDeps = {
    db: mine,
    adapter: createFakeAdapter(),
    policy: testPolicy(),
    newId: () => id(900_000 + ++n),
    ...(retrieval ? { retrieval } : {}),
  };
  const plane = createPlane(deps);
  for (const it of items) {
    const { event } = await plane.write(omar, it, AT);
    expect(event.decision, event.reason).toBe("allow");
  }
  return { mine, theirs, deps };
}

/** `mine`, with the other process erasing `victim` just before the next transaction begins. */
function erasingBefore(mine: Db, theirs: Db, victim: string): Db {
  let armed = true;
  return {
    ...mine,
    transaction: (fn) => {
      if (armed) {
        armed = false;
        appendEvent(theirs, {
          id: id(800_000),
          ts: AT,
          op: "retire",
          item_id: victim,
          actor: "person:omar",
          scope_from: "team:platform",
          scope_to: null,
          decision: "allow",
          reason: "erased by another process",
          policy_id: ERASURE_ID,
          schema_version: 1,
        });
      }
      return mine.transaction(fn);
    },
  };
}

const release = (n: number, confidence: number) =>
  item(n, { content: `release note ${n}`, confidence });

describe("a read racing an erasure committed by another process", () => {
  test("under a read limit returns the next item and counts the cut over the survivors", async () => {
    const { mine, theirs, deps } = await shared(
      [release(1, 0.95), release(2, 0.8), release(3, 0.6)],
      { pipeline: "core", limit: 1 },
    );
    const plane = createPlane({ ...deps, db: erasingBefore(mine, theirs, id(1)) });
    const read = await plane.read(omar, { text: "release", at: AT });
    expect(read.items.map((i) => i.id)).toEqual([id(2)]);
    const counts = parseReadReason(read.event.reason);
    expect(counts).toMatchObject({ returned: 1, candidates: 2, cut: 1 });
  });

  test("scores the survivors as a read issued after the erasure does", async () => {
    const { mine, theirs, deps } = await shared([
      release(1, 0.95),
      release(2, 0.8),
      release(3, 0.6),
    ]);
    const racing = await createPlane({ ...deps, db: erasingBefore(mine, theirs, id(1)) }).read(
      omar,
      { text: "release", at: AT },
    );
    const after = await createPlane(deps).read(omar, { text: "release", at: AT });
    expect(racing.items.map((i) => i.id)).toEqual(after.items.map((i) => i.id));
    expect(racing.explanations).toEqual(after.explanations);
    expect(racing.event.reason).toBe(after.event.reason);
  });

  test("binds no parameter per item when it re-checks the projection", async () => {
    const many = Array.from({ length: 300 }, (_, i) => release(i + 1, 0.9));
    const { mine, deps } = await shared(many);
    let most = 0;
    const counting: Db = {
      ...mine,
      prepare: (sql) => {
        const statement = mine.prepare(sql);
        return {
          ...statement,
          all: (...params) => {
            most = Math.max(most, params.length);
            return statement.all(...params);
          },
          get: (...params) => {
            most = Math.max(most, params.length);
            return statement.get(...params);
          },
          run: (...params) => {
            most = Math.max(most, params.length);
            return statement.run(...params);
          },
        };
      },
    };
    const read = await createPlane({ ...deps, db: counting }).read(omar, { at: AT });
    expect(read.items).toHaveLength(300);
    expect(most).toBeLessThan(20);
  });
});

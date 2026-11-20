// Card RV5, finding RV-SRF-2: a read's own time and the time its validity
// windows are judged at are two things. Status, ttl and grants are judged at
// the read's `at`, its event's ts; `valid_at` moves the validity window only,
// and the reason records it. The twin dogfood's report judges a read at its
// ts and its validity at the recorded `valid_at`, so a backdated read is not
// a way past a grant's expiry, and an honest one is not a false violation.

import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, it } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { dogfoodReport } from "../../../src/dogfood.ts";
import { appendEvent } from "../../../src/events.ts";
import { parseReadReason, readValidAt } from "../../../src/plane/read-reason.ts";
import { accessTime, createPlane, InvalidCallError } from "../../../src/plane.ts";
import { forEachBackend } from "../../db/backends.ts";
import { fresh, id, item, testPolicy } from "./helpers.ts";

const OMAR: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:platform"],
  source: "user",
};
const SAM: Actor = { id: "person:sam", level: "person", memberships: [] };
const NOW = "2026-10-29T12:00:00Z";

describe("a read's valid_at", () => {
  it("cannot bring back what a grant's expiry closed at the read's time", async () => {
    const { plane, policy } = fresh();
    const expires = "2026-10-29T11:50:00Z";
    const granted = item(1, {
      scope: "person:omar",
      grants: [{ to: "person:sam", mode: "read", class: "semantic", expires }],
    });
    expect((await plane.write(OMAR, granted, "2026-10-29T11:00:00Z")).event.decision).toBe("allow");
    const before = await plane.read(SAM, { at: "2026-10-29T11:49:30Z" });
    expect(before.items.map((i) => i.id)).toEqual([granted.id]);
    const backdated = await plane.read(SAM, { at: NOW, valid_at: "2026-10-29T11:49:30Z" });
    expect(backdated.items).toEqual([]);
    expect(backdated.event.ts).toBe(NOW);
    expect(readValidAt(backdated.event)).toBe("2026-10-29T11:49:30Z");
    const { report } = dogfoodReport(plane.events(), policy, [SAM]);
    expect(report.reads).toMatchObject({ events: 2, items_returned: 1 });
    expect(report.violations.total).toBe(0);
  });

  it("moves the validity window, and the report judges validity at it", async () => {
    const { plane, policy } = fresh();
    const past = item(2, { valid_to: "2026-10-15T00:00:00Z" });
    await plane.write(OMAR, past, "2026-10-02T00:00:00Z");
    expect((await plane.read(OMAR, { at: NOW })).items).toEqual([]);
    const then = await plane.read(OMAR, { at: NOW, valid_at: "2026-10-10T00:00:00Z" });
    expect(then.items.map((i) => i.id)).toEqual([past.id]);
    expect(then.explanations[0]?.validity.at).toBe("2026-10-10T00:00:00Z");
    // The counts parse as before; the clause is the reason's last.
    expect(parseReadReason(then.event.reason)?.returned).toBe(1);
    const { report } = dogfoodReport(plane.events(), policy, [OMAR]);
    expect(report.reads.items_returned).toBe(1);
    expect(report.violations.total).toBe(0);
  });

  it("is a ttl's business at the read's time, not at valid_at", async () => {
    const { plane } = fresh();
    const short = item(3, { valid_from: "2026-10-29T11:00:00Z", ttl: 60 });
    await plane.write(OMAR, short, "2026-10-29T11:00:00Z");
    const r = await plane.read(OMAR, { at: NOW, valid_at: "2026-10-29T11:00:30Z" });
    expect(r.items).toEqual([]);
    expect(parseReadReason(r.event.reason)?.expired).toBe(1);
  });

  it("a read without one records none, and an invalid one is refused before the log", async () => {
    const { plane } = fresh();
    expect(readValidAt((await plane.read(OMAR, { at: NOW })).event)).toBeNull();
    await expect(plane.read(OMAR, { at: NOW, valid_at: "yesterday" })).rejects.toThrow(
      InvalidCallError,
    );
    expect(plane.events()).toHaveLength(1);
  });
});

describe("RV-CORE-3: an access decision is never judged before the log's head", () => {
  it("a read named at a time before the last read cannot reopen an expired grant (the review's repro)", async () => {
    const { plane, policy } = fresh();
    const granted = item(4, {
      scope: "person:omar",
      grants: [
        { to: "person:sam", mode: "read", class: "semantic", expires: "2026-12-19T00:00:00Z" },
      ],
    });
    await plane.write(OMAR, granted, "2026-11-01T00:00:00Z");
    const late = await plane.read(SAM, { at: "2027-01-10T00:00:00Z" });
    expect(late.items).toEqual([]);
    // Appended after it, named a month earlier: before RV5 it returned the item.
    const early = await plane.read(SAM, { at: "2026-11-19T00:00:00Z" });
    expect(early.items).toEqual([]);
    expect(early.event.ts).toBe("2027-01-10T00:00:00Z");
    // The named time is kept as history, apart from ts.
    expect(readValidAt(early.event)).toBe("2026-11-19T00:00:00Z");
    const ts = plane.events().map((e) => e.ts);
    expect([...ts].sort()).toEqual(ts);
    const { report } = dogfoodReport(plane.events(), policy, [SAM]);
    expect(report.violations.total).toBe(0);
  });

  it("a read at or after the head is judged at its own time, and records no history", async () => {
    const { plane } = fresh();
    await plane.write(OMAR, item(5), "2026-11-01T00:00:00Z");
    const r = await plane.read(OMAR, { at: "2026-11-02T00:00:00Z" });
    expect(r.event.ts).toBe("2026-11-02T00:00:00Z");
    expect(readValidAt(r.event)).toBeNull();
  });
});

// Review fix pass of PR #59 (RV5-2): the head is the log's latest ts, not the
// ts of its last event. A non-read event appended with an earlier ts (a
// write at a backdated in-process clock) must not move the head back.
forEachBackend((backend) => {
  describe("RV5-2: the log's head is its highest ts, whatever the order of appends", () => {
    function onBackend() {
      const db = backend.open();
      migrate(db);
      let n = 0;
      const policy = testPolicy();
      const plane = createPlane({
        db,
        adapter: createFakeAdapter(),
        policy,
        newId: () => id(950_000 + ++n),
      });
      return { db, plane, policy };
    }

    it("a write with an earlier ts after a late read does not reopen an expired grant (the review's repro)", async () => {
      const { db, plane, policy } = onBackend();
      const granted = item(6, {
        scope: "person:omar",
        grants: [
          { to: "person:sam", mode: "read", class: "semantic", expires: "2026-12-19T00:00:00Z" },
        ],
      });
      await plane.write(OMAR, granted, "2026-11-01T00:00:00Z");
      const late = await plane.read(SAM, { at: "2027-01-10T00:00:00Z" });
      expect(late.items).toEqual([]);
      // A write whose ts is earlier than the head: it is the last event now.
      expect(
        (await plane.write(OMAR, item(7, { scope: "person:omar" }), "2026-11-02T00:00:00Z")).event
          .decision,
      ).toBe("allow");
      expect(accessTime(db, "2026-11-19T00:00:00Z")).toBe("2027-01-10T00:00:00Z");
      const early = await plane.read(SAM, { at: "2026-11-19T00:00:00Z" });
      expect(early.items).toEqual([]);
      expect(early.event.ts).toBe("2027-01-10T00:00:00Z");
      expect(readValidAt(early.event)).toBe("2026-11-19T00:00:00Z");
      const { report } = dogfoodReport(plane.events(), policy, [SAM]);
      expect(report.violations.total).toBe(0);
      db.close();
    });

    it("an append rolled back is not the head, once the log no longer holds it", async () => {
      const { db, plane } = onBackend();
      const { event } = await plane.read(OMAR, { at: "2026-11-01T00:00:00Z" });
      const { seq: _seq, ...input } = event;
      expect(() =>
        db.transaction(() => {
          appendEvent(db, { ...input, id: id(970_001), ts: "2030-01-01T00:00:00Z" });
          expect(accessTime(db, "2026-11-02T00:00:00Z")).toBe("2030-01-01T00:00:00Z");
          throw new Error("rolled back");
        }),
      ).toThrow("rolled back");
      expect(accessTime(db, "2026-11-02T00:00:00Z")).toBe("2026-11-02T00:00:00Z");
      // The next append takes the rolled-back seq; the head follows it.
      appendEvent(db, { ...input, id: id(970_002), ts: "2026-12-01T00:00:00Z" });
      expect(accessTime(db, "2026-11-02T00:00:00Z")).toBe("2026-12-01T00:00:00Z");
      db.close();
    });

    it("the head compares instants, not strings, and follows a second handle's appends", async () => {
      const [a, b] = backend.pair();
      migrate(a);
      let n = 0;
      const deps = {
        adapter: createFakeAdapter(),
        policy: testPolicy(),
        newId: () => id(960_000 + ++n),
      };
      const pa = createPlane({ ...deps, db: a });
      const pb = createPlane({ ...deps, db: b });
      await pa.write(OMAR, item(8), "2026-11-01T00:00:00.5Z");
      expect(accessTime(a, "2026-11-01T00:00:00Z")).toBe("2026-11-01T00:00:00.5Z");
      // Lexically "...00.5Z" sorts after "...01Z"; as instants it is before.
      await pb.write(OMAR, item(9), "2026-11-01T00:00:01Z");
      await pb.write(OMAR, item(10), "2026-10-01T00:00:00Z");
      expect(accessTime(a, "2026-10-01T00:00:00Z")).toBe("2026-11-01T00:00:01Z");
      expect(accessTime(b, "2026-12-01T00:00:00Z")).toBe("2026-12-01T00:00:00Z");
      a.close();
      b.close();
    });
  });
});

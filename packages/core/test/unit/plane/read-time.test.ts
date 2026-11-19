// Card RV5, finding RV-SRF-2: a read's own time and the time its validity
// windows are judged at are two things. Status, ttl and grants are judged at
// the read's `at`, its event's ts; `valid_at` moves the validity window only,
// and the reason records it. The twin dogfood's report judges a read at its
// ts and its validity at the recorded `valid_at`, so a backdated read is not
// a way past a grant's expiry, and an honest one is not a false violation.
import { describe, expect, it } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import { dogfoodReport } from "../../../src/dogfood.ts";
import { parseReadReason, readValidAt } from "../../../src/plane/read-reason.ts";
import { InvalidCallError } from "../../../src/plane.ts";
import { fresh, item } from "./helpers.ts";

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

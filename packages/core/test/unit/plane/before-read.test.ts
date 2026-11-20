// Card RV5, finding RV-SRF-1: syncBeforeRead, the one place that decides
// what runs before a read. The store's scope is swept as its owner only when
// the owner reads, at the clock the surface passes; the store's own memories
// are adopted as its owner whoever reads; the reader is shown the store's
// report only when it is the owner.
import { describe, expect, it } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import { syncBeforeRead } from "../../../src/plane/before-read.ts";
import { loadPreset } from "../../../src/policy/load.ts";
import type { MemoryEvent } from "../../../src/schema.ts";
import { fresh, item } from "./helpers.ts";

const OWNER: Actor = { id: "person:omar", level: "person", memberships: ["person:omar"] };
const STORE_OWNER: Actor = { ...OWNER, source: "import" };
const EVE: Actor = { id: "person:eve", level: "person", memberships: ["person:eve"] };
const WROTE = "2026-10-29T11:00:00Z";
const LATER = "2026-10-29T12:00:00Z";

const retirements = (events: MemoryEvent[]) => events.filter((e) => e.op === "retire");

/** The owner's item, whose own ttl ran out a minute after it was written; a policy that adopts it. */
async function expiring() {
  const f = fresh(loadPreset("medium"));
  const short = item(1, { scope: "person:omar", valid_from: WROTE, ttl: 60 });
  await f.plane.write({ ...OWNER, source: "user" }, short, WROTE);
  const store = { deps: f.deps, scope: "person:omar", owner: STORE_OWNER };
  return { ...f, store, short };
}

describe("syncBeforeRead", () => {
  it("sweeps nothing for a reader who is not the store's owner, and shows it nothing of the store", async () => {
    const { plane, store } = await expiring();
    const { report, forReader } = await syncBeforeRead(plane, { reader: EVE, now: LATER, store });
    expect(report.sweeps).toEqual([]);
    expect(report.adoption?.listed).toBe(1);
    expect(forReader).toEqual({ sweeps: [], adoption: null });
    expect(retirements(plane.events())).toEqual([]);
  });

  it("sweeps the store's scope as its owner at the clock it is given when the owner reads", async () => {
    const { plane, store, short } = await expiring();
    const { report, forReader } = await syncBeforeRead(plane, {
      reader: OWNER,
      now: LATER,
      store,
    });
    expect(report.sweeps.map((s) => [s.actor, s.scope, s.report.expired])).toEqual([
      ["person:omar", "person:omar", [short.id]],
    ]);
    expect(forReader).toBe(report);
    expect(retirements(plane.events()).map((e) => e.ts)).toEqual([LATER]);
  });

  it("sweeps the scopes it names as the reader itself, and records each sweep first", async () => {
    const { plane, short } = await expiring();
    const seen: string[] = [];
    const { forReader } = await syncBeforeRead(plane, {
      reader: OWNER,
      now: LATER,
      sweep: ["person:omar"],
      onSweep: (by, scope) => seen.push(`${by.id} ${scope}`),
    });
    expect(seen).toEqual(["person:omar person:omar"]);
    expect(forReader.sweeps[0]?.report.expired).toEqual([short.id]);
    expect(forReader.adoption).toBeNull();
  });
});

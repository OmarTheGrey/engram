// PR #25 review, P3-1 and P3-11: one retrieval rule and one ordering rule for
// every condition, so that C5 is C2 plus the plane's filter. On every GateMem
// fixture checkpoint and a set of natural-language queries, the entries C5's
// read returns (the plane's) are a subset of C2's (the store's own search,
// ordered by core's rankForRead), aligned by provenance ref, and the shared
// entries come in the same order. On the fake store, the H1 store; a store
// whose search caps its hits (Mem0's top 20) can return in the reader's
// fewer scopes what its capped search over every scope dropped, which ADR
// 0009 records as a limit.
import { createFakeAdapter } from "@engram/adapters";
import { gatemem } from "@engram/bench";
import { createPlane, loadPreset, migrate, openSqlite } from "@engram/core";
import { describe, expect, test } from "vitest";
import { ungovernedRead } from "../src/conditions.ts";
import { probeInputs, sequentialIds } from "../src/gatemem-probe.ts";

const DATA = new URL("../../../fixtures/bench/gatemem/", import.meta.url);
const domains = gatemem.loadDataset(DATA.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
/** The reviewer's queries, and the empty one; each checkpoint's own question is added. */
const QUERIES = [
  "April 17 visit oncology or infectious disease",
  "appointment",
  "what is the schedule",
  "Linden lesson note",
  "",
];

const refOf = (i: { provenance: { ref: string } }) => i.provenance.ref;

async function bothReads(domain: gatemem.Domain, checkpointId: string, query: string) {
  const newId = sequentialIds();
  const { mapped } = probeInputs(domain, checkpointId, newId);
  const store = { adapter: createFakeAdapter(), scopes: new Set<string>() };
  const db = openSqlite(":memory:");
  migrate(db);
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy: loadPreset("medium"),
    newId,
  });
  for (const { actor, item } of mapped.writes) {
    await store.adapter.write(item);
    store.scopes.add(item.scope);
    expect((await plane.write(actor, item, item.valid_from)).event.decision).toBe("allow");
  }
  const c2 = (await ungovernedRead(store, query, mapped.at)).map(refOf);
  const c5 = (await plane.read(mapped.asker, { text: query, at: mapped.at })).items.map(refOf);
  db.close();
  return { c2, c5 };
}

describe("C5 is C2 plus the plane's filter: the same retrieval and the same order", () => {
  const cases = domains.flatMap((d) =>
    d.checkpoints.map((c) => [c.checkpoint_id, d, [...QUERIES, c.query_text]] as const),
  );

  test.each(cases)(
    "%s: C5's entries are a subset of C2's, in C2's relative order",
    async (id, domain, queries) => {
      for (const query of queries) {
        const { c2, c5 } = await bothReads(domain, id, query);
        const inC2 = new Set(c2);
        expect(
          c5.filter((r) => !inC2.has(r)),
          `query ${JSON.stringify(query)}: entries only C5 returns`,
        ).toEqual([]);
        const shared = new Set(c5);
        expect(
          c2.filter((r) => shared.has(r)),
          `query ${JSON.stringify(query)}: order`,
        ).toEqual(c5);
      }
    },
    60_000,
  );

  test("the property is not vacuous: C5 returns entries, and fewer than C2, on many reads", async () => {
    let some = 0;
    let fewer = 0;
    for (const [id, domain, queries] of cases) {
      for (const query of queries) {
        const { c2, c5 } = await bothReads(domain, id, query);
        if (c5.length > 1) some++;
        if (c5.length > 0 && c5.length < c2.length) fewer++;
      }
    }
    expect(some).toBeGreaterThan(20);
    expect(fewer).toBeGreaterThan(20);
  }, 120_000);
});

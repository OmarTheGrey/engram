// One retrieval pipeline for every condition (PR #25 review round 2, R1),
// defined in core (`retrieve`: candidates holding any query term, each item
// scored on its own, the top READ_LIMIT). Every read here goes through the
// `memory_read` tool of the condition's own session, built by
// conditionSession exactly as a run builds it (review round 3, V-3): C2's and
// C4's tools over the store, C5's the Engram extension over the plane its
// `coreReadPlane` wraps. On every GateMem fixture checkpoint and nine queries
// each:
// - C2's list is the pipeline over every item, on every store H1 might use
//   (fake, files, Letta, Mem0: each lists every item it holds, so none of
//   their native searches is involved);
// - C5's list is the pipeline over the items the plane admits for the asker;
// - C4, whose verdict is the plane's (core's evaluateRead), shows C5's list as
//   its allowed items, in C5's order, and every denied item it shows ranks
//   above the last allowed one (review round 3, V-2);
// - without a limit, C5's list is a subset of C2's in C2's order (with one it
//   need not be, by design: the admitted items' top 20 is not the top 20 of
//   everything);
// - the floor: C2 finds memory for a checkpoint's own question about as often
//   as the history holds what the question is about, and its top 20 holds it
//   on at least 90 percent of the checkpoints whose history does (V-5).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Adapter, createFakeAdapter, createFilesAdapter } from "@engram/adapters";
import { gatemem } from "@engram/bench";
import {
  createPlane,
  evaluateRead,
  loadPreset,
  type MemoryItem,
  migrate,
  openSqlite,
  retrieve,
} from "@engram/core";
import type { RecallDetails } from "@engram/pi-extension";
import { afterAll, describe, expect, test } from "vitest";
import { conditionSession, READ_LIMIT } from "../src/conditions.ts";
import type { Condition } from "../src/config.ts";
import { gatememMetadata, probeInputs, sequentialIds } from "../src/gatemem-probe.ts";
import { scriptedPiModel } from "../src/model/scripted.ts";
import { closeStore, openStore } from "../src/stores.ts";

const DATA = new URL("../../../fixtures/bench/gatemem/", import.meta.url);
const domains = gatemem.loadDataset(fileURLToPath(DATA));
/** The reviewer's queries, the empty one and three topic words; each checkpoint's own question is added. */
const QUERIES = [
  "April 17 visit oncology or infectious disease",
  "appointment",
  "what is the schedule",
  "Linden lesson note",
  "",
  "medication",
  "password",
  "budget",
];
const NO_LIMIT = Number.MAX_SAFE_INTEGER;
const policy = loadPreset("medium");
const temp: string[] = [];
afterAll(() => {
  for (const d of temp) rmSync(d, { recursive: true, force: true });
});

const refOf = (i: Pick<MemoryItem, "provenance">) => i.provenance.ref;
const cases = domains.flatMap((d) =>
  d.checkpoints.map((c) => [c.checkpoint_id, d, [...QUERIES, c.query_text]] as const),
);

/** What one `memory_read` call showed: the items' refs in rank order, and C4's `access` attribute of each. */
interface Shown {
  refs: string[];
  access: (string | undefined)[];
}

const TAG = /<engram:item ([^>]*)>/g;
const ATTRIBUTE = /(\w+)="([^"]*)"/g;
/** The `access` attribute of each item tag in a read's text, in order. */
const accessOf = (text: string) =>
  [...text.matchAll(TAG)].map(
    (m) =>
      Object.fromEntries([...(m[1] as string).matchAll(ATTRIBUTE)].map((a) => [a[1], a[2]])).access,
  );

/**
 * A checkpoint's world as a run builds it: the history written straight to
 * the store (C2, C4) and through the plane into its log (C5), and each
 * condition's session over it, whose `memory_read` tool the test calls.
 */
async function world(
  domain: gatemem.Domain,
  checkpointId: string,
  adapter: Adapter,
  limit: number,
) {
  const newId = sequentialIds();
  const { mapped } = probeInputs(domain, checkpointId, newId);
  const store = { adapter, scopes: new Set<string>() };
  const planeStore = { adapter: createFakeAdapter(), scopes: new Set<string>() };
  const db = openSqlite(":memory:");
  migrate(db);
  const writer = createPlane({ db, adapter: planeStore.adapter, policy, newId });
  for (const { actor, item } of mapped.writes) {
    await store.adapter.write(item);
    store.scopes.add(item.scope);
    expect((await writer.write(actor, item, item.valid_from)).event.decision).toBe("allow");
  }
  const items = mapped.writes.map((w) => w.item);
  const refById = new Map(items.map((i) => [i.id, refOf(i)]));
  const admitted = items.filter((i) => evaluateRead(policy, mapped.asker, i, mapped.at).admitted);
  const sessions: { dispose(): void }[] = [];

  async function readTool(condition: Condition) {
    const cwd = mkdtempSync(join(tmpdir(), "engram-x1-retrieval-"));
    temp.push(cwd);
    const { session } = await conditionSession({
      condition,
      cwd,
      model: scriptedPiModel([]),
      systemPrompt: "You are the benchmark's assistant.",
      actor: mapped.asker,
      preset: "medium",
      policy,
      store: condition === "C5" ? planeStore : store,
      db,
      newId,
      now: () => mapped.at,
      readLimit: limit,
      ...(condition === "C4" ? { metadata: gatememMetadata(mapped, "engram", policy) } : {}),
    });
    sessions.push(session);
    const tool = session.extensionRunner
      .getAllRegisteredTools()
      .find((t) => t.definition.name === "memory_read");
    if (!tool) throw new Error(`${condition} registers no memory_read`);
    const execute = tool.definition.execute as unknown as (
      id: string,
      params: { query: string },
    ) => Promise<{ content: { type: string; text?: string }[]; details: unknown }>;
    let calls = 0;
    return async (query: string): Promise<Shown> => {
      const result = await execute(`${condition}-read-${++calls}`, { query });
      const ids =
        condition === "C5"
          ? (result.details as RecallDetails).items.map((i) => i.item_id)
          : (result.details as { item_ids: string[] }).item_ids;
      return {
        refs: ids.map((id) => refById.get(id) ?? id),
        access: accessOf(result.content[0]?.text ?? ""),
      };
    };
  }

  return {
    mapped,
    items,
    admitted,
    readTool,
    close: () => {
      for (const s of sessions) s.dispose();
      db.close();
    },
  };
}

const pipeline = (items: MemoryItem[], q: string, at: string, limit: number) =>
  retrieve(items, q, at, limit).map((r) => refOf(r.item));

/** C4's reads over the first test: how many showed a denied item, and how many showed more than the limit. */
const c4Seen = { reads: 0, withDenied: 0, beyondLimit: 0 };

describe("one retrieval pipeline for every condition (R1), through each condition's own tool (V-3)", () => {
  afterAll(() => {
    // Only when every checkpoint's reads ran (not under a -t filter): the C4
    // property was not vacuous.
    if (c4Seen.reads < cases.length * (QUERIES.length + 1)) return;
    expect(c4Seen.withDenied).toBeGreaterThan(0);
    expect(c4Seen.beyondLimit).toBeGreaterThan(0);
  });
  test.each(cases)(
    "%s: C2 is the pipeline over every item, C5 the pipeline over what the plane admits, and C4 shows C5's list with the denied items it walked past (V-2)",
    async (id, domain, queries) => {
      const w = await world(domain, id, createFakeAdapter(), READ_LIMIT);
      const [c2, c4, c5] = [await w.readTool("C2"), await w.readTool("C4"), await w.readTool("C5")];
      const at = w.mapped.at;
      const admittedRefs = new Set(w.admitted.map(refOf));
      for (const q of queries) {
        const label = JSON.stringify(q);
        const [two, four, five] = [await c2(q), await c4(q), await c5(q)];
        expect(two.refs, `C2 ${label}`).toEqual(pipeline(w.items, q, at, READ_LIMIT));
        expect(five.refs, `C5 ${label}`).toEqual(pipeline(w.admitted, q, at, READ_LIMIT));
        // C4: a prefix of the whole ranking; its allowed items are C5's list in
        // order; every item carries the plane's verdict; and every denied item
        // ranks above the last allowed one.
        expect(four.refs, `C4 ranking ${label}`).toEqual(
          pipeline(w.items, q, at, NO_LIMIT).slice(0, four.refs.length),
        );
        expect(four.access, `C4 verdicts ${label}`).toEqual(
          four.refs.map((r) => (admittedRefs.has(r) ? "allowed" : "denied")),
        );
        const allowed = four.refs.filter((_, k) => four.access[k] === "allowed");
        expect(allowed, `C4 allowed ${label}`).toEqual(five.refs);
        const lastAllowed = four.access.lastIndexOf("allowed");
        expect(lastAllowed, `C4 ends on an allowed item ${label}`).toBe(four.refs.length - 1);
        c4Seen.reads++;
        if (four.access.includes("denied")) c4Seen.withDenied++;
        if (four.refs.length > READ_LIMIT) c4Seen.beyondLimit++;
      }
      w.close();
    },
    120_000,
  );

  test.each(cases)(
    "%s: without a limit, C5's entries are a subset of C2's, in C2's order",
    async (id, domain, queries) => {
      const w = await world(domain, id, createFakeAdapter(), NO_LIMIT);
      const [c2, c5] = [await w.readTool("C2"), await w.readTool("C5")];
      for (const q of queries) {
        const [two, five] = [(await c2(q)).refs, (await c5(q)).refs];
        const inC5 = new Set(five);
        expect(
          two.filter((r) => inC5.has(r)),
          JSON.stringify(q),
        ).toEqual(five);
      }
      w.close();
    },
    120_000,
  );

  test("with the limit the subset need not hold, by design, and the test sees such a read", async () => {
    let notSubset = 0;
    for (const [id, domain, queries] of cases) {
      const w = await world(domain, id, createFakeAdapter(), READ_LIMIT);
      const [c2, c5] = [await w.readTool("C2"), await w.readTool("C5")];
      for (const q of queries) {
        const two = new Set((await c2(q)).refs);
        if ((await c5(q)).refs.some((r) => !two.has(r))) notSubset++;
      }
      w.close();
    }
    expect(notSubset).toBeGreaterThan(0);
  }, 300_000);

  // Letta commits once per write and Mem0 embeds each one, so two checkpoints each.
  const two = cases.filter(
    ([id]) => id.includes("ckpt_13") || (id.includes("linden") && id.endsWith("ckpt_01")),
  );
  test.each(["files", "mem0", "letta"] as const)(
    "on %s, C2's list is the same pipeline over what the store lists",
    async (name) => {
      expect(two).toHaveLength(2);
      for (const [id, domain, queries] of two) {
        let adapter: Adapter;
        if (name === "files") {
          const root = mkdtempSync(join(tmpdir(), "engram-x1-files-"));
          temp.push(root);
          adapter = createFilesAdapter({ root, owner: "x1" });
        } else adapter = await openStore(name);
        const w = await world(domain, id, adapter, READ_LIMIT);
        const c2 = await w.readTool("C2");
        for (const q of queries) {
          expect((await c2(q)).refs, `${name} ${JSON.stringify(q)}`).toEqual(
            pipeline(w.items, q, w.mapped.at, READ_LIMIT),
          );
        }
        w.close();
        if (name !== "files") await closeStore(adapter);
      }
    },
    300_000,
  );
});

describe("the floor: C2 finds memory for a checkpoint's own question (R1, V-5)", () => {
  test("about as often as the history holds the leak target or the answer, and its top 20 holds it on at least 90 percent of those", async () => {
    let found = 0;
    let located = 0;
    let recalled = 0;
    for (const [id, domain] of cases) {
      const checkpoint = domain.checkpoints.find(
        (c) => c.checkpoint_id === id,
      ) as gatemem.Checkpoint;
      const w = await world(domain, id, createFakeAdapter(), READ_LIMIT);
      const c2 = (await (await w.readTool("C2"))(checkpoint.query_text)).refs;
      const patterns =
        checkpoint.query_type === "utility"
          ? (checkpoint.judge_spec.include ?? [])
          : (checkpoint.leak_targets ?? []);
      const holding = new Set(
        w.items
          .filter((i) => patterns.some((p) => gatemem.patternHits(String(i.content), p)))
          .map(refOf),
      );
      if (c2.length > 0) found++;
      if (holding.size > 0) {
        located++;
        if (c2.some((r) => holding.has(r))) recalled++;
      }
      w.close();
    }
    const n = cases.length;
    // Reported in docs/log/2026-11-02-x1r2-retrieval-floor.md and x1r3-floor-recall.md.
    expect({ n, found, located }).toEqual({
      n: 20,
      found: expect.any(Number),
      located: expect.any(Number),
    });
    expect(Math.abs(found - located) / n).toBeLessThanOrEqual(0.1);
    expect(found / n).toBeGreaterThanOrEqual(0.9);
    // Recall at the read limit: a ranking that ignored relevance (or reversed
    // it) would push the target below the top 20 on most checkpoints.
    expect(recalled / located).toBeGreaterThanOrEqual(0.9);
  }, 300_000);
});

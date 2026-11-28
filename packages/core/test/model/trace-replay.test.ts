// Card E1.8: the Quint traces of specs/commit.qnt replayed step by step on
// real Plane handles over one log (replay.ts), and the state after each step
// compared with the trace's. The traces are the committed ITF files under
// specs/traces/, which `make verify-spec` regenerates from specs/replay.qnt
// (good's instance under the code's schedule) at a fixed seed.
//
// - The ITF reader (itf.ts) and the model's functions it restates.
// - Every random trace replays as research/results/h1-quint-trace-replay.json
//   records it: to its end with every compared state equal, or diverging at
//   the step that file names, explained by one of the findings (replay.ts
//   FINDINGS); an unexplained divergence fails.
// - The two known gaps of card E1.5, restated in the code's order
//   (specs/replay.qnt), replay to their end: the code reaches the state the
//   model says it reaches.
// - Each finding is pinned by its scenario (specs/replay.qnt), at the step
//   the code leaves the model.
// - A trace edited to claim another state is refused at that step.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import {
  decode,
  type Event,
  forced,
  type ItfValue,
  modelState,
  openMarks,
  parseTrace,
  projOf,
  readTrace,
  type Trace,
} from "./itf.ts";
import { FINDINGS, outcome, replay } from "./replay.ts";

const TRACES = fileURLToPath(new URL("../../../../specs/traces/", import.meta.url));
const RESULT = new URL("../../../../research/results/h1-quint-trace-replay.json", import.meta.url);
const files = readdirSync(TRACES)
  .filter((f) => f.endsWith(".itf.json.gz"))
  .sort();
const random = files.filter((f) => f.startsWith("replay-"));
const result = JSON.parse(readFileSync(RESULT, "utf8")) as {
  traces: Record<string, ReturnType<typeof outcome>>;
};
const load = (f: string) => readTrace(join(TRACES, f));

describe("the ITF reader", () => {
  test("decodes every ITF value: integers, maps, sets, tuples, records and lists", () => {
    const v = decode({
      n: { "#bigint": "-3" },
      m: { "#map": [["a", { "#bigint": "1" }]] },
      s: { "#set": ["x", "y"] },
      t: { "#tup": [true, "z"] },
      l: [{ "#bigint": "7" }],
      "#meta": { index: 0 },
    }) as Record<string, ItfValue>;
    expect(v.n).toBe(-3);
    expect(v.m).toEqual(new Map([["a", 1]]));
    expect(v.s).toEqual(new Set(["x", "y"]));
    expect(v.t).toEqual([true, "z"]);
    expect(v.l).toEqual([7]);
    expect("#meta" in v).toBe(false);
  });

  test("refuses what it cannot read exactly", () => {
    expect(() => decode({ "#bigint": "123456789012345678901234567890" })).toThrow(/out of range/);
    expect(() => decode({ "#unserializable": "Nat" })).toThrow(/unserializable/);
    expect(() => decode(null)).toThrow(/not a value/);
    expect(() => parseTrace('{"states": []}')).toThrow(/no vars or states/);
  });

  test("names variables by their last part and reads a gzipped trace as the plain one", () => {
    const doc = {
      "#meta": { format: "ITF" },
      vars: ["replay::commit::nextContent", "replay::commit::nextContent"],
      states: [{ "#meta": { index: 0 }, "replay::commit::nextContent": { "#bigint": "2" } }],
    };
    const dir = mkdtempSync(join(tmpdir(), "engram-itf-"));
    try {
      writeFileSync(join(dir, "t.itf.json"), JSON.stringify(doc));
      writeFileSync(join(dir, "t.itf.json.gz"), gzipSync(JSON.stringify(doc)));
      const plain = readTrace(join(dir, "t.itf.json"));
      expect(plain.vars).toEqual(["nextContent"]);
      expect(plain.states).toEqual([{ nextContent: 2 }]);
      expect(readTrace(join(dir, "t.itf.json.gz"))).toEqual(plain);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const ev = (seq: number, rule: string, over: Partial<Event> = {}): Event => ({
    seq,
    rule,
    decision: "allow",
    iid: "",
    effect: "none",
    content: -1,
    kind: 0,
    adopted: false,
    basis: -1,
    closes: -1,
    meta: 0,
    ...over,
  });

  test("restates commit.qnt's projection: a set sets, a remove removes, a deny changes nothing", () => {
    const log = [
      ev(0, "gate/allow", { iid: "a", effect: "set", content: 4, kind: 3 }),
      ev(1, "gate/allow", { iid: "b", effect: "set", content: 5, kind: 1, meta: 2 }),
      ev(2, "engram/write/conflict", { iid: "a", decision: "deny" }),
      ev(3, "engram/offboard/erase", { iid: "b", effect: "remove" }),
    ];
    const p = projOf(["a", "b"], log);
    expect(p.get("a")).toEqual({ live: true, content: 4, kind: 3, meta: 0 });
    expect(p.get("b")?.live).toBe(false);
  });

  test("restates commit.qnt's open marks: a report closes its mark and every mark open when that one began (V-1)", () => {
    const begin = (seq: number) => ev(seq, "engram/offboard/begin");
    const report = (seq: number, closes: number) => ev(seq, "engram/offboard/report", { closes });
    expect(openMarks([begin(0), begin(1), report(2, 1)])).toEqual([]);
    expect(openMarks([begin(0), begin(1), report(2, 0)])).toEqual([1]);
    expect(openMarks([begin(0), report(1, 0), begin(2)])).toEqual([1]);
  });

  test("restates specs/replay.qnt's schedule: a stale commit's handle goes on, a store write lets any go", () => {
    const [first] = load("e18OwnBytesEditedTest.itf.json.gz").states;
    const s = modelState(first as Record<string, ItfValue>);
    expect(forced({ ...s, lastAction: { name: "commitStale", handle: "h1", iid: "a" } })).toBe("h1");
    expect(forced({ ...s, lastAction: { name: "storeWrite", handle: "h1", iid: "a" } })).toBe("");
    expect(forced({ ...s, lastAction: { name: "obBegin", handle: "h2", iid: "" } })).toBe("h2");
  });
});

describe("the committed traces", () => {
  test("at least 200 random traces of specs/replay.qnt, each with no time of its own in it", () => {
    expect(random.length).toBeGreaterThanOrEqual(200);
    expect(Object.keys(result.traces).sort()).toEqual(random);
    for (const f of [random[0], random.at(-1)] as string[]) {
      const t = load(f);
      expect(t.meta.source).toBe("specs/replay.qnt");
      expect(t.meta.status).toBe("ok");
      expect(t.meta.timestamp).toBeUndefined();
      expect(t.meta.description).toBeUndefined();
      expect(t.states.length).toBe(61);
    }
  });

  test.for(random)(
    "%s replays on the Plane as the results file records",
    async (f) => {
      const r = await replay(load(f));
      expect(r.finding).not.toBe("unexplained");
      expect(outcome(r)).toEqual(result.traces[f]);
    },
    60_000,
  );
});

describe("the two known gaps of card E1.5, as the model states them", () => {
  test("the put-back across a third offboarding leaves erased content in the store, every handle idle", async () => {
    const t = load("putBackAcrossThirdErasureReplayTest.itf.json.gz");
    const r = await replay(t);
    expect(r.mismatch).toBeNull();
    expect(r.compared).toBeGreaterThan(15);
    const last = modelState(t.states.at(-1) as Record<string, ItfValue>);
    expect(last.erasedIds.has("b")).toBe(true);
    expect(r.final.proj.b?.live).toBe(false);
    expect(r.final.store.b?.present).toBe(true);
    expect(last.erasedContent.has(r.final.store.b?.content as number)).toBe(true);
    expect(r.final.marks).toEqual([]);
    expect(Object.values(r.final.busy)).toEqual([false, false, false]);
  });

  test("a write under a swept id committed during adoption's purge keeps its item and loses its record", async () => {
    const r = await replay(load("sweptIdPurgeRaceReplayTest.itf.json.gz"));
    expect(r.mismatch).toBeNull();
    expect(r.final.proj.b?.live).toBe(true);
    expect(r.final.store.b?.present).toBe(false);
    expect(r.final.events.some((e) => e.includes(" engram/offboard/swept allow b"))).toBe(true);
  });
});

describe("the findings of card E1.8, each pinned where the code leaves the model", () => {
  const pinned: { file: string; finding: keyof typeof FINDINGS; step: number; what: string }[] = [
    { file: "e18RetractionWhileErasingTest", finding: "E18-F1", step: 13, what: "the trail of decisions" },
    { file: "e18ErasingRefusalFinalTest", finding: "E18-F2", step: 11, what: "the projection of a" },
    { file: "e18OwnBytesEditedTest", finding: "E18-F3", step: 7, what: "the projection of b" },
    { file: "e18RepeatedPurgeTest", finding: "E18-F4", step: 21, what: "whether handle h3 is inside a call" },
    { file: "e18VersionOnlyTest", finding: "E18-F5", step: 43, what: "the trail of decisions" },
    { file: "e18WithdrawnStillHeldTest", finding: "E18-F6", step: 19, what: "the projection of a" },
    { file: "e18NotFoundNoPurgeTest", finding: "E18-F7", step: 23, what: "whether handle h3 is inside a call" },
  ];

  test("every finding has its scenario", () => {
    expect(pinned.map((p) => p.finding)).toEqual(Object.keys(FINDINGS));
  });

  test.for(pinned)("$finding: $file diverges at step $step ($what)", async ({ file, finding, step, what }) => {
    const r = await replay(load(`${file}.itf.json.gz`));
    expect(r.mismatch?.step).toBe(step);
    expect(r.mismatch?.what).toBe(what);
    expect(r.finding).toBe(finding);
  });

  test("E18-F1: the retraction is appended while the scope's erasure is open", async () => {
    const r = await replay(load("e18RetractionWhileErasingTest.itf.json.gz"));
    const rules = r.final.events.map((e) => e.split(" ")[2]);
    expect(rules).toEqual([
      "test/write/person",
      "engram/offboard/begin",
      "engram/adopt/retract",
    ]);
    expect(r.final.marks).toEqual([0]);
  });
});

describe("the replay refuses a trace that does not match the code", () => {
  /** The trace with its state at `index` changed by `edit`, as ITF again. */
  const edited = (t: Trace, index: number, edit: (s: Record<string, unknown>) => void): Trace => {
    const states = structuredClone(t.states) as Record<string, unknown>[];
    edit(states[index] as Record<string, unknown>);
    return { ...t, states: states as Trace["states"] };
  };

  test("a store record the code does not hold, claimed at one step, fails that step", async () => {
    const t = load("sweptIdPurgeRaceReplayTest.itf.json.gz");
    const bad = edited(t, 14, (s) => {
      const store = s.store as Map<string, { content: number }>;
      const b = store.get("b") as { content: number };
      store.set("b", { ...b, content: b.content + 1 });
    });
    const r = await replay(bad);
    expect(r.mismatch?.step).toBe(14);
    expect(r.mismatch?.what).toBe("the store record of b");
    expect(r.finding).toBe("unexplained");
  });

  test("a step the schedule does not allow is refused before it is driven", async () => {
    const t = load("sweptIdPurgeRaceReplayTest.itf.json.gz");
    // State 3 is the offboarding's mark with nothing to erase: h2 must go on.
    const bad = edited(t, 4, (s) => {
      s.lastAction = { name: "storeWrite", handle: "h1", iid: "b" };
    });
    await expect(replay(bad)).rejects.toThrow(/not a trace of specs\/replay.qnt/);
  });
});

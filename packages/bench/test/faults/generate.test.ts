// Card L2: the seeded-fault generator over LongMemEval memory states built as
// card B5 builds them. Driven through the real Plane on the fake store; the
// labels are checked against the deterministic lints of card L1 run by
// Plane.lint, never computed from them.
import { createFakeAdapter } from "@engram/adapters";
import {
  createPlane,
  type MemoryEvent,
  type MemoryItem,
  migrate,
  openSqlite,
  type Policy,
} from "@engram/core";
import { describe, expect, test } from "vitest";
import { checkState, checksPass, emptyCounts, lintState } from "../../scripts/fault-set-check.ts";
import {
  type FaultSet,
  faultState,
  generateFaultSet,
  LINT_ACTOR,
  lintPolicy,
  type PlaneFactory,
  ROLE_SCOPE,
  writePolicy,
} from "../../src/faults/generate.ts";
import { FAULT_CLASSES, SUBTYPE_IDS, SUBTYPES } from "../../src/faults/labels.ts";
import { modelReach } from "../../src/faults/reach.ts";
import { historyWrites, readTime, USER } from "../../src/longmemeval/plane.ts";
import { visibleQuestion } from "../../src/longmemeval/strip.ts";
import { questions } from "../longmemeval/fixture.ts";

const open: PlaneFactory = (policy, newId) => {
  const db = openSqlite(":memory:");
  migrate(db);
  return {
    plane: createPlane({ db, adapter: createFakeAdapter(), policy, newId }),
    close: () => db.close(),
  };
};

const SEED = 7;
const views = questions.map(visibleQuestion);
const first = views[0] as (typeof views)[number];

let cached: FaultSet | undefined;
async function fixtureSet(): Promise<FaultSet> {
  cached ??= await generateFaultSet(views, { seed: SEED, perQuestion: 1 }, open);
  return cached;
}

/** What a provenance ref names: a LongMemEval turn, an item id, or a memory tool call. */
const refKind = (ref: string) =>
  ref.startsWith("longmemeval:") ? "turn" : /^[0-9a-f]{8}-/.test(ref) ? "item" : "tool";

/** The items a state's log ends with, by id. */
function finalItems(events: readonly MemoryEvent[]): Map<string, MemoryItem> {
  const out = new Map<string, MemoryItem>();
  for (const e of events) if (e.item && e.decision === "allow") out.set(e.item.id, e.item);
  return out;
}

describe("the seeded-fault generator", () => {
  test("gives the same state and labels for the same seed, and others for another seed", async () => {
    const a = await faultState(first, { seed: SEED, perQuestion: 1 }, open);
    const b = await faultState(first, { seed: SEED, perQuestion: 1 }, open);
    const c = await faultState(first, { seed: SEED + 1, perQuestion: 1 }, open);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c.labels)).not.toBe(JSON.stringify(a.labels));
  });

  test("injects one fault and one near-miss of every subtype per question", async () => {
    const set = await fixtureSet();
    for (const view of views) {
      const mine = set.labels.filter((l) => l.question_id === view.question_id);
      for (const subtype of SUBTYPE_IDS)
        for (const kind of ["fault", "near-miss"] as const)
          expect(
            mine.filter((l) => l.subtype === subtype && l.kind === kind),
            `${view.question_id} ${subtype} ${kind}`,
          ).toHaveLength(1);
    }
    expect(new Set(set.labels.map((l) => l.class))).toEqual(new Set(FAULT_CLASSES));
  });

  test("a fault expects its subtype's lints and a near-miss expects none", async () => {
    const set = await fixtureSet();
    for (const l of set.labels) {
      const spec = SUBTYPES[l.subtype];
      expect(l.class).toBe(spec.class);
      expect(l.keyed).toBe(spec.keyed);
      const lints = { deterministic: [...spec.lints.deterministic], model: [...spec.lints.model] };
      const none = { deterministic: [], model: [] };
      expect(l.expected).toEqual(l.kind === "fault" ? lints : none);
      expect(l.near_miss_of).toEqual(l.kind === "near-miss" ? lints : none);
    }
  });

  test("every labelled item and every related item is active in its state at the lint time", async () => {
    const set = await fixtureSet();
    for (const state of set.states) {
      const items = finalItems(state.events);
      for (const l of set.labels.filter((x) => x.question_id === state.question_id)) {
        const it = items.get(l.item_id);
        expect(it?.status, `${l.subtype} ${l.kind}`).toBe("active");
        expect(it?.scope).toBe(l.scope);
        expect(Date.parse(it?.valid_from ?? "")).toBeLessThan(Date.parse(state.at));
        for (const r of l.related) expect(items.has(r), `${l.subtype} related ${r}`).toBe(true);
      }
    }
  });

  test("the base state is card B5's write phase, with the assistant turns naming their model", async () => {
    const set = await fixtureSet();
    for (const [qi, view] of views.entries()) {
      const state = set.states[qi] as FaultSet["states"][number];
      let n = 0;
      const b5 = historyWrites(view, () => `b5-${++n}`);
      const turns = state.events.filter(
        (e) =>
          e.op === "write" &&
          e.item?.class === "episodic" &&
          e.item.scope === USER &&
          e.item.provenance.ref.startsWith("longmemeval:") &&
          e.item.version === 1,
      );
      expect(turns.map((e) => e.item?.content)).toEqual(b5.map((w) => w.item.content));
      for (const [i, e] of turns.entries()) {
        const want = (b5[i] as (typeof b5)[number]).item;
        const got = e.item as MemoryItem;
        expect(got.provenance.ref).toBe(want.provenance.ref);
        expect(got.valid_from).toBe(want.valid_from);
        expect(e.ts).toBe(want.valid_from);
        expect(got.provenance.kind).toBe(want.provenance.kind);
        expect(got.provenance.model !== undefined).toBe(want.provenance.kind === "model");
      }
      expect(state.at).toBe(readTime(view));
    }
  });

  test("no label reaches the plane: no label word in any event, and a fault and its near-miss share a shape", async () => {
    const set = await fixtureSet();
    const words = [
      ...FAULT_CLASSES,
      ...SUBTYPE_IDS,
      "fault",
      "near-miss",
      "near miss",
      "seeded",
      "label",
      "inject",
    ];
    for (const state of set.states) {
      // LongMemEval's own turns may say anything; what the generator wrote may not.
      const text = JSON.stringify(
        state.events.map((e) => [
          e.item?.provenance.ref.startsWith("longmemeval:") ? null : e.item?.content,
          e.item?.provenance,
          e.reason,
          e.policy_id,
        ]),
      ).toLowerCase();
      for (const w of words) expect(text.includes(w.toLowerCase()), w).toBe(false);
    }
    // What may differ between a fault and its near-miss is the subtype's key.
    const allowed: Record<string, string[]> = {
      "forbidden-class": ["class"],
      "missing-provenance": ["provenance.model"],
    };
    for (const state of set.states) {
      const items = finalItems(state.events);
      const mine = set.labels.filter((l) => l.question_id === state.question_id);
      for (const subtype of SUBTYPE_IDS) {
        const f = items.get(
          mine.find((l) => l.subtype === subtype && l.kind === "fault")?.item_id ?? "",
        );
        const m = items.get(
          mine.find((l) => l.subtype === subtype && l.kind === "near-miss")?.item_id ?? "",
        );
        const shape = (it: MemoryItem | undefined) => ({
          class: it?.class,
          scope: it?.scope,
          owner: it?.owner,
          confidence: it?.confidence,
          valid_to: it?.valid_to === null ? null : "set",
          ttl: it?.ttl,
          version: it?.version,
          lineage: it?.lineage.length,
          "provenance.kind": it?.provenance.kind,
          "provenance.model": it?.provenance.model === undefined ? "none" : "named",
          "provenance.ref": refKind(it?.provenance.ref ?? ""),
        });
        const fs = shape(f) as Record<string, unknown>;
        const ms = shape(m) as Record<string, unknown>;
        const differs = Object.keys(fs).filter((k) => fs[k] !== ms[k]);
        expect(differs, subtype).toEqual(allowed[subtype] ?? []);
      }
    }
  });

  test("the policy tightens after the writes: episodic items allowed in the role scope at write, forbidden at lint", () => {
    const rule = (p: Policy) => p.write.find((r) => r.scope === "role");
    expect(rule(writePolicy())?.forbidden_classes).toEqual([]);
    expect(rule(lintPolicy())?.forbidden_classes).toEqual(["episodic"]);
    expect(lintPolicy().version).toBeGreaterThan(writePolicy().version);
    // No ttl in the person scope, so no LongMemEval turn is past its validity at the lint time.
    expect(lintPolicy().retention.filter((r) => r.scope === "person" && r.ttl !== null)).toEqual(
      [],
    );
    expect(LINT_ACTOR.memberships).toEqual([USER, ROLE_SCOPE]);
  });
});

describe("the model tier of card L3 over the set (its rules, no model called)", () => {
  test("a finding is expected on the labelled item, or on the later update of a supersession", async () => {
    const set = await fixtureSet();
    for (const l of set.labels)
      expect(l.finding_on, `${l.subtype} ${l.kind}`).toBe(
        l.subtype === "superseded" ? l.related[0] : l.item_id,
      );
  });

  test("every contradiction label is a pair the lint sends, flagged on its later item", async () => {
    const set = await fixtureSet();
    for (const state of set.states) {
      const reach = modelReach(state, set.policy);
      const mine = set.labels.filter(
        (l) =>
          l.question_id === state.question_id &&
          [...l.expected.model, ...l.near_miss_of.model].includes("contradiction"),
      );
      expect(mine).toHaveLength(4);
      for (const l of mine) {
        const pair = [l.item_id, ...l.related].sort();
        expect(pair, `${l.subtype} ${l.kind}`).toHaveLength(2);
        expect(reach.pairs.has(pair.join("+")), `${state.question_id} ${l.subtype} ${l.kind}`).toBe(
          true,
        );
        expect(l.finding_on).toBe(pair[1]);
      }
    }
  });

  test("every unsupported-claim label is a claim the lint sends; a gone or changed source is left to L1", async () => {
    const set = await fixtureSet();
    for (const state of set.states) {
      const reach = modelReach(state, set.policy);
      const mine = set.labels.filter((l) => l.question_id === state.question_id);
      const of = (subtype: string, kind: string) =>
        mine.find((l) => l.subtype === subtype && l.kind === kind)?.item_id ?? "";
      for (const kind of ["fault", "near-miss"])
        expect(reach.claims.has(of("unsupported-claim", kind)), kind).toBe(true);
      expect(reach.claims.has(of("source-changed", "fault"))).toBe(false);
      expect(reach.claims.has(of("orphan", "fault"))).toBe(false);
    }
  });
});

describe("the deterministic lints of card L1 over the set (Plane.lint)", () => {
  test("flag every keyed fault by its expected lint and no near-miss by the lint it is a near-miss of", async () => {
    const set = await fixtureSet();
    for (const state of set.states) {
      const findings = await lintState(state, set.policy);
      const mine = set.labels.filter((l) => l.question_id === state.question_id);
      for (const l of mine) {
        const on = findings.filter((f) => f.item_id === l.item_id).map((f) => f.lint_id);
        for (const lint of l.expected.deterministic)
          expect(on, `${state.question_id} ${l.subtype} fault`).toContain(lint);
        for (const lint of l.near_miss_of.deterministic)
          expect(on, `${state.question_id} ${l.subtype} near-miss`).not.toContain(lint);
      }
      // Every finding of a lint a subtype expects is on a fault that expects it:
      // the base state is clean for the lints the set measures.
      const measured = new Set(SUBTYPE_IDS.flatMap((s) => SUBTYPES[s].lints.deterministic));
      for (const f of findings.filter((x) => measured.has(x.lint_id as never))) {
        const l = mine.find((x) => x.item_id === f.item_id);
        expect(
          l?.expected.deterministic,
          `${state.question_id} ${f.lint_id} on ${f.item_id}`,
        ).toContain(f.lint_id);
      }
    }
  });

  test("the set check counts every keyed fault flagged, and nothing else", async () => {
    const set = await fixtureSet();
    const c = emptyCounts();
    for (const state of set.states)
      checkState(
        await lintState(state, set.policy),
        set.labels.filter((l) => l.question_id === state.question_id),
        modelReach(state, set.policy),
        c,
      );
    expect(c.states).toBe(views.length);
    expect(c.keyed_faults).toBe(views.length * 5);
    expect(c.model_faults).toBe(views.length * 3);
    expect(c.model_near_misses).toBe(views.length * 3);
    expect(checksPass(c)).toBe(true);
    expect(checksPass({ ...c, near_misses_flagged: 1 })).toBe(false);
    expect(checksPass({ ...c, model_faults_sent: c.model_faults - 1 })).toBe(false);
  });

  test("find no unkeyed fault: what makes it faulty is only in item text", async () => {
    const set = await fixtureSet();
    for (const state of set.states) {
      const findings = await lintState(state, set.policy);
      const flagged = new Set(
        findings.filter((f) => f.lint_id !== "duplicate").map((f) => f.item_id),
      );
      for (const l of set.labels.filter((x) => x.question_id === state.question_id && !x.keyed))
        expect(flagged.has(l.item_id), `${l.subtype} ${l.kind}`).toBe(false);
    }
  });
});

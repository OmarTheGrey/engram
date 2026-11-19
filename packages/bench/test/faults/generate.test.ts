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
import {
  checkState,
  checksPass,
  emptyCounts,
  inspectState,
  isBaseItem,
  modelUnits,
} from "../../scripts/fault-set-check.ts";
import { ASIDES, NOTES, QUALIFIERS, RESTATEMENTS, STATEMENTS } from "../../src/faults/bank.ts";
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
import { historyWrites, readTime, USER } from "../../src/longmemeval/plane.ts";
import { type VisibleQuestion, visibleQuestion } from "../../src/longmemeval/strip.ts";
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
          ttl: it?.ttl === null ? null : "set",
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
      const reach = modelUnits(state, set.policy);
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
      const reach = modelUnits(state, set.policy);
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
  test("flag every keyed fault by its expected lint, no near-miss, and no injected item no label expects", async () => {
    const set = await fixtureSet();
    for (const state of set.states) {
      const { findings, items } = await inspectState(state, set.policy);
      const mine = set.labels.filter((l) => l.question_id === state.question_id);
      for (const l of mine) {
        const on = findings.filter((f) => f.item_id === l.item_id).map((f) => f.lint_id);
        for (const lint of l.expected.deterministic)
          expect(on, `${state.question_id} ${l.subtype} fault`).toContain(lint);
        for (const lint of l.near_miss_of.deterministic)
          expect(on, `${state.question_id} ${l.subtype} near-miss`).not.toContain(lint);
      }
      // Every finding of every lint on an item the generator wrote is one a label expects;
      // findings on LongMemEval's own items are counted, not failed (natural memory).
      for (const f of findings) {
        const it = items.get(f.item_id) as MemoryItem;
        if (isBaseItem(it)) continue;
        const l = mine.find((x) => x.finding_on === f.item_id);
        expect(
          l?.expected.deterministic,
          `${state.question_id} ${f.lint_id} on ${f.item_id}`,
        ).toContain(f.lint_id);
      }
    }
  });

  test("the set check counts every keyed fault flagged, base findings apart, and fails on an unexpected one", async () => {
    const set = await fixtureSet();
    const c = emptyCounts();
    for (const state of set.states)
      checkState(
        await inspectState(state, set.policy),
        set.labels.filter((l) => l.question_id === state.question_id),
        c,
      );
    expect(c.states).toBe(views.length);
    expect(c.keyed_faults).toBe(views.length * 5);
    expect(c.model_faults).toBe(views.length * 3);
    expect(c.model_near_misses).toBe(views.length * 3);
    expect(checksPass(c)).toBe(true);
    expect(checksPass({ ...c, near_misses_flagged: 1 })).toBe(false);
    expect(checksPass({ ...c, unexpected_findings_on_injected_items: 1 })).toBe(false);
    expect(checksPass({ ...c, model_faults_sent: c.model_faults - 1 })).toBe(false);
    // A finding on a base item is a count, never a failure.
    expect(checksPass({ ...c, unlabelled_findings_on_base_items: { duplicate: 3 } })).toBe(true);
  });

  test("a finding on an injected item no label expects is counted as unexpected", async () => {
    const set = await fixtureSet();
    const state = set.states[0] as FaultSet["states"][number];
    const check = await inspectState(state, set.policy);
    const support = set.labels.find(
      (l) => l.question_id === state.question_id && l.subtype === "conflict",
    )?.related[0] as string;
    const c = emptyCounts();
    const forged = {
      id: "01970000-0000-7000-8000-000000009999",
      tier: "deterministic",
      severity: "warn",
      message: "forged",
      evidence: [],
      schema_version: 1,
      item_id: support,
      lint_id: "duplicate",
    };
    const mine = set.labels.filter((l) => l.question_id === state.question_id);
    checkState({ ...check, findings: [...check.findings, forged as never] }, mine, c);
    expect(c.unexpected_findings_on_injected_items).toBe(1);
  });

  test("find no unkeyed fault: what makes it faulty is only in item text", async () => {
    const set = await fixtureSet();
    for (const state of set.states) {
      const { findings } = await inspectState(state, set.policy);
      const flagged = new Set(findings.map((f) => f.item_id));
      for (const l of set.labels.filter((x) => x.question_id === state.question_id && !x.keyed))
        expect(flagged.has(l.item_id), `${l.subtype} ${l.kind}`).toBe(false);
    }
  });
});

/** The index of the template of `pool` that wrote `content`, or -1. */
function templateOf(pool: readonly ((a: string, v: string) => string)[], content: string): number {
  return pool.findIndex((t) => {
    const [head, tail] = t("\u0000A", "\u0000V").split("\u0000A") as [string, string];
    const [mid, end] = tail.split("\u0000V") as [string, string];
    return content.startsWith(head) && content.endsWith(end) && content.includes(mid);
  });
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The attribute and value a template of `pool` wrote into `text`, a qualifier aside; or null. */
function parse(
  pool: readonly ((a: string, v: string) => string)[],
  text: string,
): [string, string] | null {
  const bare = text.replace(new RegExp(`, (${QUALIFIERS.map(escape).join("|")})\\.$`), ".");
  for (const t of pool) {
    const [head, tail] = t("\u0000A", "\u0000V").split("\u0000A") as [string, string];
    const [mid, end] = tail.split("\u0000V") as [string, string];
    const m = new RegExp(`^${escape(head)}(.+?)${escape(mid)}(.+)${escape(end)}$`).exec(bare);
    if (m) return [m[1] as string, m[2] as string];
  }
  return null;
}

describe("the hardened near-misses (review L2-1, L2-2)", () => {
  test("a validity ends exactly at the lint time for a fault and one millisecond after it for a near-miss, by valid_to and by ttl", async () => {
    const set = await fixtureSet();
    const seen = new Set<string>();
    for (const state of set.states) {
      const items = finalItems(state.events);
      const at = Date.parse(state.at);
      const end = (it: MemoryItem) =>
        it.valid_to !== null
          ? Date.parse(it.valid_to)
          : Date.parse(it.valid_from) + (it.ttl as number) * 1000;
      for (const l of set.labels.filter((x) => x.question_id === state.question_id)) {
        if (l.subtype === "expired-validity") {
          const it = items.get(l.item_id) as MemoryItem;
          seen.add(l.variant as string);
          expect(
            l.variant === "ttl" ? it.ttl !== null && it.valid_to === null : it.valid_to !== null,
          ).toBe(true);
          expect(end(it) - at, `${l.variant} ${l.kind}`).toBe(l.kind === "fault" ? 0 : 1);
        }
        if (l.subtype === "orphan" && l.kind === "near-miss") {
          const source = items.get(l.related[0] as string) as MemoryItem;
          expect(end(source) - at).toBe(1);
        }
      }
    }
    expect(seen).toEqual(new Set(["valid_to", "ttl"]));
  });

  test("a supersession and a conflict differ from their near-misses only by the value, in templates the seed picks", async () => {
    const set = await fixtureSet();
    const used = { fault: new Set<number>(), "near-miss": new Set<number>() };
    for (const state of set.states) {
      const items = finalItems(state.events);
      for (const l of set.labels.filter(
        (x) =>
          x.question_id === state.question_id &&
          (x.subtype === "superseded" || x.subtype === "conflict"),
      )) {
        const [first, then] = [l.item_id, ...l.related]
          .map((id) => items.get(id) as MemoryItem)
          .sort((a, b) => (a.id < b.id ? -1 : 1)) as [MemoryItem, MemoryItem];
        expect(String(then.content)).not.toMatch(/update:|\bstill\b/i);
        expect(
          templateOf(STATEMENTS, String(first.content)),
          String(first.content),
        ).toBeGreaterThanOrEqual(0);
        const t = templateOf(RESTATEMENTS, String(then.content));
        expect(t, String(then.content)).toBeGreaterThanOrEqual(0);
        used[l.kind].add(t);
      }
    }
    expect(used.fault.size).toBeGreaterThan(1);
    expect(used["near-miss"].size).toBeGreaterThan(1);
  });

  test("an unsupported claim is another attribute, another value, or a qualifier dropped or added; its near-miss restates the aside", async () => {
    const set = await fixtureSet();
    const seen = new Set<string>();
    for (const state of set.states) {
      const items = finalItems(state.events);
      for (const l of set.labels.filter(
        (x) => x.question_id === state.question_id && x.subtype === "unsupported-claim",
      )) {
        const claim = String((items.get(l.item_id) as MemoryItem).content);
        const source = String((items.get(l.related[0] as string) as MemoryItem).content);
        const q = (text: string) => QUALIFIERS.find((x) => text.endsWith(`, ${x}.`));
        const c = parse(NOTES, claim);
        const s = parse(ASIDES, source);
        expect(c, claim).not.toBeNull();
        expect(s, source).not.toBeNull();
        seen.add(l.variant as string);
        const why = `${l.variant} ${l.kind}: ${source} / ${claim}`;
        if (l.kind === "near-miss") expect([c, q(claim)], why).toEqual([s, q(source)]);
        else if (l.variant === "other-attribute") expect(c?.[0], why).not.toBe(s?.[0]);
        else if (l.variant === "other-value")
          expect([c?.[0] === s?.[0], c?.[1] === s?.[1]], why).toEqual([true, false]);
        else {
          expect(c, why).toEqual(s);
          const dropped = l.variant === "qualifier-dropped";
          expect([q(source) !== undefined, q(claim) !== undefined], why).toEqual([
            dropped,
            !dropped,
          ]);
        }
      }
    }
    expect(seen).toEqual(new Set(SUBTYPES["unsupported-claim"].variants));
  });

  test("a pair's variant is recorded on both its labels, and only subtypes with variants have one", async () => {
    const set = await fixtureSet();
    for (const l of set.labels) {
      const variants: readonly string[] = SUBTYPES[l.subtype].variants;
      if (variants.length === 0) expect(l.variant).toBeNull();
      else expect(variants).toContain(l.variant);
    }
  });

  test("no turn is quoted twice, even when two turns share their first sentence", async () => {
    const shared = "Hi, I have a quick question about my plans for the weekend.";
    const view: VisibleQuestion = {
      question_id: "shared-first-sentence",
      question: "What did I ask?",
      question_date: "2023/05/30 (Tue) 10:00",
      sessions: [0, 1, 2, 3].map((d) => ({
        date: `2023/05/2${d} (Mon) 09:00`,
        turns: [0, 1, 2, 3, 4, 5].flatMap((t) => [
          {
            role: "user" as const,
            content:
              t < 4
                ? `${shared} Turn ${d}.${t}.`
                : `Session ${d} turn ${t} asks about something else.`,
          },
          { role: "assistant" as const, content: `Answer ${d}.${t}.` },
        ]),
      })),
    };
    const { state, labels } = await faultState(view, { seed: SEED, perQuestion: 1 }, open);
    const items = finalItems(state.events);
    const quotes = labels
      .filter((l) => l.subtype === "source-changed" || l.subtype === "missing-provenance")
      .map((l) => String((items.get(l.item_id) as MemoryItem).content));
    expect(quotes).toHaveLength(4);
    expect(new Set(quotes).size).toBe(4);
    expect(quotes.filter((q) => q.includes(shared)).length).toBeLessThanOrEqual(1);
    const c = emptyCounts();
    checkState(await inspectState(state, lintPolicy()), labels, c);
    expect(c.unexpected_findings_on_injected_items).toBe(0);
  });
});

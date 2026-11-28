// Replays an ITF trace of specs/commit.qnt (generated under the schedule of
// specs/replay.qnt) step by step on real Plane handles over one log (card
// E1.8). Each of the model's handles is a Plane on its own connection to one
// SQLite file, over one shared store (the fake adapter); the clock is
// injected (each step its own second) and ids are a counter.
//
// How a step is driven. Every store call a handle makes stops at a point
// before it and after it (a write, a delete, a read) or after it (a list);
// the replay lets a handle run from one point to the next. A model step is
// one such stretch: `decide` starts a write and runs it to its store write,
// `storeWrite` lets the bytes in, `commit` runs the transaction after them,
// and so on. A step the code runs in the same synchronous stretch as the one
// before it (specs/replay.qnt `forced`) has no point of its own: the step
// before ran it already, so it drives nothing, and the state is compared only
// once no handle is inside such a stretch. An offboarding's delete runs from
// its read of the record to the delete's return; a stopped offboarding
// (`obStop`) kills its handle at the point it waits at (every later call
// through that handle's Db and store throws, as test/helpers/failpoint.ts's
// crash does) and the model's handle goes on as a new connection.
//
// What is compared after a step, model against code:
// - the projection of each item (commit.qnt `projOf`): live, content, kind
//   and confidence (the model's meta). The model has no item status; a live
//   model item is a code item that is not retired, and a retired code item,
//   whatever retired it, is no item (specs/README.md, "Item status");
// - the store's record of each item: present, content, the kind it claims,
//   its confidence;
// - the open offboarding marks (commit.qnt `openMarks`), by position;
// - the trail of decisions: the model's log against every event of the
//   code's log, in log order, with exactly one rule left out: an adoption's
//   retraction (engram/adopt/retract), which the model does not have and
//   whose effect, a retired item, the projection's status comparison sees.
//   Every other plane event, of any rule, is in the trail, so an event the
//   model has no counterpart for is a mismatch at the step it is appended;
// - which handles are inside a call.
//
// A divergence is attributed to a finding (FINDINGS) only by a mark of that
// finding about the item the divergence is about, appended at or before the
// diverging step, and only for the kinds of difference the finding can
// cause (KINDS); with no such mark it is "unexplained".

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import type { Adapter, StoreRef } from "../../src/adapter.ts";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { allEvents, currentItems, ERASURE_ID, NOT_FOUND_CLAUSE } from "../../src/events.ts";
import { itemById } from "../../src/items.ts";
import { ADOPT_RETRACT_ID } from "../../src/plane/adopt.ts";
import {
  ADOPT_ERASED_ID,
  ADOPT_WITHDRAWN_ID,
  closesClause,
  ERASING_ID,
  OFFBOARD_BEGIN_ID,
  OFFBOARD_REPORT_ID,
  WRITE_CONFLICT_ID,
} from "../../src/plane/commit.ts";
import { WRITE_ERASED_ID } from "../../src/plane/write.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  offboard,
  type PlaneDeps,
} from "../../src/plane.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";
import { id, item, testPolicy } from "../unit/plane/helpers.ts";
import {
  forced,
  IMPORT,
  type Item,
  MODEL,
  modelState,
  NONE,
  openMarks,
  projOf,
  type State,
  type Trace,
  USER,
} from "./itf.ts";

export const PERSON = "person:dana";
export const ITEMS = ["a", "b"] as const;
/** The model's items as the code's ids, in id order (the erasure deletes in it). */
export const ID: Record<string, string> = { a: id(1), b: id(2) };
const NAME = new Map(Object.entries(ID).map(([k, v]) => [v, k]));

const KIND: Record<number, MemoryItem["provenance"]["kind"]> = {
  [USER]: "user",
  [IMPORT]: "import",
  [MODEL]: "model",
};
const RANK: Record<string, number> = { user: USER, import: IMPORT, model: MODEL };

/** The model's content n as the code's. */
export const text = (n: number) => `memory ${n}`;
const number = (s: unknown) => {
  const m = typeof s === "string" ? /^memory (\d+)$/.exec(s) : null;
  return m ? Number(m[1]) : -100;
};
/** The model's meta (0 for what the plane wrote, n for the n-th outside edit) as a confidence. */
const confidence = (meta: number) => (90 - 10 * meta) / 100;
const metaOf = (c: number) => Math.round((0.9 - c) * 10);

/** One policy: every source the model writes with, and adoption's import, allowed into the person scope. */
export function replayPolicy(): Policy {
  return testPolicy({
    write: [
      {
        scope: "person",
        allowed_sources: ["user", "document", "import", "model"],
        confidence_floor: 0.5,
        forbidden_classes: [],
        requires_review: false,
      },
    ],
  });
}

const writer = (kind: number): Actor => ({
  id: PERSON,
  level: "person",
  memberships: [PERSON],
  source: KIND[kind],
});
const hr: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", PERSON],
  source: "user",
};
const owner: Actor = { id: PERSON, level: "person", memberships: [PERSON], source: "user" };

/** The handle was killed at a point (obStop): its call and every later one throws. */
export class Killed extends Error {
  constructor() {
    super("the handle was stopped by the replay (obStop)");
    this.name = "Killed";
  }
}

/** A replay that could not go on: the trace asked for something the code's state does not allow. */
export class ReplayError extends Error {}

interface Point {
  op: "write" | "delete" | "read" | "list";
  phase: "before" | "after";
  /** The model's name of the item the call is about, or "" for a list. */
  iid: string;
  /** For a read: whether the store had a record. */
  found?: boolean;
  go(kill: boolean): void;
}

interface Handle {
  name: string;
  raw: Db;
  deps: PlaneDeps;
  dead: boolean;
  busy: boolean;
  at: Point | null;
  error: unknown;
  wake: (() => void) | null;
  /** The order the next list returns the store's records in (model names). */
  order: string[];
}

export interface Mismatch {
  /** The index of the step (1 for the first step after init). */
  step: number;
  action: string;
  what: string;
  model: unknown;
  code: unknown;
}

export interface Replayed {
  steps: number;
  /** Steps after which the state was compared (no handle inside a synchronous stretch). */
  compared: number;
  /** Steps driven that the code ran in the stretch of the one before. */
  folded: number;
  mismatch: Mismatch | null;
  /**
   * Why the replay diverged, when it did: the finding of card E1.8 whose mark
   * about the diverging item, at or before the diverging step and of a kind
   * it can cause, is the latest (FINDINGS, KINDS), or "unexplained".
   */
  finding: Finding | null;
  /** The code's state after the last step. */
  final: CodeState;
}

/**
 * The divergences of the code from the model card E1.8 found, each a
 * `finding` log entry and a pinned test in trace-replay.test.ts. A replay
 * that diverges is attributed to one only as `attribute` says.
 */
export const FINDINGS = {
  /**
   * Adoption retires a projected item the store no longer lists, or whose
   * listed record it refused (adopt.ts adoptStoreItems), and the retirement
   * is an allowed change other handles' checks count. The model has no
   * retraction (specs/README.md, "Item status"), and the code appends one
   * even while the item's person scope is being erased.
   */
  "E18-F1": "an adoption's retraction, which the model leaves out",
  /**
   * A record adoption refused while its scope was being erased
   * (engram/offboard/erasing) is never adopted after the erasure completes
   * while it holds the same bytes: adoption treats the same-hash deny as
   * final (adopt.ts, "denied before with the same hash"). The model adopts it.
   */
  "E18-F2": "a record refused while its scope was erased is never adopted after",
  /**
   * The model's own-bytes test (commit.qnt touchedSince's `ign`) compares
   * content only; the code's (commit.ts ownBytes, recovery) compares every
   * field but provenance and grants. An adoption of a writer's bytes whose
   * confidence was edited by hand is the writer's own in the model and a
   * change in the code.
   */
  "E18-F3": "own bytes with a hand-edited confidence",
  /**
   * A record whose purge adoption already decided (an engram/adopt/erased
   * deny of the same bytes) is deleted again by a later adoption without the
   * deferral the model applies to a listing older than a change (adopt.ts,
   * `decided`), and without an event.
   */
  "E18-F4": "a repeated purge skips the listing's deferral",
  /**
   * The settle writes a withdrawal's put-back at a version above the
   * projection's before it commits; an adoption in between records that
   * record as a change, which the model, without versions, holds unchanged.
   */
  "E18-F5": "a record that differs from the projection only in its version",
  /**
   * A withdrawal to nothing leaves the item retired in the code (a removal
   * in the model, specs/README.md "Item status"), and the code goes on
   * treating it as the plane's item: a stale writer's settle puts it back
   * into the store (commit.ts wanted returns it), so the stale bytes the
   * withdrawal undid are written back as its record, and adoption takes its
   * kind as the ceiling of a new record under its id.
   */
  "E18-F6": "a withdrawal to nothing leaves a retired item the code still holds",
  /**
   * An erasure whose read finds no record (a stale writer's settle deleted
   * it a moment before) records the item's content as left in the store
   * (offboard.ts, not found); adoption then refuses a record under the
   * erased id holding that content without purging it, where the model,
   * which has no such path, refuses and purges.
   */
  "E18-F7": "an erasure that finds no record makes adoption refuse without a purge",
  /**
   * The erasure reads every projected item of the person scope, of any
   * status (offboard.ts, currentItems), so it erases, with an erase event,
   * an item a withdrawal to nothing left retired. The model removed that
   * item and erases nothing. The code is right to erase every status; the
   * difference is the model's (E18-F6's status), seen at the erasure.
   */
  "E18-F8": "the erasure erases an item a withdrawal left retired",
} as const;

export type Finding = keyof typeof FINDINGS | "unexplained";

/** The kinds of difference a mismatch is: which part of the state differs. */
export type Kind = "projection" | "store" | "marks" | "trail" | "busy" | "call";

/** The kinds of difference each finding can cause. */
export const KINDS: Record<keyof typeof FINDINGS, readonly Kind[]> = {
  "E18-F1": ["projection", "trail", "busy"],
  "E18-F2": ["projection"],
  "E18-F3": ["projection", "store", "trail", "busy"],
  "E18-F4": ["trail", "busy"],
  "E18-F5": ["projection", "trail", "busy"],
  "E18-F6": ["projection", "store", "trail", "busy"],
  "E18-F7": ["store", "trail", "busy"],
  "E18-F8": ["marks", "trail", "busy"],
};

/** A finding's mark: what showed it, at which step, about which item. */
export interface Mark {
  finding: keyof typeof FINDINGS;
  step: number;
  item: string;
}

/** The kind of a mismatch, from its `what`. */
export function kindOf(what: string): Kind {
  if (what.startsWith("the projection")) return "projection";
  if (what.startsWith("the store record")) return "store";
  if (what.startsWith("the open offboarding marks")) return "marks";
  if (what.startsWith("the trail")) return "trail";
  if (what.startsWith("whether handle")) return "busy";
  return "call";
}

/** The items a mismatch is about: named in it, the first differing trail entry's, the step's. */
export function subjects(
  m: Mismatch,
  actionItem: string,
  handleItems: readonly string[],
): Set<string> {
  const out = new Set<string>();
  // The open marks are the scope's, not an item's: every item.
  if (kindOf(m.what) === "marks") for (const x of ITEMS) out.add(x);
  const named = /of ([ab])$/.exec(m.what);
  if (named) out.add(named[1] as string);
  if (kindOf(m.what) === "trail") {
    const a = (m.model ?? []) as string[];
    const b = (m.code ?? []) as string[];
    for (let k = 0; k < Math.max(a.length, b.length); k++) {
      if (a[k] === b[k]) continue;
      for (const e of [a[k], b[k]]) {
        const last = e?.split(" ").at(-1);
        if (last === "a" || last === "b") out.add(last);
      }
      break;
    }
  }
  if (kindOf(m.what) === "busy" || kindOf(m.what) === "call") {
    if (actionItem) out.add(actionItem);
    for (const x of handleItems) if (x) out.add(x);
  }
  return out;
}

/** The finding a mismatch is attributed to: the latest mark about its items, at or before its step, of a kind it can cause. */
export function attribute(m: Mismatch, marks: readonly Mark[], items: Set<string>): Finding {
  const kind = kindOf(m.what);
  let best: Mark | null = null;
  for (const mark of marks) {
    if (mark.step > m.step || !items.has(mark.item) || !KINDS[mark.finding].includes(kind))
      continue;
    if (!best || mark.step >= best.step) best = mark;
  }
  return best ? best.finding : "unexplained";
}

export interface CodeState {
  proj: Record<string, Item>;
  store: Record<string, { present: boolean; content: number; kind: number; meta: number }>;
  marks: number[];
  trail: string[];
  busy: Record<string, boolean>;
  /** Every event of the code's log, briefly: rule, decision, item, reason. */
  events: string[];
}

const LOOPS = new Set([
  "obSweepDecide",
  "obSweepKeep",
  "adoptSkip",
  "adoptDefer",
  "adoptRefuseErased",
  "adoptRefuseErasing",
  "adopt",
]);
const ENDS = new Set(["obReport", "adoptDone", "obStop", "adoptList", "obBegin"]);

function timeAt(step: number): string {
  const m = Math.floor(step / 60);
  const s = step % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return `2026-11-28T${two(10 + Math.floor(m / 60))}:${two(m % 60)}:${two(s)}Z`;
}

/** What the results file records of one trace. */
export function outcome(r: Replayed) {
  const base = { steps: r.steps, compared: r.compared, folded: r.folded };
  if (!r.mismatch) return { ...base, outcome: "replayed" as const, matched: r.steps };
  return {
    ...base,
    outcome: "diverged" as const,
    matched: r.mismatch.step - 1,
    step: r.mismatch.step,
    action: r.mismatch.action,
    what: r.mismatch.what,
    finding: r.finding,
  };
}

/** Replays one trace; returns at the first mismatch. */
export async function replay(trace: Trace): Promise<Replayed> {
  const states = trace.states.map(modelState);
  const dir = mkdtempSync(join(tmpdir(), "engram-e18-"));
  const file = join(dir, "plane.sqlite");
  const store = createFakeAdapter({ history: false });
  const policy = replayPolicy();
  let ids = 0;
  const newId = () => id(1000 + ++ids);
  const handles = new Map<string, Handle>();
  const opened: Db[] = [];
  /** The findings' marks the code's run showed (FINDINGS), with their steps. */
  const marks: Mark[] = [];
  /** The step being driven, for the marks the store's list makes. */
  let current = 0;
  /** How many of the code's events the marks have read. */
  let read = 0;

  const open = (name: string): Handle => {
    const raw = openSqlite(file);
    opened.push(raw);
    if (opened.length === 1) migrate(raw);
    const h: Handle = {
      name,
      raw,
      deps: undefined as unknown as PlaneDeps,
      dead: false,
      busy: false,
      at: null,
      error: undefined,
      wake: null,
      order: [],
    };
    const alive = () => {
      if (h.dead) throw new Killed();
    };
    const db: Db = {
      dialect: raw.dialect,
      exec: (sql) => {
        alive();
        raw.exec(sql);
      },
      prepare: (sql) => {
        alive();
        const s = raw.prepare(sql);
        return {
          run: (...p) => {
            alive();
            return s.run(...p);
          },
          get: (...p) => {
            alive();
            return s.get(...p);
          },
          all: (...p) => {
            alive();
            return s.all(...p);
          },
        };
      },
      transaction: (fn) => {
        alive();
        return raw.transaction(fn);
      },
      close: () => raw.close(),
    };
    const point = async (
      op: Point["op"],
      phase: Point["phase"],
      itemId: string,
      found?: boolean,
    ) => {
      alive();
      await new Promise<void>((resolve, reject) => {
        h.at = {
          op,
          phase,
          iid: NAME.get(itemId) ?? itemId,
          ...(found === undefined ? {} : { found }),
          go: (kill) => (kill ? reject(new Killed()) : resolve()),
        };
        h.wake?.();
      });
      alive();
    };
    const adapter = Object.create(store) as Adapter;
    adapter.write = async (it) => {
      await point("write", "before", it.id);
      const ref = await store.write(it);
      await point("write", "after", it.id);
      return ref;
    };
    adapter.delete = async (ref) => {
      await point("delete", "before", ref.key);
      await store.delete(ref);
      await point("delete", "after", ref.key);
    };
    adapter.read = async (ref) => {
      await point("read", "before", ref.key);
      const got = await store.read(ref);
      await point("read", "after", ref.key, got !== undefined);
      return got;
    };
    adapter.list = async (scope) => {
      alive();
      const listed = await store.list(scope);
      const rank = (i: MemoryItem) => {
        const k = h.order.indexOf(NAME.get(i.id) ?? "");
        return k < 0 ? h.order.length : k;
      };
      listed.sort((x, y) => rank(x) - rank(y) || (x.id < y.id ? -1 : 1));
      for (const r of listed) {
        const held = itemById(raw, r.id);
        if (
          held &&
          held.version !== r.version &&
          held.content === r.content &&
          held.confidence === r.confidence
        )
          marks.push({ finding: "E18-F5", step: current, item: NAME.get(r.id) ?? r.id });
      }
      await point("list", "after", "");
      return listed;
    };
    h.deps = { db, adapter, policy, newId };
    handles.set(name, h);
    return h;
  };
  for (const name of [...(states[0]?.pc.keys() ?? [])].sort()) open(name);

  /** Waits until the handle stops at a point or its call settles. */
  const settle = (h: Handle) =>
    new Promise<void>((resolve, reject) => {
      if (h.at || !h.busy) return resolve();
      const timer = setTimeout(() => {
        h.wake = null;
        reject(
          new ReplayError(`handle ${h.name} neither stopped at a point nor finished within 5 s`),
        );
      }, 5000);
      h.wake = () => {
        clearTimeout(timer);
        h.wake = null;
        resolve();
      };
    });

  const release = (h: Handle, kill = false) => {
    const p = h.at;
    h.at = null;
    p?.go(kill);
  };

  /** Runs the handle on until `stop` accepts the point it reaches, or its call settles. */
  const advance = async (h: Handle, stop: (p: Point) => boolean = () => true) => {
    if (!h.busy)
      throw new ReplayError(`handle ${h.name} is idle in the code but inside a call in the model`);
    release(h);
    for (;;) {
      await settle(h);
      if (!h.at) return;
      if (stop(h.at)) return;
      release(h);
    }
  };

  const start = async (h: Handle, call: () => Promise<unknown>) => {
    if (h.busy)
      throw new ReplayError(`handle ${h.name} is inside a call in the code but idle in the model`);
    h.busy = true;
    h.error = undefined;
    call().then(
      () => {
        h.busy = false;
        h.wake?.();
      },
      (e: unknown) => {
        h.busy = false;
        h.error = e;
        h.wake?.();
      },
    );
    await settle(h);
  };

  /** The order the call starting or continuing at step i takes the store's records in. */
  const orderFrom = (i: number, name: string) => {
    const order: string[] = [];
    for (let j = i + 1; j < states.length; j++) {
      const a = (states[j] as State).lastAction;
      if (a.handle !== name) continue;
      if (ENDS.has(a.name)) break;
      if (LOOPS.has(a.name) && !order.includes(a.iid)) order.push(a.iid);
    }
    return order;
  };

  const codeState = (): CodeState => {
    const raw = opened.at(-1) as Db;
    const proj: CodeState["proj"] = {};
    const recs: CodeState["store"] = {};
    for (const x of ITEMS) {
      const it = itemById(raw, ID[x] as string);
      proj[x] =
        it && it.status !== "retired"
          ? {
              live: true,
              content: number(it.content),
              kind: RANK[it.provenance.kind] ?? -1,
              meta: metaOf(it.confidence),
            }
          : NONE;
    }
    return { proj, store: recs, marks: [], trail: [], busy: {}, events: [] };
  };

  const snapshot = async (): Promise<CodeState> => {
    const raw = opened.at(-1) as Db;
    const s = codeState();
    for (const x of ITEMS) {
      const r = await store.read({ adapter: store.name, key: ID[x] as string } as StoreRef);
      s.store[x] = r
        ? {
            present: true,
            content: number(r.content),
            kind: RANK[r.provenance.kind] ?? -1,
            meta: metaOf(r.confidence),
          }
        : { present: false, content: -1, kind: 0, meta: 0 };
    }
    const events = allEvents(raw);
    s.marks = codeMarks(events);
    s.trail = codeTrail(events);
    if (process.env.ENGRAM_E18_DEBUG)
      for (const x of ITEMS) {
        console.log("projected", x, JSON.stringify(itemById(raw, ID[x] as string)));
        console.log(
          "stored   ",
          x,
          JSON.stringify(
            await store.read({ adapter: store.name, key: ID[x] as string } as StoreRef),
          ),
        );
      }
    s.events = events.map(
      (e) =>
        `${e.seq} ${e.op} ${e.policy_id} ${e.decision} ${e.item_id === null ? "" : (NAME.get(e.item_id) ?? e.item_id)}: ${e.reason}`,
    );
    for (const [name, h] of handles) s.busy[name] = h.busy;
    return s;
  };

  const compare = (step: number, action: string, m: State, c: CodeState): Mismatch | null => {
    const miss = (what: string, model: unknown, code: unknown): Mismatch => ({
      step,
      action,
      what,
      model,
      code,
    });
    const proj = projOf(ITEMS, m.log);
    for (const x of ITEMS) {
      const a = proj.get(x) as Item;
      const b = c.proj[x] as Item;
      const pa = a.live ? a : NONE;
      if (
        pa.live !== b.live ||
        (pa.live && (pa.content !== b.content || pa.kind !== b.kind || pa.meta !== b.meta))
      )
        return miss(`the projection of ${x}`, pa, b);
      const r = m.store.get(x);
      const sa = r?.present
        ? { present: true, content: r.content, kind: r.kind, meta: r.meta }
        : { present: false, content: -1, kind: 0, meta: 0 };
      const sb = c.store[x];
      if (JSON.stringify(sa) !== JSON.stringify(sb))
        return miss(`the store record of ${x}`, sa, sb);
    }
    const ma = openMarks(m.log);
    if (JSON.stringify(ma) !== JSON.stringify(c.marks))
      return miss("the open offboarding marks", ma, c.marks);
    const ta = modelTrail(states, step);
    if (JSON.stringify(ta) !== JSON.stringify(c.trail))
      return miss("the trail of decisions", ta, c.trail);
    for (const [name, p] of m.pc) {
      const inside = p.tag !== "idle";
      if (inside !== c.busy[name])
        return miss(`whether handle ${name} is inside a call`, p.tag, c.busy[name]);
    }
    return null;
  };

  /**
   * The marks the code's events appended since the last call show, at step
   * i: E18-F1 a retraction, E18-F6 a withdrawal to nothing (a retire),
   * E18-F7 an erasure that found no record, E18-F8 an offboarding begun
   * while the scope holds a retired item (it will erase it) or an erasure of
   * an item whose last allowed event retired it.
   */
  const codeMarksAt = (i: number) => {
    const events = allEvents(opened.at(-1) as Db);
    for (const e of events.slice(read)) {
      if (e.policy_id === OFFBOARD_BEGIN_ID && e.decision === "allow")
        for (const held of currentItems(opened.at(-1) as Db))
          if (held.scope === PERSON && held.status === "retired")
            marks.push({ finding: "E18-F8", step: i, item: NAME.get(held.id) ?? held.id });
      if (e.item_id === null) continue;
      const x = NAME.get(e.item_id) ?? e.item_id;
      if (e.policy_id === ADOPT_RETRACT_ID) marks.push({ finding: "E18-F1", step: i, item: x });
      if (e.policy_id === ADOPT_WITHDRAWN_ID && e.op === "retire")
        marks.push({ finding: "E18-F6", step: i, item: x });
      if (e.policy_id === ERASURE_ID) {
        if (e.reason.includes(NOT_FOUND_CLAUSE))
          marks.push({ finding: "E18-F7", step: i, item: x });
        const before = events
          .filter((o) => o.seq < e.seq && o.item_id === e.item_id && o.decision === "allow")
          .at(-1);
        if (before?.op === "retire" && before.policy_id !== ERASURE_ID)
          marks.push({ finding: "E18-F8", step: i, item: x });
      }
    }
    read = events.length;
  };

  let compared = 0;
  let folded = 0;
  let mismatch: Mismatch | null = null;
  try {
    for (let i = 1; i < states.length && !mismatch; i++) {
      current = i;
      const prev = states[i - 1] as State;
      const next = states[i] as State;
      const a = next.lastAction;
      const at = timeAt(i);
      const h = a.handle === "" ? undefined : handles.get(a.handle);
      const must = forced(prev);
      if (must !== "" && must !== a.handle)
        throw new ReplayError(
          `step ${i} (${a.name}) is on ${a.handle}, but the schedule has ${must} go on: not a trace of specs/replay.qnt`,
        );
      try {
        if (must !== "") folded++;
        else if (a.name === "decide") {
          const x = a.iid;
          const p = next.pc.get(a.handle);
          const kind = p?.tag === "decided" ? p.kind : (next.log.at(-1)?.kind ?? USER);
          const held = itemById(h?.raw as Db, ID[x] as string);
          const input = item(1, {
            id: ID[x],
            scope: PERSON,
            owner: PERSON,
            content: text(prev.nextContent),
            version: held?.version ?? 1,
          });
          const handle = h as Handle;
          await start(handle, () => createPlane(handle.deps).write(writer(kind), input, at));
        } else if (a.name === "obBegin") {
          const handle = h as Handle;
          handle.order = orderFrom(i, handle.name);
          await start(handle, () => offboard(handle.deps, hr, { person: PERSON, roles: [] }, at));
        } else if (a.name === "adoptList") {
          const handle = h as Handle;
          handle.order = orderFrom(i, handle.name);
          await start(handle, () => adoptStoreItems(handle.deps, owner, PERSON, at));
        } else if (a.name === "obDelete") {
          await advance(
            h as Handle,
            (p) =>
              p.iid === a.iid &&
              ((p.op === "delete" && p.phase === "after") ||
                (p.op === "read" && p.phase === "after" && !p.found)),
          );
        } else if (a.name === "obErase") {
          const handle = h as Handle;
          handle.order = orderFrom(i, handle.name);
          await advance(handle);
        } else if (a.name === "obStop") {
          const handle = h as Handle;
          handle.dead = true;
          release(handle, true);
          await settle(handle);
          if (!(handle.error instanceof Killed))
            throw new ReplayError(
              `the stopped handle ${handle.name} ended with ${String(handle.error)}`,
            );
          handles.delete(handle.name);
          open(handle.name);
        } else if (a.name === "outsideEdit") {
          const x = a.iid;
          const r = next.store.get(x);
          const ref = { adapter: store.name, key: ID[x] as string } as StoreRef;
          const was = await store.read(ref);
          const held = itemById(opened.at(-1) as Db, ID[x] as string);
          await store.write(
            item(1, {
              id: ID[x],
              scope: PERSON,
              owner: PERSON,
              content: text(prev.nextContent),
              kind: KIND[r?.kind ?? USER],
              version: Math.max(was?.version ?? 1, held?.version ?? 1),
            }),
          );
        } else if (a.name === "outsideEditMeta") {
          const x = a.iid;
          const ref = { adapter: store.name, key: ID[x] as string } as StoreRef;
          const was = await store.read(ref);
          if (!was)
            throw new ReplayError(`outsideEditMeta(${x}) finds no record in the code's store`);
          await store.write({
            ...was,
            confidence: confidence(next.store.get(x)?.meta ?? 0),
          } as MemoryItem);
        } else await advance(h as Handle);
      } catch (e) {
        if (!(e instanceof ReplayError)) throw e;
        mismatch = { step: i, action: a.name, what: e.message, model: null, code: null };
        break;
      }
      for (const handle of handles.values())
        if (handle.error !== undefined && !(handle.error instanceof Killed)) {
          mismatch = {
            step: i,
            action: a.name,
            what: `handle ${handle.name}'s call threw`,
            model: null,
            code: String(handle.error),
          };
          handle.error = undefined;
        }
      codeMarksAt(i);
      if (mismatch) break;
      if (forced(next) !== "") continue;
      compared++;
      mismatch = compare(
        i,
        `${a.name}(${a.handle}${a.iid ? `, ${a.iid}` : ""})`,
        next,
        await snapshot(),
      );
    }
    const final = await snapshot();
    let finding: Finding | null = null;
    if (mismatch) {
      const at = states[mismatch.step] as State;
      // The items the handle a mismatch names (or the step's handle) acted
      // on in its current call: back to the step that began it.
      const named = /handle (h\d)/.exec(mismatch.what)?.[1] ?? at.lastAction.handle;
      const handleItems: string[] = [];
      for (let j = mismatch.step; j > 0; j--) {
        const a = (states[j] as State).lastAction;
        if (a.handle !== named) continue;
        handleItems.push(a.iid);
        if (["decide", "obBegin", "adoptList"].includes(a.name)) break;
      }
      finding = attribute(
        mismatch,
        [...marks, ...modelMarks(states, mismatch.step)],
        subjects(mismatch, at.lastAction.iid, handleItems),
      );
    }
    return { steps: states.length - 1, compared, folded, mismatch, finding, final };
  } finally {
    for (const h of handles.values()) {
      h.dead = true;
      if (h.at) release(h, true);
    }
    await Promise.all([...handles.values()].map((h) => settle(h).catch(() => undefined)));
    for (const db of opened)
      try {
        db.close();
      } catch {
        // already closed
      }
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The findings' marks a model trace carries up to state `upTo`:
 * - E18-F2: an adoption allows a record whose bytes the item's last write
 *   event, an adoption's engram/offboard/erasing deny, refused;
 * - E18-F3: an adoption records, with a confidence edited by hand, the
 *   content a writer then in flight wrote;
 * - E18-F4: an adoption defers or skips a record whose bytes the item's last
 *   write event, an adoption's engram/adopt/erased deny, refused, while the
 *   id is still projected as no item.
 */
function modelMarks(states: readonly State[], upTo: number): Mark[] {
  const out: Mark[] = [];
  const last = new Map<string, { rule: string; adopted: boolean; deny: boolean; bytes: string }>();
  for (let j = 1; j <= upTo && j < states.length; j++) {
    const prev = states[j - 1] as State;
    const s = states[j] as State;
    const a = s.lastAction;
    const rec = prev.pc.get(a.handle)?.listing.get(a.iid);
    const bytes = rec ? `${rec.content}/${rec.kind}/${rec.meta}` : "";
    const was = last.get(a.iid);
    if (
      (a.name === "adoptDefer" || a.name === "adoptSkip") &&
      was?.rule === ADOPT_ERASED_ID &&
      was.bytes === bytes
    )
      if (!projOf(ITEMS, prev.log).get(a.iid)?.live)
        out.push({ finding: "E18-F4", step: j, item: a.iid });
    for (const e of s.log.slice(prev.log.length)) {
      if (!WRITE_OPS.has(e.rule)) continue;
      const eb = e.adopted ? bytes : "";
      const before = last.get(e.iid);
      if (
        e.adopted &&
        e.decision === "allow" &&
        before?.rule === ERASING_ID &&
        before.adopted &&
        before.bytes === eb
      )
        out.push({ finding: "E18-F2", step: j, item: e.iid });
      if (e.adopted && e.decision === "allow" && e.meta !== 0)
        for (const p of prev.pc.values())
          if (
            p.content === e.content &&
            ["decided", "wrote", "settling", "settleStore", "settleConfirm"].includes(p.tag)
          )
            out.push({ finding: "E18-F3", step: j, item: e.iid });
      if (
        e.adopted &&
        e.decision === "deny" &&
        before?.deny &&
        before.adopted &&
        before.bytes === eb
      )
        continue;
      last.set(e.iid, { rule: e.rule, adopted: e.adopted, deny: e.decision === "deny", bytes: eb });
    }
  }
  return out;
}

/** The model's events the code records as `write` events (the rest are retire and update events). */
const WRITE_OPS = new Set([
  "gate/allow",
  WRITE_CONFLICT_ID,
  ERASING_ID,
  WRITE_ERASED_ID,
  ADOPT_ERASED_ID,
]);

/**
 * The model's log up to state `upTo` as the code records it. One rule of the
 * code the model leaves out is applied (a finding of card E1.8): adoption
 * appends no event for a record whose bytes the item's last write event
 * already denied (adopt.ts, "denied before with the same hash"; a purge it
 * decided is repeated without one). So an adoption's deny of a record whose
 * bytes, as listed, equal those of the item's last recorded write event, an
 * adoption's deny, is dropped here.
 */
function modelTrail(states: readonly State[], upTo: number): string[] {
  const out: string[] = [];
  const last = new Map<string, { deny: boolean; bytes: string }>();
  for (let j = 1; j <= upTo; j++) {
    const before = (states[j - 1] as State).log.length;
    const s = states[j] as State;
    // One erasure's events in id order, as the code appends them (the
    // model's fold over a set takes its own order).
    const appended = s.log
      .slice(before)
      .map((e, k) => ({ e, k: e.rule === ERASURE_ID ? 1000 + ITEMS.indexOf(e.iid as "a") : k }))
      .sort((x, y) => x.k - y.k)
      .map(({ e }) => e);
    for (const e of appended) {
      const rule = e.rule === "gate/allow" ? (e.adopted ? "adopt" : "write") : e.rule;
      if (WRITE_OPS.has(e.rule)) {
        const rec = e.adopted
          ? (states[j - 1] as State).pc.get(s.lastAction.handle)?.listing.get(e.iid)
          : undefined;
        const bytes = rec ? `${rec.content}/${rec.kind}/${rec.meta}` : "";
        const was = last.get(e.iid);
        if (e.adopted && e.decision === "deny" && was?.deny && was.bytes === bytes) continue;
        last.set(e.iid, { deny: e.adopted && e.decision === "deny", bytes });
      }
      out.push(`${rule} ${e.decision} ${e.iid}`.trim());
    }
  }
  return out;
}

/**
 * The code's events as the model's trail: every event of the log but an
 * adoption's retraction (ADOPT_RETRACT_ID, the one rule left out; the
 * projection's status comparison sees its effect). A gate's decision on a
 * write, under the policy's own rule, is `write` or `adopt`, as the model's
 * `gate/allow`; every other event keeps its rule, so one the model does not
 * have (a store failure, a version or retired-content refusal, a narrowing,
 * an eviction) differs from the model's trail at the step it is appended.
 */
function codeTrail(events: readonly ReturnType<typeof allEvents>[number][]): string[] {
  const out: string[] = [];
  for (const e of events) {
    if (e.policy_id === ADOPT_RETRACT_ID) continue;
    const x = e.item_id === null ? "" : (NAME.get(e.item_id) ?? e.item_id);
    if (e.op === "write" && !e.policy_id.startsWith("engram/"))
      out.push(
        `${e.reason.startsWith("adopted from store ") ? "adopt" : "write"} ${e.decision} ${x}`,
      );
    else out.push(`${e.policy_id} ${e.decision} ${x}`.trim());
  }
  return out;
}

/** commit.ts erasureOpen over the code's events, by position, as openMarks does for the model's. */
function codeMarks(events: readonly ReturnType<typeof allEvents>[number][]): number[] {
  const begins = events.filter((e) => e.policy_id === OFFBOARD_BEGIN_ID && e.decision === "allow");
  const index = new Map(begins.map((e, k) => [e.id, k]));
  const open = new Set<string>();
  const at = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.decision !== "allow") continue;
    if (e.policy_id === OFFBOARD_BEGIN_ID) {
      open.add(e.id);
      at.set(e.id, new Set(open));
    } else if (e.policy_id === OFFBOARD_REPORT_ID)
      for (const [begin, then] of at)
        if (e.reason.includes(closesClause(begin))) for (const m of then) open.delete(m);
  }
  return [...open].map((b) => index.get(b) as number).sort((a, b) => a - b);
}

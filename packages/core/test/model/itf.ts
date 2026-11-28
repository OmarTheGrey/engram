// A small reader of the Informal Trace Format (ITF) for the traces Quint
// writes from specs/commit.qnt (card E1.8). The format is Apalache's ADR 015
// (https://apalache-mc.org/docs/adr/015adr-trace.html), which Quint
// (Apache-2.0, quint-co/quint, run at 0.33.1 through the Makefile) emits for
// `quint run --out-itf` and `quint test --out-itf`. Written here rather than
// taken from `@firfi/quint-connect`, which stays unusable (the absorb plan's
// long list); nothing is copied.
//
// A trace is `{ "#meta", vars, states }`; each state maps a variable to an
// ITF value: a string, a boolean, a list (a JSON array), a record (an
// object), `{ "#bigint": "n" }`, `{ "#map": [[k, v], ...] }`,
// `{ "#set": [...] }`, `{ "#tup": [...] }`. Quint names a variable by its
// module path (`replay::commit::log`); the reader keeps the last part.
//
// The rest of the file reads the decoded state as the model's, and restates,
// in TypeScript, the model's own functions the replay compares against: the
// projection (commit.qnt `projOf`), the open marks (`openMarks`), and the
// schedule of specs/replay.qnt (`forced`).
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

export type ItfValue =
  | string
  | boolean
  | number
  | ItfValue[]
  | Map<ItfValue, ItfValue>
  | Set<ItfValue>
  | { [k: string]: ItfValue };

/** Decodes one ITF value; integers become numbers (the model's are small). */
export function decode(v: unknown): ItfValue {
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v))
      throw new Error(`itf: a JSON number that is not a safe integer: ${v}`);
    return v;
  }
  if (Array.isArray(v)) return v.map(decode);
  if (v === null || typeof v !== "object")
    throw new Error(`itf: not a value: ${JSON.stringify(v)}`);
  const o = v as Record<string, unknown>;
  if ("#bigint" in o) {
    const n = Number(o["#bigint"]);
    if (!Number.isSafeInteger(n)) throw new Error(`itf: a bigint out of range: ${o["#bigint"]}`);
    return n;
  }
  if ("#map" in o)
    return new Map((o["#map"] as [unknown, unknown][]).map(([k, x]) => [decode(k), decode(x)]));
  if ("#set" in o) return new Set((o["#set"] as unknown[]).map(decode));
  if ("#tup" in o) return (o["#tup"] as unknown[]).map(decode);
  if ("#unserializable" in o)
    throw new Error(`itf: an unserializable value: ${String(o["#unserializable"])}`);
  const out: { [k: string]: ItfValue } = {};
  for (const [k, x] of Object.entries(o)) if (k !== "#meta") out[k] = decode(x);
  return out;
}

export interface Trace {
  /** The file's `#meta`, as written. */
  meta: Record<string, unknown>;
  /** The variables, by their short names. */
  vars: string[];
  states: Record<string, ItfValue>[];
}

const short = (name: string) => name.slice(name.lastIndexOf("::") + 2);

/** Parses an ITF document (a trace as JSON text). */
export function parseTrace(text: string): Trace {
  const doc = JSON.parse(text) as {
    "#meta"?: Record<string, unknown>;
    vars: string[];
    states: Record<string, unknown>[];
  };
  if (!Array.isArray(doc.vars) || !Array.isArray(doc.states))
    throw new Error("itf: no vars or states");
  return {
    meta: doc["#meta"] ?? {},
    vars: [...new Set(doc.vars.map(short))],
    states: doc.states.map((s) => {
      const out: Record<string, ItfValue> = {};
      for (const [k, x] of Object.entries(s)) if (k !== "#meta") out[short(k)] = decode(x);
      return out;
    }),
  };
}

/** Reads a trace file, gzipped (`.gz`) or not. */
export function readTrace(path: string): Trace {
  const bytes = readFileSync(path);
  return parseTrace((path.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8"));
}

// ------------------------------------------------------------ the model's state

/** The model's provenance kinds as trust ranks (commit.qnt USER, IMPORT, MODEL). */
export const USER = 3;
export const IMPORT = 2;
export const MODEL = 1;
/** The content the log keeps for an erased item (commit.qnt REDACTED). */
export const REDACTED = -2;

export interface StoreRec {
  present: boolean;
  content: number;
  kind: number;
  meta: number;
  ext: boolean;
}

export interface Item {
  live: boolean;
  content: number;
  kind: number;
  meta: number;
}

export const NONE: Item = { live: false, content: -1, kind: 0, meta: 0 };

export interface Event {
  seq: number;
  rule: string;
  decision: string;
  iid: string;
  effect: string;
  content: number;
  kind: number;
  adopted: boolean;
  basis: number;
  closes: number;
  meta: number;
}

export interface Proc {
  tag: string;
  iid: string;
  content: number;
  kind: number;
  remaining: Set<string>;
  doomed: Set<string>;
  /** An adoption's listing of the store. */
  listing: Map<string, StoreRec>;
}

export interface Step {
  name: string;
  handle: string;
  iid: string;
}

export interface State {
  log: Event[];
  store: Map<string, StoreRec>;
  pc: Map<string, Proc>;
  nextContent: number;
  edits: number;
  erasedIds: Set<string>;
  erasedContent: Set<number>;
  lastAction: Step;
}

/** A decoded ITF state read as the model's state (commit.qnt's variables). */
export function modelState(s: Record<string, ItfValue>): State {
  const need = (k: string) => {
    if (!(k in s)) throw new Error(`itf: the state has no variable ${k}`);
    return s[k] as unknown;
  };
  return {
    log: need("log") as Event[],
    store: need("store") as Map<string, StoreRec>,
    pc: need("pc") as Map<string, Proc>,
    nextContent: need("nextContent") as number,
    edits: need("edits") as number,
    erasedIds: need("erasedIds") as Set<string>,
    erasedContent: need("erasedContent") as Set<number>,
    lastAction: need("lastAction") as Step,
  };
}

// ------------------------------------------------------------ the model's functions

const BEGIN = "engram/offboard/begin";
const REPORT = "engram/offboard/report";

/** commit.qnt `applyEv` and `projOf`: the projection of a log. */
export function projOf(items: readonly string[], log: readonly Event[]): Map<string, Item> {
  const p = new Map(items.map((x) => [x, NONE] as const));
  for (const e of log) {
    if (e.decision !== "allow" || e.iid === "") continue;
    if (e.effect === "set")
      p.set(e.iid, { live: true, content: e.content, kind: e.kind, meta: e.meta });
    else if (e.effect === "remove") p.set(e.iid, NONE);
  }
  return p;
}

/**
 * commit.qnt `openMarks`, by position: the indices (0 for the first begin
 * mark of the log) of the marks still open. A report closes the mark it
 * names and every mark open when that one was appended (V-1).
 */
export function openMarks(log: readonly Event[]): number[] {
  const open = new Set<number>();
  const at = new Map<number, Set<number>>();
  const index = new Map<number, number>();
  for (const e of log) {
    if (e.rule === BEGIN) {
      index.set(e.seq, index.size);
      open.add(e.seq);
      at.set(e.seq, new Set(open));
    } else if (e.rule === REPORT) for (const m of at.get(e.closes) ?? []) open.delete(m);
  }
  return [...open].map((seq) => index.get(seq) as number).sort((a, b) => a - b);
}

/** The steps after which the code goes on without a store call between (specs/replay.qnt CONTINUES). */
const CONTINUES = new Set([
  "commitStale",
  "settleAgain",
  "obErase",
  "obSweepKeep",
  "obSwept",
  "obSweepChanged",
  "obPutBackCheck",
]);
/** specs/replay.qnt ADOPT_CONTINUES. */
const ADOPT_CONTINUES = new Set(["adoptSkip", "adoptDefer", "adopt", "adoptRefuseErasing"]);

/** specs/replay.qnt `forced`: the handle that must take the next step, or "". */
export function forced(s: State): string {
  const { handle: h, name: n } = s.lastAction;
  if (h === "") return "";
  const p = s.pc.get(h);
  if (!p) return "";
  if (CONTINUES.has(n)) return h;
  if (n === "obBegin" && p.remaining.size === 0) return h;
  if (ADOPT_CONTINUES.has(n) && p.tag === "adopt") return h;
  return "";
}

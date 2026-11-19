// The seeded-fault generator (card L2): a LongMemEval memory state built as
// card B5 builds it, with labelled faults of four classes and an unfaulted
// near-miss beside each, all written through the Plane, for H3's lint
// precision and recall (docs/research/preregistration.md).
//
// The base state is B5's write phase (longmemeval/plane.ts): every turn of
// every history session, in session order and turn order, as the episodic
// item turnItem makes, written by turnActor at its own time. One change: an
// assistant turn's provenance names its model (ASSISTANT_MODEL), since B5's
// names none and the missing-provenance lint (card L1) would then flag every
// assistant turn, so the state would hold more "faults" than the generator
// put there (decision entry docs/log/2026-11-19-l2-decision-assistant-model.md).
//
// The faults (labels.ts SUBTYPES) are written between those turns: each
// group at a seeded anchor turn, timed 50 ms apart just after it, so the log
// keeps B5's order and an injected item sits where its time puts it. Their
// text comes from bank.ts, the same sentences for a fault and its near-miss.
// What is faulty is the field a keyed subtype keys (a valid_to before the
// lint time, an episodic class the tightened policy forbids, a provenance
// without its model, a source rewritten or retired after a note cited it) or
// the attribute and value an unkeyed subtype's sentence carries. Labels are
// returned beside the state and never reach a write, an item or a read.
//
// Seeds: each question draws from its own stream, seeded by the set's seed
// and its question id, so a question's faults do not depend on which other
// questions the set holds.
import { createHash } from "node:crypto";
import {
  type Actor,
  isExpired,
  LINT_IDS,
  loadPreset,
  type MemoryEvent,
  type MemoryItem,
  missingProvenance,
  type Plane,
  type Policy,
  strictContentHash,
} from "@engram/core";
import { readTime, turnActor, turnItem, USER } from "../longmemeval/plane.ts";
import type { VisibleQuestion, VisibleTurn } from "../longmemeval/strip.ts";
import {
  ASIDES,
  bounded,
  EDITS,
  excerpt,
  type Fact,
  NOTES,
  PERSONAL,
  QUALIFIERS,
  qualified,
  quote,
  RESTATEMENTS,
  STATEMENTS,
  statement,
  type Template,
  WORK,
  workStatement,
} from "./bank.ts";
import { type FaultLabel, label, SUBTYPE_IDS, SUBTYPES, type Subtype } from "./labels.ts";

/** The user's role scope (ADR 0021): where the user's work memory lives beside their person scope. */
export const ROLE_SCOPE = "role:user";
/** The policy the state is written and linted under: preset medium, adjusted (writePolicy, lintPolicy). */
export const POLICY_ID = "longmemeval.lint-set";
/** The model an assistant turn's provenance names: upstream's sessions do not say which model wrote them. */
export const ASSISTANT_MODEL = "longmemeval/assistant";
/** The model a note's provenance names when it names one. */
export const NOTE_MODEL = "engram/note-extractor";
/** Who lints the state: the user, a member of both their scopes. */
export const LINT_ACTOR: Actor = { id: USER, level: "person", memberships: [USER, ROLE_SCOPE] };

/** Injected writes after one anchor turn are this far apart. */
const STEP_MS = 50;
/** An anchor needs this much time before the lint time, so every write it carries lands before it. */
const ANCHOR_ROOM_MS = 1_500;
/** The ttl, in seconds, of an aside a retention sweep retires before the lint time. */
const SHORT_TTL = 1;
/** How long after its aside the sweep runs: past that ttl. */
const SWEEP_AFTER_MS = 1_001;

const USER_WRITER: Actor = { id: USER, level: "person", memberships: [USER], source: "user" };
const ROLE_WRITER: Actor = { ...LINT_ACTOR, source: "user" };
const NOTE_WRITER: Actor = { id: USER, level: "person", memberships: [USER], source: "model" };

/**
 * Preset medium with two changes for this set: no ttl in the person scope
 * (medium retires episodic items after 90 days, which would put most of a
 * LongMemEval history past its validity at the lint time; decision entry
 * docs/log/2026-11-19-l2-decision-lint-policy.md), and every lint enabled.
 */
function basePolicy(): Policy {
  const medium = loadPreset("medium");
  return {
    ...medium,
    id: POLICY_ID,
    retention: medium.retention.map((r) => (r.scope === "person" ? { ...r, ttl: null } : r)),
    lints: { ...medium.lints, enabled: [...LINT_IDS] },
  };
}

/** The policy at write time, version 1: the role scope still takes episodic items. */
export function writePolicy(): Policy {
  const base = basePolicy();
  return {
    ...base,
    version: 1,
    write: base.write.map((r) => (r.scope === "role" ? { ...r, forbidden_classes: [] } : r)),
  };
}

/** The policy at lint time, version 2: the role scope forbids episodic items, as medium does. */
export function lintPolicy(): Policy {
  return { ...basePolicy(), version: 2 };
}

/** One question's memory state: its event log, and where and by whom it is linted. */
export interface FaultState {
  question_id: string;
  /** The lint time: B5's read time (readTime), after every write. */
  at: string;
  actor: Actor;
  scopes: string[];
  events: MemoryEvent[];
}

/** What one question's state holds, counted as the generator built it. */
export interface StateStats {
  question_id: string;
  /** B5's turns in the base state. */
  turns: number;
  /** Of them, assistant turns, whose provenance the generator names a model for. */
  assistant_turns: number;
  /** Base turns past preset medium's own person-scope ttl at the lint time, which this set's policy drops. */
  past_medium_ttl: number;
  /**
   * Base turns L1's missing-provenance lint would flag as B5 writes them (an
   * assistant turn names no model); the generator names one, so they are
   * natural findings the set's state does not show.
   */
  b5_missing_provenance: number;
  /** Events in the state's log. */
  events: number;
}

export interface FaultSetOptions {
  seed: number;
  /** Faults of each subtype per question, each with its near-miss. */
  perQuestion: number;
}

/** A plane over a fresh log and store, and how to close it. */
export type PlaneFactory = (
  policy: Policy,
  newId: () => string,
) => { plane: Plane; close: () => void };

export interface FaultSet {
  /** The lint-time policy every state is linted under. */
  policy: Policy;
  states: FaultState[];
  labels: FaultLabel[];
  stats: StateStats[];
}

/** mulberry32, seeded by the set's seed and the question id. */
function stream(seed: number, questionId: string): () => number {
  let a = createHash("sha256").update(`${seed}:${questionId}`).digest().readUInt32BE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const pick = <T>(items: readonly T[], rand: () => number, what: string): T => {
  if (items.length === 0) throw new Error(`fault generator: no ${what} to choose from`);
  return items[Math.floor(rand() * items.length)] as T;
};

/** A base turn as B5 writes it, with an assistant turn's model named. */
interface BaseWrite {
  turn: VisibleTurn;
  position: { session: number; turn: number; date: string };
  at: string;
}

/**
 * What an injected write builds, given its id, its time, the items written
 * before it by key, and the next memory tool call ref a user write cites.
 */
type Build = (ctx: {
  id: string;
  at: string;
  item: (key: string) => MemoryItem;
  toolRef: () => string;
}) => MemoryItem;

/** An episodic or semantic item: every item the generator writes. */
type Knowledge = Extract<MemoryItem, { class: "episodic" | "semantic" }>;

interface WriteOp {
  kind: "write";
  key: string;
  actor: Actor;
  build: Build;
}

type Op =
  | WriteOp
  | { kind: "rewrite"; base: number; edit: (content: string) => string }
  | { kind: "sweep"; after: string };

const iso = (ms: number) => new Date(ms).toISOString();

function injected(
  over: Partial<Knowledge> & Pick<Knowledge, "class" | "scope" | "content" | "provenance">,
  id: string,
  at: string,
): MemoryItem {
  return {
    id,
    owner: USER,
    confidence: 0.9,
    valid_from: at,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    ...over,
  } as MemoryItem;
}

const ZERO_HASH = `sha256:${"0".repeat(64)}`;

/**
 * Plans, then writes, one question's state. Throws when a write the plan
 * makes is denied, or when the history is too short to place every group.
 */
export async function faultState(
  view: VisibleQuestion,
  opts: FaultSetOptions,
  open: PlaneFactory,
): Promise<{ state: FaultState; labels: FaultLabel[]; stats: StateStats }> {
  const rand = stream(opts.seed, view.question_id);
  const at = readTime(view);
  const atMs = Date.parse(at);
  /** A ttl in seconds long enough that an item written at `t` can end at or after the lint time. */
  const ttlTo = (t: number) => Math.ceil((atMs - t) / 1000) + 1;
  const base: BaseWrite[] = view.sessions.flatMap((s, si) =>
    s.turns.map((turn, ti) => {
      const position = { session: si, turn: ti, date: s.date };
      return { turn, position, at: turnItem(turn, position, "x").valid_from };
    }),
  );
  const timeOf = (i: number) => Date.parse((base[i] as BaseWrite).at);
  const anchors = base.map((_b, i) => i).filter((i) => timeOf(i) + ANCHOR_ROOM_MS <= atMs);
  const later = (i: number) => anchors.filter((j) => j > i && timeOf(j) > timeOf(i));
  const userTurns = shuffled(
    anchors.filter((i) => {
      const b = base[i] as BaseWrite;
      return b.turn.role === "user" && excerpt(b.turn.content).length >= 20 && later(i).length > 0;
    }),
    rand,
  );
  const personal = shuffled(PERSONAL, rand);
  const work = shuffled(WORK, rand);
  const take = (from: Fact[], what: string): Fact => {
    const f = from.shift();
    if (!f) throw new Error(`fault generator: ${view.question_id} ran out of ${what} attributes`);
    return f;
  };
  const values = (f: Fact) => shuffled(f.values, rand);
  // Two turns can share a first sentence; quoting both would make two notes
  // with one text, a real duplicate (review finding L2-2), so an excerpt
  // already quoted is skipped.
  const quoted = new Set<string>();
  const sourceTurn = () => {
    for (;;) {
      const i = userTurns.shift();
      if (i === undefined)
        throw new Error(`fault generator: ${view.question_id} has too few user turns to quote`);
      const e = excerpt((base[i] as BaseWrite).turn.content);
      if (quoted.has(e)) continue;
      quoted.add(e);
      return i;
    }
  };
  const said = (pool: readonly Template[], f: Fact, v: string) =>
    pick(pool, rand, "template")(f.attribute, v);

  const ops = new Map<number, Op[]>();
  const place = (anchor: number, op: Op) => ops.set(anchor, [...(ops.get(anchor) ?? []), op]);
  const marks: {
    key: string;
    subtype: Subtype;
    kind: FaultLabel["kind"];
    related: string[];
    variant: string | null;
  }[] = [];
  const mark = (
    key: string,
    subtype: Subtype,
    kind: FaultLabel["kind"],
    related: string[],
    variant: string | null = null,
  ) => marks.push({ key, subtype, kind, related, variant });
  const baseKey = (i: number) => `base/${i}`;

  const userFact = (key: string, content: string, over: Partial<Knowledge> = {}): WriteOp => ({
    kind: "write",
    key,
    actor: USER_WRITER,
    build: ({ id, at: t, toolRef }) =>
      injected(
        {
          class: "semantic",
          scope: USER,
          content,
          provenance: { kind: "user", ref: toolRef(), hash: ZERO_HASH, actor: USER },
          ...over,
        },
        id,
        t,
      ),
  });
  const noteOf = (key: string, source: string, content: string, named: boolean): WriteOp => ({
    kind: "write",
    key,
    actor: NOTE_WRITER,
    build: ({ id, at: t, item }) => {
      const src = item(source);
      return injected(
        {
          class: "semantic",
          scope: USER,
          content,
          provenance: {
            kind: "model",
            ref: src.id,
            hash: strictContentHash(src.content),
            actor: USER,
            ...(named ? { model: NOTE_MODEL } : {}),
          },
        },
        id,
        t,
      );
    },
  });

  for (let r = 0; r < opts.perQuestion; r++) {
    const k = (subtype: Subtype, kind: string, part: string) => `${subtype}/${r}/${kind}/${part}`;
    for (const subtype of SUBTYPE_IDS) {
      const variants: readonly string[] = SUBTYPES[subtype].variants;
      const variant = variants.length > 0 ? pick(variants, rand, "variant") : null;
      for (const kind of ["fault", "near-miss"] as const) {
        const fault = kind === "fault";
        const key = (part: string) => k(subtype, kind, part);
        switch (subtype) {
          case "expired-validity": {
            // At the boundary (review finding L2-1): the fault's validity ends
            // exactly at the lint time, which L1 counts as ended (valid_to not
            // after it; past ttl at it); the near-miss's one millisecond later.
            const f = take(personal, "personal");
            const [v] = values(f) as [string];
            const end = fault ? atMs : atMs + 1;
            const text = said(STATEMENTS, f, v);
            place(pick(anchors, rand, "anchor"), {
              kind: "write",
              key: key("item"),
              actor: USER_WRITER,
              build: (ctx) => {
                if (variant === "valid_to")
                  return userFact(key("item"), bounded(f.attribute, v, iso(end).slice(0, 10)), {
                    valid_to: iso(end),
                  }).build(ctx);
                const ttl = ttlTo(Date.parse(ctx.at));
                return userFact(key("item"), text, {
                  ttl,
                  valid_from: iso(end - ttl * 1000),
                }).build(ctx);
              },
            });
            mark(key("item"), subtype, kind, [], variant);
            break;
          }
          case "source-changed": {
            const src = sourceTurn();
            const content = (base[src] as BaseWrite).turn.content;
            place(src, noteOf(key("note"), baseKey(src), quote(excerpt(content)), true));
            const edit = pick(EDITS, rand, "edit");
            place(pick(later(src), rand, "later anchor"), {
              kind: "rewrite",
              base: src,
              edit: fault
                ? (c) => `${c} ${edit}`
                : (c) => (c.includes(" ") ? c.replace(" ", "  ") : `${c} `),
            });
            mark(key("note"), subtype, kind, [baseKey(src)]);
            break;
          }
          case "superseded": {
            const f = take(personal, "personal");
            const [v1, v2] = values(f) as [string, string];
            const i = pick(
              anchors.filter((a) => later(a).length > 0),
              rand,
              "anchor",
            );
            const j = pick(later(i), rand, "later anchor");
            // No cue word (review finding L2-1): the later restatement comes
            // from the same pool for a fault and its near-miss, so only the
            // value tells them apart. It shares the attribute's words, so card
            // L3's contradiction lint pairs and judges it.
            place(i, userFact(key("first"), said(STATEMENTS, f, v1)));
            place(j, userFact(key("then"), said(RESTATEMENTS, f, fault ? v2 : v1)));
            mark(key("first"), subtype, kind, [key("then")]);
            break;
          }
          case "conflict": {
            const f = take(personal, "personal");
            const [v1, v2] = values(f) as [string, string];
            const i = pick(anchors, rand, "anchor");
            place(i, userFact(key("first"), said(STATEMENTS, f, v1)));
            place(i, userFact(key("again"), said(RESTATEMENTS, f, fault ? v2 : v1)));
            mark(key("again"), subtype, kind, [key("first")]);
            break;
          }
          case "forbidden-class": {
            const f = take(work, "work");
            const [v] = values(f) as [string];
            place(pick(anchors, rand, "anchor"), {
              ...userFact(key("item"), workStatement(f.attribute, v), {
                class: fault ? "episodic" : "semantic",
                scope: ROLE_SCOPE,
              }),
              actor: ROLE_WRITER,
            });
            mark(key("item"), subtype, kind, []);
            break;
          }
          case "wrong-scope": {
            const f = fault ? take(personal, "personal") : take(work, "work");
            const [v] = values(f) as [string];
            const content = fault ? statement(f.attribute, v) : workStatement(f.attribute, v);
            place(pick(anchors, rand, "anchor"), {
              ...userFact(key("item"), content, { scope: ROLE_SCOPE }),
              actor: ROLE_WRITER,
            });
            mark(key("item"), subtype, kind, []);
            break;
          }
          case "missing-provenance": {
            const src = sourceTurn();
            const content = (base[src] as BaseWrite).turn.content;
            place(src, noteOf(key("note"), baseKey(src), quote(excerpt(content)), !fault));
            mark(key("note"), subtype, kind, [baseKey(src)]);
            break;
          }
          case "orphan": {
            const f = take(personal, "personal");
            const [v] = values(f) as [string];
            const i = pick(anchors, rand, "anchor");
            place(i, {
              kind: "write",
              key: key("aside"),
              actor: USER_WRITER,
              build: (ctx) => {
                // The near-miss's aside stays valid until one millisecond
                // after the lint time (review finding L2-1).
                const ttl = fault ? SHORT_TTL : ttlTo(Date.parse(ctx.at));
                const from = fault ? ctx.at : iso(atMs + 1 - ttl * 1000);
                return userFact(key("aside"), said(ASIDES, f, v), {
                  class: "episodic",
                  ttl,
                  valid_from: from,
                }).build(ctx);
              },
            });
            place(i, noteOf(key("note"), key("aside"), said(NOTES, f, v), true));
            if (fault) place(i, { kind: "sweep", after: key("aside") });
            mark(key("note"), subtype, kind, [key("aside")]);
            break;
          }
          case "unsupported-claim": {
            // Four ways a claim says more than its source (review finding
            // L2-1); the near-miss restates the aside, qualifier and all, in
            // a note's other words.
            const f = take(personal, "personal");
            const [v1, v2] = values(f) as [string, string];
            const q = pick(QUALIFIERS, rand, "qualifier");
            const sourceQualified = variant === "qualifier-dropped";
            const sourceText = said(ASIDES, f, v1);
            const i = pick(anchors, rand, "anchor");
            place(
              i,
              userFact(key("aside"), sourceQualified ? qualified(sourceText, q) : sourceText, {
                class: "episodic",
              }),
            );
            let claim: string;
            if (!fault) {
              const restated = said(NOTES, f, v1);
              claim = sourceQualified ? qualified(restated, q) : restated;
            } else if (variant === "other-attribute") {
              const g = take(personal, "personal");
              claim = said(NOTES, g, (values(g) as [string])[0]);
            } else if (variant === "other-value") claim = said(NOTES, f, v2);
            else if (variant === "qualifier-dropped") claim = said(NOTES, f, v1);
            else claim = qualified(said(NOTES, f, v1), q);
            place(i, noteOf(key("note"), key("aside"), claim, true));
            mark(key("note"), subtype, kind, [key("aside")], variant);
            break;
          }
        }
      }
    }
  }

  // Write: B5's turns in order, each followed by the groups anchored on it.
  let n = 0;
  const newId = () => `01960000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const { plane, close } = open(writePolicy(), newId);
  const written = new Map<string, MemoryItem>();
  const timeOfKey = new Map<string, number>();
  const item = (key: string) => {
    const it = written.get(key);
    if (!it) throw new Error(`fault generator: ${key} is cited before it is written`);
    return it;
  };
  const land = async (actor: Actor, it: MemoryItem, t: string, key: string) => {
    const result = await plane.write(actor, it, t);
    if (result.item === null)
      throw new Error(`fault generator: write of ${key} denied: ${result.event.reason}`);
    written.set(key, result.item);
  };
  const medium = loadPreset("medium");
  let pastTtl = 0;
  let b5Missing = 0;
  let calls = 0;
  const toolRef = () => `memory_write:${++calls}`;
  try {
    for (const [i, b] of base.entries()) {
      const turn = turnItem(b.turn, b.position, newId());
      const it: MemoryItem =
        b.turn.role === "assistant"
          ? { ...turn, provenance: { ...turn.provenance, model: ASSISTANT_MODEL } }
          : turn;
      if (isExpired(medium, it, at)) pastTtl++;
      if (missingProvenance(turn) !== null) b5Missing++;
      await land(turnActor(b.turn), it, b.at, baseKey(i));
      timeOfKey.set(baseKey(i), timeOf(i));
      for (const [slot, op] of (ops.get(i) ?? []).entries()) {
        const t = timeOf(i) + STEP_MS * (slot + 1);
        if (op.kind === "write") {
          const built = op.build({ id: newId(), at: iso(t), item, toolRef });
          await land(op.actor, built, iso(t), op.key);
          timeOfKey.set(op.key, t);
        } else if (op.kind === "rewrite") {
          const src = base[op.base] as BaseWrite;
          const prior = item(baseKey(op.base));
          const edited = turnItem(
            { role: src.turn.role, content: op.edit(src.turn.content) },
            src.position,
            prior.id,
          );
          await land(turnActor(src.turn), { ...edited, version: 2 }, iso(t), baseKey(op.base));
        } else {
          const sweepAt = (timeOfKey.get(op.after) as number) + SWEEP_AFTER_MS;
          const report = await plane.retain(USER_WRITER, USER, iso(sweepAt));
          if (!report.expired.includes(item(op.after).id))
            throw new Error(`fault generator: the sweep did not retire ${op.after}`);
        }
      }
    }
    const events = plane.events();
    const labels = marks.map((m) =>
      label(
        view.question_id,
        m.subtype,
        m.kind,
        item(m.key),
        m.related.map((r) => item(r).id),
        m.variant,
      ),
    );
    return {
      state: {
        question_id: view.question_id,
        at,
        actor: LINT_ACTOR,
        scopes: [USER, ROLE_SCOPE],
        events,
      },
      labels,
      stats: {
        question_id: view.question_id,
        turns: base.length,
        assistant_turns: base.filter((b) => b.turn.role === "assistant").length,
        past_medium_ttl: pastTtl,
        b5_missing_provenance: b5Missing,
        events: events.length,
      },
    };
  } finally {
    close();
  }
}

/** The set over every question, in the order given. */
export async function generateFaultSet(
  views: readonly VisibleQuestion[],
  opts: FaultSetOptions,
  open: PlaneFactory,
): Promise<FaultSet> {
  const out: FaultSet = { policy: lintPolicy(), states: [], labels: [], stats: [] };
  for (const view of views) {
    const { state, labels, stats } = await faultState(view, opts, open);
    out.states.push(state);
    out.labels.push(...labels);
    out.stats.push(stats);
  }
  return out;
}

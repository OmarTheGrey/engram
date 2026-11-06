// LongMemEval through the plane (card B5). One user, `person:user`, chats with
// their assistant over dated sessions; the question is asked after them.
//
// The write phase: every turn of every history session crosses Plane.write
// into the user's person scope as an episodic item, in session order and turn
// order. A user turn is the user's own content (source `user`); an assistant
// turn is model content (source `model`), which source isolation keeps in the
// person scope (ADR 0004, 0007). The retrieval phase: the user's read at the
// question date crosses Plane.read. Only the visible question reaches this
// module (strip.ts), so no answer, evidence label or session id can steer a
// write, an item or a read.
import { createHash } from "node:crypto";
import type { Actor, MemoryItem, Plane, ReadResult, WriteResult } from "@engram/core";
import type { VisibleQuestion, VisibleTurn } from "./strip.ts";

export const USER = "person:user";

/** Every turn's confidence: a constant that clears every preset's floor, so no admission turns on a number upstream does not have. */
export const TURN_CONFIDENCE = 0.9;

/** The actor a turn is written as: the user, with the source its role implies. */
export const turnActor = (turn: Pick<VisibleTurn, "role">): Actor => ({
  id: USER,
  level: "person",
  memberships: [USER],
  source: turn.role === "user" ? "user" : "model",
});

/** The user asking the question: reads their own person scope. */
export const userActor = (): Actor => ({ id: USER, level: "person", memberships: [USER] });

/**
 * Upstream's date, `YYYY/MM/DD (Day) HH:MM`, as an ISO instant (read as UTC;
 * upstream gives no zone). Throws on any other shape.
 */
export function longMemEvalTime(date: string): string {
  const m = /^(\d{4})\/(\d{2})\/(\d{2}) \(\w{3}\) (\d{2}):(\d{2})$/.exec(date);
  if (!m) throw new Error(`LongMemEval date ${JSON.stringify(date)} is not YYYY/MM/DD (Day) HH:MM`);
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, h, mi)).toISOString();
}

/** Turn `t` of a session at `date`: one second after the previous, so order is kept within a minute. */
export const turnTime = (date: string, t: number) =>
  new Date(Date.parse(longMemEvalTime(date)) + t * 1000).toISOString();

/** The instant upstream dates the question. */
export const questionTime = (view: Pick<VisibleQuestion, "question_date">) =>
  longMemEvalTime(view.question_date);

/**
 * The instant every read is made: the question's date, or the last turn's
 * time when a session is dated after the question. Upstream asks each
 * question after all its history sessions (README.md), yet 43 of the 500
 * questions of the pinned release date a session up to a day after the
 * question (`node packages/bench/scripts/longmemeval-date-facts.ts`); a read
 * at the question's own date would hide those turns under C5 only, by the
 * items' validity, which would measure the dates and not the policy
 * (decision entry docs/log/2026-11-07-b5-decision-read-time.md). The prompt
 * still shows upstream's question date.
 */
export function readTime(view: Pick<VisibleQuestion, "question_date" | "sessions">): string {
  const times = view.sessions.flatMap((s) =>
    s.turns.map((_t, i) => Date.parse(turnTime(s.date, i))),
  );
  return new Date(Math.max(Date.parse(questionTime(view)), ...times)).toISOString();
}

const sha256 = (s: string) => `sha256:${createHash("sha256").update(s).digest("hex")}`;

/**
 * One turn as the item its role writes. The ref names the session by its
 * position in the history and the turn by its position in the session, never
 * by upstream's session id, which marks evidence sessions (strip.ts).
 */
export function turnItem(
  turn: VisibleTurn,
  position: { session: number; turn: number; date: string },
  id: string,
): MemoryItem {
  return {
    id,
    class: "episodic",
    scope: USER,
    owner: USER,
    content: turn.content,
    provenance: {
      kind: turn.role === "user" ? "user" : "model",
      ref: `longmemeval:session/${position.session + 1}/turn/${position.turn + 1}`,
      hash: sha256(turn.content),
      actor: USER,
    },
    confidence: TURN_CONFIDENCE,
    valid_from: turnTime(position.date, position.turn),
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
  };
}

/** Every turn as its write, in session order then turn order. */
export function historyWrites(
  view: VisibleQuestion,
  newId: () => string,
): { actor: Actor; item: MemoryItem; at: string }[] {
  return view.sessions.flatMap((s, si) =>
    s.turns.map((turn, ti) => {
      const item = turnItem(turn, { session: si, turn: ti, date: s.date }, newId());
      return { actor: turnActor(turn), item, at: item.valid_from };
    }),
  );
}

export interface TurnWriteResult {
  session: number;
  turn: number;
  role: VisibleTurn["role"];
  result: WriteResult;
}

/** The write phase: each turn through Plane.write, in order, as its role's actor. */
export async function writePhase(
  plane: Plane,
  view: VisibleQuestion,
  newId: () => string,
): Promise<TurnWriteResult[]> {
  const out: TurnWriteResult[] = [];
  for (const [si, s] of view.sessions.entries()) {
    for (const [ti, turn] of s.turns.entries()) {
      const item = turnItem(turn, { session: si, turn: ti, date: s.date }, newId());
      const result = await plane.write(turnActor(turn), item, item.valid_from);
      out.push({ session: si, turn: ti, role: turn.role, result });
    }
  }
  return out;
}

/** The retrieval phase: the user's read at the read time (readTime). */
export function questionRead(
  plane: Plane,
  view: VisibleQuestion,
  query: string,
): Promise<ReadResult> {
  return plane.read(userActor(), { text: query, at: readTime(view) });
}

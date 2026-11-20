// The clock problem card L2 found (docs/log/2026-11-19-l2-finding-medium-ttl.md),
// measured per question for card B6: what the plane's read filter hides of a
// LongMemEval history at the instant the plane reads it, for a reason that is
// the date and not governance (preset medium retires person-scope episodic
// items after 90 days, and B5 dates each turn by its session).
//
// For each question and each preset, the history is written as card B5 writes
// it, every turn through Plane.write (packages/bench longmemeval/plane.ts
// writePhase) on the fake store, and the user then reads their person scope
// with no query text, so every item they can reach is a candidate and the
// read returns what the plane's own read filter admits (status, ttl, scope
// and matrix, validity window at the read time). The read is made at each of
// three clocks:
//
// - `read_time`: B5's read time (plane.ts readTime), the question's date, or
//   the last turn's time when a session is dated after the question;
// - `last_session`: the time of the history's last turn;
// - `real_time`: one fixed instant standing for the wall clock of a live run
//   (a live run reads later still, so its count is at least this one's).
//
// Hidden is what the plane wrote and the read did not return; the read
// event's reason (core's readCounts) splits it by cause. Only then are the
// benchmark's evidence labels read, to say which hidden turns hold the
// answer: a turn marked `has_answer`, and the turns of an evidence session
// (`answer_session_ids`). The labels never reach a write, a read or a
// prompt: the plane sees only the visible question (strip.ts).
import { longMemEval } from "@engram/bench";
import {
  createPlane,
  loadPreset,
  migrate,
  openSqlite,
  type Policy,
  type PresetName,
  readCounts,
} from "@engram/core";
import { sequentialIds } from "../gatemem-probe.ts";
import { closeStore, openStore } from "../stores.ts";

export const CLOCKS = ["read_time", "last_session", "real_time"] as const;
export type Clock = (typeof CLOCKS)[number];

/** The instant each clock reads a question's history at. */
export function clockTimes(
  view: longMemEval.VisibleQuestion,
  realTime: string,
): Record<Clock, string> {
  const turns = view.sessions.flatMap((s) =>
    s.turns.map((_t, i) => Date.parse(longMemEval.turnTime(s.date, i))),
  );
  if (turns.length === 0) throw new Error(`question ${view.question_id} has no history turn`);
  return {
    read_time: longMemEval.readTime(view),
    last_session: new Date(Math.max(...turns)).toISOString(),
    real_time: new Date(Date.parse(realTime)).toISOString(),
  };
}

/** What one read at one clock hid. */
export interface ClockCell {
  at: string;
  returned: number;
  /** Written items the read did not return. */
  hidden: number;
  /** The read event's counts of the filter's causes. */
  expired: number;
  outside_validity: number;
  not_active: number;
  /** Hidden turns marked `has_answer`, and hidden turns of an evidence session. */
  evidence_turns_hidden: number;
  evidence_session_turns_hidden: number;
  /** The age of the history's oldest turn at this clock, in seconds. */
  oldest_age_seconds: number;
}

export interface ClockRow {
  question_id: string;
  /** The question's category (type, `+abstention`); a label, counted only. */
  category: string;
  turns: number;
  evidence_turns: number;
  evidence_session_turns: number;
  /** Per preset: the write decisions, and the read at each clock. */
  presets: Record<string, { writes: Record<string, number>; clocks: Record<Clock, ClockCell> }>;
}

/** One question's row under each preset. */
export function clockRow(
  question: longMemEval.Question,
  presets: readonly PresetName[],
  realTime: string,
): Promise<ClockRow> {
  return clockRowFor(
    question,
    Object.fromEntries(presets.map((p) => [p, loadPreset(p)])),
    realTime,
  );
}

/**
 * One question's row under each named policy: a preset, or a variant of one
 * (card RV8's frontier axes, packages/runner/scripts/frontier-axes.ts).
 */
export async function clockRowFor(
  question: longMemEval.Question,
  policies: Readonly<Record<string, Policy>>,
  realTime: string,
): Promise<ClockRow> {
  const view = longMemEval.visibleQuestion(question);
  const times = clockTimes(view, realTime);
  // Reads in time order, so no read is made before one already logged.
  const order = [...CLOCKS].sort((a, b) => Date.parse(times[a]) - Date.parse(times[b]));
  // The labels, read only to count what the plane already hid.
  const evidenceSession = new Set(question.answer_session_ids);
  const label = (session: number, turn: number) => ({
    answer: question.haystack_sessions[session]?.[turn]?.has_answer === true,
    session: evidenceSession.has(question.haystack_session_ids[session] as string),
  });
  const turns = question.haystack_sessions.flatMap((s, si) => s.map((_t, ti) => label(si, ti)));

  const out: ClockRow["presets"] = {};
  for (const [preset, policy] of Object.entries(policies)) {
    const adapter = await openStore("fake");
    const db = openSqlite(":memory:");
    try {
      migrate(db);
      const newId = sequentialIds();
      const plane = createPlane({ db, adapter, policy, newId });
      const written = await longMemEval.writePhase(plane, view, newId);
      const writes: Record<string, number> = {};
      const items = new Map<string, { at: number; answer: boolean; session: boolean }>();
      for (const w of written) {
        const d = w.result.event.decision;
        writes[d] = (writes[d] ?? 0) + 1;
        if (w.result.item) {
          items.set(w.result.item.id, {
            at: Date.parse(w.result.item.valid_from),
            ...label(w.session, w.turn),
          });
        }
      }
      const clocks = {} as Record<Clock, ClockCell>;
      for (const clock of order) {
        const at = times[clock];
        const read = await plane.read(longMemEval.userActor(), { at });
        const counts = readCounts(read.event);
        if (!counts) throw new Error(`question ${view.question_id}: an unreadable read reason`);
        const returned = new Set(read.items.map((i) => i.id));
        const hidden = [...items].filter(([id]) => !returned.has(id)).map(([, v]) => v);
        clocks[clock] = {
          at,
          returned: read.items.length,
          hidden: hidden.length,
          expired: counts.expired,
          outside_validity: counts.outside_validity,
          not_active: counts.not_active,
          evidence_turns_hidden: hidden.filter((h) => h.answer).length,
          evidence_session_turns_hidden: hidden.filter((h) => h.session).length,
          oldest_age_seconds: Math.max(
            0,
            ...[...items.values()].map((v) => (Date.parse(at) - v.at) / 1000),
          ),
        };
      }
      out[preset] = {
        writes,
        clocks: Object.fromEntries(CLOCKS.map((c) => [c, clocks[c]])) as Record<Clock, ClockCell>,
      };
    } finally {
      db.close();
      await closeStore(adapter);
    }
  }
  return {
    question_id: question.question_id,
    category: longMemEval.categoryOf(question),
    turns: turns.length,
    evidence_turns: turns.filter((t) => t.answer).length,
    evidence_session_turns: turns.filter((t) => t.session).length,
    presets: out,
  };
}

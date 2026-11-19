// How `make h1-table` reads a run's rows (card RV1, RV-EXP-2 and review
// RV1-5): one line at a time, since at H1's size a results file is too large
// to read as one string, and each GateMem row cut to what the H1 conversion
// reads. scripts/h1-sessions.ts reads with these, and the scale test runs
// them on a file above V8's string limit.
import type { ProbeResult } from "../gatemem-probe.ts";
import { forEachJsonl } from "../journal.ts";

/** A JSON Lines file's rows, one line at a time, each as `keep` leaves it. */
export const readJsonl = <T>(path: string, keep: (row: T) => T = (row) => row): T[] => {
  const rows: T[] = [];
  forEachJsonl<T>(path, (row) => rows.push(keep(row)));
  return rows;
};

/** What the H1 conversion reads of a GateMem row: its session, score, judge and exclusion. */
export const gatememRow = (r: ProbeResult): ProbeResult => {
  const { tool_calls: _t, output: _o, decisions: _d, events: _e, ...kept } = r;
  return kept as ProbeResult;
};

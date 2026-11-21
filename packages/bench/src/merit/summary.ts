// What a MERIT run reports (card B7): per run cell, MERIT's own task success
// from its results rows, the plane's decisions (C5), and the calls and their
// cost from the proxy's ledger; and, where the config names MERIT's own
// reference run of a cell, how the slice compares with it. Byte-stable: no
// time, no path, no MERIT episode id (a uuid4 MERIT draws per episode) and no
// wall time; keys in a fixed order and rates rounded to six places.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LedgerRow, MeritCellRun, MeritRow, MeritRunResult } from "./launch.ts";

const rate = (k: number, n: number) => (n === 0 ? null : Math.round((k / n) * 1e6) / 1e6);
const round = (x: number) => Math.round(x * 1e9) / 1e9;

export interface CallCount {
  calls: number;
  new: number;
  from_cassettes: number;
  /** What this run paid: misses answered upstream (zero on a replay). */
  paid: { input_tokens: number; output_tokens: number; cost_usd: number };
  /** What the replayed calls cost when they were recorded (the cassette's usage). */
  recorded: { input_tokens: number; output_tokens: number; cost_usd: number };
}

export function countCalls(rows: readonly LedgerRow[]): CallCount {
  const fresh = rows.filter((r) => !r.hit);
  const hits = rows.filter((r) => r.hit);
  const sum = (xs: readonly LedgerRow[], f: (r: LedgerRow) => number) =>
    xs.reduce((a, r) => a + f(r), 0);
  return {
    calls: rows.length,
    new: fresh.length,
    from_cassettes: hits.length,
    paid: {
      input_tokens: sum(fresh, (r) => r.input_tokens),
      output_tokens: sum(fresh, (r) => r.output_tokens),
      cost_usd: round(sum(fresh, (r) => r.cost_usd)),
    },
    recorded: {
      input_tokens: sum(hits, (r) => r.cached?.input_tokens ?? 0),
      output_tokens: sum(hits, (r) => r.cached?.output_tokens ?? 0),
      cost_usd: round(sum(hits, (r) => r.cached?.cost_usd ?? 0)),
    },
  };
}

function taskSuccess(rows: readonly MeritRow[]) {
  const dep = rows.filter((r) => r.dependent);
  const ind = rows.filter((r) => !r.dependent);
  const ok = (xs: readonly MeritRow[]) => xs.filter((r) => r.success).length;
  return {
    episodes: rows.length,
    success: ok(rows),
    success_rate: rate(ok(rows), rows.length),
    dependent: { n: dep.length, success: ok(dep), rate: rate(ok(dep), dep.length) },
    independent: { n: ind.length, success: ok(ind), rate: rate(ok(ind), ind.length) },
    memory_had_fact: dep.filter((r) => r.memory_had_fact).length,
    memory_utilized: dep.filter((r) => r.memory_utilized).length,
    prompt_tokens: rows.reduce((a, r) => a + r.prompt_tokens, 0),
    completion_tokens: rows.reduce((a, r) => a + r.completion_tokens, 0),
  };
}

/** The plane's decisions over a cell's arcs: write and read events by decision. */
function decisions(cell: MeritCellRun) {
  const events = cell.events.flat();
  if (cell.events.length === 0) return null;
  const count = (op: string, decision: string) =>
    events.filter((e) => e.op === op && e.decision === decision).length;
  return {
    events: events.length,
    write_allow: count("write", "allow"),
    write_deny: count("write", "deny"),
    read_allow: count("read", "allow"),
    read_deny: count("read", "deny"),
    every_event_has_reason_and_policy: events.every((e) => e.reason !== "" && e.policy_id !== ""),
  };
}

const keyOf = (r: Pick<MeritRow, "seed" | "arc_id" | "episode_index">) =>
  `${r.seed}|${r.arc_id}|${r.episode_index}`;

/**
 * The slice against MERIT's reference run of the same cell: the tasks (id,
 * kind, dependent) must be the same, since the worlds and arcs are seeded
 * and model-free; success is shown beside the reference's under the same
 * mechanism (MERIT's C1 for C1; C2 and C5 have none in MERIT), and is not
 * comparable: the slice's model is scripted.
 */
export function compareWithReference(cell: MeritCellRun, reference: readonly MeritRow[]) {
  const ours = new Map(cell.rows.map((r) => [keyOf(r), r]));
  const theirs = reference.filter((r) => ours.has(keyOf(r)));
  const mismatched = [...ours.values()].filter((r) => {
    const same = theirs.filter((t) => keyOf(t) === keyOf(r));
    return (
      same.length === 0 ||
      same.some((t) => t.task_id !== r.task_id || t.kind !== r.kind || t.dependent !== r.dependent)
    );
  });
  const mechanism = cell.run.condition === "C1" ? "C1" : null;
  const peer = mechanism === null ? [] : theirs.filter((t) => t.condition === mechanism);
  return {
    episodes_matched: ours.size - mismatched.length,
    episodes_mismatched: mismatched.map((r) => r.task_id).sort(),
    reference_condition: mechanism,
    reference_success: mechanism === null ? null : taskSuccess(peer),
  };
}

const readRows = (path: string): MeritRow[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as MeritRow);

/** The run's summary; `checkout` resolves each cell's reference run. */
export function summarise(
  result: MeritRunResult,
  meta: { name: string; model: string; checkout: string },
) {
  const cells = result.cells.map((cell) => {
    const ref = cell.run.cell.reference;
    return {
      name: cell.run.name,
      item: cell.run.item,
      condition: cell.run.condition,
      store: cell.run.store,
      preset: cell.run.preset,
      seed: cell.run.seed,
      tasks: taskSuccess(cell.rows),
      plane: decisions(cell),
      calls: countCalls(result.ledger.filter((r) => r.cell === cell.run.name)),
      reference:
        ref === undefined
          ? null
          : { run: ref, ...compareWithReference(cell, readRows(join(meta.checkout, ref))) },
    };
  });
  return {
    name: meta.name,
    model: meta.model,
    note: "scripted model: a pipeline check of the harness, not a result (AGENTS.md rule 9); tokens are the scripted model's estimates and a scripted call costs nothing",
    calls: countCalls(result.ledger),
    cells,
  };
}

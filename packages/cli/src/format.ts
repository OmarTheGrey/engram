// Human-readable output. Everything printed comes from what the Plane returned.
import type {
  Explanation,
  MemoryEvent,
  MemoryItem,
  PolicyRun,
  SimReport,
  StepOutcome,
} from "@engram/core";

const n4 = (x: number) => x.toFixed(4);

/** The lines that explain one returned item: score components, admitting rule, grants, validity. */
export function explanationLines(e: Explanation): string[] {
  const parts = Object.entries(e.score.components).map(([k, v]) => `${k} ${n4(v)}`);
  const lines = [`score ${n4(e.score.total)} = ${parts.join(" + ")}`, `admitted by ${e.policy_id}`];
  if (e.grants_used.length > 0) lines.push(`grants ${e.grants_used.join(", ")}`);
  lines.push(
    `valid ${e.validity.valid_from} to ${e.validity.valid_to ?? "open"}, at ${e.validity.at}`,
  );
  return lines;
}

/** The first non-empty line of the content, cut at 100 characters. */
export function preview(item: MemoryItem): string {
  const text =
    typeof item.content === "string"
      ? item.content
      : "body" in item.content && typeof item.content.body === "string"
        ? item.content.body
        : JSON.stringify(item.content);
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (line === undefined) return "";
  return line.length > 100 ? `${line.slice(0, 100)}...` : line;
}

export function decisionLines(event: MemoryEvent, item: MemoryItem | null): string[] {
  const lines = [
    `${event.op} ${event.id} at ${event.ts} by ${event.actor}`,
    `${event.decision}: ${event.reason}`,
    `policy ${event.policy_id}`,
  ];
  if (item) {
    const ref = item.store_ref ? `${item.store_ref.adapter}:${item.store_ref.key}` : "nowhere";
    lines.push(
      `item ${item.id} ${item.class} in ${item.scope}, status ${item.status}, stored at ${ref}`,
    );
  }
  return lines;
}

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

const policyName = (r: PolicyRun) => `${r.policy_id} v${r.policy_version}`;

/** One step's outcome in a change line: its decision, and for a read what it returned. */
function outcomeText(o: StepOutcome): string {
  const retired = [
    o.evicted.length > 0 ? `evicted ${o.evicted.join(", ")}` : "",
    o.expired.length > 0 ? `expired ${o.expired.join(", ")}` : "",
    o.asked > 0 ? plural(o.asked, "ask") : "",
  ].filter(Boolean);
  const head = o.op === "read" ? `returned ${o.returned.length}` : o.decision;
  return [head, ...retired].join(", ");
}

/**
 * The simulator's comparison (card E8.9): one table of decisions, the utility
 * proxy and evictions for the baseline and the candidate, then every step
 * whose outcome differs, with the candidate's rule and reason.
 */
export function simulationLines(report: SimReport): string[] {
  const { baseline: b, candidate: c } = report;
  const steps = b.outcomes.length;
  const active = (r: PolicyRun) => Object.values(r.active).reduce((n, k) => n + k, 0);
  const rows: [string, number | string, number | string][] = [
    ["allow", b.totals.allow, c.totals.allow],
    ["deny", b.totals.deny, c.totals.deny],
    ["ask", b.totals.ask, c.totals.ask],
    ["reads", b.utility.reads, c.utility.reads],
    ["items returned", b.utility.returned, c.utility.returned],
    ["reads with recall", b.utility.reads_with_recall, c.utility.reads_with_recall],
    [
      "mean returned per read",
      b.utility.mean_returned.toFixed(2),
      c.utility.mean_returned.toFixed(2),
    ],
    ["evicted over budget", b.evictions.evicted, c.evictions.evicted],
    ["expired by ttl", b.evictions.expired, c.evictions.expired],
    ["manual eviction asks", b.evictions.asked, c.evictions.asked],
    ["active items at the end", active(b), active(c)],
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  const left = Math.max(8, policyName(b).length);
  const pad = (v: number | string, n: number) => String(v).padStart(n);
  const lines = [
    `workload ${report.workload_id}: ${plural(steps, "step")}, ${report.model_calls} model calls`,
    `baseline ${policyName(b)}, candidate ${policyName(c)}`,
    "",
    `${"".padEnd(width)}  ${pad("baseline", left)}  candidate`,
    ...rows.map(([k, x, y]) => `${k.padEnd(width)}  ${pad(x, left)}  ${pad(y, 9)}`),
    "",
    `${plural(report.changed.length, "step")} differ${report.changed.length === 1 ? "s" : ""}`,
  ];
  for (const d of report.changed) {
    const what = d.item_id === null ? d.actor : `${d.actor} ${d.item_id}`;
    lines.push(
      `  step ${d.step} ${d.op} ${what}: ${outcomeText(d.baseline)} -> ${outcomeText(d.candidate)}`,
      `    ${d.candidate.reason} (${d.candidate.policy_id})`,
    );
  }
  return lines;
}

// Human-readable output. Everything printed comes from what the Plane returned.
import type {
  Actor,
  Explanation,
  Grant,
  MemoryEvent,
  MemoryItem,
  PolicyRun,
  SimReport,
  StepOutcome,
  WhoCanReadAnswer,
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

/**
 * A who-can-read answer (card E2.13): one line per reader entry with the rule
 * or grant that admits it, then why the item is closed and, for its owner,
 * the grants that admit nobody now.
 */
export function whoCanReadLines(a: WhoCanReadAnswer, actor: Actor): string[] {
  const lines = [
    `who can read ${a.target} at ${a.at} as ${actor.id}: ${a.answered ? "answered" : "refused"}`,
    `  ${a.reason}`,
  ];
  if (!a.answered) return lines;
  if (a.closed) lines.push(`nobody now: ${a.closed.reason} (${a.closed.policy_id})`);
  else if (a.readers.length === 0)
    lines.push("nobody: no read matrix row or live grant admits a reader");
  for (const r of a.readers)
    lines.push(
      r.kind === "members"
        ? `  every member of ${r.scope} reading as ${r.level} (${r.policy_id})`
        : `  ${r.to} by ${r.grant}, until ${r.grant_detail.expires ?? "no expiry"} (${r.policy_id})`,
    );
  for (const d of a.dormant) lines.push(`  dormant ${d.grant}: ${d.reason}`);
  if (a.grants_shown === "yours") lines.push("grants shown: only those naming you");
  return lines;
}

/** An event's scope as the inspector's timeline shows it: from and to when they differ. */
export function scopeText(e: Pick<MemoryEvent, "scope_from" | "scope_to">): string {
  if (e.scope_from !== null && e.scope_to !== null && e.scope_from !== e.scope_to)
    return `${e.scope_from} to ${e.scope_to}`;
  return e.scope_to ?? e.scope_from ?? "-";
}

/**
 * The timeline (card E8.15a, `engram events`): a heading, then per event its
 * seq, time, op, decision, actor, scope and item, and under it the reason
 * with the rule that decided.
 */
export function eventsLines(events: MemoryEvent[], actor: Actor, after?: number): string[] {
  const since = after === undefined ? "" : ` after seq ${after}`;
  const lines = [`events ${actor.id} may see${since}: ${plural(events.length, "event")}`];
  for (const e of events)
    lines.push(
      `  ${e.seq} ${e.ts} ${e.op} ${e.decision} by ${e.actor} in ${scopeText(e)}, item ${e.item_id ?? "none"}`,
      `    ${e.reason} (${e.policy_id})`,
    );
  return lines;
}

/** An item's grants as the inspector's editor lists them (grantLabel). */
export function grantLines(grants: readonly Grant[]): string[] {
  if (grants.length === 0) return ["grants: none"];
  return [
    "grants:",
    ...grants.map(
      (g) =>
        `  ${g.to}: ${g.class ?? "any class"}, ${g.mode}, ${g.expires === undefined ? "no expiry" : `until ${g.expires}`}`,
    ),
  ];
}

/** The scopes an actor can see (card E8.15a over E8.14's route), each with how. */
export function scopesLines(
  answer: { scopes: { scope: string; via: string }[]; event: MemoryEvent; policy: string },
  actor: Actor,
): string[] {
  return [
    `scopes ${actor.id} can see at ${answer.event.ts} under ${answer.policy}: ${plural(answer.scopes.length, "scope")}`,
    ...answer.scopes.map((s) => `  ${s.scope} (${s.via})`),
  ];
}

const YAML_KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const isScalar = (v: unknown) => v === null || typeof v !== "object";
const isEmpty = (v: unknown) =>
  Array.isArray(v)
    ? v.length === 0
    : typeof v === "object" && v !== null && Object.keys(v).length === 0;
/** A JSON value written inline: JSON's scalars and empty collections are YAML flow nodes too. */
const inline = (v: unknown) =>
  Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v);

/** A JSON value as block YAML, every scalar in JSON's syntax, so the text parses back to the same value. */
function yamlLines(value: unknown, indent: string): string[] {
  const lines: string[] = [];
  if (Array.isArray(value)) {
    for (const v of value) {
      if (isScalar(v) || isEmpty(v)) lines.push(`${indent}- ${inline(v)}`);
      else {
        const [first = "", ...rest] = yamlLines(v, `${indent}  `);
        lines.push(`${indent}- ${first.slice(indent.length + 2)}`, ...rest);
      }
    }
    return lines;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    const key = YAML_KEY.test(k) ? k : JSON.stringify(k);
    if (isScalar(v) || isEmpty(v) || (Array.isArray(v) && v.every(isScalar)))
      lines.push(`${indent}${key}: ${inline(v)}`);
    else lines.push(`${indent}${key}:`, ...yamlLines(v, `${indent}  `));
  }
  return lines;
}

/**
 * The policy in force (card E8.15a, `engram policy`): a comment naming it,
 * then the policy as block YAML a policy file may hold (`--policy <file>`
 * loads it back to the same policy).
 */
export function policyLines(policy: Record<string, unknown>, label: string): string[] {
  return [`# ${label}: the policy the workspace decides with`, ...yamlLines(policy, "")];
}
/** The supersede route's answer as engram supersede prints it (card L6). */
export interface SupersedeAnswer {
  item_id: string;
  head:
    | { ok: true; head_id: string; chain: string[] }
    | { ok: false; error: string; chain: string[] };
  proposals: {
    item_id: string;
    action: "close" | "review";
    relation: string | null;
    valid_to: string | null;
    reason: string;
  }[];
  applied: { item: MemoryItem | null; event: MemoryEvent }[];
  stopped: { item_id: string; event: MemoryEvent } | null;
}

/**
 * The lines of engram supersede's answer (card L6): the head, each
 * proposal, each write's decision, and when the store refused a close
 * (review fix L6-3) the closes that landed before it and those not sent,
 * then the command that applies the closes not yet accepted.
 */
export function supersedeLines(plan: SupersedeAnswer, accept: readonly string[]): string[] {
  const lines = [
    plan.head.ok
      ? `head ${plan.head.head_id}, chain ${plan.head.chain.join(" -> ")}`
      : `${plan.head.error}: the chain from ${plan.item_id} does not resolve (${plan.head.chain.join(" -> ") || "nothing readable"}); nothing proposed`,
  ];
  if (plan.head.ok && plan.proposals.length === 0) lines.push("nothing to propose");
  for (const p of plan.proposals)
    lines.push(
      p.action === "close"
        ? `close ${p.item_id}: valid_to ${p.valid_to} (${p.relation}); ${p.reason}`
        : `review ${p.item_id} (${p.relation ?? "no relation"}): ${p.reason}`,
    );
  for (const { event, item } of plan.applied) lines.push("", ...decisionLines(event, item));
  const stopped = plan.stopped;
  if (stopped !== null) {
    const landed = plan.applied
      .filter((a) => a.event.decision === "allow")
      .map((a) => a.event.item_id);
    const unsent = accept.filter(
      (id) => id !== stopped.item_id && !plan.applied.some((a) => a.event.item_id === id),
    );
    lines.push(
      "",
      `not applied: ${stopped.item_id}, the store refused it`,
      ...decisionLines(stopped.event, null),
      `landed before it: ${landed.join(", ") || "none"}; not sent: ${unsent.join(", ") || "none"}`,
    );
  }
  const open = plan.proposals.filter((p) => p.action === "close" && !accept.includes(p.item_id));
  if (open.length > 0)
    lines.push(
      "",
      `to apply: engram supersede ${plan.item_id} ${open.map((p) => `--accept ${p.item_id}`).join(" ")}`,
    );
  return lines;
}

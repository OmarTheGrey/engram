// The Policy group's hand-made screens (card E8.15d, docs/design/tui.md 8.9
// to 8.11): Retention sweep, whose confirmation is the strong dialog of 9.5
// (the router's, for `writes` retire: the action button not focused, and
// "Retiring cannot be undone"); Lint, its findings from the answer's
// `findings` and `events`; Simulate, the comparison drawn from the report's
// fields with a bar beside each pair, and the changed steps as a list.
// Every word about a decision is a field of the answer or the command's
// own text; nothing is derived from a reason or a rule id.
import type { LintFinding, SimReport, StepChange } from "@engram/core";
import { outcomeText, plural, policyName } from "../../format.ts";
import { type CommandSpec, command, type Values } from "../../registry.ts";
import { middleCut } from "../argv.ts";
import { clean, fit, para } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { Ctx } from "../screen.ts";
import type { StatusKind } from "../theme.ts";
import { oneLine } from "./rich.ts";
import { otherJson, type Row, SurfaceScreen } from "./surface.ts";

/** The first line of the command's own output: its summary line, verbatim. */
const firstLine = (r: RunResult) => clean(r.out).split("\n")[0] ?? "";

export class RetainScreen extends SurfaceScreen {
  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    // The actor's own person scope first, as the mockup shows it (8.9); any scope may be typed.
    const own = ctx.ws.actorId();
    const scope = own?.startsWith("person:") === true ? own : undefined;
    super(
      spec,
      ctx,
      values.scope === undefined && scope !== undefined ? { ...values, scope } : values,
      positionals,
    );
  }
  override title(): string {
    return "Retention sweep";
  }
  protected override top(): Row[] {
    return [{ kind: "field", id: "scope", hint: "swept as a user-sourced member of it" }];
  }
  protected override buttons() {
    return [{ id: "button:run", label: "Sweep", press: (c: Ctx) => this.run(c) }];
  }
  protected override rich(_ctx: Ctx, width: number, result: RunResult): Row[] {
    const body = result.calls.at(-1)?.body as
      | { expired?: string[]; evicted?: string[] }
      | undefined;
    const rows: Row[] = [{ kind: "text", lines: this.plainLines(result, width) }];
    if (body?.expired === undefined || body.evicted === undefined) return rows;
    const said =
      body.expired.length + body.evicted.length === 0
        ? "Nothing was due. Expired items are retired and items over the scope's budget are evicted, in the order the policy's retention rule names."
        : `Retired for good: ${plural(body.expired.length, "expired item")}, ${plural(body.evicted.length, "evicted item")}. Retired items stay in the log; reads no longer return them.`;
    rows.push({ kind: "text", lines: ["", ...para(said, width)] });
    return rows;
  }
  protected override footer(_ctx: Ctx, width: number): Row[] {
    if (this.result !== undefined) return [];
    return [
      {
        kind: "text",
        lines: [
          "",
          ...para(
            "A sweep retires every item past its ttl and evicts items over the scope's budget. There is no preview: it asks first, and it cannot be undone.",
            width,
          ),
        ],
      },
    ];
  }
  protected override async jsonOf(_ctx: Ctx, result: RunResult) {
    return otherJson(result);
  }
  protected override keyHints(): string {
    return this.result === undefined ? "ctrl+s sweep  tab next" : "r sweep again  v plain  J json";
  }
}

const SEVERITY: Record<LintFinding["severity"], StatusKind> = {
  error: "fail",
  warn: "warn",
  info: "info",
};

export class LintScreen extends SurfaceScreen {
  /** The findings whose evidence is open. */
  private readonly open = new Set<string>();

  override title(): string {
    return "Lint a scope";
  }
  protected override top(): Row[] {
    return [{ kind: "field", id: "scope", hint: "linted as a member of it" }];
  }
  protected override buttons() {
    return [{ id: "button:run", label: "Lint", press: (c: Ctx) => this.run(c) }];
  }
  /** The findings first: the lint ran (allow) or was refused (deny); a finding is exit 1. */
  protected override status(ctx: Ctx, result: RunResult): string {
    const body = result.calls.at(-1)?.body as
      | { decision?: string; findings?: unknown[] }
      | undefined;
    const n = body?.findings?.length;
    if (body?.decision !== "allow" || n === undefined) return super.status(ctx, result);
    return n === 0
      ? ` ${ctx.theme.status("ok", "clean")}   exit ${result.code}  no finding`
      : ` ${ctx.theme.status("warn", plural(n, "finding"))}   exit ${result.code}  each one a lint event in the log`;
  }
  protected override rich(ctx: Ctx, width: number, result: RunResult): Row[] {
    const t = ctx.theme;
    const body = result.calls.at(-1)?.body as
      | { findings?: LintFinding[]; events?: { policy_id: string }[] }
      | undefined;
    if (body?.findings === undefined)
      return [{ kind: "text", lines: this.plainLines(result, width) }];
    const rows: Row[] = [{ kind: "text", lines: para(firstLine(result), width) }];
    body.findings.forEach((f, i) => {
      const id = `finding:${f.id}`;
      const lines = [
        ` ${t.status(SEVERITY[f.severity], f.severity)}  ${f.lint_id}  ${f.item_id}`,
        ...para(clean(f.message), width - 3, "   "),
      ];
      if (this.open.has(id)) {
        lines.push(`   ${t.glyphs.open} evidence`);
        for (const e of f.evidence) lines.push(...para(clean(e), width - 5, "     "));
        // The finding's own event's rule, drawn in a template and nothing else (card E8.15c's guard).
        lines.push(`   rule ${body.events?.[i]?.policy_id}`);
      } else lines.push(`   ${t.glyphs.closed} evidence: space; the item page: enter`);
      rows.push({
        kind: "item",
        id,
        lines,
        press: () => {
          if (this.open.has(id)) this.open.delete(id);
          else this.open.add(id);
        },
        // Enter opens the finding's item page (card E8.15c's screen, docs/design/tui.md 8.10).
        open: (c) => c.openCommand(command("read --item") as CommandSpec, {}, [f.item_id]),
      });
    });
    const said =
      body.findings.length === 0
        ? `exit ${result.code}: no finding. The lints the policy enables found nothing to report.`
        : `exit ${result.code}: ${plural(body.findings.length, "finding")}. Each finding is a lint event in the log.`;
    rows.push({ kind: "text", lines: ["", ...para(said, width)] });
    return rows;
  }
  protected override async jsonOf(_ctx: Ctx, result: RunResult) {
    return otherJson(result);
  }
  protected override keyHints(): string {
    return this.result === undefined
      ? "ctrl+s lint  tab next"
      : "enter item page  space evidence  r again  v plain  J json";
  }
}

/** A bar of `n` blocks scaled so the largest value of the table is `room` blocks. */
const bar = (block: string, n: number, max: number, room: number) =>
  max <= 0 ? "" : block.repeat(Math.round((n / max) * room));

export class SimulateScreen extends SurfaceScreen {
  /** Every row of the table, not only those that differ (a). */
  private all = false;
  private readonly open = new Set<string>();

  override title(): string {
    return "Simulate a policy";
  }
  protected override top(): Row[] {
    return [
      { kind: "field", id: "workload", hint: "a recorded workload (.json)" },
      { kind: "field", id: "policy", label: "Policy", hint: "the baseline: a preset or a file" },
      { kind: "field", id: "candidate", hint: "a preset or a file; default the baseline" },
    ];
  }
  protected override buttons() {
    return [{ id: "button:run", label: "Simulate", press: (c: Ctx) => this.run(c) }];
  }
  protected override ownActions(): readonly string[] {
    return ["plain", "json", "rerun", "all"];
  }
  protected override extra(name: string): boolean {
    if (name !== "all") return false;
    this.all = !this.all;
    return true;
  }
  protected override rich(ctx: Ctx, width: number, result: RunResult): Row[] {
    const report = result.calls.at(-1)?.body as SimReport | undefined;
    if (report?.baseline === undefined)
      return [{ kind: "text", lines: this.plainLines(result, width) }];
    const { baseline: b, candidate: c } = report;
    const active = (r: SimReport["baseline"]) => Object.values(r.active).reduce((n, k) => n + k, 0);
    const table: [string, number, number, string?][] = [
      ["allow", b.totals.allow, c.totals.allow],
      ["deny", b.totals.deny, c.totals.deny],
      ["ask", b.totals.ask, c.totals.ask],
      ["reads", b.utility.reads, c.utility.reads],
      ["items returned", b.utility.returned, c.utility.returned],
      ["reads with recall", b.utility.reads_with_recall, c.utility.reads_with_recall],
      ["mean returned per read", b.utility.mean_returned, c.utility.mean_returned, "mean"],
      ["evicted over budget", b.evictions.evicted, c.evictions.evicted],
      ["expired by ttl", b.evictions.expired, c.evictions.expired],
      ["manual eviction asks", b.evictions.asked, c.evictions.asked],
      ["active items at the end", active(b), active(c)],
    ];
    const wide = width >= 118;
    const shown = wide || this.all ? table : table.filter(([, x, y]) => x !== y);
    const max = Math.max(
      1,
      ...table.filter(([, , , m]) => m === undefined).flatMap(([, x, y]) => [x, y]),
    );
    const block = ctx.theme.glyphs.block;
    const num = (v: number, mean: boolean) => (mean ? v.toFixed(2) : String(v));
    const lines = [
      ` workload ${report.workload_id}: ${plural(b.outcomes.length, "step")}, ${report.model_calls} model calls`,
      ` baseline ${policyName(b)}, candidate ${policyName(c)}`,
      "",
      ` ${"".padEnd(24)}  baseline  candidate`,
    ];
    for (const [k, x, y, m] of shown) {
      const mean = m !== undefined;
      const bars = mean ? "" : `  ${fit(bar(block, x, max, 10), 10)} ${bar(block, y, max, 10)}`;
      const differs = wide && x !== y ? "   differs" : "";
      lines.push(
        ` ${k.padEnd(24)}  ${num(x, mean).padStart(8)}  ${num(y, mean).padStart(9)}${differs}${bars}`,
      );
    }
    if (!wide && !this.all && shown.length < table.length)
      lines.push(` ${table.length - shown.length} rows the same: a shows all ${table.length}`);
    lines.push(
      "",
      ` ${plural(report.changed.length, "step")} differ${report.changed.length === 1 ? "s" : ""}`,
    );
    const rows: Row[] = [{ kind: "text", lines }];
    for (const d of report.changed) rows.push(this.stepRow(d, width, wide));
    rows.push({
      kind: "text",
      lines: [
        ...para(
          "Replayed on scratch logs and stores: your log and store are not touched, and no model is called.",
          width,
        ),
      ],
    });
    return rows;
  }
  private stepRow(d: StepChange, width: number, wide: boolean): Row {
    const id = `step:${d.step}`;
    const item = d.item_id === null ? "" : ` ${wide ? d.item_id : middleCut(d.item_id, 16)}`;
    const lines = [
      ` step ${d.step} ${d.op} ${d.actor}${item}: ${outcomeText(d.baseline)} -> ${outcomeText(d.candidate)}`,
    ];
    if (this.open.has(id)) {
      lines.push(
        ...para(
          `baseline   ${d.baseline.decision}: ${oneLine(d.baseline.reason)} (${oneLine(d.baseline.policy_id)})`,
          width - 4,
          "     ",
        ),
      );
      lines.push(
        ...para(
          `candidate  ${d.candidate.decision}: ${oneLine(d.candidate.reason)} (${oneLine(d.candidate.policy_id)})`,
          width - 4,
          "     ",
        ),
      );
      if (d.item_id !== null) lines.push(`     item ${d.item_id}`);
    }
    return {
      kind: "item",
      id,
      lines,
      press: () => {
        if (this.open.has(id)) this.open.delete(id);
        else this.open.add(id);
      },
    };
  }
  protected override footer(_ctx: Ctx, width: number): Row[] {
    if (this.result !== undefined) return [];
    return [
      {
        kind: "text",
        lines: [
          "",
          ...para(
            "Simulate replays the workload under the baseline and the candidate on scratch logs and stores: your log and store are never read or written, and nothing asks first.",
            width,
          ),
        ],
      },
    ];
  }
  protected override async jsonOf(_ctx: Ctx, result: RunResult) {
    return otherJson(result);
  }
  protected override keyHints(): string {
    return this.result === undefined
      ? "ctrl+s simulate  tab next"
      : "enter step  a all rows  v plain  J json";
  }
}

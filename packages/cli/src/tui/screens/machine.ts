// Doctor (card E8.15d, docs/design/tui.md 8.12): `engram doctor` run as the
// plain command, its checks shown as a list, a failing one first (the
// plain output keeps its order), each with "What this means" and "What to
// do" from a fixed table keyed by the check's name, never from parsing its
// detail. Doctor's own flags are the workspace's; its bind flags (--host
// and serve's credential flags, card E8.12) are the Serve screen's last
// answers, so doctor checks the bind Serve would make.
import type { CommandSpec, Values } from "../../registry.ts";
import { clean, para, visibleWidth } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { Ctx } from "../screen.ts";
import type { StatusKind } from "../theme.ts";
import { type Row, SurfaceScreen, sharedOf } from "./surface.ts";

export interface DoctorCheck {
  status: "ok" | "fail" | "skip";
  name: string;
  detail: string;
}

/**
 * The checks of doctor's text output, which doctor.ts writes as fixed
 * columns: the status padded to 5, the name padded to 16, the detail. The
 * last line is the summary. Lines that are not a check (stderr) are left out.
 */
export function parseDoctor(text: string): DoctorCheck[] {
  const out: DoctorCheck[] = [];
  for (const line of text.split("\n")) {
    const status = line.slice(0, 5).trim();
    if (status !== "ok" && status !== "fail" && status !== "skip") continue;
    if (line.length < 21) continue;
    out.push({ status, name: line.slice(5, 21).trim(), detail: line.slice(21) });
  }
  return out;
}

/** What each check means and what to do when it fails, by the check's name (never its detail). */
export const DOCTOR_HELP: Readonly<Record<string, { means: string; todo: string }>> = {
  log: {
    means:
      "The event log: whether it opens and is up to date. Doctor never creates or migrates it.",
    todo: "Choose a log in the workspace (ctrl+o, Event log). A SQLite file that does not exist yet is fine: the first read or write creates it.",
  },
  policy: {
    means:
      "The policy every command decides with: a preset or a policy file, loaded and validated.",
    todo: "Choose a preset or a readable policy file in the workspace (ctrl+o, Policy).",
  },
  store: {
    means: "The store folder the commands adopt memories from: whether it is a readable folder.",
    todo: "Choose a readable store folder in the workspace (ctrl+o, Store folder), or none to work on the log alone.",
  },
  "adapter files": {
    means:
      "The files adapter listing the store folder's memories through the plane, on an in-memory log.",
    todo: "Check that the store folder holds memory files; the detail names what failed.",
  },
  "adapter mem0": {
    means:
      "An in-memory Mem0 store with the hashing embedder: a write and a read through the plane, offline.",
    todo: "Run engram doctor in a shell to see the whole error; nothing was recorded.",
  },
  "adapter letta": {
    means:
      "A Letta MemFS repository in a temporary folder: a write, a read and a delete, offline. It needs git.",
    todo: "Put git on the PATH, or leave this if you do not use --store letta.",
  },
  "adapter mcp-mem": {
    means:
      "The MCP memory server's JSONL file in a temporary folder: a write, a read and a delete, another client's line kept as it was, offline.",
    todo: "Run engram doctor in a shell to see the whole error; nothing was recorded.",
  },
  "provider keys": {
    means:
      "Which provider key variables are set, by name only; their values are never read or shown.",
    todo: "Only live model runs need a key: set its variable in your shell.",
  },
  "benchmark pins": {
    means: "The benchmark pins of packages/bench/PINS.md and the fixtures' hashes.",
    todo: "Run make fixtures, or check out the pinned commit; never update a pin mid-experiment.",
  },
  "pi pin": {
    means: "The pi packages installed against the exact versions docs/deps.md pins.",
    todo: "Run pnpm install --frozen-lockfile.",
  },
  node: {
    means: "The Node running the CLI: 24 or later (node:sqlite, type stripping).",
    todo: "Install Node 24 or later.",
  },
  serve: {
    means:
      "The bind engram serve would make with these flags: refused without authentication, or beyond loopback without credentials.",
    todo: 'Answer Serve\'s "Who may call this server?" with a key file, a token issuer, or the loopback waiver.',
  },
};

const KIND: Record<DoctorCheck["status"], StatusKind> = { ok: "ok", fail: "fail", skip: "skip" };

/** The flags doctor takes from the Serve screen's answers. */
export const BIND_FLAGS = [
  "host",
  "keys",
  "issuer",
  "jwks",
  "subjects",
  "audience",
  "resource",
  "insecure-loopback",
] as const;

export class DoctorScreen extends SurfaceScreen {
  private readonly open = new Set<string>();
  /** Whether the bind flags came from the Serve screen. */
  private readonly fromServe: boolean;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    const serve = sharedOf(ctx).serve ?? {};
    const bind = Object.fromEntries(
      BIND_FLAGS.flatMap((f) => (serve[f] === undefined ? [] : [[f, serve[f]]])),
    );
    super(spec, ctx, { ...bind, ...values }, positionals);
    this.fromServe = Object.keys(bind).length > 0;
    // Run first: the checks are the screen (review E8.15d-9).
    this.focusId = "button:run";
  }

  override title(): string {
    return "Doctor";
  }
  protected override top(_ctx: Ctx): Row[] {
    // Once it has run, the checks take the room.
    if (this.result !== undefined) return [];
    const said = this.fromServe
      ? "The bind flags are the Serve screen's answers: doctor checks what Serve would start."
      : "Checks the workspace's log, policy and store, the adapters, and the bind Serve would make. It changes nothing.";
    return [{ kind: "para", text: said }];
  }
  protected override buttons() {
    return [
      {
        id: "button:run",
        label: this.result === undefined ? "Run doctor" : "Run doctor again",
        press: (c: Ctx) => this.run(c),
      },
    ];
  }
  protected override rich(ctx: Ctx, width: number, result: RunResult): Row[] {
    const t = ctx.theme;
    const checks = parseDoctor(clean(result.out));
    if (checks.length === 0) return [{ kind: "text", lines: this.plainLines(result, width) }];
    // A failing check first; the plain output (v) keeps doctor's order.
    const sorted = [
      ...checks.filter((c) => c.status === "fail"),
      ...checks.filter((c) => c.status !== "fail"),
    ];
    const rows: Row[] = [];
    for (const c of sorted) {
      const id = `check:${c.name}`;
      const head = ` ${t.status(KIND[c.status], c.status.padEnd(4))}  ${c.name.padEnd(15)} `;
      // The item's marker column comes first: the detail starts one column after the head.
      const indent = visibleWidth(head);
      const detail = para(clean(c.detail), Math.max(20, width - indent - 1), "");
      const lines = [
        `${head}${detail[0] ?? ""}`,
        ...detail.slice(1).map((l) => `${" ".repeat(indent)}${l}`),
      ];
      const help = DOCTOR_HELP[c.name];
      if (this.open.has(id) && help !== undefined) {
        lines.push(...para(`What this means: ${help.means}`, width - 4, "    "));
        if (c.status === "fail") lines.push(...para(`What to do: ${help.todo}`, width - 4, "    "));
      }
      rows.push({
        kind: "item",
        id,
        lines,
        press: () => {
          if (this.open.has(id)) this.open.delete(id);
          else this.open.add(id);
        },
      });
    }
    const summary = clean(result.out).trimEnd().split("\n").at(-1) ?? "";
    rows.push({ kind: "text", lines: ["", ` ${summary}      exit ${result.code}`] });
    // What to do about the first failing check, above the list, so it shows at 80x24.
    const failed = sorted.find((c) => c.status === "fail");
    const todo = failed === undefined ? undefined : DOCTOR_HELP[failed.name]?.todo;
    if (todo !== undefined)
      rows.unshift({ kind: "text", lines: [...para(`What to do: ${todo}`, width), ""] });
    return rows;
  }
  protected override async jsonOf(ctx: Ctx, result: RunResult) {
    // Doctor changes nothing, so its --json view is a second run of the same checks.
    const again = await ctx.peek([...result.argv, "--json"]);
    return again.out;
  }
  protected override status(ctx: Ctx, result: RunResult): string {
    const failed = parseDoctor(clean(result.out)).filter((c) => c.status === "fail").length;
    return failed === 0 && result.code === 0
      ? ` ${ctx.theme.status("ok", "all checks passed")}   exit 0`
      : ` ${ctx.theme.status("fail", `${failed} failed`)}   exit ${result.code}`;
  }
  protected override keyHints(): string {
    return this.result === undefined
      ? "enter run  ctrl+o workspace"
      : "r rerun  enter details  v plain  J json";
  }
}

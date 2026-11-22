// The guided first loop (card E8.15b, docs/design/tui.md 8.2): write a
// memory, read it back, see why it came back. Three steps, each a real
// command shown whole before it runs and run by one press of enter; the
// step's own text says what it changes, so it is the confirmation. The
// result of each is the command's own output. Every step can be skipped,
// and esc leaves for Home.
import { command } from "../../registry.ts";
import { TextField } from "../fields.ts";
import { rows, wrap } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { CommandRow, Ctx, Screen } from "../screen.ts";
import { shortPath } from "../workspace.ts";

/** The sample memory the first step offers; the person may change it. */
export const SAMPLE = "The deploy key rotates every 90 days.";

type Step = "write" | "read" | "explain";
const STEPS: readonly Step[] = ["write", "read", "explain"];

/** The read's id, from the answer of its one call (POST /api/v1/read). */
export function readIdOf(result: RunResult | undefined): string | undefined {
  const call = result?.calls.find((c) => c.path === "/api/v1/read" && c.status === 200);
  const id = (call?.body as { event?: { id?: unknown } } | undefined)?.event?.id;
  return typeof id === "string" ? id : undefined;
}

/** A word of the content to read it back by: its first of four letters or more. */
export const queryOf = (content: string) =>
  (content.match(/[\p{L}\p{N}]{4,}/u)?.[0] ?? content.split(/\s+/)[0] ?? "").toLowerCase();

export class LoopScreen implements Screen {
  readonly kind = "loop" as const;
  private step = 0;
  private readonly content = new TextField(SAMPLE);
  private readonly query = new TextField(queryOf(SAMPLE));
  private readonly results = new Map<Step, RunResult | "skipped">();

  constructor(_ctx: Ctx) {}

  title(): string {
    return "Getting started  first loop";
  }

  focused(): string {
    return STEPS[this.step] ?? "done";
  }

  private current(): Step | undefined {
    return STEPS[this.step];
  }

  argv(ctx: Ctx, step: Step): string[] {
    const spec = command(step);
    const ws = spec === undefined ? [] : ctx.ws.argsFor(spec);
    if (step === "write") return ["write", "--content", this.content.value, ...ws];
    if (step === "read") return ["read", ...(this.query.value.trim() === "" ? [] : [this.query.value.trim()]), ...ws];
    const r = this.results.get("read");
    return ["explain", readIdOf(r === "skipped" ? undefined : r) ?? "<the read's id>", ...ws];
  }

  inField(): boolean {
    const s = this.current();
    return s === "write" || s === "read";
  }

  async action(name: string, ctx: Ctx): Promise<boolean> {
    const s = this.current();
    if (name === "run-step") {
      if (s === undefined) {
        ctx.home();
        return true;
      }
      if (s === "explain" && this.argv(ctx, "explain")[1] === "<the read's id>") {
        ctx.say("no read to explain: the read step was skipped or failed; s skips");
        return true;
      }
      // The step's text is its confirmation (8.2): one press of enter runs it.
      this.results.set(s, await ctx.runNow(this.argv(ctx, s)));
      this.step++;
      if (s === "write") this.query.set(queryOf(this.content.value));
      return true;
    }
    if (name === "skip") {
      if (s === undefined) return false;
      this.results.set(s, "skipped");
      this.step++;
      return true;
    }
    if (name === "back") {
      ctx.home();
      return true;
    }
    if (name === "leave") {
      ctx.home();
      return true;
    }
    return false;
  }

  raw(data: string): boolean {
    const s = this.current();
    if (s === "write") this.content.type(data);
    else if (s === "read") this.query.type(data);
    else return false;
    return true;
  }

  command(ctx: Ctx): CommandRow {
    const s = this.current();
    if (s !== undefined) return { argv: this.argv(ctx, s) };
    const last = [...STEPS].reverse().find((x) => this.results.get(x) !== "skipped");
    const r = last === undefined ? undefined : this.results.get(last);
    return r === undefined || r === "skipped" ? { text: "" } : { argv: r.argv, exit: r.code };
  }

  hints(): string {
    return this.current() === undefined ? "enter Home" : "enter run this step  ctrl+n skip  esc Home";
  }

  private stepLines(ctx: Ctx, step: Step, i: number, width: number): string[] {
    const t = ctx.theme;
    const label = { write: "Write  ", read: "Read   ", explain: "Explain" }[step];
    const r = this.results.get(step);
    const on = i === this.step;
    const mark = r === undefined ? (on ? ">" : " ") : r === "skipped" ? t.symbol("skip") : t.symbol(r.code === 0 ? "ok" : "fail");
    const indent = " ".repeat(15);
    const lines: string[] = [];
    const cmd = wrap(ctx.line(this.argv(ctx, step)), width - 16);
    lines.push(` ${mark} ${i + 1}  ${label}  ${cmd[0] ?? ""}`, ...cmd.slice(1).map((l) => `${indent} ${l}`));
    if (r === "skipped") lines.push(`${indent} skipped`);
    else if (r !== undefined) {
      const out = `${r.out}${r.err}`.split("\n").filter((l) => l !== "");
      for (const l of out.slice(0, 3)) lines.push(...wrap(l, width - 16).map((w) => `${indent} ${w}`));
      lines.push(`${indent} exit ${r.code}`);
    } else if (on) {
      const root = ctx.ws.get("root");
      if (step === "write") {
        lines.push(`${indent} Content [ ${this.content.render(Math.max(10, width - 30), true)} ]`);
        lines.push(
          ...wrap(
            root === undefined
              ? "Writing needs a memory folder (--root); without one the plane refuses the write. ctrl+n skips."
              : `Writes one item into ${shortPath(root, ctx.io)} through the write gate; a write cannot be undone. Press enter to write.`,
            width - 16,
          ).map((w) => `${indent} ${w}`),
        );
      } else if (step === "read") {
        lines.push(`${indent} Query   [ ${this.query.render(24, true)} ]`);
        lines.push(
          ...wrap(
            root === undefined
              ? "Reads the log only (no store folder): one read event. Press enter to read."
              : `Reading adopts ${shortPath(root, ctx.io)} into the log and, as its owner, sweeps your expired items first. Press enter to read.`,
            width - 16,
          ).map((w) => `${indent} ${w}`),
        );
      } else lines.push(`${indent} The explanations the read recorded. Press enter to explain.`);
    }
    lines.push("");
    return lines;
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const lines = [" Your first loop: write a memory, read it back, see why it came back.", ""];
    for (const [i, s] of STEPS.entries()) lines.push(...this.stepLines(ctx, s, i, width));
    lines.push(
      this.current() === undefined
        ? " Done. Press enter for Home; every action there shows its command the same way."
        : " Each step is the plain command; c copies it. Next time, type it yourself.",
    );
    return rows(lines, height, width);
  }
}

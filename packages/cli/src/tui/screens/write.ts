// Write and Promote (card E8.15c, docs/design/tui.md 8.7 and 8.8).
//
// Write is `engram write` with every write flag. While it is edited, "The
// gate would" is a live `engram check` with the same flags, run after 400 ms
// without a keystroke (never on every key), labelled a preview: nothing is
// stored and no event appended. When it denies or asks, the screen shows the
// server's reason and policy id verbatim and offers only neutral shortcuts,
// which move the cursor to Class or Scope (the preview runs again on the
// next pause, so the plane gives the next answer) or open Policy at the
// policy id as a link would. The TUI never suggests a value and never reads
// the reason or the policy id to decide what to offer. Submitting a write the
// preview denies is labelled for what it does: the gate records the denial.
//
// Promote is `engram promote <itemId> --to <scope> [--review]`. After a
// promotion that did not land, whatever the reason, it offers the reviewer
// handoff: Acting as becomes the reviewer and Member of the target scope,
// for this session only (never saved), and Promote opens again with As
// reviewer on; Switch back in the workspace panel restores the actor.
// Against a server with credentials the handoff is not offered: the identity
// comes from the key or token, not from Acting as.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MemoryEvent } from "@engram/sdk";
import { parseMemberships } from "@engram/view";
import { type CommandSpec, command, type Values } from "../../registry.ts";
import { buildActor } from "../../setup.ts";
import { TextField } from "../fields.ts";
import { Form } from "../forms.ts";
import { cut, para } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { Ctx } from "../screen.ts";
import { EventsScreen, PolicyScreen } from "./events.ts";
import { decisionOf } from "./form.ts";
import {
  answerOf,
  decisionHead,
  errorLines,
  firstLine,
  knownState,
  oneLine,
  outputLines,
  RichScreen,
  type Stop,
  statusOf,
  viewerOf,
} from "./rich.ts";

/** How long the preview waits after the last keystroke (docs/design/tui.md 8.7). */
export const PREVIEW_DELAY_MS = 400;

interface CheckAnswer {
  decision: "allow" | "deny" | "ask";
  reason: string;
  policy_id: string;
}

/** The fields Write lays out before its fold, in the design's order. */
const WRITE_FIELDS = ["content", "file", "scope", "class", "confidence", "valid-from", "valid-to"];

/** Asks before leaving a form with unsent input, as the generated form does. */
async function leaveAsking(ctx: Ctx, dirty: boolean): Promise<boolean> {
  if (!dirty) {
    ctx.pop();
    return true;
  }
  const yes = await ctx.confirm({
    title: "Leave this form?",
    lines: ["What you typed in it is lost. Nothing was run."],
    action: "Leave",
  });
  if (yes) ctx.pop();
  return true;
}

/** The seq of the event a write or a promotion's answer carries. */
const eventOf = (r: RunResult | undefined) =>
  answerOf<{ event?: MemoryEvent }>(r, /\/api\/v1\/(items|promote)$/)?.event;

export class WriteScreen extends RichScreen {
  readonly kind = "write" as const;
  protected override readonly keepsForm = true;
  /** The last preview's run of `engram check`, and the command it ran. */
  private preview: RunResult | undefined;
  private previewProblem: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private previewing: Promise<void> = Promise.resolve();

  override title(): string {
    return this.result === undefined || this.edited ? "Write a memory" : "Write a memory  result";
  }

  /** The preview's answer: the decision a write would get now. */
  previewAnswer(): CheckAnswer | undefined {
    return answerOf<CheckAnswer>(this.preview, /\/api\/v1\/items\/check$/);
  }

  /** Resolves when the preview running now (if any) has answered: for tests. */
  previewed(): Promise<void> {
    return this.previewing;
  }

  stops(): Stop[] {
    if (this.result !== undefined && !this.edited)
      return [
        { kind: "button", id: "retry", label: "Edit and retry" },
        { kind: "button", id: "event", label: "Open the event" },
        { kind: "button", id: "new", label: "New write" },
      ];
    const out: Stop[] = WRITE_FIELDS.map((id) => ({ kind: "field", id }));
    out.push(...this.advancedStops());
    const p = this.previewAnswer();
    if (p !== undefined && p.decision !== "allow")
      out.push(
        { kind: "button", id: "change-class", label: "change Class" },
        { kind: "button", id: "change-scope", label: "change Scope" },
        { kind: "button", id: "open-policy", label: "open the rule in Policy" },
      );
    out.push({ kind: "button", id: "submit", label: this.submitLabel() });
    out.push({ kind: "button", id: "check", label: "Check again" });
    return out;
  }

  private submitLabel(): string {
    const p = this.previewAnswer();
    if (p?.decision === "deny") return "Record this write (the gate will deny it)";
    if (p?.decision === "ask") return "Record this write (the gate will ask)";
    return "Write";
  }

  override close(): void {
    super.close();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  protected override changed(ctx: Ctx): void {
    super.changed(ctx);
    // After a pause, never on every key (8.7).
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.closed) void this.check(ctx);
    }, PREVIEW_DELAY_MS);
    this.timer.unref?.();
  }

  /**
   * The fields From file sets (8.7): those whose key the item JSON holds, read
   * as the CLI reads the file; marked "from file" until edited. Nothing when
   * the file is not there or is not JSON: the check says why.
   */
  private fromFile(ctx: Ctx): Set<string> {
    const file = String(this.form.get("file")).trim();
    if (file === "") return new Set();
    try {
      const item = JSON.parse(readFileSync(resolve(ctx.io.cwd, file), "utf8")) as Record<
        string,
        unknown
      >;
      return new Set(
        Object.keys(FILE_KEYS).filter((id) => Object.hasOwn(item, FILE_KEYS[id] as string)),
      );
    } catch {
      return new Set();
    }
  }

  /** `engram check` with the write's flags: the same form, the check command. */
  private checkForm(ctx: Ctx): Form {
    const spec = command("check") as CommandSpec;
    return new Form(spec, ctx.ws, this.form.flagValues() as Values);
  }

  /** Runs the preview now; an older preview's answer is dropped. */
  check(ctx: Ctx): Promise<void> {
    const generation = ++this.generation;
    const form = this.checkForm(ctx);
    const problem = form.validate(ctx.ws, ctx.io)[0];
    if (problem !== undefined) {
      this.preview = undefined;
      this.previewProblem = problem.message;
      ctx.redraw();
      return Promise.resolve();
    }
    this.previewing = ctx.peek(form.argv(ctx.ws)).then((r) => {
      if (generation !== this.generation || this.closed) return;
      this.preview = r;
      this.previewProblem =
        r.code === 2 || this.previewAnswer() === undefined ? safeErr(r) : undefined;
      ctx.redraw();
    });
    return this.previewing;
  }

  private async submit(ctx: Ctx): Promise<void> {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const p = this.previewAnswer();
    const extra =
      p === undefined
        ? []
        : [
            `The gate would (preview): ${p.decision}: ${oneLine(p.reason)} (${oneLine(p.policy_id)}).`,
          ];
    const r = await this.run(ctx, this.argvNow(ctx), extra);
    if (r !== undefined) {
      this.preview = undefined;
      this.focus = 0;
    }
  }

  protected override async leave(ctx: Ctx): Promise<boolean> {
    return leaveAsking(ctx, this.result === undefined && this.form.dirty());
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    switch (name) {
      case "submit":
        if (this.result !== undefined && !this.edited) return true;
        await this.submit(ctx);
        return true;
      case "up":
      case "down":
        this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
      case "toggle":
      case "accept": {
        if (stop?.kind === "field") {
          if (name === "accept") this.focus += 1;
          return true;
        }
        if (stop?.kind !== "button") return false;
        return this.press(stop.id, ctx);
      }
    }
    return false;
  }

  private async press(id: string, ctx: Ctx): Promise<boolean> {
    switch (id) {
      case "advanced":
        this.advancedOpen = !this.advancedOpen;
        return true;
      case "change-class":
        this.focusOn("class");
        return true;
      case "change-scope":
        this.focusOn("scope");
        return true;
      case "open-policy": {
        const p = this.previewAnswer();
        // The id as the check returned it, shown verbatim: nothing is read into it (8.7).
        const shown = p === undefined ? undefined : oneLine(p.policy_id);
        ctx.push(new PolicyScreen(command("policy") as CommandSpec, ctx, {}, [], shown));
        return true;
      }
      case "submit":
        await this.submit(ctx);
        return true;
      case "check":
        await this.check(ctx);
        return true;
      case "retry":
        this.edited = true;
        this.focusOn("content");
        return true;
      case "event": {
        const e = eventOf(this.result);
        ctx.push(new EventsScreen(command("events") as CommandSpec, ctx, {}, [], e?.seq));
        return true;
      }
      case "new":
        this.form = new Form(this.command_, ctx.ws);
        this.result = undefined;
        this.preview = undefined;
        this.previewProblem = undefined;
        this.edited = false;
        this.focus = 0;
        return true;
    }
    return false;
  }

  protected ownHints(): string {
    if (this.result !== undefined && !this.edited) return "v plain  J json  enter choose";
    return "ctrl+s write  tab next";
  }

  private previewLines(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const p = this.previewAnswer();
    if (p === undefined) {
      if (this.previewProblem !== undefined)
        return para(
          `The gate would  ${t.status("skip", "not yet")}: ${this.previewProblem}`,
          width,
        );
      return para(
        `The gate would  ${t.status("skip", "not yet")}: the preview runs ${PREVIEW_DELAY_MS} ms after you stop typing`,
        width,
      );
    }
    const lines = para(
      `The gate would  ${t.status(statusOf(p.decision), p.decision)}  ${oneLine(p.reason)}  (${oneLine(p.policy_id)})  preview, nothing stored`,
      width,
    );
    return lines;
  }

  protected body(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const r = this.result;
    if (r !== undefined && !this.edited) {
      const out = [decisionHead(t, this.command_, r), ""];
      out.push(...outputLines(r, width), ...errorLines(r, width));
      const e = eventOf(r);
      const d = decisionOf(r);
      if (e !== undefined && d !== "allow")
        out.push("", ` Nothing was stored. The decision is event ${e.seq} in the log.`);
      out.push(
        "",
        ` ${this.button(ctx, "retry", "Edit and retry")}   ${this.button(ctx, "event", "Open the event")}   ${this.button(ctx, "new", "New write")}`,
      );
      return out;
    }
    const out: string[] = [...this.errorHead(ctx, width)];
    const scopeHint = viewerOf(ctx)
      ? `default ${ctx.ws.get("owner") !== undefined ? `person:${ctx.ws.get("owner")}` : viewerOf(ctx)?.id}; person:<id>, role:<id>, team:<id> or org`
      : "person:<id>, role:<id>, team:<id> or org";
    const fromFile = this.fromFile(ctx);
    for (const id of WRITE_FIELDS)
      out.push(
        this.fieldRow(
          ctx,
          id,
          width,
          12,
          fromFile.has(id) && this.form.get(id) === ""
            ? "from file"
            : id === "scope"
              ? scopeHint
              : undefined,
        ),
      );
    out.push(...this.advancedLines(ctx, width));
    const members = ctx.ws.list("member");
    if (members.length > 0)
      out.push(cut(` Member of    ${members.join(", ")}   (from the workspace)`, width));
    out.push("", ...this.previewLines(ctx, width));
    const p = this.previewAnswer();
    if (p !== undefined && p.decision !== "allow")
      out.push(
        "",
        cut(
          ` ${this.button(ctx, "change-class", "change Class")}  ${this.button(ctx, "change-scope", "change Scope")}  ${this.button(ctx, "open-policy", "open the rule in Policy")}   the preview runs again after a change`,
          width,
        ),
      );
    out.push(
      "",
      cut(
        `   ${this.button(ctx, "submit", this.submitLabel())}   ${this.button(ctx, "check", "Check again")}`,
        width,
      ),
    );
    return out;
  }
}

/** The item JSON's keys each field stands for, as engram write lets the flags fill what the file leaves out. */
const FILE_KEYS: Readonly<Record<string, string>> = {
  content: "content",
  scope: "scope",
  class: "class",
  confidence: "confidence",
  "valid-from": "valid_from",
  "valid-to": "valid_to",
  id: "id",
};

const safeErr = (r: RunResult) => oneLine(r.err.replace(/^engram [a-z-]+: /, ""));

export class PromoteScreen extends RichScreen {
  readonly kind = "promote" as const;
  protected override readonly keepsForm = true;
  /** Asking for the reviewer's principal, after a promotion that did not land. */
  private asking = false;
  /** Whether the handoff is offered here: not against a server with credentials. */
  private offered: boolean;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    super(spec, ctx, values, positionals);
    this.extras.set("reviewer", new TextField(""));
    this.extras.set("members", new TextField(""));
    this.offered = this.handoffOffered(ctx);
  }

  /** Whether the handoff is offered: not against a server with credentials (card E8.12). */
  private handoffOffered(ctx: Ctx): boolean {
    return !(ctx.ws.server() !== undefined && ctx.ws.tokenSet());
  }

  private landed(): boolean {
    return decisionOf(this.result as RunResult) === "allow";
  }

  stops(): Stop[] {
    const out: Stop[] = [
      { kind: "field", id: "pos:itemId" },
      { kind: "field", id: "to" },
      { kind: "field", id: "review" },
      ...this.advancedStops(),
    ];
    if (this.result !== undefined && !this.edited && !this.landed()) {
      if (this.asking)
        out.push(
          { kind: "field", id: "reviewer" },
          { kind: "field", id: "members" },
          { kind: "button", id: "switch", label: "Switch" },
        );
      else if (this.offered)
        out.push({ kind: "button", id: "handoff", label: "Switch to a reviewer and approve" });
      out.push({ kind: "button", id: "retry", label: "Edit and retry" });
    }
    out.push({ kind: "button", id: "submit", label: "Promote" });
    return out;
  }

  protected override async leave(ctx: Ctx): Promise<boolean> {
    return leaveAsking(ctx, this.result === undefined && this.form.dirty());
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    switch (name) {
      case "submit":
        await this.promote(ctx);
        return true;
      case "up":
      case "down":
        this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
      case "toggle":
      case "accept":
        if (stop?.kind === "field") {
          if (name === "accept") this.focus += 1;
          return true;
        }
        if (stop?.kind === "button") return this.press(stop.id, ctx);
        return false;
    }
    return false;
  }

  private async press(id: string, ctx: Ctx): Promise<boolean> {
    switch (id) {
      case "advanced":
        this.advancedOpen = !this.advancedOpen;
        return true;
      case "submit":
        await this.promote(ctx);
        return true;
      case "retry":
        this.edited = true;
        this.focusOn("to");
        return true;
      case "handoff":
        if (!this.handoffOffered(ctx)) {
          ctx.say("against a server with credentials, the reviewer approves in their own session");
          return true;
        }
        this.asking = true;
        // Member of, prefilled with the target scope and the item's own: data from the item, not a rule (review 3).
        this.extras.get("members")?.set(this.memberDefault(ctx).join(", "));
        this.focusOn("reviewer");
        return true;
      case "switch":
        await this.switchToReviewer(ctx);
        return true;
    }
    return false;
  }

  private async promote(ctx: Ctx): Promise<void> {
    this.offered = this.handoffOffered(ctx);
    if ((await this.run(ctx)) === undefined) return;
    this.asking = false;
    // Off the fields, so the result's keys act: the handoff when offered, else Promote.
    if (!this.focusOn("handoff") && !this.focusOn("retry")) this.focusOn("submit");
  }

  /** The reviewer's memberships offered: the target scope and the item's own scope, when known. */
  private memberDefault(ctx: Ctx): string[] {
    const to = String(this.form.get("to")).trim();
    const own = knownState(ctx, String(this.form.get("pos:itemId")).trim())?.scope;
    // Never a person scope: it is its owner's alone, and a reviewer is no member of it (N4).
    const item = own === undefined || own.startsWith("person:") ? [] : [own];
    return [...new Set([to, ...item].filter((s) => s !== ""))];
  }

  /** The handoff: both changes shown before they apply, for this session only (8.8). */
  private async switchToReviewer(ctx: Ctx): Promise<void> {
    const reviewer = (this.extras.get("reviewer")?.value ?? "").trim();
    const to = String(this.form.get("to")).trim();
    const members = parseMemberships(this.extras.get("members")?.value ?? "");
    try {
      // The CLI's own check of an actor (buildActor), with the reviewer as --as and each --member.
      buildActor({ as: reviewer || undefined, member: members }, undefined);
    } catch (e) {
      this.error = { message: (e as Error).message };
      return;
    }
    const before = ctx.handoff?.before ?? ctx.ws.actorLabel();
    const yes = await ctx.confirm({
      title: "Switch to a reviewer?",
      lines: [
        `Acting as becomes ${reviewer} and Member of becomes ${members.join(", ") || "the actor's own scope"}, for this session only: neither is saved to tui.json.`,
        `Promote opens again with As reviewer on. Whether ${reviewer} may approve is the plane's answer. Switch back in the workspace panel (ctrl+o) restores ${before}.`,
      ],
      action: "Switch",
    });
    if (!yes) return;
    ctx.startHandoff(reviewer, members, to);
    ctx.replace(
      new PromoteScreen(this.command_, ctx, { to, review: true }, [
        String(this.form.get("pos:itemId")),
      ]),
    );
    ctx.say(`acting as ${reviewer} for this session; ctrl+o, Switch back restores ${before}`);
  }

  protected ownHints(): string {
    return "v plain  J json  ctrl+s promote  tab next";
  }

  protected body(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const out = [...this.errorHead(ctx, width)];
    const id = String(this.form.get("pos:itemId")).trim();
    const known = id === "" ? undefined : knownState(ctx, id);
    out.push(
      this.fieldRow(
        ctx,
        "pos:itemId",
        width,
        12,
        known === undefined ? "an item id (a UUIDv7)" : `${known.class} ${known.scope}`,
      ),
    );
    if (known !== undefined) out.push(cut(`                ${firstLine(known)}`, width));
    const scopes = [...new Set([...(viewerOf(ctx)?.memberships ?? []), "org"])].join(", ");
    out.push(this.fieldRow(ctx, "to", width, 12, `the item's own or wider; yours: ${scopes}`));
    out.push(this.fieldRow(ctx, "review", width, 19, this.field("review")?.help ?? ""));
    out.push(...this.advancedLines(ctx, width));
    if (ctx.handoff !== undefined)
      out.push(
        cut(
          ` Acting as ${ctx.handoff.reviewer}, a reviewer for this session; ctrl+o, Switch back restores ${ctx.handoff.before}`,
          width,
        ),
      );
    const r = this.result;
    if (r !== undefined && !this.edited) {
      out.push(
        "",
        decisionHead(t, this.command_, r),
        ...outputLines(r, width),
        ...errorLines(r, width),
      );
      if (!this.landed()) {
        out.push("");
        if (!this.handoffOffered(ctx))
          out.push(
            ...para(
              "Against a server with credentials the identity comes from the key or token, not from Acting as: the reviewer approves in their own session with their own credential.",
              width,
            ),
          );
        else if (this.asking) {
          out.push(
            this.extraRow(ctx, "reviewer", "Reviewer", width, "a principal, such as person:sam"),
            this.extraRow(
              ctx,
              "members",
              "Member of",
              width,
              "the reviewer's scopes, comma separated",
            ),
          );
          out.push(
            ...para(
              "Acting as becomes the reviewer and Member of these scopes, for this session only.",
              width,
            ),
            `   ${this.button(ctx, "switch", "Switch")}`,
          );
        } else
          out.push(
            cut(
              ` ${this.button(ctx, "handoff", "Switch to a reviewer and approve")}   ${this.button(ctx, "retry", "Edit and retry")}`,
              width,
            ),
          );
        if (this.asking) out.push(cut(` ${this.button(ctx, "retry", "Edit and retry")}`, width));
        out.push(" Promotions cannot be undone from here.");
      }
    }
    out.push("", `   ${this.button(ctx, "submit", "Promote")}   ctrl+s from any field`);
    return out;
  }
}

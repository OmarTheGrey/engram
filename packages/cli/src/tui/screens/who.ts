// Who can read and Supersede (card E8.15c, docs/design/tui.md 8.22 and 8.26).
//
// Who can read is `engram who-can-read <itemId> | --scope <scope>`: the
// reader set the plane computed, each reader with the rule or grant that
// admits it, the closed reason when no one else can, the dormant grants, as
// readerView labels them. A refusal shows the route's reason; nothing is
// guessed.
//
// Supersede is `engram supersede <itemId>`: the plan (the chain's head, a
// proposed close or a review flag per ancestor the actor may read), then
// `--accept <id>...` for the closes chosen. Only a close can be accepted, so
// only a close row has a checkbox; each accepted close is a new version
// through the write gate, which asks first and shows each write's decision.
import type { WhoCanReadAnswer } from "@engram/sdk";
import { readerView } from "@engram/view";
import type { SupersedeAnswer } from "../../format.ts";
import type { CommandSpec, Values } from "../../registry.ts";
import { cut, para } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { Ctx } from "../screen.ts";
import {
  answerOf,
  decisionHead,
  errorLines,
  oneLine,
  outputLines,
  RichScreen,
  type Stop,
  safe,
  statusOf,
} from "./rich.ts";

export class WhoScreen extends RichScreen {
  readonly kind = "who" as const;

  override title(): string {
    return "Who can read";
  }

  stops(): Stop[] {
    return [
      { kind: "field", id: "pos:itemId" },
      { kind: "field", id: "scope" },
      ...this.advancedStops(),
      ...(this.result === undefined ? [] : [{ kind: "list", id: "result" } as Stop]),
    ];
  }

  async opened(ctx: Ctx): Promise<void> {
    if (String(this.form.get("pos:itemId")) !== "") await this.ask(ctx);
  }

  private async ask(ctx: Ctx, argv?: readonly string[]): Promise<void> {
    if ((await this.run(ctx, argv)) !== undefined) this.focusOn("result");
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    switch (name) {
      case "submit":
      case "accept":
        if (stop?.id === "advanced") {
          this.advancedOpen = !this.advancedOpen;
          return true;
        }
        if (stop?.id === "result" && name === "accept") return true;
        await this.ask(ctx);
        return true;
      case "toggle":
        if (stop?.id === "advanced") this.advancedOpen = !this.advancedOpen;
        return stop?.id === "advanced";
      case "rerun":
        if (this.result !== undefined) await this.ask(ctx, this.result.argv);
        return true;
      case "up":
      case "down":
        this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
    }
    return false;
  }

  protected ownHints(): string {
    return "enter ask  tab item or scope  J json";
  }

  protected body(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const out = [
      ...this.errorHead(ctx, width),
      this.fieldRow(ctx, "pos:itemId", width, 8, "an item id, or leave it empty and give a scope"),
      this.fieldRow(ctx, "scope", width, 8, "or a scope: every item in it"),
      ...this.advancedLines(ctx, width),
    ];
    const r = this.result;
    if (r === undefined || this.edited) {
      if (r === undefined)
        out.push(
          "",
          ...para(
            "Asks the plane who can read an item or a scope's items: each reader with the rule or grant that admits it. Grant holders are named to the item's owner only.",
            width,
          ),
        );
      return out;
    }
    const a = answerOf<WhoCanReadAnswer>(r, /\/api\/v1\/who-can-read\//);
    if (a === undefined) {
      out.push("", decisionHead(t, this.command_, r), "", ...errorLines(r, width));
      return out;
    }
    const v = readerView(a);
    out.push(
      "",
      cut(` who can read ${oneLine(a.target)} at ${a.at}`, width),
      ` ${a.answered ? t.status("ok", "answered") : t.status("deny", "refused")}   exit ${r.code}`,
      ...para(oneLine(v.reason), width, "   "),
    );
    if (!v.answered) return out;
    out.push("");
    if (v.closed !== null) out.push(...para(`nobody now: ${oneLine(v.closed)}`, width, "   "));
    else if (v.rows.length === 0)
      out.push("   nobody: no read matrix row or live grant admits a reader");
    for (const row of v.rows)
      out.push(cut(`   ${oneLine(row.text)}    ${safe(row.policyId)}`, width));
    out.push("", " Dormant");
    if (v.dormant.length === 0) out.push("   none");
    for (const d of v.dormant) out.push(cut(`   ${oneLine(d)}`, width));
    if (v.withheld) out.push("", " Grants shown: only those naming you.");
    return out;
  }
}

export class SupersedeScreen extends RichScreen {
  readonly kind = "supersede" as const;
  /** The plan's run (no --accept), which the proposals come from. */
  private plan: RunResult | undefined;
  private readonly chosen = new Set<string>();
  private selected = 0;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    super(spec, ctx, values, positionals);
  }

  private planAnswer(): SupersedeAnswer | undefined {
    return answerOf<SupersedeAnswer>(this.plan, /\/api\/v1\/supersede$/);
  }

  stops(): Stop[] {
    const out: Stop[] = [{ kind: "field", id: "pos:itemId" }];
    if ((this.planAnswer()?.proposals.length ?? 0) > 0) out.push({ kind: "list", id: "proposals" });
    else if (this.plan !== undefined) out.push({ kind: "list", id: "result" });
    if (this.planAnswer() !== undefined)
      out.push({ kind: "button", id: "apply", label: "Accept chosen" });
    out.push(...this.advancedStops());
    return out;
  }

  async opened(ctx: Ctx): Promise<void> {
    if (String(this.form.get("pos:itemId")) !== "") await this.propose(ctx);
  }

  /** The plan: engram supersede <itemId> with no --accept, which writes nothing. */
  private async propose(ctx: Ctx): Promise<void> {
    this.form.setValue("accept", []);
    const r = await this.run(ctx);
    if (r === undefined) return;
    this.plan = r;
    this.chosen.clear();
    if (!this.focusOn("proposals")) this.focusOn("result");
  }

  private async apply(ctx: Ctx): Promise<void> {
    if (this.chosen.size === 0) {
      ctx.say("choose a close first: space on a close row");
      return;
    }
    const plan = this.planAnswer();
    const order = (plan?.proposals ?? []).map((p) => p.item_id).filter((id) => this.chosen.has(id));
    this.form.setValue("accept", order);
    await this.run(ctx, this.argvNow(ctx), [
      "Accepting writes a new version of each chosen ancestor with that end date; the write gate decides each, as for any update. Nothing is retired.",
    ]);
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    const proposals = this.planAnswer()?.proposals ?? [];
    switch (name) {
      case "submit":
        if (this.plan === undefined || this.edited) await this.propose(ctx);
        else await this.apply(ctx);
        return true;
      case "accept":
        if (stop?.id === "advanced") this.advancedOpen = !this.advancedOpen;
        else if (stop?.id === "apply") await this.apply(ctx);
        else if (stop?.kind === "field") await this.propose(ctx);
        return true;
      case "toggle": {
        if (stop?.id === "advanced") this.advancedOpen = !this.advancedOpen;
        else if (stop?.kind === "list") {
          const p = proposals[this.selected];
          // Only a close can be accepted (8.26): a review row has no checkbox.
          if (p?.action === "close") {
            if (this.chosen.has(p.item_id)) this.chosen.delete(p.item_id);
            else this.chosen.add(p.item_id);
            this.edited = true;
          } else if (p !== undefined)
            ctx.say("a review row is for you to act on elsewhere: only a close is accepted");
        }
        return true;
      }
      case "up":
      case "down":
        if (stop?.kind === "list")
          this.selected = Math.max(
            0,
            Math.min(proposals.length - 1, this.selected + (name === "up" ? -1 : 1)),
          );
        else this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
    }
    return false;
  }

  /** The command as the chosen closes stand: what ctrl+s would accept. */
  protected override argvNow(ctx: Ctx): string[] {
    return this.form.argv(ctx.ws);
  }

  override command(ctx: Ctx) {
    if (this.plan !== undefined && this.chosen.size > 0 && this.result === this.plan) {
      const plan = this.planAnswer();
      const order = (plan?.proposals ?? [])
        .map((p) => p.item_id)
        .filter((id) => this.chosen.has(id));
      this.form.setValue("accept", order);
      return { argv: this.form.argv(ctx.ws) };
    }
    return super.command(ctx);
  }

  protected ownHints(): string {
    return "space choose  ctrl+s accept chosen  J json";
  }

  protected body(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const out = [
      ...this.errorHead(ctx, width),
      this.fieldRow(ctx, "pos:itemId", width, 6, "the newest item of a chain"),
      ...this.advancedLines(ctx, width),
    ];
    const plan = this.planAnswer();
    if (this.plan === undefined) {
      out.push(
        "",
        ...para(
          "Plans the supersession of an item's chain: for each ancestor you may read, a proposed close (its valid_to set to this item's valid_from) or a review flag. Accepting a close writes a new version through the write gate.",
          width,
        ),
      );
      return out;
    }
    if (plan === undefined) {
      out.push("", decisionHead(t, this.command_, this.plan), "", ...errorLines(this.plan, width));
      return out;
    }
    out.push(
      ...para(
        plan.head.ok
          ? `head ${plan.head.head_id}, a chain of ${plan.head.chain.length}`
          : `${oneLine(plan.head.error)}: the chain does not resolve; nothing proposed`,
        width,
      ),
      "",
    );
    if (plan.head.ok) out.push(" Proposals, one per ancestor you may read");
    if (plan.head.ok && plan.proposals.length === 0) out.push("   nothing to propose");
    const onList = this.current()?.id === "proposals";
    plan.proposals.forEach((p, i) => {
      const mark = onList && i === this.selected ? ">" : " ";
      const box = p.action === "close" ? (this.chosen.has(p.item_id) ? "[x]" : "[ ]") : "   ";
      const text = cut(
        ` ${mark} ${box} ${p.action.padEnd(6)} ${p.item_id}  ${p.action === "close" ? `valid_to ${p.valid_to ?? ""}` : "flagged for review"}`,
        width,
      );
      out.push(onList && i === this.selected ? t.reverse(text) : text);
      out.push(...para(oneLine(p.reason), width, "              ").slice(0, 2));
    });
    out.push("", `   ${this.button(ctx, "apply", "Accept chosen")}   ctrl+s`);
    const r = this.result;
    if (r !== undefined && r !== this.plan) {
      const applied = answerOf<SupersedeAnswer>(r, /\/api\/v1\/supersede$/);
      out.push("", decisionHead(t, this.command_, r));
      for (const a of applied?.applied ?? [])
        out.push(
          cut(
            `   ${t.status(statusOf(a.event.decision), a.event.decision)}  ${a.event.item_id ?? ""}  ${safe(a.event.policy_id)}`,
            width,
          ),
        );
      if (applied === undefined) out.push(...errorLines(r, width));
      else out.push(...outputLines(r, width).slice(-2));
    }
    return out;
  }
}

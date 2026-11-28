// Why not this item (card E2.17): `engram explain --absent <id> [query]
// [--at]`. The item, the read's query and the time its validity windows are
// judged at, then the plane's answer as the route gave it: the stage that
// kept the item out of the read and its rule, that the read returns it, or
// the refusal an unknown id gets. Opened with n from the item page (on its
// item) and from the read screen (with its query). Nothing here decides:
// every word about the answer is the plane's.
import type { AbsenceExplanation } from "@engram/sdk";
import { cut, para } from "../layout.ts";
import type { Ctx } from "../screen.ts";
import { answerOf, decisionHead, errorLines, oneLine, RichScreen, type Stop } from "./rich.ts";

const ROUTE = /\/api\/v1\/explain-absent$/;

export class WhyNotScreen extends RichScreen {
  readonly kind = "why-not" as const;

  override title(): string {
    return "Why not this item";
  }

  stops(): Stop[] {
    return [
      { kind: "field", id: "pos:itemId" },
      { kind: "field", id: "pos:query" },
      { kind: "field", id: "at" },
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

  /** The plane's answer, when the last run returned one. */
  answer(): AbsenceExplanation | undefined {
    return answerOf<AbsenceExplanation>(this.result, ROUTE);
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
        if (this.result !== undefined && !this.edited && this.staleAs(ctx) === undefined) {
          ctx.say("asked already: change the item, the query or the time, or r asks again");
          return true;
        }
        await this.ask(ctx);
        return true;
      case "toggle":
        if (stop?.id === "advanced") this.advancedOpen = !this.advancedOpen;
        return stop?.id === "advanced";
      case "rerun":
        if (this.result !== undefined) await this.ask(ctx, this.rerunLine(ctx));
        return true;
      case "up":
      case "down":
        this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
    }
    return false;
  }

  protected ownHints(): string {
    return "J json  enter ask  tab item, query or time";
  }

  protected body(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const out = [
      ...this.errorHead(ctx, width),
      this.fieldRow(ctx, "pos:itemId", width, 12, "the item left out"),
      this.fieldRow(ctx, "pos:query", width, 12, "the read's text"),
      this.fieldRow(ctx, "at", width, 12, "empty for now"),
      ...this.advancedLines(ctx, width),
    ];
    const r = this.result;
    if (r === undefined || this.edited) {
      if (r === undefined)
        out.push(
          "",
          ...para(
            "Asks the plane why an item is not in the read this query would make now: the first stage that kept it out (match, status, ttl, validity, the rank cut), or that the read returns it. Answered only for an item you may read by id; any other id is refused as an unknown one. Nothing is written.",
            width,
          ),
        );
      return out;
    }
    const a = this.answer();
    if (a === undefined) {
      out.push("", decisionHead(t, this.command_, r), "", ...errorLines(r, width));
      return out;
    }
    const verdict = !a.answered
      ? t.status("deny", "refused")
      : a.absent === false
        ? t.status("ok", "not absent: the read returns it")
        : t.status("deny", `absent at ${a.stage ?? ""}`);
    out.push(
      "",
      cut(` why not ${oneLine(a.item_id)} in a read at ${a.at}`, width),
      ...(a.valid_at === a.at ? [] : [cut(`   validity windows judged at ${a.valid_at}`, width)]),
      ` ${verdict}   exit ${r.code}`,
      ...para(oneLine(a.reason), width, "   "),
    );
    if (a.answered && a.policy_id !== null) out.push(cut(`   rule ${oneLine(a.policy_id)}`, width));
    return out;
  }
}

// Grants (card E8.15c, docs/design/tui.md 8.19 and 9.6): the inspector's
// grants editor (card E9.4) through `engram grants <itemId> --add | --remove`.
// The item's grants are listed as the inspector shows them (all of them to
// the owner, only the viewer's own to anyone else: shownGrants), with
// grantLabel's text; a grant is added from a draft read by grantFrom, with
// its messages. Each change is one governed call whose decision is shown.
// After an allowed change, `u` offers its inverse (remove what was added, add
// back what was removed if it has not expired): a new governed change with
// its own event, shown in the confirmation as its own command. It may be
// denied; nothing else on these screens can be undone.
import type { Grant, MemoryItem } from "@engram/sdk";
import { GRANT_CLASSES, GRANT_MODES, grantFrom, grantLabel, shownGrants } from "@engram/view";
import type { CommandSpec, Values } from "../../registry.ts";
import { TextField } from "../fields.ts";
import { cut, para } from "../layout.ts";
import type { Ctx } from "../screen.ts";
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
  viewerOf,
} from "./rich.ts";

/** A grant as `--add` and `--remove` write it: `<to>[,class=..],mode=..[,expires=..]`. */
export function grantSpec(g: Grant): string {
  return [
    g.to,
    ...(g.class === undefined ? [] : [`class=${g.class}`]),
    `mode=${g.mode}`,
    ...(g.expires === undefined ? [] : [`expires=${g.expires}`]),
  ].join(",");
}

interface Change {
  op: "add" | "remove";
  grant: Grant;
}

export class GrantsScreen extends RichScreen {
  readonly kind = "grants" as const;
  private klass = "semantic";
  private mode = "read";
  private selected = 0;
  /** The last change the plane allowed, which `u` can undo. */
  private last: Change | undefined;
  private problem: string | undefined;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    super(spec, ctx, values, positionals);
    this.extras.set("to", new TextField(""));
    this.extras.set("expires", new TextField(""));
  }

  itemId(): string {
    return String(this.form.get("pos:itemId")).trim();
  }

  /** The item as the last answer about it carries it: this screen's change, else the session's read. */
  private item(ctx: Ctx): MemoryItem | undefined {
    const changed = answerOf<{ item: MemoryItem | null }>(this.result, /\/api\/v1\/grants$/)?.item;
    if (changed?.id === this.itemId()) return changed;
    return this.itemId() === "" ? undefined : knownState(ctx, this.itemId());
  }

  /** The grants shown to the viewer, and whether they are all of them. */
  private grants(ctx: Ctx): { grants: Grant[]; grantsShown: "all" | "yours" } | undefined {
    const item = this.item(ctx);
    const viewer = viewerOf(ctx);
    if (item === undefined || viewer === undefined) return undefined;
    return shownGrants(item.grants, item.owner, viewer.id);
  }

  private shownList: Grant[] = [];

  stops(): Stop[] {
    const out: Stop[] = [{ kind: "field", id: "pos:itemId" }];
    if (this.shownList.length > 0) out.push({ kind: "list", id: "grants" });
    out.push(
      { kind: "field", id: "to" },
      { kind: "button", id: "class", label: "Class" },
      { kind: "button", id: "mode", label: "Mode" },
      { kind: "field", id: "expires" },
      { kind: "button", id: "apply", label: "Add the grant" },
      ...this.advancedStops(),
    );
    return out;
  }

  /** Runs one change: the form's --add or --remove, through the router's confirmation. */
  private async change(ctx: Ctx, c: Change, extra: readonly string[] = []): Promise<void> {
    this.form.setValue("add", c.op === "add" ? [grantSpec(c.grant)] : []);
    this.form.setValue("remove", c.op === "remove" ? [grantSpec(c.grant)] : []);
    const r = await this.run(ctx, this.argvNow(ctx), extra);
    if (r === undefined) return;
    this.last = decisionOf(r) === "allow" ? c : undefined;
    // Off the fields, so u, c, v and J act on the answer; the list as the answer now has it.
    this.shownList = this.grants(ctx)?.grants ?? [];
    if (!this.focusOn("grants")) this.focusOn("apply");
  }

  private draftGrant(): Grant | string {
    return grantFrom({
      to: this.extras.get("to")?.value ?? "",
      class: this.klass,
      mode: this.mode,
      expires: this.extras.get("expires")?.value ?? "",
    });
  }

  private async add(ctx: Ctx): Promise<void> {
    const g = this.draftGrant();
    if (typeof g === "string") {
      this.problem = g;
      this.focusOn(g.includes("expiry") ? "expires" : "to");
      return;
    }
    await this.change(ctx, { op: "add", grant: g });
  }

  private async undo(ctx: Ctx): Promise<void> {
    const c = this.last;
    if (c === undefined) {
      ctx.say("nothing to undo: only a change the plane allowed on this screen can be");
      return;
    }
    if (c.op === "remove" && c.grant.expires !== undefined && c.grant.expires <= ctx.io.now()) {
      ctx.say("the removed grant has expired since: adding it back is not offered");
      return;
    }
    const inverse: Change = { op: c.op === "add" ? "remove" : "add", grant: c.grant };
    await this.change(ctx, inverse, [
      `This undoes the last change: it ${inverse.op === "remove" ? "removes the grant it added" : "adds back the grant it removed"}, as a new governed change with its own event. The plane may deny it.`,
    ]);
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    this.problem = undefined;
    switch (name) {
      case "submit":
        await this.add(ctx);
        return true;
      case "undo":
        await this.undo(ctx);
        return true;
      case "up":
      case "down":
        if (stop?.kind === "list")
          this.selected = Math.max(
            0,
            Math.min(this.shownList.length - 1, this.selected + (name === "up" ? -1 : 1)),
          );
        else this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
      case "toggle":
      case "choose-next":
      case "choose-prev":
      case "accept": {
        const step = name === "choose-prev" ? -1 : 1;
        if (stop?.id === "class" && name !== "accept") {
          const c = ["", ...GRANT_CLASSES];
          this.klass = c[(c.indexOf(this.klass) + step + c.length) % c.length] as string;
          return true;
        }
        if (stop?.id === "mode" && name !== "accept") {
          const m = [...GRANT_MODES] as string[];
          this.mode = m[(m.indexOf(this.mode) + step + m.length) % m.length] as string;
          return true;
        }
        if (stop?.id === "advanced") {
          if (name === "accept" || name === "toggle") this.advancedOpen = !this.advancedOpen;
          return true;
        }
        if (stop?.id === "apply" && (name === "accept" || name === "toggle")) {
          await this.add(ctx);
          return true;
        }
        if (stop?.kind === "list" && name === "accept") {
          const g = this.shownList[this.selected];
          if (g !== undefined) await this.change(ctx, { op: "remove", grant: g });
          return true;
        }
        if (name === "accept") this.focus += 1;
        return name === "accept";
      }
    }
    return false;
  }

  protected ownHints(): string {
    return "ctrl+s add  enter on a grant removes it  u undo  tab next";
  }

  protected body(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const out = [...this.errorHead(ctx, width)];
    const item = this.item(ctx);
    out.push(
      this.fieldRow(
        ctx,
        "pos:itemId",
        width,
        8,
        item === undefined ? "an item id (a UUIDv7)" : firstLine(item),
      ),
    );
    const shown = this.grants(ctx);
    this.shownList = shown?.grants ?? [];
    this.selected = Math.max(0, Math.min(this.selected, this.shownList.length - 1));
    if (shown === undefined)
      out.push(
        ...para(
          "Its grants show once a read of yours returns the item or a change answers; a change needs only its id.",
          width,
        ),
      );
    else
      out.push(
        ` ${shown.grantsShown === "all" ? "You own this item: every grant is shown." : "Only the grants naming you are shown; its owner sees every grant."}`,
      );
    out.push("", " Grants");
    if (this.shownList.length === 0) out.push("   none");
    const onList = this.current()?.id === "grants";
    this.shownList.forEach((g, i) => {
      const text = cut(
        `   ${onList && i === this.selected ? ">" : " "} ${oneLine(grantLabel(g))}     [ remove: enter ]`,
        width,
      );
      out.push(onList && i === this.selected ? t.reverse(text) : text);
    });
    const at = this.current()?.id;
    const choice = (id: string, label: string, value: string) => {
      const text = `${label} [ ${value === "" ? "any class" : value} ]`;
      return at === id ? t.reverse(text) : text;
    };
    out.push(
      "",
      " Add a grant",
      this.extraRow(ctx, "to", "To", width, "who it is for, such as person:sam"),
      cut(
        `     ${choice("class", "Class", this.klass)}   ${choice("mode", "Mode", this.mode)}   space or left and right choose`,
        width,
      ),
      this.extraRow(ctx, "expires", "Expires", width, "a UTC date or timestamp; empty for none"),
      `   ${this.button(ctx, "apply", "Add the grant")}`,
      ...this.advancedLines(ctx, width),
    );
    if (this.problem !== undefined) out.push("", ...para(t.status("fail", this.problem), width));
    const r = this.result;
    if (r !== undefined && !this.edited) {
      const allowed = decisionOf(r) === "allow";
      out.push("", decisionHead(t, this.command_, r));
      out.push(...outputLines(r, width).slice(0, 3), ...errorLines(r, width));
      if (allowed && this.last !== undefined)
        out.push(
          ` u undo (${this.last.op === "add" ? "removes it again" : "adds it back"}, a new governed change)`,
        );
    }
    return out;
  }
}

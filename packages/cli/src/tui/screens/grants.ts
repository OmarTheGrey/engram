// Grants (card E8.15c, docs/design/tui.md 8.19 and 9.6): the inspector's
// grants editor (card E9.4) through `engram grants <itemId> --add | --remove`.
// The item's grants are listed as the inspector shows them (all of them to
// the owner, only the viewer's own to anyone else: shownGrants), with
// grantLabel's text; a grant is added from a draft read by grantFrom, with
// its messages. A change is one governed call, as `engram grants` makes it,
// and may hold several grants added and removed (review fix pass): the
// pending change lists them, from the command line the screen was opened
// with, the drafts added to it and the grants chosen for removal, and ctrl+s
// sends them all. After an allowed change, `u` offers its inverse on the same
// item (remove what was added, add back what was removed if it has not
// expired): a new governed change with its own event, shown in the
// confirmation as its own command. It may be denied; nothing else on these
// screens can be undone.
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

/** One grant added or removed, as its flag's value writes it. */
interface Change {
  op: "add" | "remove";
  spec: string;
}

/** A spec's expiry, as it writes it; undefined for none. */
const expiryOf = (spec: string) => /(?:^|,)expires=([^,]+)/.exec(spec)?.[1];

/** A date alone is midnight UTC, as the CLI reads it. */
const instant = (t: string) => (/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00Z` : t);

export class GrantsScreen extends RichScreen {
  readonly kind = "grants" as const;
  protected override readonly keepsForm = true;
  private klass = "semantic";
  private mode = "read";
  private selected = 0;
  /** The last change the plane allowed, which `u` can undo, and the item it changed. */
  private last: { item: string; changes: Change[] } | undefined;
  /** The change ctrl+s sends: from the command line, the drafts added, the grants chosen. */
  private pending: Change[] = [];
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
    // A command line's --add and --remove are the pending change (review finding 4).
    for (const op of ["add", "remove"] as const) {
      for (const spec of this.form.get(op) as readonly string[]) this.pending.push({ op, spec });
      this.form.setValue(op, []);
    }
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
      { kind: "button", id: "apply", label: "Add to the change" },
      { kind: "button", id: "send", label: "Apply the change" },
      ...this.advancedStops(),
    );
    return out;
  }

  /** Runs one change, every --add and --remove of it in one call, through the router's confirmation. */
  private async change(ctx: Ctx, changes: Change[], extra: readonly string[] = []): Promise<void> {
    this.form.setValue(
      "add",
      changes.filter((c) => c.op === "add").map((c) => c.spec),
    );
    this.form.setValue(
      "remove",
      changes.filter((c) => c.op === "remove").map((c) => c.spec),
    );
    const r = await this.run(ctx, this.argvNow(ctx), extra);
    this.form.setValue("add", []);
    this.form.setValue("remove", []);
    if (r === undefined) return;
    this.pending = [];
    this.last = decisionOf(r) === "allow" ? { item: this.itemId(), changes } : undefined;
    // Off the fields, so u, c, v and J act on the answer; the list as the answer now has it.
    this.shownList = this.grants(ctx)?.grants ?? [];
    if (!this.focusOn("grants")) this.focusOn("apply");
  }

  protected override forgetAnswer(): void {
    super.forgetAnswer();
    this.last = undefined;
  }

  private draftGrant(): Grant | string {
    return grantFrom({
      to: this.extras.get("to")?.value ?? "",
      class: this.klass,
      mode: this.mode,
      expires: this.extras.get("expires")?.value ?? "",
    });
  }

  /** The draft as a change, or undefined when it is empty; a problem is set when it does not read. */
  private draftChange(): Change | undefined | "bad" {
    const to = (this.extras.get("to")?.value ?? "").trim();
    const expires = (this.extras.get("expires")?.value ?? "").trim();
    if (to === "" && expires === "") return undefined;
    const g = this.draftGrant();
    if (typeof g === "string") {
      this.problem = g;
      this.focusOn(g.includes("expiry") ? "expires" : "to");
      return "bad";
    }
    return { op: "add", spec: grantSpec(g) };
  }

  /** "Add to the change": the draft joins the pending change, and the draft is cleared. */
  private addDraft(): void {
    const c = this.draftChange();
    if (c === "bad") return;
    if (c === undefined) {
      this.problem = "a grant names who it is for, such as person:sam";
      this.focusOn("to");
      return;
    }
    this.pending.push(c);
    this.extras.get("to")?.set("");
    this.extras.get("expires")?.set("");
  }

  /** ctrl+s: the pending change and the draft, if one is typed, in one call. */
  private async send(ctx: Ctx): Promise<void> {
    const draft = this.draftChange();
    if (draft === "bad") return;
    const changes = [...this.pending, ...(draft === undefined ? [] : [draft])];
    if (changes.length === 0) {
      this.problem = "no change yet: type a grant, or choose one of the item's grants to remove";
      return;
    }
    if (draft !== undefined) {
      this.extras.get("to")?.set("");
      this.extras.get("expires")?.set("");
    }
    await this.change(ctx, changes);
  }

  private async undo(ctx: Ctx): Promise<void> {
    const last = this.last;
    if (last === undefined || last.item !== this.itemId()) {
      ctx.say(
        "nothing to undo: only a change the plane allowed on this item, on this screen, can be",
      );
      return;
    }
    const now = ctx.io.now();
    // A removed grant that has expired since is not added back (9.6).
    const back = last.changes.filter(
      (c) =>
        c.op === "add" ||
        expiryOf(c.spec) === undefined ||
        instant(expiryOf(c.spec) as string) > now,
    );
    if (back.length === 0) {
      ctx.say("the removed grants have expired since: adding them back is not offered");
      return;
    }
    const inverse = back.map(
      (c): Change => ({ op: c.op === "add" ? "remove" : "add", spec: c.spec }),
    );
    await this.change(ctx, inverse, [
      `This undoes the last change on ${last.item}: it removes what it added and adds back what it removed, as a new governed change with its own event. The plane may deny it.`,
    ]);
  }

  /** Editing the item clears the undo and the pending change: both belong to the item they were made on. */
  protected override changed(ctx: Ctx): void {
    super.changed(ctx);
    if (this.current()?.id === "pos:itemId") {
      this.last = undefined;
      this.pending = [];
    }
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    this.problem = undefined;
    switch (name) {
      case "submit":
        await this.send(ctx);
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
          this.addDraft();
          return true;
        }
        if (stop?.id === "send" && (name === "accept" || name === "toggle")) {
          await this.send(ctx);
          return true;
        }
        if (stop?.kind === "list" && (name === "accept" || name === "toggle")) {
          // A grant chosen for removal joins the pending change; chosen again, it leaves it.
          const g = this.shownList[this.selected];
          if (g === undefined) return true;
          const spec = grantSpec(g);
          const at = this.pending.findIndex((c) => c.op === "remove" && c.spec === spec);
          if (at >= 0) this.pending.splice(at, 1);
          else this.pending.push({ op: "remove", spec });
          return true;
        }
        if (name === "accept") this.focus += 1;
        return name === "accept";
      }
    }
    return false;
  }

  protected ownHints(): string {
    return "ctrl+s apply  enter on a grant chooses it  u undo  tab next";
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
      const chosen = this.pending.some((c) => c.op === "remove" && c.spec === grantSpec(g));
      const text = cut(
        `   ${onList && i === this.selected ? ">" : " "} ${chosen ? "[x] remove" : "[ ]"} ${oneLine(grantLabel(g))}`,
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
      `   ${this.button(ctx, "apply", "Add to the change")}   ${this.button(ctx, "send", "Apply the change")}   ctrl+s`,
      ...this.advancedLines(ctx, width),
    );
    if (this.pending.length > 0)
      out.push(
        "",
        " The change, one call",
        ...this.pending.map((c) =>
          cut(`   ${c.op === "add" ? "+ --add" : "- --remove"} ${oneLine(c.spec)}`, width),
        ),
      );
    if (this.problem !== undefined) out.push("", ...para(t.status("fail", this.problem), width));
    const r = this.result;
    if (r !== undefined && !this.edited) {
      const allowed = decisionOf(r) === "allow";
      // The decision first, then what undo would do, then the command's own lines (8.19).
      out.push("", decisionHead(t, this.command_, r));
      if (allowed && this.last !== undefined)
        out.push(
          cut(
            ` u undo on ${this.last.item} (${this.last.changes.every((c) => c.op === "add") ? "removes it again" : "the inverse change"}, a new governed change)`,
            width,
          ),
        );
      out.push(...outputLines(r, width), ...errorLines(r, width));
    }
    return out;
  }
}

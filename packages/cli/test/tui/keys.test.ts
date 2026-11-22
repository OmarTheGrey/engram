// The keys (card E8.15b, docs/design/tui.md 9.1 and 13): on every screen and
// overlay no key is bound to two actions; every action has a binding with no
// function key, no Alt, and not ctrl+p or F1 alone; Home's letters avoid the
// keys that act everywhere and in lists. Then the key flows of the frame,
// typed through a FakeTerminal as a person types them.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { actionFor, actionsOn, EVERYWHERE, KEYS, printable, type Where } from "../../src/tui/keys.ts";
import { offered } from "../../src/tui/overlays.ts";
import { LETTERS, RESERVED_LETTERS } from "../../src/tui/screens/home.ts";
import { fixtureCopy, tempDir } from "../helpers.ts";
import { type Harness, startHarness } from "./harness.ts";

const ALL: Where[] = [...EVERYWHERE, "too-small", "help", "palette", "confirm"];
const UP = "\x1b[A";
const DOWN = "\x1b[B";
const ESC = "\x1b";
const ENTER = "\r";
const TAB = "\t";

describe("the key table", () => {
  it("binds no key to two actions on any screen or overlay", () => {
    for (const where of ALL) {
      const seen = new Map<string, string>();
      for (const a of actionsOn(where))
        for (const k of a.keys) {
          expect(seen.get(k), `${where}: ${k} is ${seen.get(k)} and ${a.action}`).toBeUndefined();
          seen.set(k, a.action);
        }
      if (where === "home")
        for (const letter of Object.values(LETTERS))
          expect(seen.get(letter), `home: ${letter} is a letter and ${seen.get(letter)}`).toBeUndefined();
    }
  });

  it("gives every action a binding with no function key, no Alt, and not ctrl+p or F1 alone", () => {
    for (const a of KEYS) {
      const plain = a.keys.filter((k) => !/^f\d+$/.test(k) && !k.includes("alt+") && k !== "ctrl+p");
      expect(plain.length, `${a.action} needs a key every terminal passes`).toBeGreaterThan(0);
    }
  });

  it("gives every command on Home one letter, none of them a global or list key", () => {
    const letters = offered().map((s) => LETTERS[s.name]);
    expect(letters.every((l) => l !== undefined && l.length === 1), JSON.stringify(letters)).toBe(true);
    expect(new Set(letters).size).toBe(letters.length);
    for (const l of letters) expect(RESERVED_LETTERS as readonly string[]).not.toContain(l);
    for (const d of ["1", "2", "3", "4", "5", "6"]) expect(letters).not.toContain(d);
  });

  it("lets a text field type every printable key, : and ; and ? and q included", () => {
    for (const k of [":", ";", "?", "q", "c", "j", "s", " "]) expect(actionFor(k, "form", true)).toBeUndefined();
    expect(actionFor(";", "home", false)).toBe("palette");
    expect(actionFor("\x07", "form", true)).toBe("help"); // ctrl+g
    expect(actionFor("\x10", "form", true)).toBe("palette"); // ctrl+p
    expect(actionFor(ESC, "form", true)).toBe("back");
    expect(actionFor("\x13", "form", true)).toBe("submit");
    expect(printable("shift+l")).toBe(true);
    expect(printable("ctrl+l")).toBe(false);
  });
});

/** A started TUI on a usable workspace in a temporary folder. */
async function usable(extra: Parameters<typeof startHarness>[0] = {}): Promise<Harness> {
  const cwd = await tempDir();
  return startHarness({ cwd, home: cwd, given: { owner: "dana", db: "engram.db" }, ...extra });
}

describe("the frame's keys", () => {
  it("? opens the help overlay with this screen's keys, the global ones and the command's help; esc closes it", async () => {
    const h = await usable();
    await h.press("?");
    expect(h.overlay()).toBe("help");
    const text = await h.text();
    expect(text).toContain("Help: Home");
    expect(text).toContain("This screen");
    expect(text).toContain("Everywhere");
    expect(text).toContain("engram read [query]");
    await h.press(ESC);
    expect(h.overlay()).toBeUndefined();
    await h.quit();
  });

  it("ctrl+g opens help from inside a field, where ? types", async () => {
    const h = await usable();
    await h.press("w"); // Write a memory: the content field is focused
    expect(h.screen()).toBe("form");
    await h.press("?");
    expect(h.overlay()).toBeUndefined();
    expect(await h.text()).toContain("[ ?");
    await h.press("\x07");
    expect(h.overlay()).toBe("help");
    // The command's own help section, from HELP verbatim, below the keys.
    for (let i = 0; i < 30; i++) await h.press(DOWN);
    expect(await h.text()).toContain("write options:");
    await h.quit();
  });

  it("; and ctrl+p open the palette; ctrl+o the workspace; esc goes back", async () => {
    const h = await usable();
    await h.press(";");
    expect(h.overlay()).toBe("palette");
    await h.press(ESC);
    await h.press("\x10");
    expect(h.overlay()).toBe("palette");
    await h.press(ESC);
    await h.press("\x0f");
    expect(h.screen()).toBe("workspace");
    await h.press(ESC);
    expect(h.screen()).toBe("home");
    await h.quit();
  });

  it("q on Home quits; q in a form field types; esc on a form with input asks first", async () => {
    const h = await usable();
    await h.press("w", "q");
    expect(h.screen()).toBe("form");
    expect(await h.text()).toContain("[ q");
    await h.press(ESC);
    expect(h.overlay()).toBe("confirm");
    expect(await h.text()).toContain("Leave this form?");
    await h.press("y");
    expect(h.screen()).toBe("home");
    const done = h.quit();
    expect((await done).ran).toEqual([]);
  });

  it("1 to 6 jump to a group and a letter opens its command", async () => {
    const h = await usable();
    await h.press("6");
    expect(h.focused()).toBe("doctor");
    await h.press("2");
    expect(h.focused()).toBe("retain");
    await h.press(DOWN);
    expect(h.focused()).toBe("lint");
    await h.press("p");
    expect(h.screen()).toBe("form");
    expect(await h.text()).toContain("engram promote <itemId>");
    await h.quit();
  });

  it("scrolls Home at 80x24 and says how much is below; at 120x40 everything fits", async () => {
    const small = await usable();
    expect(await small.text()).toMatch(/\d+ more below: pgdn/);
    await small.press("6");
    expect(await small.text()).toContain("[d] Doctor");
    await small.quit();
    const wide = await usable({ columns: 120, rows: 40 });
    const text = await wide.text();
    expect(text).not.toContain("more below");
    for (const s of offered()) expect(text).toContain(s.title);
    await wide.quit();
  });

  it("the palette finds a command by a flag it takes, and opens a pasted command line filled from its flags", async () => {
    const h = await usable();
    await h.press(";");
    await h.type("--review");
    expect((await h.frame()).find((l) => l.includes(">") && l.includes("Promote an item"))).toBeDefined();
    await h.press(ESC, ";");
    await h.type("read release --at 2026-10-25T12:00:00Z");
    expect(await h.text()).toContain("Open as typed");
    await h.press(ENTER);
    expect(h.screen()).toBe("form");
    const app = h.app.top() as unknown as { form: { argv(ws: unknown): string[] } };
    expect(app.form.argv(h.app.ws)).toEqual([
      "read",
      "release",
      "--at",
      "2026-10-25T12:00:00Z",
      "--db",
      "engram.db",
      "--owner",
      "dana",
    ]);
    await h.quit();
  });

  it("the palette says did you mean for a query that matches nothing", async () => {
    const h = await usable();
    await h.press(";");
    await h.type("readd zq");
    expect(await h.text()).toContain("No command matches. Did you mean read?");
    await h.quit();
  });

  it("keeps the session through a resize below 80x24: the form's input is there when it grows back", async () => {
    const h = await usable();
    await h.press("w");
    await h.type("kept across the resize");
    await h.resize(79, 24);
    expect(await h.text()).toContain("engram tui needs 80x24; this terminal is 79x24.");
    await h.press("x"); // ignored while too small
    await h.resize(80, 23);
    expect(await h.text()).toContain("this terminal is 80x23");
    await h.resize(80, 24);
    expect(h.screen()).toBe("form");
    expect(await h.text()).toContain("kept across the resize");
    await h.quit();
  });

  it("ctrl+c quits from inside an overlay", async () => {
    const h = await usable();
    await h.press("?");
    await h.press("\x03");
    await expect(h.app.done).resolves.toBeDefined();
  });

  it("c copies the command; with no clipboard path it is printed on quit", async () => {
    const h = await usable();
    await h.press("c");
    expect(await h.text()).toContain("not copied: it will be printed when you quit");
    const s = await h.quit();
    expect(s.deferred).toEqual(["engram read --db engram.db --owner dana"]);
  });

  it("copies by OSC 52 in Windows Terminal", async () => {
    const h = await usable({ env: { WT_SESSION: "1" } });
    await h.press("c");
    expect(h.term.output).toContain(`\x1b]52;c;${Buffer.from("engram read --db engram.db --owner dana").toString("base64")}\x07`);
    expect(await h.text()).toContain("copied");
    await h.quit();
  });
});

describe("confirmation (9.5)", () => {
  it("asks before a write, the safe button focused: enter cancels and nothing runs", async () => {
    const root = await fixtureCopy();
    const h = await usable({ given: { owner: "dana", db: "engram.db", root } });
    await h.press("w");
    await h.type("a memory");
    await h.press("\x13");
    expect(h.overlay()).toBe("confirm");
    const text = await h.text();
    expect(text).toContain("Write a memory?");
    expect(text).toContain("$ engram write --content");
    await h.press(ENTER);
    expect(h.overlay()).toBeUndefined();
    expect(h.ran()).toEqual([]);
    await h.press("\x13", "y");
    expect(h.screen()).toBe("result");
    expect(h.ran()).toHaveLength(1);
    expect(await h.text()).toContain("exit 0");
    await h.quit();
  });

  it("asks before the first read with a store folder in a session, and not before the second", async () => {
    const root = await fixtureCopy();
    const h = await usable({ given: { owner: "dana", db: "engram.db", root } });
    await h.press("r", "\x13");
    expect(h.overlay()).toBe("confirm");
    expect(await h.text()).toContain("sweeps the owner's retention");
    expect(h.ran()).toEqual([]);
    await h.press("y");
    expect(h.ran()).toHaveLength(1);
    await h.press(ESC); // back to the form
    await h.press("\x13");
    expect(h.overlay()).toBeUndefined();
    expect(h.ran()).toHaveLength(2);
    await h.quit();
  });

  it("asks for the key id typed before a key is revoked", async () => {
    const cwd = await tempDir();
    mkdirSync(join(cwd, "k"));
    const h = await usable({ cwd });
    await h.press("R");
    await h.type("ab12cd34");
    await h.press(TAB, ENTER, TAB); // open the workspace flags' fold: --keys is one
    expect(h.focused()).toBe("keys");
    await h.type("k/keys.json");
    await h.press("\x13");
    expect(h.overlay()).toBe("confirm");
    expect(await h.text()).toContain("Type ab12cd34 to go on");
    await h.press(ENTER, TAB, ENTER);
    expect(h.ran()).toEqual([]);
    await h.type("ab12cd34");
    await h.press(TAB, ENTER);
    expect(h.ran()).toEqual([["key", "revoke", "ab12cd34", "--keys", "k/keys.json"]]);
    await h.quit();
  });

  it("does not run serve, mcp or the hook on its own terminal", async () => {
    const h = await usable();
    await h.press("h", "\x13");
    expect(h.ran()).toEqual([]);
    expect(await h.text()).toContain("engram serve runs until stopped");
    await h.quit();
  });
});

describe("the first loop", () => {
  it("first run, then write, read and explain, each the plain command shown before it runs", async () => {
    const cwd = await tempDir();
    const root = await fixtureCopy();
    const h = await startHarness({ cwd, home: cwd, given: { db: "engram.db", root } });
    expect(h.screen()).toBe("first-run");
    // It opens on the question that failed: who you are.
    expect(h.focused()).toBe("who");
    await h.type("dana");
    await h.press(ENTER, ENTER);
    expect(h.screen()).toBe("loop");
    expect(await h.text()).toContain('1  Write    engram write --content "The deploy key rotates every 90 days."');
    await h.press(ENTER);
    await h.press(ENTER);
    await h.press(ENTER);
    const ran = h.ran();
    expect(ran.map((a) => a[0])).toEqual(["write", "read", "explain"]);
    expect(ran[1]?.[1]).toBe("deploy");
    expect(ran[2]?.[1]).toMatch(/^01930000-0000-7000-8000-\d{12}$/);
    expect(await h.text()).toContain("Done. Press enter for Home");
    await h.press(ENTER);
    expect(h.screen()).toBe("home");
    const s = await h.quit();
    expect(s.ran.map((r) => r.code)).toEqual([0, 0, 0]);
  });
});

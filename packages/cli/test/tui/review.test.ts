// The E8.15b review fix pass (card E8.15b; the reviewer's findings C1, I1 to
// I10 and M1 to M16, scratchpad/review-e8-15b.md): one test per finding the
// fix closes, each written before its fix and seen failing first.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summaryText } from "../../src/tui/app.ts";
import { actionFor, KEYS, printable } from "../../src/tui/keys.ts";
import { LoopScreen } from "../../src/tui/screens/loop.ts";
import { cli, fixtureCopy, tempDir } from "../helpers.ts";
import { startHarness } from "./harness.ts";

const ESC = "\x1b";
const CTRL_S = "\x13";

describe("I1: a Postgres log is checked off the input path", () => {
  const PG = "postgres://dana:pw@127.0.0.1:1/engram";
  it("types at full speed while a slow check runs, shows its answer when it comes, and ctrl+c still quits", async () => {
    let calls = 0;
    const slow = () => {
      calls++;
      return new Promise<["ok" | "fail", string]>((r) =>
        setTimeout(() => r(["ok", "postgres: opens; up to date"]), 1500),
      );
    };
    const cwd = await tempDir();
    const h = await startHarness({ cwd, home: cwd, given: { db: PG }, logCheck: slow });
    expect(h.screen()).toBe("first-run");
    expect(await h.text()).toContain("checking");
    const t = Date.now();
    await h.type("dana");
    expect(Date.now() - t).toBeLessThan(1000);
    // Typing an answer runs no check; only a change of the log's answer does.
    expect(calls).toBe(1);
    await new Promise((r) => setTimeout(r, 1700));
    expect(await h.text()).toContain("postgres: opens; up to date");
    const quit = Date.now();
    h.term.send("\x03");
    await h.app.done;
    expect(Date.now() - quit).toBeLessThan(500);
  });

  it("checks a Postgres URL typed in first run once, when its question is left, not per key", async () => {
    let calls = 0;
    const check = async () => {
      calls++;
      return ["fail", "postgres 127.0.0.1:1: connection refused"] as ["fail", string];
    };
    const cwd = await tempDir();
    const h = await startHarness({ cwd, home: cwd, given: {}, logCheck: check });
    await h.press("\x1b[B", "\x1b[B", "\x1b[B"); // a Postgres server
    await h.type(PG);
    expect(calls).toBe(0);
    await h.press("\t");
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(1);
    await h.quit();
  });
});

describe("I3: pgup and pgdn reach the screens", () => {
  it("move Home's selection by a page and scroll a result", async () => {
    const cwd = await tempDir();
    const h = await startHarness({ cwd, home: cwd, given: { owner: "dana", db: "engram.db" } });
    expect(h.focused()).toBe("read");
    await h.press("\x1b[6~");
    expect(h.focused()).not.toBe("read");
    await h.press("\x1b[5~");
    expect(h.focused()).toBe("read");
    await h.press("y", CTRL_S); // the policy in force: a long result
    expect(h.screen()).toBe("result");
    const before = await h.text();
    await h.press("\x1b[6~");
    expect(await h.text()).not.toBe(before);
    await h.quit();
  });
});

describe("I2: control characters in a command's output never reach the terminal", () => {
  it("draws a memory holding escape sequences as text, in a result and in the first loop", async () => {
    const cwd = await tempDir();
    const root = await fixtureCopy();
    const db = join(cwd, "engram.db");
    const evil = "\x1b]0;PWNED\x07 hello \x1b[2J\x1b[31mred\x9b31m\x07bell\ttab";
    const w = await cli([
      "write",
      "--content",
      evil,
      "--owner",
      "dana",
      "--db",
      db,
      "--root",
      root,
    ]);
    expect(w.code).toBe(0);
    const h = await startHarness({
      cwd,
      home: cwd,
      given: { owner: "dana", db: "engram.db", root },
    });
    const start = h.term.output.length;
    await h.press(";");
    await h.type("read hello");
    await h.press("\r", CTRL_S, "y");
    expect(h.screen()).toBe("result");
    for (let i = 0; i < 6; i++) await h.press("\x1b[6~");
    const text = (await h.frame()).join("\n");
    const written = h.term.output.slice(start);
    expect(written).not.toContain("\x1b]0;PWNED");
    expect(written).not.toContain("\x1b[31mred");
    expect(written).not.toContain("\x9b");
    expect(written).not.toContain("\x07bell");
    expect(text).toContain("hello");
    await h.quit();
  });
});

describe("I4: secrets are not shown, while c copies the whole command", () => {
  const PG = "postgres://dana:hunter2secret@127.0.0.1:1/engram";
  it("redacts a Postgres password in the command row and the quit summary", async () => {
    const cwd = await tempDir();
    const h = await startHarness({
      cwd,
      home: cwd,
      given: { owner: "dana", db: PG },
      logCheck: async () => ["fail", "postgres: connection refused"],
    });
    expect(h.screen()).toBe("home");
    expect(await h.text()).not.toContain("hunter2secret");
    expect(await h.text()).toContain("postgres://***@127.0.0.1:1/engram");
    await h.press("E"); // explain: a command that takes --db
    await h.type("01930000-0000-7000-8000-000000000001");
    await h.press(CTRL_S);
    expect(h.ran()).toHaveLength(1);
    expect(await h.text()).not.toContain("hunter2secret");
    await h.press("c");
    const s = await h.quit();
    expect(s.deferred.join("\n")).toContain("hunter2secret");
    const summary = summaryText(s, "posix", false);
    expect(summary).toContain("explain");
    expect(summary).not.toContain("hunter2secret");
  });
});

describe("I7 and I9: copy and the palette work inside a text field, by keys VS Code passes", () => {
  it("binds each to a key that acts in a field and is not ctrl+p", () => {
    for (const action of ["copy", "palette", "help"]) {
      const inField = KEYS.filter((k) => k.action === action)
        .flatMap((k) => k.keys)
        .filter((k) => !printable(k) && k !== "ctrl+p" && !/^f\d+$/.test(k));
      expect(inField.length, action).toBeGreaterThan(0);
    }
    expect(actionFor("\x1bc", "form", true)).toBe("copy");
    expect(actionFor("\x1bp", "form", true)).toBe("palette");
  });

  it("alt+c copies and alt+p opens the palette from inside a field, and the hints name only keys that work there", async () => {
    const cwd = await tempDir();
    const h = await startHarness({ cwd, home: cwd, given: { owner: "dana", db: "engram.db" } });
    await h.press("w");
    expect(h.app.top().inField()).toBe(true);
    const hints = (await h.frame()).at(-1) ?? "";
    expect(hints).toContain("alt+c copy");
    expect(hints).toContain("alt+p commands");
    expect(hints).toContain("ctrl+g help");
    expect(hints).not.toMatch(/(^|\s)\? help/);
    expect(hints).not.toMatch(/(^|\s); commands/);
    await h.press("\x1bc");
    expect(await h.text()).toContain("not copied: it will be printed when you quit");
    await h.press("\x1bp");
    expect(h.overlay()).toBe("palette");
    await h.quit();
  });

  it("the first loop says how to copy from a field", async () => {
    const cwd = await tempDir();
    const root = await fixtureCopy();
    const h = await startHarness({
      cwd,
      home: cwd,
      given: { db: "engram.db", root, owner: "dana" },
    });
    h.app.replace(new LoopScreen());
    const text = await h.text();
    expect(text).not.toMatch(/(^|[^+])c copies it/);
    expect(text).toContain("alt+c copies it");
    await h.quit();
  });
});

describe("I8: the mouse, on by default, does what it captures", () => {
  const wheelDown = (x: number, y: number) => `\x1b[<65;${x};${y}M`;
  const wheelUp = (x: number, y: number) => `\x1b[<64;${x};${y}M`;
  const click = (x: number, y: number) => [`\x1b[<0;${x};${y}M`, `\x1b[<0;${x};${y}m`];

  it("the wheel moves Home's selection and scrolls a result; a click selects a Home row, a double click opens it", async () => {
    const cwd = await tempDir();
    const h = await startHarness({
      cwd,
      home: cwd,
      given: { owner: "dana", db: "engram.db" },
      options: { mouse: true },
    });
    expect(h.focused()).toBe("read");
    await h.press(wheelDown(10, 10));
    expect(h.focused()).not.toBe("read");
    await h.press(wheelUp(10, 10));
    expect(h.focused()).toBe("read");
    // Row 6 of the terminal (1-based) is Home's fifth list line: Check a write.
    const frame = await h.frame();
    const row = frame.findIndex((l) => l.includes("[C] Check a write")) + 1;
    await h.press(...click(8, row));
    expect(h.focused()).toBe("check");
    expect(h.screen()).toBe("home");
    await h.press(...click(8, row), ...click(8, row));
    expect(h.screen()).toBe("form");
    await h.press(ESC);
    await h.press("y", CTRL_S);
    const before = await h.text();
    await h.press(wheelDown(10, 10));
    expect(await h.text()).not.toBe(before);
    await h.quit();
  });
});

describe("C1: a read with a store folder asks for the folder its own command line names", () => {
  it("asks for folder A, then again for folder B, each dialog naming its folder", async () => {
    const cwd = await tempDir();
    const a = (await fixtureCopy()).replaceAll("\\", "/");
    const b = (await fixtureCopy()).replaceAll("\\", "/");
    const h = await startHarness({ cwd, home: cwd, given: { owner: "dana", db: "engram.db" } });
    for (const root of [a, b]) {
      await h.press(";");
      await h.type(`read --root ${root}`);
      await h.press("\r");
      expect(h.screen()).toBe("form");
      await h.press(CTRL_S);
      expect(h.overlay(), `no dialog before the read of ${root}`).toBe("confirm");
      const text = await h.text();
      expect(text).toContain(`Read with .../${root.split("/").at(-1)}?`);
      expect(text).not.toContain("the server's store");
      await h.press("y");
      expect(h.screen()).toBe("result");
      await h.press(ESC, ESC);
    }
    expect(h.ran()).toHaveLength(2);
    // The same folder again in this session does not ask.
    await h.press(";");
    await h.type(`read --root ${a}`);
    await h.press("\r", CTRL_S);
    expect(h.overlay()).toBeUndefined();
    expect(h.ran()).toHaveLength(3);
    await h.quit();
  });
});

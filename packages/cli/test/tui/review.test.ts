// The E8.15b review fix pass (card E8.15b; the reviewer's findings C1, I1 to
// I10 and M1 to M16, scratchpad/review-e8-15b.md): one test per finding the
// fix closes, each written before its fix and seen failing first.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { summaryText } from "../../src/tui/app.ts";
import { actionFor, KEYS, printable } from "../../src/tui/keys.ts";
import { savedPath } from "../../src/tui/saved.ts";
import { LoopScreen } from "../../src/tui/screens/loop.ts";
import { makeTheme, paletteFor } from "../../src/tui/theme.ts";
import { cli, fixtureCopy, tempDir } from "../helpers.ts";
import { startHarness } from "./harness.ts";

const ESC = "\x1b";
const CTRL_S = "\x13";
const HERE = dirname(fileURLToPath(import.meta.url));

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

  it("opens first run on the log's question when the start's Postgres check comes back refused", async () => {
    const cwd = await tempDir();
    const h = await startHarness({
      cwd,
      home: cwd,
      given: { db: PG, owner: "dana" },
      logCheck: () =>
        new Promise((r) => setTimeout(() => r(["fail", "postgres 127.0.0.1:1: connect ECONNREFUSED"]), 100)),
    });
    expect(h.screen()).toBe("home");
    await new Promise((r) => setTimeout(r, 250));
    expect(h.screen()).toBe("first-run");
    expect(h.focused()).toBe("log");
    expect(await h.text()).toContain("ECONNREFUSED");
    await h.quit();
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
      // The log answers, so the TUI stays on Home: the subject here is redaction.
      logCheck: async () => ["ok", "postgres: opens; up to date"],
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

describe("I10: the first loop shows each step's whole output", () => {
  it("scrolls to every line of the read and the explain, and alt+v opens a step's full result", async () => {
    const cwd = await tempDir();
    const root = await fixtureCopy();
    const h = await startHarness({
      cwd,
      home: cwd,
      given: { db: "engram.db", root, owner: "dana" },
    });
    h.app.replace(new LoopScreen());
    await h.press("\r", "\r", "\r"); // write, read, explain
    expect(h.ran().map((a) => a[0])).toEqual(["write", "read", "explain"]);
    const read = h.app.ran[1];
    expect(read).toBeDefined();
    // Every line of every step's output is on the loop screen, by scrolling.
    const seen = new Set<string>();
    await h.press("\x1b[H"); // home: to the top
    for (let i = 0; i < 40; i++) {
      for (const l of await h.frame()) seen.add(l.trim());
      await h.press("\x1b[B");
    }
    const all = [...seen].join("\n");
    expect(all).toContain("admitted by");
    expect(all).toContain("The deploy key rotates every 90 days.");
    // alt+v: the last step's whole result, as a result screen.
    await h.press("\x1bv");
    expect(h.screen()).toBe("result");
    expect(await h.text()).toContain("explain");
    await h.quit();
  });
});

describe("the minor findings", () => {
  const usable = async (extra: Parameters<typeof startHarness>[0] = {}) => {
    const cwd = await tempDir();
    return startHarness({ cwd, home: cwd, given: { owner: "dana", db: "engram.db" }, ...extra });
  };

  it("M1: names no preset in the TUI's source; the choices are the registry's", () => {
    const src = join(HERE, "../../src/tui");
    const files = readdirSync(src, { recursive: true }).filter((f) => String(f).endsWith(".ts"));
    for (const f of files) {
      const text = readFileSync(join(src, String(f)), "utf8");
      for (const preset of ["strict", "medium", "permissive"])
        expect(text, String(f)).not.toContain(`"${preset}"`);
    }
  });

  it("M2: high contrast greys nothing out with faint text", () => {
    expect(makeTheme("high-contrast", "unicode").dim("the server's own")).toBe("the server's own");
  });

  it("M3: with no known background, status symbols are bold and uncoloured, not the terminal's indexed colours", async () => {
    expect(paletteFor({ noColor: false, highContrast: false, ascii: false }, {}, undefined)).toBe(
      "unknown",
    );
    const h = await usable({ env: {}, given: {} });
    const tick = (await h.cells()).find((c) => c.char === "✓");
    expect(tick?.fg).toBe("default");
    expect(tick?.bold).toBe(true);
    await h.quit();
  });

  it("M9: keeps <here> in sight when the command row is cut in the middle", async () => {
    const h = await usable();
    await h.press("w");
    await h.type("a".repeat(70));
    await h.focusField("confidence");
    await h.type("high");
    await h.press(CTRL_S);
    const row = (await h.frame()).at(-2) ?? "";
    expect(row).toContain("<here>");
    await h.quit();
  });

  it("M10: in the workspace panel enter moves to the next field, ctrl+s applies, and a missing folder is warned of", async () => {
    const h = await usable();
    await h.press("\x0f");
    await h.focusField("root");
    await h.type("no-such-folder");
    await h.press("\r");
    expect(h.screen()).toBe("workspace");
    expect(h.focused()).toBe("owner");
    await h.press(CTRL_S);
    expect(h.screen()).toBe("home");
    expect(await h.text()).toContain("no-such-folder does not exist");
    await h.quit();
  });

  it("M11: flags such as --high-contrast hold for the session only; the panel's own toggle saves", async () => {
    const h = await usable({ options: { highContrast: true, ascii: true } });
    h.app.save();
    const home = h.io.home;
    expect(JSON.parse(readFileSync(savedPath(home), "utf8")).options).toEqual({});
    await h.press("\x0f");
    await h.focusField("contrast");
    await h.press(" ");
    await h.press(CTRL_S);
    expect(JSON.parse(readFileSync(savedPath(home), "utf8")).options).toEqual({ contrast: "high" });
    await h.quit();
  });

  it("M12: the export confirmation says whether the file exists", async () => {
    const h = await usable();
    writeFileSync(join(h.io.cwd, "old.bundle"), "x");
    for (const [file, says] of [
      ["old.bundle", "it exists and will be overwritten"],
      ["new.bundle", "it does not exist yet"],
    ] as const) {
      await h.press(";");
      await h.type(`export --out ${file}`);
      await h.press("\r", CTRL_S);
      expect(h.overlay()).toBe("confirm");
      expect(await h.text()).toContain(says);
      await h.press("n", ESC);
    }
    await h.quit();
  });

  it("M13: a write with no store folder is refused at the form, before any confirmation", async () => {
    const h = await usable();
    await h.press("w");
    await h.type("a memory");
    await h.press(CTRL_S);
    expect(h.overlay()).toBeUndefined();
    expect(await h.text()).toContain("the files store needs --root <folder>");
    expect(h.ran()).toEqual([]);
    await h.quit();
  });

  it("M15: in server mode the title bar says whether the server answers GET /health, and applying checks again", async () => {
    const asked: string[] = [];
    const up = async (r: Request) => {
      asked.push(new URL(r.url).pathname);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const h = await usable({
      given: { owner: "dana", server: "http://127.0.0.1:7313" },
      fetch: up,
    });
    await h.frame();
    expect(asked).toContain("/api/v1/health");
    expect((await h.frame())[0]).toContain("server 127.0.0.1:7313");
    await h.quit();
    const down = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    const d = await usable({
      given: { owner: "dana", server: "http://127.0.0.1:7313" },
      fetch: down,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect((await d.frame())[0]).toContain("server unreachable");
    await d.press("\x0f", CTRL_S);
    expect(await d.text()).toContain("did not answer");
    await d.quit();
  });

  it("M5: the palette has switch actor, rerun and copy, ranks word starts first, and cuts no label at 32", async () => {
    const h = await usable();
    await h.press(";");
    for (const label of ["Switch actor", "Run the last command again", "Copy the command line"]) {
      await h.press("\x15");
      await h.type(label.toLowerCase());
      expect(await h.text(), label).toContain(label);
    }
    await h.press("\x15");
    await h.type("read");
    const first = (await h.frame()).find((l) => l.includes(" > ") && !l.includes("> read"));
    expect(first).toContain("Read and explain");
    await h.press("\x15");
    await h.type("procedures");
    expect(await h.text()).toContain("Procedures: not yet available (backlog)");
    await h.quit();
  });

  it("shows a choice's default by its value", async () => {
    const h = await usable();
    await h.press("w");
    expect(await h.text()).toContain("default (semantic)");
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

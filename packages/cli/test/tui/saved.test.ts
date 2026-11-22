// The saved workspace (card E8.15b, docs/design/tui.md 8.3 and 13): the TUI
// keeps the workspace flags and its own options in <home>/.engram/tui.json
// and nothing else: no memory content, no item or read id, no token, key or
// password, and a Postgres URL or a server URL with credentials only
// redacted. Forget deletes the file; --no-saved neither reads nor writes it.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  forgetSaved,
  loadSaved,
  SAVED_FLAGS,
  SAVED_OPTIONS,
  savedPath,
  writeSaved,
} from "../../src/tui/saved.ts";
import { tempDir } from "../helpers.ts";
import { startHarness } from "./harness.ts";

const SECRET = "hunter2-very-secret-password";
const TOKEN = "eyJhbGciOiJFZERTQSJ9.token-value-never-saved";
const CONTENT = "The deploy key rotates every 90 days, codename BLUEBIRD.";

describe("tui.json", () => {
  it("lives beside the default log, in the user's home", async () => {
    const home = await tempDir();
    expect(savedPath(home)).toBe(join(home, ".engram", "tui.json"));
  });

  it("holds only the listed flags and options, round trip", async () => {
    const home = await tempDir();
    const written = writeSaved(
      home,
      {
        db: "engram.db",
        policy: "strict",
        store: "files",
        root: "mem",
        owner: "dana",
        "import-valid-from": "2026-10-01T00:00:00Z",
        as: "person:dana",
        level: "person",
        member: ["person:dana", "team:lantern"],
        otlp: "http://127.0.0.1:4318/v1/traces",
        "export-jsonl": "decisions.jsonl",
        keys: "keys.json",
        // Not flags of the workspace: never written.
        content: CONTENT,
        item: "01930000-0000-7000-8000-000000000001",
        token: TOKEN,
      } as Record<string, string | string[]>,
      { ascii: true, contrast: "high", motion: "reduce", mouse: false, line: false },
    );
    const text = readFileSync(savedPath(home), "utf8");
    const parsed = JSON.parse(text);
    expect(Object.keys(parsed).sort()).toEqual(["engram_tui", "flags", "options"]);
    for (const k of Object.keys(parsed.flags)) expect(SAVED_FLAGS).toContain(k);
    for (const k of Object.keys(parsed.options)) expect(SAVED_OPTIONS).toContain(k);
    expect(parsed.flags.member).toEqual(["person:dana", "team:lantern"]);
    expect(text).not.toContain(CONTENT);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("01930000-0000-7000-8000-000000000001");
    expect(loadSaved(home).saved).toEqual(written);
    if (process.platform !== "win32") expect(statSync(savedPath(home)).mode & 0o077).toBe(0);
  });

  it("saves a Postgres URL redacted, as doctor prints it, and a server URL without its credentials", async () => {
    const home = await tempDir();
    writeSaved(
      home,
      {
        db: `postgres://dana:${SECRET}@db.example:5432/engram?sslmode=require&password=${SECRET}`,
        server: `http://dana:${SECRET}@127.0.0.1:7313/?token=${SECRET}`,
      },
      {},
    );
    const text = readFileSync(savedPath(home), "utf8");
    expect(text).not.toContain(SECRET);
    const { flags } = JSON.parse(text);
    expect(flags.db).toMatch(/^postgres:\/\/\*\*\*@db\.example:5432\/engram/);
    expect(flags.server).toBe("http://127.0.0.1:7313/");
  });

  it("reads back nothing it does not know, and reports a file it cannot read", async () => {
    const home = await tempDir();
    mkdirSync(join(home, ".engram"), { recursive: true });
    writeFileSync(
      savedPath(home),
      JSON.stringify({
        engram_tui: 1,
        flags: { owner: "dana", content: CONTENT, member: ["person:dana", 3] },
        options: { ascii: true, bogus: 1 },
      }),
    );
    const { saved } = loadSaved(home);
    expect(saved?.flags).toEqual({ owner: "dana" });
    expect(saved?.options).toEqual({ ascii: true });
    writeFileSync(savedPath(home), "{ not json");
    const broken = loadSaved(home);
    expect(broken.saved).toBeUndefined();
    expect(broken.problem).toMatch(/tui\.json/);
    expect(loadSaved(await tempDir())).toEqual({});
  });

  it("forgets: the file is deleted", async () => {
    const home = await tempDir();
    writeSaved(home, { owner: "dana" }, {});
    expect(forgetSaved(home)).toBe(true);
    expect(existsSync(savedPath(home))).toBe(false);
    expect(forgetSaved(home)).toBe(false);
  });
});

describe("the TUI and tui.json", () => {
  it("writes it at the end of first run with the answers only, and never the first loop's content or ids", async () => {
    const home = await tempDir();
    const cwd = await tempDir();
    mkdirSync(join(cwd, "mem"));
    const h = await startHarness({ home, cwd, env: { ENGRAM_TOKEN: TOKEN } });
    expect(h.screen()).toBe("first-run");
    await h.press("\x1b[B"); // down: "a file I name"
    await h.type("engram.db");
    await h.press("\t");
    await h.type("dana");
    await h.press("\t");
    await h.type("mem");
    await h.press("\r");
    expect(h.screen()).toBe("loop");
    const saved = JSON.parse(readFileSync(savedPath(home), "utf8"));
    expect(saved.flags).toEqual({ db: "engram.db", owner: "dana", root: "mem" });
    // The first loop: write, read, explain.
    await h.press("\x15"); // ctrl+u clears the sample content
    await h.type(CONTENT);
    await h.press("\r");
    await h.press("\r");
    await h.press("\r");
    const after = readFileSync(savedPath(home), "utf8");
    expect(after).not.toContain(CONTENT);
    expect(after).not.toContain("BLUEBIRD");
    expect(after).not.toContain(TOKEN);
    expect(after).not.toMatch(/01930000-0000-7000-8000-\d{12}/);
    await h.quit();
  });

  it("opens Home on a second start with the saved workspace, running no doctor", async () => {
    const home = await tempDir();
    const cwd = await tempDir();
    writeSaved(home, { db: "engram.db", owner: "dana" }, {});
    const h = await startHarness({ home, cwd });
    expect(h.screen()).toBe("home");
    expect(await h.text()).toContain("workspace saved");
    expect(h.ran()).toEqual([]);
    await h.quit();
  });

  it("--no-saved neither reads nor writes it", async () => {
    const home = await tempDir();
    const cwd = await tempDir();
    writeSaved(home, { db: "engram.db", owner: "dana" }, {});
    const before = readFileSync(savedPath(home), "utf8");
    const h = await startHarness({ home, cwd, options: { noSaved: true } });
    expect(h.screen()).toBe("first-run");
    await h.press("\x1b[B");
    await h.type("other.db");
    await h.press("\t");
    await h.type("sam");
    await h.press("\r");
    await h.press("\r"); // no folder: skipped
    expect(h.screen()).toBe("loop");
    expect(readFileSync(savedPath(home), "utf8")).toBe(before);
    await h.quit();
  });

  it("Forget saved workspace, in the workspace panel, deletes the file after a confirmation", async () => {
    const home = await tempDir();
    const cwd = await tempDir();
    writeSaved(home, { db: "engram.db", owner: "dana" }, {});
    const h = await startHarness({ home, cwd });
    await h.press("\x0f"); // ctrl+o
    expect(h.screen()).toBe("workspace");
    await h.focusField("forget");
    await h.press("\r");
    expect(await h.text()).toContain("Forget the saved workspace?");
    expect(existsSync(savedPath(home))).toBe(true);
    await h.press("y");
    expect(existsSync(savedPath(home))).toBe(false);
    await h.quit();
  });
});

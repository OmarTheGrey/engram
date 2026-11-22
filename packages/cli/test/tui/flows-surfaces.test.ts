// Key flows of card E8.15d's screens (docs/design/tui.md 8.9 to 8.13, 8.20
// to 8.24, 9.5 and 13), typed through a FakeTerminal as a person types them:
// the retention sweep's strong dialog; Serve with a key created first, then
// started and stopped, and stopped by quitting; Keys created, listed and
// revoked with the id typed; Export's confirmation saying whether the file
// exists; Import's per-row decisions; Doctor taking Serve's bind flags;
// Lint's findings from a fault fixture; Simulate's changed steps; Log verify.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appendEvent, migrate, openSqlite } from "@engram/core";
import { describe, expect, it } from "vitest";
import { command } from "../../src/registry.ts";
import { surfaceScreen } from "../../src/tui/screens/surfaces.ts";
import { cli, fixtureCopy, REPO, tempDir } from "../helpers.ts";
import { type Harness, startHarness } from "./harness.ts";

const ESC = "\x1b";
const ENTER = "\r";
const TAB = "\t";
const SAVE = "\x13";
const SPACE = " ";

/** A started TUI on a usable workspace in a temporary folder. */
async function usable(extra: Parameters<typeof startHarness>[0] = {}): Promise<Harness> {
  const cwd = extra.cwd ?? (await tempDir());
  return startHarness({ cwd, home: cwd, given: { owner: "dana", db: "engram.db" }, ...extra });
}

/** Waits until the screen shows `text` (a server's start line arrives from its own process). */
async function waitFor(h: Harness, text: string, ms = 20_000): Promise<string> {
  const until = Date.now() + ms;
  let shown = "";
  while (Date.now() < until) {
    shown = await h.text();
    if (shown.includes(text)) return shown;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`the screen never showed ${JSON.stringify(text)}:\n${shown}`);
}

/** Tabs until the focused unit's id starts with `prefix`. */
async function focusStarting(h: Harness, prefix: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const f = h.focused() ?? "";
    if (f.startsWith(prefix)) return f;
    await h.press(TAB);
  }
  throw new Error(`nothing focused starts with ${prefix}; focused ${h.focused()}`);
}

/** Fills the Create a key form: actor, source user, an expiry, and the key file if given. */
async function fillKey(h: Harness, file?: string) {
  if (file !== undefined) {
    await h.focusField("keys");
    await h.type(file);
  }
  await h.focusField("as");
  await h.type("person:dana");
  await h.focusField("source");
  await h.press(SPACE); // the first source: user
  await h.focusField("expires");
  await h.type("2027-01-01T00:00:00Z");
}

describe("Retention sweep (8.9)", () => {
  it("asks with the strong dialog, its safe button focused; enter cancels; y sweeps", async () => {
    const root = await fixtureCopy();
    const h = await usable({ given: { owner: "dana", db: "engram.db", root } });
    await h.press("t");
    expect(h.screen()).toBe("surface");
    // The scope starts as the actor's own (review E8.15d-12).
    expect(await h.text()).toContain("[ person:dana");
    await h.press(SAVE);
    expect(h.overlay()).toBe("confirm");
    const text = await h.text();
    expect(text).toContain("Retiring cannot be undone. Retired items stay in the log; reads no");
    expect(text).toContain("longer return them.");
    // The action button is not focused: Cancel is reverse video, Sweep is not.
    const cells = await h.cells();
    const frame = await h.frame();
    const row = frame.findIndex((l) => l.includes("[ Cancel ]"));
    const at = (word: string) => (frame[row] as string).indexOf(word);
    const inverse = (col: number) => cells.some((c) => c.row === row && c.col === col && c.inverse);
    expect(inverse(at("Cancel"))).toBe(true);
    expect(inverse(at("Sweep"))).toBe(false);
    await h.press(ENTER);
    expect(h.overlay()).toBeUndefined();
    expect(h.ran()).toEqual([]);
    await h.press(SAVE, "y");
    expect(h.ran()).toHaveLength(1);
    const done = await h.text();
    expect(done).toContain("allow");
    expect(done).toContain("exit 0");
    expect(done).toContain("Nothing was due.");
    // v shows the command's own text; J its --json.
    // The focus left the scope field for the Sweep button, so v and J act.
    expect(h.focused()).toBe("button:run");
    await h.press("v");
    expect(await h.text()).toContain("retain person:dana at 2026-10-25T12:00:00.000Z");
    await h.press("J");
    expect(await h.text()).toContain('"decision": "allow"');
    expect((await h.frame()).at(-2)).toContain("--json");
    await h.quit();
  });
});

describe("Serve (8.13)", () => {
  it("creates a key first, starts authenticated, and stops on s's button", async () => {
    const cwd = await tempDir();
    mkdirSync(join(cwd, "k"));
    const h = await usable({ cwd });
    await h.press("h");
    expect(h.focused()).toBe("choice:auth");
    expect(await h.text()).toContain("(o) API keys from a key file");
    expect(await h.text()).toContain("No authentication: this machine only");
    await h.press("k");
    expect(await h.text()).toContain("Create a key");
    await fillKey(h, "k/keys.json");
    await h.press(SAVE);
    expect(h.overlay()).toBe("confirm");
    await h.press("y");
    const created = await h.text();
    expect(created).toContain("copy it now");
    expect(created).toMatch(/egk_[0-9a-f]{12}_/);
    await h.press(ESC);
    expect(h.app.top().title(h.app)).toBe("Serve the API and inspector");
    await h.focusField("port");
    await h.type("0");
    await h.press(SAVE);
    const running = await waitFor(h, "authenticated, resource");
    expect(running).toContain("engram serve: listening on http://127.0.0.1:");
    expect(running).toContain("Inspector");
    await h.press(SAVE); // Stop is the first button while it runs
    await waitFor(h, "engram serve: stopped");
    const ran = h.ran();
    expect(ran.map((a) => a.slice(0, 2))).toEqual([
      ["key", "create"],
      ["serve", "--port"],
    ]);
    expect(ran[1]).toContain("--keys");
    const s = await h.quit();
    expect(s.ran.map((r) => r.code)).toEqual([0, 0]);
  }, 60_000);

  it("refuses to start without a credential, the CLI's message shown and the answer focused", async () => {
    const h = await usable();
    await h.press("h");
    await h.focusField("port");
    await h.type("0");
    await h.press(SAVE);
    const text = await waitFor(h, "exit 2");
    expect(text).toContain("the server needs authentication");
    expect(h.focused()).toBe("choice:auth");
    await h.quit();
  });

  it("is stopped first when the TUI quits, and the summary says so", async () => {
    const h = await usable();
    await h.press("h", SPACE, SPACE); // keys, issuer, then no authentication
    expect(await h.text()).toContain("(o) No authentication");
    await h.focusField("port");
    await h.type("0");
    await h.press(SAVE);
    await waitFor(h, "insecure loopback: actors are self-asserted");
    const s = await h.quit();
    expect(s.ran).toHaveLength(1);
    expect(s.ran[0]?.argv).toContain("--insecure-loopback");
    expect(s.ran[0]?.note).toBe("stopped when the TUI quit");
  }, 30_000);
});

describe("Doctor (8.12)", () => {
  it("takes the bind flags from the Serve screen's answers", async () => {
    const h = await usable();
    await h.press("h", SPACE, SPACE);
    await h.focusField("port");
    await h.type("0");
    await h.press(SAVE);
    await waitFor(h, "insecure loopback");
    await h.press(SAVE);
    await waitFor(h, "stopped");
    await h.press(ESC);
    await h.press("d");
    expect(await h.text()).toContain("the Serve screen's answers");
    expect((await h.frame()).at(-2)).toContain("--insecure-loopback");
    await h.press(SAVE);
    const text = await waitFor(h, "exit 0");
    expect(text).toContain("all checks passed");
    // The serve check is the last; enter on it says what it means.
    for (let i = 0; i < 40 && h.focused() !== "check:serve"; i++) await h.press(TAB);
    await h.press(ENTER);
    expect(await h.text()).toContain("What this means: The bind engram serve would make");
    await h.quit();
  }, 60_000);
});

describe("Keys (8.23)", () => {
  it("creates a key, lists it, and revokes it with its id typed", async () => {
    const cwd = await tempDir();
    mkdirSync(join(cwd, "k"));
    const h = await usable({ cwd });
    await h.press("A");
    await h.type("k/keys.json");
    await h.press(TAB); // List the keys
    for (let i = 0; i < 2; i++) {
      await h.press("n");
      await fillKey(h);
      await h.press(SAVE, "y");
      await h.press(ESC);
    }
    const listed = await h.text();
    expect(listed).toMatch(
      /egk_[0-9a-f]{12}_\*\*\*\*\S{4} {2}active {3}person:dana \(person, source user\)/,
    );
    // The second key listed is the one revoked, not the first (review E8.15d-7).
    const first = (await focusStarting(h, "key:")).slice(4);
    await h.press(TAB);
    const second = (h.focused() ?? "").slice(4);
    expect(second).toMatch(/^[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
    await h.press("R");
    expect(h.overlay()).toBe("confirm");
    expect(await h.text()).toContain(`Type ${second} to go on`);
    // While the id is typed the hint says what enter does; enter with a wrong id does nothing.
    expect((await h.frame()).join("\n")).toContain("enter revokes once the id is typed");
    await h.type("nope");
    await h.press(ENTER);
    expect(h.overlay()).toBe("confirm");
    expect(h.ran().filter((a) => a[1] === "revoke")).toEqual([]);
    for (let i = 0; i < 4; i++) await h.press("\x7f");
    // Enter with the right id typed presses Revoke, though Cancel has the focus (review E8.15d-10).
    await h.type(second);
    await h.press(ENTER);
    expect(h.overlay()).toBeUndefined();
    expect(h.ran().filter((a) => a[1] === "revoke")).toEqual([
      ["key", "revoke", second, "--keys", "k/keys.json"],
    ]);
    const after = await h.text();
    expect(after).toMatch(new RegExp(`egk_${first}_\\S+ {2}active`));
    expect(after).toMatch(new RegExp(`egk_${second}_\\S+ {2}revoked`));
    expect(h.ran().map((a) => a.slice(0, 2).join(" "))).toEqual([
      "key create",
      "key list",
      "key create",
      "key list",
      "key revoke",
      "key list",
    ]);
    await h.quit();
  });
});

describe("Export and Import (8.20, 8.21)", () => {
  it("export's confirmation says whether the file exists and will be overwritten", async () => {
    const cwd = await tempDir();
    const root = await fixtureCopy();
    expect(
      (
        await cli([
          "write",
          "--content",
          "x",
          "--owner",
          "dana",
          "--root",
          root,
          "--db",
          join(cwd, "engram.db"),
        ])
      ).code,
    ).toBe(0);
    const h = await usable({ cwd });
    await h.press("x");
    await h.type("dana.jsonl");
    await h.press(SAVE);
    expect(h.overlay()).toBe("confirm");
    expect(await h.text()).toContain("dana.jsonl does not exist yet: it will be created.");
    await h.press("n");
    writeFileSync(join(cwd, "dana.jsonl"), "old\n");
    await h.press(SAVE);
    expect(await h.text()).toContain("dana.jsonl exists: it will be overwritten.");
    await h.press("y");
    expect(await h.text()).toContain("exported 1 item");
    expect(readFileSync(join(cwd, "dana.jsonl"), "utf8").startsWith("{")).toBe(true);
    await h.quit();
  });

  it("import says how many rows it offers the write gate, then shows each row's decision", async () => {
    const from = await tempDir();
    const root = await fixtureCopy();
    const db = join(from, "engram.db");
    expect(
      (await cli(["write", "--content", "x", "--owner", "dana", "--root", root, "--db", db])).code,
    ).toBe(0);
    const bundle = join(from, "b.jsonl");
    expect((await cli(["export", "--owner", "dana", "--db", db, "--out", bundle])).code).toBe(0);
    const root2 = await fixtureCopy();
    const h = await usable({ given: { owner: "dana", db: "engram.db", root: root2 } });
    await h.press("i");
    await h.focusField("pos:bundle");
    await h.type(bundle);
    await h.press(SAVE);
    expect(h.overlay()).toBe("confirm");
    const asked = await h.text();
    expect(asked).toContain("Offers 1 row to the write gate");
    expect(asked).toContain("a denied row is not written");
    await h.press("y");
    const done = await h.text();
    expect(done).toContain("import as import:");
    expect(done).toMatch(/[✓+] 01930000-\S+ ->/);
    expect(done).toContain("allow as candidate");
    expect(h.ran()[0]?.[0]).toBe("import");
    await h.quit();
  });
});

describe("Lint (8.10)", () => {
  it("shows a fault fixture's finding with its severity, lint id and item, and its evidence on enter", async () => {
    const cwd = await tempDir();
    const f = JSON.parse(readFileSync(join(REPO, "fixtures/faults/duplicate.flag.json"), "utf8"));
    const db = openSqlite(join(cwd, "engram.db"));
    migrate(db);
    for (const { seq: _seq, ...e } of f.events) appendEvent(db, e);
    db.close();
    writeFileSync(join(cwd, "policy.yaml"), `${JSON.stringify(f.policy, null, 2)}\n`);
    const h = await startHarness({
      cwd,
      home: cwd,
      given: {
        db: "engram.db",
        policy: "policy.yaml",
        as: f.actor.id,
        member: f.actor.memberships,
      },
    });
    await h.press("l");
    await h.type(f.scope);
    await h.focusField("fold:more");
    await h.press(ENTER);
    await h.focusField("test-clock");
    await h.press(SPACE);
    await h.focusField("at");
    await h.type(f.at);
    await h.press(SAVE);
    expect(h.overlay()).toBeUndefined(); // a lint appends events only: it does not ask
    const text = await h.text();
    expect(text).toContain("exit 1");
    expect(text).toMatch(/[▲!] warn {2}duplicate {2}\S+/);
    const id = await focusStarting(h, "finding:");
    expect(id).toBeDefined();
    await h.press(ENTER);
    const open = await h.text();
    expect(open).toContain("evidence");
    expect(open).toContain("rule fixture.faults/lint/duplicate");
    await h.quit();
  });
});

describe("Simulate (8.11)", () => {
  it("draws the comparison with bars, lists the changed steps, and opens one on enter", async () => {
    const h = await usable({ cwd: REPO });
    await h.press("s");
    await h.type("fixtures/workloads/e8-9-two-presets.json");
    await h.focusField("candidate");
    await h.type("strict");
    await h.press(SAVE);
    const text = await h.text();
    expect(text).toContain("workload e8-9-two-presets: 10 steps, 0 model calls");
    expect(text).toMatch(/allow +10 +7 +█{10} █{7}/);
    const step = await focusStarting(h, "step:");
    await h.press(ENTER);
    expect(await h.text()).toContain("candidate  deny");
    expect(step).toBe("step:1");
    expect(h.ran()).toHaveLength(1);
    await h.quit();
  });
});

describe("Log verify (8.24)", () => {
  it("shows the verdict as a word: an unsigned log is unsigned, exit 3", async () => {
    const cwd = await tempDir();
    const root = await fixtureCopy();
    expect(
      (
        await cli([
          "write",
          "--content",
          "x",
          "--owner",
          "dana",
          "--root",
          root,
          "--db",
          join(cwd, "engram.db"),
        ])
      ).code,
    ).toBe(0);
    const h = await usable({ cwd });
    await h.press("f", SAVE);
    const text = await h.text();
    expect(text).toContain("unsigned");
    expect(text).toContain("exit 3");
    await h.press("\x1b[6~"); // pgdn
    expect(await h.text()).toContain("The chain proves no event was changed");
    await h.quit();
  });
});

describe("text fields and the server's log (9.1, 8.15)", () => {
  it("a text field types every printable key, the screen's own keys and : included", async () => {
    const h = await usable();
    await h.press("t"); // Retention sweep: its scope field has the focus
    await h.press("\x15"); // ctrl+u clears the actor's scope it starts with
    await h.type("team:a;?vJrstknaoRq");
    expect(await h.text()).toContain("[ team:a;?vJrstknaoRq");
    expect(h.ran()).toEqual([]);
    expect(h.overlay()).toBeUndefined();
    await h.quit();
  });

  it("with a server, the hook protects the log the Serve screen's --db named, and says why", async () => {
    const cwd = await tempDir();
    const h = await usable({ cwd });
    await h.press("h", SPACE, SPACE);
    await h.focusField("port");
    await h.type("0");
    await h.press(SAVE);
    await waitFor(h, "insecure loopback");
    await h.press(SAVE);
    await waitFor(h, "stopped");
    await h.press(ESC);
    h.app.ws.set("server", "http://127.0.0.1:7313");
    await h.press("b");
    const screen = h.app.top() as unknown as { snippetArgs(): string[] };
    const args = screen.snippetArgs();
    expect(args[args.indexOf("--protect") + 1]).toBe(join(cwd, "engram.db"));
    expect(args).toContain("--server");
    // Wrapped at 80 columns: read as one line.
    expect((await h.text()).replace(/\s+/g, " ")).toContain(
      "the log engram serve --db names, which the hook cannot see through --server",
    );
    await h.quit();
  }, 30_000);
});

describe("the review's fix pass (E8.15d)", () => {
  it("a server keeps running after esc; Serve opened again attaches to it and s stops it (review 3)", async () => {
    const h = await usable();
    await h.press("h", SPACE, SPACE);
    await h.focusField("port");
    await h.type("0");
    await h.press(SAVE);
    await waitFor(h, "insecure loopback");
    await h.press(ESC);
    expect(h.screen()).toBe("home");
    await h.press("h");
    const text = await waitFor(h, "running");
    expect(text).toContain("[ Stop ]");
    expect(text).toContain("(o) No authentication");
    // The form shows the command that runs.
    expect(h.app.top().command(h.app).argv?.slice(0, 4)).toEqual([
      "serve",
      "--insecure-loopback",
      "--port",
      "0",
    ]);
    expect(h.focused()).toBe("choice:auth");
    await h.press("s");
    await waitFor(h, "engram serve: stopped");
    expect(h.ran()).toHaveLength(1);
    expect(h.ran()[0]?.[0]).toBe("serve");
    const s = await h.quit();
    expect(s.ran[0]?.note).toBeUndefined();
  }, 30_000);

  it("q on Home stops a running server, and the summary says so (review 2)", async () => {
    const h = await usable();
    await h.press("h", SPACE, SPACE);
    await h.focusField("port");
    await h.type("0");
    await h.press(SAVE);
    await waitFor(h, "insecure loopback");
    await h.press(ESC, "q");
    const s = await h.app.done;
    expect(s.ran).toHaveLength(1);
    expect(s.ran[0]?.note).toBe("stopped when the TUI quit");
  }, 30_000);

  it("a refusal naming --host focuses Host (review 12)", async () => {
    const h = await usable();
    await h.press("h", SPACE, SPACE);
    await h.focusField("fold:more");
    await h.press(ENTER);
    await h.focusField("host");
    await h.type("0.0.0.0");
    await h.focusField("port");
    await h.type("0");
    await h.press(SAVE);
    await waitFor(h, "exit 2");
    expect(h.focused()).toBe("choice:host");
    await h.quit();
  }, 30_000);

  it("Serve offers Host as the three loopback names and starts the Viewer as the actor; Retain starts on the actor's scope", async () => {
    const h = await usable();
    await h.press("h");
    let text = await h.text();
    expect(text).toContain("(o) 127.0.0.1");
    expect(text).toContain("( ) ::1");
    expect(text).toContain("( ) localhost");
    expect(text).toContain("[ person:dana");
    await h.focusField("choice:host");
    await h.press(SPACE);
    expect((await h.frame()).at(-2)).toContain("--host ::1");
    await h.press(ESC);
    if (h.overlay() === "confirm") await h.press("y");
    await h.press("t");
    text = await h.text();
    expect(text).toContain("[ person:dana");
    await h.quit();
  });

  it("Doctor's first focus is Run (review 9)", async () => {
    const h = await usable();
    await h.press("d");
    expect(h.focused()).toBe("button:run");
    await h.quit();
  });

  it("the hook says what an empty Store roots guards, and leaving after Try it or a copy does not ask", async () => {
    const cwd = await tempDir();
    const h = await usable({ cwd });
    await h.press("b");
    expect((await h.text()).replace(/\s+/g, " ")).toContain(
      "No store roots: the hook guards the stores' own commands only",
    );
    await h.focusField("protect");
    await h.type("x.txt");
    await h.press(ENTER);
    await h.focusField("button:copy");
    await h.press(ENTER);
    await h.press(ESC);
    expect(h.overlay()).toBeUndefined();
    expect(h.screen()).toBe("home");
    await h.quit();
  });

  it("MCP starts Acting as agent:claude-code, and its stdio snippet never holds --http (review 7)", async () => {
    const h = await usable();
    await h.press("m");
    const screen = h.app.top() as unknown as {
      snippetArgs(): string[];
      form: { setValue(id: string, v: string): void };
    };
    expect(screen.snippetArgs()).toContain("agent:claude-code");
    screen.form.setValue("http", "7399");
    (h.app.top() as unknown as { transport: string }).transport = "stdio";
    expect(screen.snippetArgs()).not.toContain("--http");
    expect(screen.snippetArgs()).not.toContain("7399");
    await h.quit();
  });

  it("with the server from ENGRAM_SERVER_URL, the hook and MCP snippets name it and say the token is set apart (review 4)", async () => {
    const cwd = await tempDir();
    const h = await startHarness({
      cwd,
      home: cwd,
      given: { owner: "dana", root: "mem" },
      env: { ENGRAM_SERVER_URL: "http://127.0.0.1:7313", ENGRAM_TOKEN: "egk_secret" },
    });
    for (const letter of ["b", "m"]) {
      await h.press(letter);
      const screen = h.app.top() as unknown as { snippetArgs(): string[] };
      const args = screen.snippetArgs();
      expect(args.slice(args.indexOf("--server"), args.indexOf("--server") + 2)).toEqual([
        "--server",
        "http://127.0.0.1:7313",
      ]);
      expect(args).not.toContain("--db");
      const text = (await h.text()).replace(/\s+/g, " ");
      expect(text).toContain("ENGRAM_TOKEN");
      expect(text).not.toContain("egk_secret");
      await h.press(ESC);
    }
    await h.quit();
  });

  it("with --server, the hook's snippet still holds its --root (review 5)", async () => {
    const cwd = await tempDir();
    const h = await usable({
      cwd,
      given: { owner: "dana", server: "http://127.0.0.1:7313", root: "mem" },
    });
    await h.press("b");
    const args = (h.app.top() as unknown as { snippetArgs(): string[] }).snippetArgs();
    expect(args).toContain("--server");
    expect(args[args.indexOf("--root") + 1]).toBe(join(cwd, "mem"));
    await h.quit();
  });

  it("lint shows each finding's own rule: two findings, two rules (review 7)", async () => {
    const h = await usable();
    const f = (id: string, lint: string) => ({
      id,
      lint_id: lint,
      item_id: id,
      tier: "deterministic",
      severity: "warn",
      message: `${lint} finding`,
      evidence: [],
      schema_version: 1,
    });
    const screen = surfaceScreen(
      command("lint") as never,
      h.app,
      { scope: "team:core" } as never,
      [],
    ) as unknown as {
      show(r: unknown): void;
    };
    screen.show({
      argv: ["lint", "--scope", "team:core"],
      code: 1,
      out: "lint team:core: allow, 2 findings\n",
      err: "",
      calls: [
        {
          method: "POST",
          path: "/api/v1/lint",
          status: 200,
          body: {
            decision: "allow",
            findings: [
              f("01950000-0000-7000-8000-0000000000a1", "duplicate"),
              f("01950000-0000-7000-8000-0000000000a2", "orphan"),
            ],
            events: [{ policy_id: "fixture/lint/duplicate" }, { policy_id: "fixture/lint/orphan" }],
          },
        },
      ],
    });
    h.app.push(screen as never);
    await h.frame();
    await focusStarting(h, "finding:01950000-0000-7000-8000-0000000000a2");
    await h.press(ENTER);
    const text = await h.text();
    expect(text).toContain("rule fixture/lint/orphan");
    expect(text).not.toContain("rule fixture/lint/duplicate");
    await h.quit();
  });
});

describe("Procedures (8.25)", () => {
  it("has no screen: the palette names it with no action", async () => {
    const h = await usable();
    await h.press(";");
    await h.type("procedures");
    await h.press(ENTER);
    expect(await h.text()).toContain("no command exists or is planned");
    expect(h.ran()).toEqual([]);
    await h.quit();
  });
});

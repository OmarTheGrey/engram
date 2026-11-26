// r runs again with the same flags (card E8.15c verification, finding N1; the
// lead's decision): the command line exactly as it ran, every flag that is
// not the actor's included (--db, --root, --store, the scope and the rest),
// on every screen that has r. Only when the answer was made as another actor
// are the actor's flags (--as, --owner, --member, --level) replaced by the
// workspace's, and only those. The command row shows what r would run.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { command } from "../../src/registry.ts";
import { rerunArgv } from "../../src/tui/forms.ts";
import { Workspace } from "../../src/tui/workspace.ts";
import { cli, fixtureCopy, tempDir, VALID_FROM } from "../helpers.ts";
import { type Harness, startHarness } from "./harness.ts";

const CTRL_S = "\x13";

/** Two workspaces' logs and stores in one folder: the one chosen on the command line, and the workspace's. */
async function twoLogs() {
  const cwd = await tempDir();
  const chosenRoot = await fixtureCopy();
  const wsRoot = await fixtureCopy();
  for (const [db, root] of [
    ["chosen.db", chosenRoot],
    ["ws.db", wsRoot],
  ] as const)
    expect(
      (
        await cli(["write", "--owner", "dana", "--db", db, "--root", root, "--content", "x"], {
          cwd,
        })
      ).code,
    ).toBe(0);
  return { cwd, chosenRoot, wsRoot };
}

/** Runs the open screen, then r: both command lines and the command row as r left it. */
async function runThenRerun(h: Harness) {
  await h.press(CTRL_S);
  if (h.overlay() === "confirm") await h.press("y");
  const first = h.ran().at(-1) ?? [];
  await h.press("r");
  if (h.overlay() === "confirm") await h.press("y");
  const again = h.ran().at(-1) ?? [];
  const row = h.app.top().command(h.app).argv;
  return { first, again, row };
}

describe("r runs again with the same flags", () => {
  for (const [name, values] of [
    ["lint", { scope: "person:dana" }],
    ["retain", { scope: "person:dana" }],
    ["read", {}],
    ["events", {}],
  ] as const)
    it(`${name}: on the log and the store the command line chose, not the workspace's`, async () => {
      const { cwd, chosenRoot, wsRoot } = await twoLogs();
      const h = await startHarness({
        cwd,
        home: cwd,
        given: { owner: "dana", db: "ws.db", root: wsRoot },
      });
      const spec = command(name);
      const chosen = {
        ...values,
        db: "chosen.db",
        ...(spec !== undefined && Object.hasOwn(spec.options, "root") ? { root: chosenRoot } : {}),
      };
      h.app.openCommand(spec as never, chosen as never, []);
      await h.app.settled();
      const { first, again, row } = await runThenRerun(h);
      expect(first).toContain("chosen.db");
      expect(again).toEqual(first);
      expect(again).not.toContain("ws.db");
      // The command row says what ran.
      expect(row).toEqual(again);
      await h.quit();
    });

  it("creates no default log in the home folder when the workspace names none", async () => {
    const cwd = await tempDir();
    const home = join(cwd, "home");
    const root = await fixtureCopy();
    await cli(["write", "--owner", "dana", "--db", "chosen.db", "--root", root, "--content", "x"], {
      cwd,
    });
    const h = await startHarness({ cwd, home, given: { owner: "dana", root } });
    h.app.openCommand(
      command("lint") as never,
      { scope: "person:dana", db: "chosen.db" } as never,
      [],
    );
    await h.app.settled();
    const { first, again } = await runThenRerun(h);
    expect(again).toEqual(first);
    expect(existsSync(join(home, ".engram", "engram.db"))).toBe(false);
    expect(existsSync(join(cwd, ".engram", "engram.db"))).toBe(false);
    await h.quit();
  });

  it("after a change of actor, replaces the actor's flags and only those", async () => {
    const { cwd, chosenRoot, wsRoot } = await twoLogs();
    const h = await startHarness({
      cwd,
      home: cwd,
      given: { owner: "dana", db: "ws.db", root: wsRoot, "import-valid-from": VALID_FROM },
    });
    h.app.openCommand(
      command("lint") as never,
      { scope: "person:dana", db: "chosen.db", root: chosenRoot } as never,
      [],
    );
    await h.app.settled();
    await h.press(CTRL_S);
    const first = h.ran().at(-1) ?? [];
    h.app.startHandoff("person:sam", ["person:dana"]);
    await h.app.settled();
    // The result screen's command row is what r will run (re-verification 4).
    const row = h.app.top().command(h.app).argv;
    await h.press("r");
    if (h.overlay() === "confirm") await h.press("y");
    const again = h.ran().at(-1) ?? [];
    const actor = new Set(["--as", "--owner", "--member", "--level"]);
    const strip = (argv: readonly string[]) =>
      argv.filter((w, i) => !actor.has(w) && !actor.has(argv[i - 1] ?? ""));
    expect(strip(again)).toEqual(strip(first));
    expect(again).toEqual(
      expect.arrayContaining(["--as", "person:sam", "--member", "person:dana"]),
    );
    expect(again).toContain("chosen.db");
    expect(row).toEqual(again);
    await h.quit();
  });

  it("rerunArgv keeps a line made as the actor now exactly, and swaps only the actor's flags otherwise", () => {
    const spec = command("lint") as never;
    const ws = Workspace.from(
      {},
      { as: "person:sam", member: ["team:core"], db: "ws.db" },
      undefined,
    );
    const argv = [
      "lint",
      "--scope",
      "team:core",
      "--db",
      "chosen.db",
      "--owner",
      "dana",
      "--member=person:dana",
    ];
    expect(rerunArgv(spec, argv, ws, false)).toEqual(argv);
    expect(rerunArgv(spec, argv, ws, true)).toEqual([
      "lint",
      "--scope",
      "team:core",
      "--db",
      "chosen.db",
      "--as",
      "person:sam",
      "--member",
      "team:core",
    ]);
  });
});

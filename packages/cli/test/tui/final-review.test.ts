// The final TUI review of card E8.15e (findings F-4, F-5 and F-6): one test
// per finding, each written before its fix and seen failing first. F-1, F-2
// and F-7 are in line.test.ts, F-3 in actor-switch.test.ts and F-8 in
// no-policy.test.ts.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { savedPath, writeSaved } from "../../src/tui/saved.ts";
import { tempDir } from "../helpers.ts";
import { startHarness } from "./harness.ts";

const CTRL_S = "\x13";
const ENTER = "\r";

async function folders() {
  const cwd = await tempDir();
  const home = join(cwd, "home");
  mkdirSync(home);
  return { cwd, home };
}

describe("F-4: with no store folder, Read and Home say that read needs --root", () => {
  it("Read refuses for want of --root, and never says it reads the log only", async () => {
    const f = await folders();
    const h = await startHarness({
      ...f,
      given: { owner: "dana", db: "empty.db" },
      options: { noSaved: true },
      columns: 120,
      rows: 40,
    });
    const home = await h.text();
    expect(home).not.toContain("reading the log only");
    expect(home).toContain("(none: read and write need --root)");
    await h.press("r");
    const before = await h.text();
    expect(before).not.toContain("reading the log only");
    expect(before).toContain("No store folder: read needs --root <folder>, which ctrl+o sets.");
    await h.press(CTRL_S);
    if (h.overlay() === "confirm") await h.press("y");
    const after = await h.text();
    expect(after).toContain("the files store needs --root <folder>");
    expect(after).not.toContain("reading the log only");
    await h.quit();
  });
});

describe("F-5: under --no-saved, Forget saved workspace leaves tui.json alone", () => {
  for (const from of ["the palette", "the workspace panel"])
    it(`from ${from}: says it is off and deletes nothing`, async () => {
      const f = await folders();
      writeSaved(f.home, { owner: "dana" }, {});
      expect(existsSync(savedPath(f.home))).toBe(true);
      const h = await startHarness({
        ...f,
        given: { owner: "dana", db: "x.db" },
        options: { noSaved: true },
        columns: 100,
        rows: 30,
      });
      if (from === "the palette") {
        await h.press(";");
        await h.type("forget");
        const row = (await h.text()).split("\n").find((l) => l.includes("Forget saved workspace"));
        expect(row).toContain("off: --no-saved");
        await h.press(ENTER);
      } else {
        await h.press("\x0f");
        await h.focusField("forget");
        await h.press(ENTER);
      }
      expect(h.overlay()).not.toBe("confirm");
      await h.app.settled();
      expect(existsSync(savedPath(f.home))).toBe(true);
      expect(await h.text()).toContain(
        "Forget is off: tui.json is not read or written this session (--no-saved)",
      );
      await h.quit();
    });

  it("the router's own forget deletes nothing under --no-saved either", async () => {
    const f = await folders();
    writeSaved(f.home, { owner: "dana" }, {});
    const h = await startHarness({
      ...f,
      given: { owner: "dana", db: "x.db" },
      options: { noSaved: true },
    });
    expect(h.app.forget()).toBe(false);
    expect(existsSync(savedPath(f.home))).toBe(true);
    await h.quit();
  });
});

describe("F-6: log verify on a log that does not exist", () => {
  it("labels its exit 1 as an error too, not only as a failed check", async () => {
    const f = await folders();
    const h = await startHarness({
      ...f,
      given: { owner: "dana", db: "nolog.db" },
      options: { noSaved: true },
      columns: 120,
      rows: 40,
    });
    await h.press("f", CTRL_S);
    if (h.overlay() === "confirm") await h.press("y");
    await h.app.settled();
    const text = await h.text();
    expect(text).toContain("no event log at");
    const row = text.split("\n").find((l) => l.includes("exit 1")) ?? "";
    expect(row).toContain("or an error, such as no log");
    expect(existsSync(join(f.cwd, "nolog.db"))).toBe(false);
    await h.quit();
  });
});

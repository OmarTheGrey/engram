// The docs' TUI screenshots (`make tui-screens`, packages/cli/scripts/tui-screens.ts):
// the script's frame capture, without Chromium, for three screens, against
// the committed .ansi files under docs/design/screens/, so a TUI change that
// moves them is caught here and the screenshots are regenerated with it.
// The capture writes nothing outside its temporary workspace: not the
// repository's tracked files, not the real ~/.engram.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OUT, REPO, SCREENS, shoot, WORK, workFolder } from "../../scripts/tui-screens.ts";
import { tempDir } from "../helpers.ts";

const CHECKED = ["home", "read", "write-deny"];

/** The real ~/.engram as names, sizes and times; empty when it does not exist. */
function realEngram(): string[] {
  const dir = join(homedir(), ".engram");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((f) => {
    const s = statSync(join(dir, f));
    return `${f} ${s.size} ${s.mtimeMs}`;
  });
}

const gitStatus = () =>
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: REPO,
    encoding: "utf8",
  });

describe("make tui-screens", () => {
  it("captures home, read and write deny byte for byte as committed, writing only inside its workspace", async () => {
    const work = join(await tempDir(), "work");
    const before = { engram: realEngram(), git: gitStatus() };
    for (const name of CHECKED) {
      const spec = SCREENS.find((s) => s.name === name);
      if (spec === undefined) throw new Error(`no screen ${name}`);
      const shot = await shoot(spec, "dark", work);
      expect(shot.ansi, name).toBe(readFileSync(join(OUT, `${shot.file}.ansi`), "utf8"));
      // No folder of this machine is drawn.
      expect(shot.ansi).not.toContain(work);
    }
    expect(realEngram()).toEqual(before.engram);
    expect(gitStatus()).toBe(before.git);
    // Everything the sessions wrote is in the workspace: its log, store and home.
    expect(existsSync(join(work, "engram.db"))).toBe(true);
    expect(existsSync(join(work, "home", ".engram", "tui.json"))).toBe(false);
  }, 60_000);

  it("takes a work folder only under the repository's .engram/ or the OS temp folder, which it empties (N-2)", async () => {
    expect(workFolder(WORK)).toBe(WORK);
    const temp = join(tmpdir(), "engram-screens-work");
    expect(workFolder(temp)).toBe(temp);
    for (const bad of [
      REPO,
      join(REPO, "docs"),
      join(REPO, ".engram"),
      join(REPO, ".engram", "..", "docs"),
      join(REPO, ".engramx", "work"),
      tmpdir(),
      homedir(),
      join(homedir(), ".engram"),
    ])
      expect(() => workFolder(bad), bad).toThrow(/is not under/);
    // The capture refuses one too, before it removes or makes anything.
    const spec = SCREENS.find((s) => s.name === "home");
    if (spec === undefined) throw new Error("no screen home");
    const outside = join(REPO, "tui-screens-no-such-work");
    await expect(shoot(spec, "dark", outside)).rejects.toThrow(/is not under/);
    expect(existsSync(outside)).toBe(false);
  });
});

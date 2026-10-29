// The no-bypass decisions in core (ADR 0014; plan decision 6): the store
// command check both surfaces call, the spellings of the Engram CLI's
// workspace folder review finding P5-20 found getting past it, and the
// combined shell and tool checks the pi extension and the Claude Code hook use.
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blockedStoreCommand,
  STORE_COMMANDS,
  shellBypass,
  toolBypass,
  uncDrivePath,
} from "../../src/no-bypass.ts";

describe("the Engram CLI's folder under other spellings (review finding P5-20)", () => {
  it.each([
    "node packages//cli/src/main.ts write --as person:x",
    "node ./packages/./cli/src/main.ts read",
    "node packages/x/../cli/src/main.ts read",
    "cd packages//cli && node src/main.ts read",
    "node ../cli/src/main.ts write",
    "cd ../cli",
    "node ../../packages/cli/src/main.ts read",
    "node cli/src/main.ts read",
    "node C:\\repo\\packages\\\\cli\\src\\main.ts read",
    "pnpm --filter ./packages//cli exec node src/main.ts",
  ])("blocks %s", (command) => {
    expect(blockedStoreCommand(command, STORE_COMMANDS)).toBe("engram");
  });

  it.each([
    "node packages/client/src/main.ts",
    "cd ../clinic",
    "node src/main.ts",
    "ls packages/core",
  ])("leaves %s alone", (command) => {
    expect(blockedStoreCommand(command, STORE_COMMANDS)).toBeUndefined();
  });
});

describe("shellBypass and toolBypass", () => {
  const cwd = mkdtempSync(join(tmpdir(), "engram-nobypass-"));
  const root = join(cwd, "memory");
  mkdirSync(root);
  const check = { cwd, roots: [root], rootStore: "files" };

  it("names the store a shell command runs", () => {
    expect(shellBypass("mem0 add x", check)).toEqual({ command: "mem0 add x", store: "mem0" });
  });

  it("names the root's store for a shell word that is a path inside it", () => {
    expect(shellBypass("cat ./memory/a.md", check)).toEqual({
      command: "cat ./memory/a.md",
      store: "files",
      route: "path",
    });
  });

  it.each([
    "cd memory && cat a.md",
    "cat memor*/a.md",
    "cat mem[o]ry/a.md",
    "tar czf x.tgz memory",
  ])("names the root's store for %s, a bare or globbed word reaching it (R3-7)", (command) => {
    expect(shellBypass(command, check)?.route).toBe("path");
  });

  it.each(["echo hello", "ls *.ts", "cat src/memory.ts"])("leaves %s alone", (command) => {
    expect(shellBypass(command, check)).toBeUndefined();
  });

  it("reads NotebookEdit's notebook_path as a path (R3-7)", () => {
    expect(toolBypass("NotebookEdit", { notebook_path: "memory/n.ipynb" }, check)?.route).toBe(
      "path",
    );
  });

  it.runIf(process.platform === "win32")(
    "reads this machine's admin share as its drive (R3-7)",
    () => {
      const share = (p: string) => `\\\\localhost\\${p[0]}$${p.slice(2)}`;
      expect(uncDrivePath(share("C:\\x\\y"))).toBe("C:\\x\\y");
      expect(uncDrivePath("\\\\fileserver\\C$\\x")).toBeUndefined();
      expect(toolBypass("Read", { file_path: share(join(root, "a.md")) }, check)?.route).toBe(
        "path",
      );
      expect(shellBypass(`type ${share(join(root, "a.md"))}`, check)?.route).toBe("path");
    },
  );

  it("names a file tool on a path inside a root, and leaves other paths alone", () => {
    expect(toolBypass("Write", { file_path: join(root, "x.md"), content: "x" }, check)).toEqual({
      command: `Write ${join(root, "x.md")}`,
      store: "files",
      route: "path",
    });
    expect(toolBypass("Read", { file_path: join(cwd, "notes.md") }, check)).toBeUndefined();
    expect(shellBypass("ls", check)).toBeUndefined();
  });
});

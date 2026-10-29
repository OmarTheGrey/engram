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

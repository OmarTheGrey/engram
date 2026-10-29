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

  it.each([
    "git commit -m 'fix memory leak'",
    "git commit --message 'memory leak'",
    "git commit --message='drop the memory cache'",
    "git tag -a v1 -m 'memory release'",
    "git -C . commit -m 'memory: tidy'",
    "git -c user.name=x commit -m 'memory leak'",
    "git stash push -m 'memory wip'",
    "hg commit -m 'memory leak'",
    "jj describe -m 'memory leak'",
  ])(
    "reads a single-quoted message of a built-in commit command as one word: %s passes (R3-15 to R3-25)",
    (command) => {
      expect(shellBypass(command, check)).toBeUndefined();
    },
  );

  it.each([
    'eval "cd memory && cat a.md"',
    'bash <<< "cd memory && cat a.md"',
    'echo "cd memory && cat a.md" | bash',
    'echo "cd memory && cat a.md" | sh',
    'bash -c -- "cd memory && cat a.md"',
    'iex "Set-Location memory; Get-Content a.md"',
    'Invoke-Expression "Set-Location memory; Get-Content a.md"',
    `python -c "import os; os.chdir('memory')"`,
    `node -e "process.chdir('memory')"`,
    'grep -rn "memory leak" src',
    'git commit -m "x" && eval "cd memory"',
  ])("checks every word of any other quoted argument: %s is blocked (R3-16)", (command) => {
    expect(shellBypass(command, check)?.route).toBe("path");
  });

  it.each([
    'sort -m "memory leak"',
    // Double-quoted messages are checked in full: the documented cost (R3-23 to R3-25).
    'git commit -m "fix memory leak"',
    'git tag -a v1 -m "memory release"',
    "git commit -m 'see memory/a.md'",
    'git commit -m "see memory/a.md"',
    'git commit -m "$(cd memory; cat a.md)"',
    'git commit -m "$(cd memory && cat a.md)"',
    'git commit -m "`cd memory; cat a.md`"',
    // A parameter expansion `$` + `{HOME}` in a message (joined so it is no template).
    ['git commit -m "$', '{HOME} memory"'].join(""),
    'git commit --message="$(cd memory)"',
    'hg commit -m "$(cd memory; cat a.md)"',
    'echo git -m "cd memory && cat a.md" | bash',
    `bash -c 'eval "$3"' _ git -m "cd memory && cat a.md"`,
    'xargs echo git -m "memory leak"',
    "git show HEAD:memory/a.md",
    "git show HEAD:./memory/a.md",
    "git cat-file -p HEAD:memory/a.md",
    // R3-23: an unquoted newline ends a segment, so `echo` is in command position there.
    'git status\necho -m "; cd memory; cat a.md" | bash',
    // R3-24: an alias (or any non-built-in subcommand) gets no exemption.
    `git -c alias.y='!f(){ eval "$2"; }; f' y -m "cd memory; cat a.md"`,
    `git -c alias.y='!sh -c' y -m 'cd memory; cat a.md'`,
    "git y -m 'cd memory; cat a.md'",
    // R3-20: a git word outside command position, even single-quoted with a built-in.
    "echo git commit -m 'cd memory; cat a.md' | bash",
    "xargs echo git commit -m 'memory leak'",
    "git stash list -m 'memory'",
    // R3-25: index, stage and stash rev:path forms.
    "git show :memory/a.md",
    "git show :0:memory/a.md",
    "git show stash@{0}:memory/a.md",
  ])("pins the message exemption's boundary: %s is blocked (R3-19 to R3-22)", (command) => {
    expect(shellBypass(command, check)?.route).toBe("path");
  });

  it.each([
    "git commit -m '$(cd memory)'",
    "env GIT_EDITOR=true git commit -m 'memory leak'",
    "sudo git commit -m 'memory leak'",
    "cd src && git commit -m 'memory leak'",
    "cd src\ngit commit -m 'memory leak'",
    `bash -c "git commit -m 'memory leak'"`,
  ])("keeps the exemption for a VCS message in command position: %s passes", (command) => {
    expect(shellBypass(command, check)).toBeUndefined();
  });

  it("decodes a PowerShell encoded command and checks it as a nested command (R3-17)", () => {
    const encoded = Buffer.from("Set-Location memory; Get-Content a.md", "utf16le").toString(
      "base64",
    );
    for (const flag of ["-EncodedCommand", "-enc", "-e", "-ec"])
      expect(shellBypass(`pwsh ${flag} ${encoded}`, check)?.route).toBe("path");
    const store = Buffer.from("mem0 add x", "utf16le").toString("base64");
    expect(shellBypass(`powershell -enc ${store}`, check)?.store).toBe("mem0");
    const harmless = Buffer.from("Get-Date", "utf16le").toString("base64");
    expect(shellBypass(`pwsh -enc ${harmless}`, check)).toBeUndefined();
  });

  it.each([
    'cat "memory/a.md"',
    "cat 'memory'/a.md",
    'bash -c "cat memory/a.md"',
    "ls *",
    "rm -rf *",
  ])("still blocks %s (R3-15)", (command) => {
    expect(shellBypass(command, check)?.route).toBe("path");
  });

  it.each([
    'bash -c "cd memory && cat a.md"',
    "sh -c 'cat memory/a.md'",
    "bash -lc 'cd memory; ls'",
    'zsh -c "cd memory"',
    'pwsh -Command "Get-Content memory/a.md"',
    'powershell -c "Set-Location memory"',
    'cmd /c "cd memory && type a.md"',
    `bash -c "sh -c 'cd memory'"`,
  ])("checks a shell's script argument as a nested command: %s (D10)", (command) => {
    expect(shellBypass(command, check)?.route).toBe("path");
  });

  it("passes a shell script that names no root", () => {
    expect(shellBypass('bash -c "echo done"', check)).toBeUndefined();
  });

  it("refuses every command whose cwd is inside a root", () => {
    expect(shellBypass("ls", { ...check, cwd: root })?.route).toBe("path");
  });

  it("reaches a folder holding a protected file only below the given folders (R3-13)", () => {
    const protectedFile = join(cwd, ".claude", "settings.json");
    const guard = { cwd, roots: [protectedFile], rootStore: "engram", ancestorsBelow: [cwd] };
    expect(shellBypass("rm -rf .claude", guard)?.route).toBe("path");
    expect(shellBypass("mv .claude x", guard)?.route).toBe("path");
    expect(toolBypass("Bash", { path: join(cwd, ".claude") }, guard)?.route).toBe("path");
    expect(shellBypass("ls", guard)).toBeUndefined();
    expect(shellBypass("rm -rf .claude", { ...guard, ancestorsBelow: undefined })).toBeUndefined();
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

// The no-bypass check with node:path replaced by its posix half, so the
// Linux reading of paths is tested on every platform, Windows included: a
// backslash is a separator for PowerShell and cmd (they read it so on Linux
// too, as pwsh does), and an escape for bash. Linux CI caught the missing
// PowerShell rule the Windows path module had hidden (PR 3).
import { describe, expect, it, vi } from "vitest";

vi.mock("node:path", async () => {
  const actual = await vi.importActual<typeof import("node:path")>("node:path");
  return { ...actual.posix, default: actual.posix };
});

const { shellBypass } = await import("../../src/no-bypass.ts");
const check = { cwd: "/proj", roots: ["/proj/memory"], rootStore: "files" };

describe("under a posix path module", () => {
  it("PowerShell reads a backslash as a separator", () => {
    expect(shellBypass("Get-Content memory\\a.md", { ...check, shell: "powershell" })?.route).toBe(
      "path",
    );
    expect(shellBypass('pwsh -Command "Get-Content memory\\a.md"', check)?.route).toBe("path");
  });
  it("bash keeps it as an escape", () => {
    expect(shellBypass("cat memory\\a.md", check)).toBeUndefined();
  });
  it("forward-slash paths still work", () => {
    expect(shellBypass("cat memory/a.md", check)?.route).toBe("path");
    expect(shellBypass("cd memory && cat a.md", check)?.route).toBe("path");
    expect(shellBypass("cat memor*/a.md", check)?.route).toBe("path");
    expect(shellBypass("git show :0:memory/a.md", check)?.route).toBe("path");
    expect(shellBypass("git commit -m 'fix memory leak'", check)).toBeUndefined();
  });
});

// Core review finding RV-CORE-5 (card RV7): a path a `cd`, `pushd` or `-C`
// makes relative, a recursive walk over an ancestor of a root, and `~user`.
describe("paths a command reaches from another folder (RV-CORE-5)", () => {
  const away = { cwd: "/home/u/proj", roots: ["/home/u/mem"], rootStore: "files", home: "/home/u" };
  it.each([
    "cd .. && cat mem/a.md",
    "cd /home/u; cat mem/a.md",
    "cd ..\ncat mem/a.md",
    "pushd .. && cat mem/a.md",
    "cd ~ && cat mem/a.md",
    "cd && cat mem/a.md",
    'bash -c "cd .. && cat mem/a.md"',
    "cd /home && cd u && cat mem/a.md",
    "tar cf - -C /home/u mem",
    "git -C .. show HEAD:mem/a.md",
    "make --directory=.. -f mem/Makefile",
    "grep -r secret /home/u",
    "grep -rn secret ..",
    "rg secret /home/u",
    "find /home/u -name a.md -exec cat {} +",
    "find .. -name a.md",
    "cp -r /home/u /tmp/x",
    "rsync -a /home/u/ /tmp/x",
    "ls -R ..",
    "du -a ~",
    "cat ~u/mem/a.md",
    "cat ~u/mem",
  ])("blocks %s", (command) => {
    expect(shellBypass(command, away)?.route).toBe("path");
  });

  it.each([
    "cd src && cat a.md",
    "cd .. && ls proj",
    "grep -r secret src",
    "grep -rn secret .",
    "find . -name '*.ts'",
    "ls -lrt ..",
    "cat ~/notes.md",
    "cat ~v/mem/a.md",
    "tar cf x.tar src",
    "cat ../notes.md",
    "git -C . commit -m 'mem: tidy'",
  ])("leaves %s alone", (command) => {
    expect(shellBypass(command, away)).toBeUndefined();
  });
});

// Review fix pass of PR #61. RV7-R3: spellings of a folder change the first
// pass let through, in both shell modes. RV7-R7: a leading `cd dir &&` moves
// every later word, so `.` after it is judged in `dir` alone.
describe("folder changes under other spellings (RV7-R3)", () => {
  const away = { cwd: "/home/u/proj", roots: ["/home/u/mem"], rootStore: "files", home: "/home/u" };
  it.each([
    "cd -- .. && cat mem/a.md",
    "\\cd .. && cat mem/a.md",
    '"cd" .. && cat mem/a.md',
    "c''d .. && cat mem/a.md",
    "builtin cd .. && cat mem/a.md",
    "Push-Location ..; Get-Content mem/a.md",
    "make -C.. -f mem/a.md",
    "tar -C.. -cf - mem",
    "env --chdir=.. cat mem/a.md",
    "env -C .. cat mem/a.md",
    "bash -c -m 'cd ..; cat mem/a.md'",
    "echo x && git commit -m 'ok' && cd .. && cat mem/a.md",
  ])("blocks %s in both shell modes", (command) => {
    expect(shellBypass(command, away)?.route).toBe("path");
    expect(shellBypass(command, { ...away, shell: "powershell" })?.route).toBe("path");
  });

  it.each(["git commit -m 'cd ..; tidy mem notes'", "git -C . commit -m 'cd .. first'"])(
    "still ignores a cd inside a single-quoted commit message: %s",
    (command) => {
      expect(shellBypass(command, away)).toBeUndefined();
    },
  );
});

describe("a leading cd moves the words after it (RV7-R7)", () => {
  const inside = {
    cwd: "/home/u/proj",
    roots: ["/home/u/proj/.engram/mem"],
    rootStore: "files",
    home: "/home/u",
  };
  it.each([
    "cd src && grep -r TODO .",
    "cd packages && find . -name '*.ts'",
    "cd src && cd lib && rg TODO .",
  ])("leaves %s alone with the root in the repository", (command) => {
    expect(shellBypass(command, inside)).toBeUndefined();
  });
  it.each([
    "grep -r TODO .",
    "cd src; grep -r TODO .",
    "cd src && cd .. && grep -r TODO .",
    "cd .engram && cat mem/a.md",
    "cd src && cat ../.engram/mem/a.md",
    "(cd src && true); grep -r TODO .",
    'bash -c "cd src && true"; grep -r TODO .',
  ])("still blocks %s", (command) => {
    expect(shellBypass(command, inside)?.route).toBe("path");
  });
});

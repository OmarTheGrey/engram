// The store-command check of ADR 0014 as decision D10 settles it (finding
// R7-1): a command is a store command if any word of it, after removing
// quotes, a leading path, an executable suffix and case, is a store name,
// wherever it stands. Every command the review showed passing must now be
// blocked; a name hidden in a variable stays out of reach, and says so.
import { describe, expect, test } from "vitest";
import { blockedStoreCommand, commandWords, pathWords, STORE_COMMANDS } from "../../src/bash.ts";

const blocked = (command: string) => blockedStoreCommand(command, STORE_COMMANDS);

describe("blockedStoreCommand", () => {
  test.each([
    // The four the first check already caught.
    ["mem0 add x", "mem0"],
    ["/usr/bin/mem0 add x", "mem0"],
    ["FOO=1 mem0 add x", "mem0"],
    ["letta agents list", "letta"],
    // Quoting and escapes.
    ['"mem0" add x', "mem0"],
    ["'mem0' add x", "mem0"],
    ["m\\em0 add x", "mem0"],
    ['m"e"m0 add x', "mem0"],
    // Wrappers.
    ["npx mem0 add x", "mem0"],
    ["uvx letta agents list", "letta"],
    ["pnpm dlx mem0 add x", "mem0"],
    ["env mem0 add x", "mem0"],
    ["sudo mem0 add x", "mem0"],
    ["command mem0 add x", "mem0"],
    ["exec mem0 add x", "mem0"],
    ["time mem0 add x", "mem0"],
    ["nohup mem0 add x &", "mem0"],
    ["echo x | xargs mem0 add", "mem0"],
    ["python -m mem0 add x", "mem0"],
    // Grouping and substitution.
    ["(mem0 add x)", "mem0"],
    ["{ mem0 add x; }", "mem0"],
    ["if true; then mem0 add x; fi", "mem0"],
    ["echo $(mem0 list)", "mem0"],
    ["echo `mem0 list`", "mem0"],
    ["true & mem0 add x", "mem0"],
    ["true&&mem0 add x", "mem0"],
    ["false||letta agents list", "letta"],
    ["ls\nmem0 add x", "mem0"],
    // A shell inside the shell.
    ['bash -c "mem0 add x"', "mem0"],
    ["sh -c 'letta agents list'", "letta"],
    ['powershell -Command "mem0 add x"', "mem0"],
    // The name in an assignment or an alias.
    ["M=mem0; $M add x", "mem0"],
    ["alias m=mem0; m add x", "mem0"],
    ["mem0ctl --store=mem0 list", "mem0"],
    // Windows paths, executable suffixes and case.
    ["C:\\tools\\mem0.exe add x", "mem0"],
    ["mem0.exe add x", "mem0"],
    ["letta.cmd agents list", "letta"],
    ["Mem0 add x", "mem0"],
    ["MEM0.EXE add x", "mem0"],
    // A library import names the store too.
    ["python -c 'import mem0'", "mem0"],
    ["node -e \"require('letta')\"", "letta"],
    // Redirections do not hide it.
    ["mem0 list > out.txt", "mem0"],
    ["cat <(mem0 list)", "mem0"],
    // The first check's cases still hold.
    ["cd /tmp && letta agents create", "letta"],
    ["ls; mem0 list | head", "mem0"],
    ["/usr/local/bin/mem0 list", "mem0"],
    ["MEM0_API_KEY=k mem0 list", "mem0"],
  ])("blocks %j", (command, store) => {
    expect(blocked(command)).toBe(store);
  });

  test.each([
    "ls -la",
    "echo hello",
    "git status",
    "pip install mem0ai",
    "mem0x status",
    "cat notes/mem0-plan.md",
    "grep -r memory src",
    "",
  ])("lets %j run", (command) => {
    expect(blocked(command)).toBeUndefined();
  });

  test("a store name as a mere argument is blocked too: the check errs towards blocking (D10)", () => {
    // The first check let `echo mem0` run; D10 reverses that on purpose.
    expect(blocked("echo mem0")).toBe("mem0");
  });

  test("a name only a variable holds is out of reach of a text check (D10's recorded limit)", () => {
    expect(blocked("$STORE add x")).toBeUndefined();
  });

  test("store names come from the configured list, matched without case", () => {
    expect(blockedStoreCommand("Zep add x", ["zep"])).toBe("zep");
    expect(blockedStoreCommand("mem0 add x", ["zep"])).toBeUndefined();
  });
});

describe("shell spellings of a store name (review round 2, defect 1)", () => {
  // The six routes the verifier ran in a real session, then more of the same
  // families. Each spelling is one the shell itself turns into `mem0`.
  test.each([
    // The verifier's six.
    ["me{m,}0 add x", "brace expansion"],
    ["me\\\nm0 add x", "backslash-newline continuation"],
    ["me\\\r\nm0 add x", "backslash-newline continuation, CRLF"],
    ["$'\\x6dem0' add x", "ANSI-C quoting, hex"],
    ["/usr/local/bin/mem? add x", "glob ?"],
    ["/usr/local/bin/mem* add x", "glob *"],
    ["cmd //c m^em0 add x", "cmd caret"],
    ["npx mem0@latest add x", "versioned package"],
    // The same families, spelled otherwise.
    ["mem{0,1} add x", "brace expansion, alternatives"],
    ["{mem0,true} add x", "brace expansion, whole word"],
    ["me{m..m}0 add x", "brace expansion, letter range"],
    ["mem{0..1} add x", "brace expansion, number range"],
    ["me{{m,},}0 add x", "brace expansion, nested"],
    ["$'\\155em0' add x", "ANSI-C quoting, octal"],
    ["$'\\u006dem0' add x", "ANSI-C quoting, unicode"],
    ["$'m\\145m0' add x", "ANSI-C quoting, inner octal"],
    ['$"mem0" add x', "locale quoting"],
    ["m[e]m0 add x", "glob class"],
    ["m[!x]m0 add x", "glob negated class"],
    ["/usr/local/bin/m?m? add x", "glob, two literals"],
    ['cmd /c "m^e^m^0 add x"', "cmd carets"],
    ["& m`em0 add x", "PowerShell backtick escape"],
    ["npx mem0@1.2.3 add x", "pinned package"],
    ["uvx letta@0.5 agents list", "uvx pinned package"],
    ['m""em0 add x', "empty double quotes"],
    ["m''em0 add x", "empty single quotes"],
    ["\\mem0 add x", "leading backslash"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell text, not a template
    ["${X:-mem0} add x", "parameter default"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell text, not a template
    ["${X:=mem0} add x", "parameter assign default"],
    ['"$(printf mem0)" add x', "substitution printing the name"],
    ["$(printf 'm\\x65m0') add x", "printf escape"],
    ["echo -e 'm\\x65m0' | sh", "echo -e escape"],
    ["python -c \"__import__('me'+'m0')\"", "concatenation with +"],
    ["pwsh -c \"& ('me'+'m0') add x\"", "PowerShell concatenation"],
  ])("blocks %j (%s)", (command) => {
    expect(blocked(command)).toBe(command.includes("letta") ? "letta" : "mem0");
  });

  test.each([
    "ls *.md",
    "ls *",
    "rm -f build/*",
    "echo {a,b}.txt",
    "find . -name '*.ts'",
    "curl 'https://example.com/a?b=c'",
    "git log --format=%H@%s",
    "npm view mem0ai@latest",
    "printf 'a\\x62c'",
    "echo $'hello\\n'",
  ])("still lets %j run", (command) => {
    expect(blocked(command)).toBeUndefined();
  });

  test.each([
    // Recorded in ADR 0014 and bash.ts as out of reach of a text check.
    ["$(printf mem%s 0) add x", "a name printf assembles from parts"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: shell text, not a template
    ["x=me; ${x}m0 add x", "a name joined from a variable"],
    ["/usr/local/bin/m* add x", "a glob with one literal character matches too much to test"],
  ])("does not claim %j (%s)", (command) => {
    expect(blocked(command)).toBeUndefined();
  });
});

describe("pathWords", () => {
  test("a path spelled in ANSI-C quoting, joined across a continuation or in braces is read decoded", () => {
    expect(pathWords("cat $'\\x2ftmp\\x2fstore\\x2fa.md'")).toContain("/tmp/store/a.md");
    expect(pathWords("cat /tmp/st\\\nore/a.md")).toContain("/tmp/store/a.md");
    expect(pathWords("cat /tmp/{store,x}/a.md")).toContain("/tmp/store/a.md");
  });
});

describe("blockedStoreCommand, configured list", () => {
  test("matches without case", () => {
    expect(blockedStoreCommand("Zep add x", ["zep"])).toBe("zep");
    expect(blockedStoreCommand("mem0 add x", ["zep"])).toBeUndefined();
  });
});

describe("commandWords", () => {
  test("splits on every shell operator and drops quotes", () => {
    expect(commandWords("a&&b||c;d|e&f (g) {h} $(i) `j` <k >l\nm")).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "k",
      "l",
      "m",
    ]);
    expect(commandWords(`bash -c "x 'y' z"`)).toEqual(["bash", "-c", "x", "y", "z"]);
  });
});

// Acceptance for card E0.6: `make lint-docs` checks the register of absorbed
// work (ADR 0037, decision 8). The red fixture breaks each rule once and holds
// the clean cases beside them; main's register passes.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { COPY_OR_PORT, checkRegister, DATA_ONLY, licenceIds, splitRow } from "../check-absorbed.ts";

const RED = "fixtures/ci/absorbed-red/absorbed.md";
const RED_NOTICE = "fixtures/ci/absorbed-red/NOTICE";
const HASH = "0123456789abcdef0123456789abcdef01234567";

const check = (register: string, notice: string) =>
  checkRegister({
    registerPath: register,
    register: readFileSync(register, "utf8"),
    notice: readFileSync(notice, "utf8"),
    exists: existsSync,
  });

/** One register holding `rows` under the header, every path existing. */
const inMemory = (rows: string[], notice = "") =>
  checkRegister({
    registerPath: "r.md",
    register: [
      "| source | commit | licence | mode | what was taken | where it landed | card |",
      "|---|---|---|---|---|---|---|",
      ...rows,
    ].join("\n"),
    notice,
    exists: () => true,
  });

const row = (source: string, licence: string, mode: string, landed: string) =>
  `| ${source} | ${HASH} | ${licence} | ${mode} | x | ${landed} | E0.6 |`;

describe("the red register", () => {
  test("reports every broken row, once, and passes the clean ones", () => {
    expect(check(RED, RED_NOTICE)).toEqual([
      `${RED}:8: landed path scripts/no-such-file.ts does not exist`,
      `${RED}:9: licence GPL-3.0 is not in ADR 0037's copy-or-port list`,
      `${RED}:10: copy from example-org/no-notice has no NOTICE entry naming its source and a landed path`,
      `${RED}:11: copy from example-org/notice-elsewhere has no NOTICE entry naming its source and a landed path`,
      `${RED}:12: commit 0123abc is not a full 40-character hash`,
      `${RED}:13: licence CC-BY-4.0 is allowed for data only, and the mode is port`,
      `${RED}:14: mode idea is neither copy nor port`,
      `${RED}:15: names no landed path in backticks`,
      `${RED}:16: has 11 cells, expected 7 (escape a pipe inside a cell as \\|)`,
      `${RED}:18: licence GPL-3.0 is not in ADR 0037's copy-or-port list`,
      `${RED}:22: copy from example-org/good has no NOTICE entry naming its source and a landed path`,
      `${RED}:23: licence GPL-2.0 is not in ADR 0037's copy-or-port list`,
      `${RED}:25: a table row outside the register's table (a blank line or other text ended it)`,
    ]);
  });

  test("the command exits 1 on it and prints each problem", () => {
    const run = spawnSync(process.execPath, ["scripts/check-absorbed.ts", RED, RED_NOTICE], {
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(run.status).toBe(1);
    expect(run.stderr.trim().split("\n")).toHaveLength(13);
  });
});

describe("main's register", () => {
  test("passes: every landed path exists, every licence is allowed, every copy has its notice", () => {
    expect(check("docs/absorbed.md", "NOTICE")).toEqual([]);
  });
});

describe("the licence lists", () => {
  test("copy or port allows exactly ADR 0037 decision 1's eight licences, as SPDX ids", () => {
    expect([...COPY_OR_PORT].sort()).toEqual(
      [
        "0BSD",
        "Apache-2.0",
        "BSD-2-Clause",
        "BSD-3-Clause",
        "CC0-1.0",
        "ISC",
        "MIT",
        "Unlicense",
      ].sort(),
    );
    expect([...DATA_ONLY]).toEqual(["CC-BY-4.0"]);
  });

  test("MPL-2.0 is depend only and an LGPL is idea only: both rejected for a port", () => {
    expect(inMemory([row("o/r", "MPL-2.0", "port", "`a/b.ts`")])).toEqual([
      "r.md:3: licence MPL-2.0 is not in ADR 0037's copy-or-port list",
    ]);
    expect(inMemory([row("o/r", "LGPL-3.0", "port", "`a/b.ts`")])).toEqual([
      "r.md:3: licence LGPL-3.0 is not in ADR 0037's copy-or-port list",
    ]);
  });

  test("licenceIds reads the SPDX expression, the convention's spellings and no note", () => {
    expect(licenceIds("Apache-2.0 (LICENSE read at the commit)")).toEqual(["Apache-2.0"]);
    expect(licenceIds(" MIT ")).toEqual(["MIT"]);
    expect(licenceIds("The Unlicense (read at the commit)")).toEqual(["Unlicense"]);
    expect(licenceIds("the Unlicense")).toEqual(["Unlicense"]);
    expect(licenceIds("CC0")).toEqual(["CC0-1.0"]);
    expect(licenceIds("MIT OR Apache-2.0")).toEqual(["MIT", "Apache-2.0"]);
    expect(licenceIds("MIT AND GPL-3.0")).toEqual(["MIT", "GPL-3.0"]);
    expect(licenceIds("MIT WITH Some-exception")).toEqual(["MIT", "Some-exception"]);
    expect(licenceIds("")).toEqual([]);
  });

  test("an exception after WITH is not on the list, so it is rejected", () => {
    expect(inMemory([row("o/r", "Apache-2.0 WITH LLVM-exception", "port", "`a/b.ts`")])).toEqual([
      "r.md:3: licence LLVM-exception is not in ADR 0037's copy-or-port list",
    ]);
  });

  test("a licence cell with no id is reported", () => {
    expect(inMemory([row("o/r", "(unknown)", "port", "`a/b.ts`")])).toEqual([
      "r.md:3: licence cell does not start with a licence id",
    ]);
  });
});

describe("the NOTICE match", () => {
  const copy = [row("o/r", "MIT", "copy", "`a/b.ts`")];

  test("a block naming the repository and the path passes, sentence punctuation allowed", () => {
    expect(inMemory(copy, "a/b.ts copies (https://github.com/o/r, commit x).\n")).toEqual([]);
    expect(inMemory(copy, "a/b.ts copies github.com/o/r.\n")).toEqual([]);
  });

  test("a longer repository or a longer path does not count", () => {
    const missing = [
      "r.md:3: copy from o/r has no NOTICE entry naming its source and a landed path",
    ];
    expect(inMemory(copy, "a/b.ts copies github.com/o/r-fork\n")).toEqual(missing);
    expect(inMemory(copy, "a/b.ts copies github.com/xo/r\n")).toEqual(missing);
    expect(inMemory(copy, "a/b.ts.bak copies github.com/o/r\n")).toEqual(missing);
    expect(inMemory(copy, "x/a/b.ts copies github.com/o/r\n")).toEqual(missing);
  });
});

describe("the table", () => {
  test("a header with no separator row is reported", () => {
    const register = "| source | commit | licence | mode | what | where | card |\n| a | b |\n";
    expect(
      checkRegister({ registerPath: "r.md", register, notice: "", exists: () => true }),
    ).toEqual(["r.md:2: the header row is not followed by a separator row"]);
  });

  test("a register with no table is itself a problem", () => {
    expect(
      checkRegister({
        registerPath: "r.md",
        register: "# empty\n",
        notice: "",
        exists: () => true,
      }),
    ).toEqual(["r.md: no table with a `source` header row"]);
  });
});

describe("splitRow, as GitHub's tables split", () => {
  test("keeps an escaped pipe inside its cell", () => {
    expect(splitRow("| a \\|A\\| b | c |")).toEqual(["a |A| b", "c"]);
  });

  test("an escaped backslash does not escape the pipe after it", () => {
    expect(splitRow("| a \\\\| b |")).toEqual(["a \\\\", "b"]);
  });

  test("a row without outer pipes keeps a final escaped pipe", () => {
    expect(splitRow("a | b \\|")).toEqual(["a", "b |"]);
  });

  test("leading indentation is not a cell", () => {
    expect(splitRow("  | a | b |")).toEqual(["a", "b"]);
  });
});

// Acceptance for card E0.6: `make lint-docs` checks the register of absorbed
// work (ADR 0037, decision 8). The red fixture breaks each rule once; main's
// register passes.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { checkRegister, licenceId, splitRow } from "../check-absorbed.ts";

const RED = "fixtures/ci/absorbed-red/absorbed.md";
const RED_NOTICE = "fixtures/ci/absorbed-red/NOTICE";

const check = (register: string, notice: string) =>
  checkRegister({
    registerPath: register,
    register: readFileSync(register, "utf8"),
    notice: readFileSync(notice, "utf8"),
    exists: existsSync,
  });

describe("the red register", () => {
  test("reports every broken row, once, and passes the clean one", () => {
    expect(check(RED, RED_NOTICE)).toEqual([
      `${RED}:8: landed path scripts/no-such-file.ts does not exist`,
      `${RED}:9: licence GPL-3.0 is not in ADR 0037's copy-or-port list`,
      `${RED}:10: copy from example-org/no-notice has no NOTICE entry naming its source and a landed path`,
      `${RED}:11: copy from example-org/notice-elsewhere has no NOTICE entry naming its source and a landed path`,
      `${RED}:12: commit 0123abc is not a full 40-character hash`,
      `${RED}:13: licence CC-BY-4.0 is allowed for data only, and the mode is port`,
      `${RED}:14: mode idea is neither copy nor port`,
      `${RED}:15: names no landed path in backticks`,
      `${RED}:16: has 9 cells, expected 7 (escape a pipe inside a cell as \\|)`,
    ]);
  });

  test("the command exits 1 on it and prints each problem", () => {
    const run = spawnSync(process.execPath, ["scripts/check-absorbed.ts", RED, RED_NOTICE], {
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(run.status).toBe(1);
    expect(run.stderr.trim().split("\n")).toHaveLength(9);
  });
});

describe("main's register", () => {
  test("passes: every landed path exists, every licence is allowed, every copy has its notice", () => {
    expect(check("docs/absorbed.md", "NOTICE")).toEqual([]);
  });
});

describe("the parsers", () => {
  test("splitRow keeps an escaped pipe inside its cell", () => {
    expect(splitRow("| a \\|A\\| b | c |")).toEqual(["a |A| b", "c"]);
  });

  test("licenceId reads the leading SPDX id and ignores the note after it", () => {
    expect(licenceId("Apache-2.0 (LICENSE read at the commit)")).toBe("Apache-2.0");
    expect(licenceId(" MIT ")).toBe("MIT");
  });

  test("a register with no table is itself a problem", () => {
    expect(
      checkRegister({ registerPath: "r.md", register: "# empty\n", notice: "", exists: () => true }),
    ).toEqual(["r.md: no table with a `source` header row"]);
  });
});

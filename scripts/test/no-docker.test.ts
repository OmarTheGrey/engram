// The lead's instruction of 2026-10-29 (ADR 0019 and ADR 0024 amendments):
// nothing in a test, a gate, a Makefile target or CI needs Docker. The
// docker-compose.yml at the root is for deployment only.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const files = [
  "Makefile",
  "package.json",
  ...readdirSync(".github/workflows").map((f) => join(".github/workflows", f)),
  ...readdirSync("packages").flatMap((p) => {
    try {
      readFileSync(join("packages", p, "package.json"));
      return [join("packages", p, "package.json")];
    } catch {
      return [];
    }
  }),
];

test("no Makefile target, CI workflow or package script runs Docker", () => {
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    // A comment (Makefile help text included) may say Docker is not used; no command may call it.
    const commands = text
      .split("\n")
      .map((line) => line.replace(/(^|\s)#.*$/, ""))
      .join("\n");
    expect(commands, file).not.toMatch(/\bdocker\b|\bcompose\b|services:\s*\n\s+postgres/i);
  }
});

// Attribution the upstream licences require (finding R6-10): MIT asks that the
// copyright and permission notice travel with every copy or substantial
// portion of the code, and CC BY 4.0 asks that the data's notice name the
// licence with its URI and say whether it was changed.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { FIXTURES } from "./fixture.ts";

const SRC = new URL("../../src/gatemem/", import.meta.url);
const PORTED = [
  "agents.ts",
  "harness.ts",
  "parse.ts",
  "prompt.ts",
  "score.ts",
  "schema.ts",
  "vendor/domains.ts",
];

describe("GateMem attribution", () => {
  test.each(PORTED)("%s names upstream's MIT notice and where its text is", (file) => {
    const head = readFileSync(new URL(file, SRC), "utf8").split("\n").slice(0, 30).join("\n");
    expect(head).toContain("MIT, Copyright (c) 2026 Renz");
    expect(head).toContain("fixtures/bench/gatemem/UPSTREAM-LICENSE");
  });

  test("the fixture README gives the data licence with its URI and says the data is unchanged", () => {
    const readme = readFileSync(`${FIXTURES}README.md`, "utf8");
    expect(readme).toContain("https://creativecommons.org/licenses/by/4.0/");
    expect(readme).toContain("unmodified");
  });

  test("the vendored licence text is upstream's MIT licence", () => {
    const text = readFileSync(`${FIXTURES}UPSTREAM-LICENSE`, "utf8");
    expect(text).toContain("MIT License");
    expect(text).toContain("Copyright (c) 2026 Renz");
  });
});

// Attribution the upstream licences require (finding R6-10): MIT asks that the
// copyright and permission notice travel with every copy or substantial
// portion of the code, and CC BY 4.0 asks that the data's notice name the
// licence with its URI and say whether it was changed.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { FIXTURES } from "./fixture.ts";

const SRC = new URL("../../src/gatemem/", import.meta.url);
const PORTED = [
  "agents.ts",
  "harness.ts",
  "judge.ts",
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

  test("each verbatim upstream file is in the manifest with its hash and the MIT notice", () => {
    const manifest = JSON.parse(readFileSync(`${FIXTURES}manifest.json`, "utf8")) as {
      upstream_sha256: Record<string, string>;
      vendored: Record<string, { from: string; sha256: string; licence: string }>;
    };
    const root = new URL("../../../../", import.meta.url);
    expect(Object.keys(manifest.vendored).sort()).toEqual([
      "packages/bench/src/gatemem/vendor/judge_prompt.txt",
      "packages/bench/src/gatemem/vendor/query_prompt.txt",
    ]);
    for (const [path, v] of Object.entries(manifest.vendored)) {
      const bytes = readFileSync(new URL(path, root));
      expect(createHash("sha256").update(bytes).digest("hex"), path).toBe(v.sha256);
      expect(v.sha256).toBe(manifest.upstream_sha256[v.from]);
      expect(v.licence).toContain("MIT, Copyright (c) 2026 Renz");
      expect(v.licence).toContain("fixtures/bench/gatemem/UPSTREAM-LICENSE");
    }
  });

  test("the vendored licence text is upstream's MIT licence", () => {
    const text = readFileSync(`${FIXTURES}UPSTREAM-LICENSE`, "utf8");
    expect(text).toContain("MIT License");
    expect(text).toContain("Copyright (c) 2026 Renz");
  });
});

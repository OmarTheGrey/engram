import { describe, expect, test } from "vitest";
import { findEmDashes, isProseFile } from "../check-prose.ts";

describe("findEmDashes", () => {
  test("reports the one-based line of every em dash", () => {
    expect(findEmDashes("fine\nnot \u2014 fine\nfine\n\u2014")).toEqual([2, 4]);
  });

  test("ignores en dashes and hyphens", () => {
    expect(findEmDashes("a - b \u2013 c -- d")).toEqual([]);
  });
});

describe("isProseFile", () => {
  test("covers every file under docs and every markdown file", () => {
    expect(isProseFile("docs/glossary.md")).toBe(true);
    expect(isProseFile("docs/research/notes.txt")).toBe(true);
    expect(isProseFile("packages/core/README.md")).toBe(true);
    expect(isProseFile("AGENTS.md")).toBe(true);
  });

  test("skips code and data outside docs", () => {
    expect(isProseFile("packages/core/src/index.ts")).toBe(false);
    expect(isProseFile("fixtures/sessions/a.jsonl")).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  CONFLICT_FIXTURE,
  findConflictMarkers,
  findEmDashes,
  isProseFile,
  scannedForConflicts,
} from "../check-prose.ts";

describe("findConflictMarkers (review finding P5-8)", () => {
  test("reports the one-based line of every merge-conflict marker", () => {
    const text = ["a", "<<<<<<< HEAD", "b", "=======", "c", ">>>>>>> 3fef61d (x)", "d"].join("\n");
    expect(findConflictMarkers(text)).toEqual([2, 4, 6]);
  });

  test("ignores longer rules, markers inside a line and a bare marker word", () => {
    expect(findConflictMarkers("Title\n========\n== x\nnot <<<<<<< here\n=======x")).toEqual([]);
  });

  test("flags the red fixture, which the repository scan skips", () => {
    const red = readFileSync(CONFLICT_FIXTURE, "utf8");
    expect(findConflictMarkers(red)).toHaveLength(3);
    expect(scannedForConflicts(CONFLICT_FIXTURE)).toBe(false);
    expect(scannedForConflicts("docs/conventions/testing.md")).toBe(true);
    expect(scannedForConflicts("packages/core/src/plane.ts")).toBe(true);
  });
});

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

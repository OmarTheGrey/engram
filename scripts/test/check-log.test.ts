import { describe, expect, test } from "vitest";
import { checkLogEntry } from "../check-log.ts";

const PATH = "docs/log/2026-10-17-x.md";
const existing = new Set(["Makefile", "docs/log/2026-10-16-old.md"]);
const exists = (p: string) => existing.has(p);

const valid = `---
date: 2026-10-17
author: omar
type: finding
card: S0.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - Makefile
  - "make lint-docs"
supersedes: none
---

**What.** x.

**Why.** y.

**Result.** z.

**Consequence.** nothing.
`;

const noEvidence = valid.replace('  - Makefile\n  - "make lint-docs"\n', "");
const check = (text: string, path = PATH) => checkLogEntry(path, text, { exists });

describe("checkLogEntry field set", () => {
  test("accepts an entry with exactly the fixed field set", () => {
    expect(check(valid)).toEqual([]);
  });

  test("reports a missing field", () => {
    expect(check(valid.replace("pillar: plane\n", ""))).toEqual([`${PATH}: missing field pillar`]);
  });

  test("reports an unknown field", () => {
    const text = valid.replace("supersedes: none\n", "supersedes: none\nmood: good\n");
    expect(check(text)).toEqual([`${PATH}: unknown field mood`]);
  });

  test("reports a file name that does not start with the entry date", () => {
    expect(check(valid, "docs/log/2026-10-18-x.md")).toEqual([
      "docs/log/2026-10-18-x.md: file name must start with the entry date 2026-10-17",
    ]);
  });

  test("reports unparseable frontmatter instead of throwing", () => {
    expect(check("no fence\n")).toEqual([
      `${PATH}: frontmatter must start with an opening --- line`,
    ]);
  });
});

describe("checkLogEntry values", () => {
  test("reports a type outside the enum", () => {
    expect(check(valid.replace("type: finding", "type: musing"))).toEqual([
      `${PATH}: type must be one of decision, finding, failure, measurement, change, milestone`,
    ]);
  });

  test("reports a chapter outside the enum", () => {
    expect(check(valid.replace("chapter: implementation", "chapter: intro"))).toEqual([
      `${PATH}: chapter must be one of design, implementation, evaluation, results, discussion, limitations, related-work`,
    ]);
  });

  test("reports a pillar outside the enum", () => {
    expect(check(valid.replace("pillar: plane", "pillar: other"))).toEqual([
      `${PATH}: pillar must be one of govern, twin, distill, plane, research`,
    ]);
  });

  test("reports a hypothesis that is not H1 to H5 or none", () => {
    expect(check(valid.replace("hypothesis: none", "hypothesis: H9"))).toEqual([
      `${PATH}: hypothesis must be H1 to H5 or none`,
    ]);
  });

  test("reports a date that is not a real calendar date", () => {
    const text = valid.replace("date: 2026-10-17", "date: 2026-13-40");
    expect(check(text, "docs/log/2026-13-40-x.md")).toEqual([
      "docs/log/2026-13-40-x.md: date must be a real YYYY-MM-DD date",
    ]);
  });

  test("reports evidence given as a scalar instead of a list", () => {
    const text = valid.replace(
      'evidence:\n  - Makefile\n  - "make lint-docs"',
      "evidence: Makefile",
    );
    expect(check(text)).toEqual([`${PATH}: evidence must be a list`]);
  });
});

describe("checkLogEntry evidence", () => {
  test("reports an evidence path that does not exist", () => {
    expect(check(valid.replace("  - Makefile", "  - research/results/missing.json"))).toEqual([
      `${PATH}: evidence path does not exist: research/results/missing.json`,
    ]);
  });

  test("treats an item with spaces as a command and an http URL as a link", () => {
    const text = valid.replace("  - Makefile", "  - https://pi.dev/docs/latest/sdk");
    expect(check(text)).toEqual([]);
  });

  test("requires at least one evidence item for a finding", () => {
    expect(check(noEvidence)).toEqual([`${PATH}: type finding needs at least one evidence item`]);
  });

  test("allows a change with no evidence", () => {
    expect(check(noEvidence.replace("type: finding", "type: change"))).toEqual([]);
  });

  test("reports a supersedes path that is not an existing entry", () => {
    expect(check(valid.replace("supersedes: none", "supersedes: docs/log/nope.md"))).toEqual([
      `${PATH}: supersedes must be none or an existing docs/log entry`,
    ]);
  });

  test("accepts a supersedes path that is an existing entry", () => {
    const text = valid.replace("supersedes: none", "supersedes: docs/log/2026-10-16-old.md");
    expect(check(text)).toEqual([]);
  });
});

describe("checkLogEntry body", () => {
  test("reports sections missing or out of order", () => {
    const text = valid.replace("**Why.** y.\n\n**Result.** z.", "**Result.** z.\n\n**Why.** y.");
    expect(check(text)).toEqual([
      `${PATH}: body must have What, Why, Result, Consequence in that order`,
    ]);
  });

  test("reports a body over 150 words", () => {
    const text = valid.replace("**What.** x.", `**What.** ${"word ".repeat(150)}`);
    expect(check(text)).toEqual([`${PATH}: body has 157 words, at most 150 allowed`]);
  });
});

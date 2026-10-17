import { describe, expect, test } from "vitest";
import { checkLogEntry } from "../check-log.ts";

const valid = `---
date: 2026-10-17
author: omar
type: change
card: S0.2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - Makefile
supersedes: none
---

**What.** x.
`;

describe("checkLogEntry", () => {
  test("accepts an entry with exactly the fixed field set", () => {
    expect(checkLogEntry("docs/log/2026-10-17-x.md", valid)).toEqual([]);
  });

  test("reports a missing field", () => {
    const text = valid.replace("pillar: plane\n", "");
    expect(checkLogEntry("docs/log/2026-10-17-x.md", text)).toEqual([
      "docs/log/2026-10-17-x.md: missing field pillar",
    ]);
  });

  test("reports an unknown field", () => {
    const text = valid.replace("supersedes: none\n", "supersedes: none\nmood: good\n");
    expect(checkLogEntry("docs/log/2026-10-17-x.md", text)).toEqual([
      "docs/log/2026-10-17-x.md: unknown field mood",
    ]);
  });

  test("reports a file name that does not start with the entry date", () => {
    expect(checkLogEntry("docs/log/2026-10-18-x.md", valid)).toEqual([
      "docs/log/2026-10-18-x.md: file name must start with the entry date 2026-10-17",
    ]);
  });

  test("reports unparseable frontmatter instead of throwing", () => {
    expect(checkLogEntry("docs/log/2026-10-17-x.md", "no fence\n")).toEqual([
      "docs/log/2026-10-17-x.md: frontmatter must start with an opening --- line",
    ]);
  });
});

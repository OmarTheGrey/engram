import { describe, expect, test } from "vitest";
import { parseFrontmatter } from "../lib/frontmatter.ts";

const entry = `---
date: 2026-11-04
card: E2.3            # or none
evidence:
  - research/results/x.json
  - "make bench BENCH=gatemem"
supersedes: none
---

**What.** Body.
`;

describe("parseFrontmatter", () => {
  test("reads scalars, strips trailing comments and keeps the body", () => {
    const parsed = parseFrontmatter(entry);
    expect(parsed.fields.get("date")).toBe("2026-11-04");
    expect(parsed.fields.get("card")).toBe("E2.3");
    expect(parsed.body.trim()).toBe("**What.** Body.");
  });

  test("reads a list and unquotes quoted items", () => {
    const parsed = parseFrontmatter(entry);
    expect(parsed.fields.get("evidence")).toEqual([
      "research/results/x.json",
      "make bench BENCH=gatemem",
    ]);
  });

  test("keeps a hash inside quotes", () => {
    const parsed = parseFrontmatter('---\nevidence:\n  - "grep -c # x"\n---\n');
    expect(parsed.fields.get("evidence")).toEqual(["grep -c # x"]);
  });

  test("rejects text without an opening fence", () => {
    expect(() => parseFrontmatter("date: 2026-11-04\n")).toThrow(/opening ---/);
  });

  test("rejects a missing closing fence", () => {
    expect(() => parseFrontmatter("---\ndate: 2026-11-04\n")).toThrow(/closing ---/);
  });

  test("rejects a duplicated key", () => {
    expect(() => parseFrontmatter("---\ndate: a\ndate: b\n---\n")).toThrow(/duplicate key date/);
  });

  test("rejects a line that is neither a key nor a list item", () => {
    expect(() => parseFrontmatter("---\njust words\n---\n")).toThrow(/line 2/);
  });
});

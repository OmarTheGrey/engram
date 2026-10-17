import { describe, expect, test } from "vitest";
import { checkPr } from "../check-pr.ts";

const entry = `---
date: 2026-10-17
author: omar
type: change
card: S0.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - Makefile
supersedes: none
---

**What.** x.

**Why.** y.

**Result.** z.

**Consequence.** nothing.
`;

const files = new Map([
  ["docs/log/2026-10-17-x.md", entry],
  ["docs/log/2026-10-17-bad.md", entry.replace("type: change", "type: musing")],
]);
const read = (p: string) => files.get(p);
const exists = (p: string) => p === "Makefile" || files.has(p);
const body = "## Acceptance\n\nAcceptance: `make lint-docs`\n";
const ACCEPTANCE = "PR body must contain a line Acceptance: `<command>` naming a real command";
const NO_LOG = "PR diff must add or change an entry under docs/log/";

describe("checkPr", () => {
  test("passes a PR with an acceptance command and a valid log entry", () => {
    const changed = ["scripts/check-pr.ts", "docs/log/2026-10-17-x.md"];
    expect(checkPr({ body, changed, read, exists })).toEqual([]);
  });

  test("fails a PR whose diff touches no log entry", () => {
    expect(checkPr({ body, changed: ["scripts/check-pr.ts"], read, exists })).toEqual([NO_LOG]);
  });

  test("does not count the log template as an entry", () => {
    expect(checkPr({ body, changed: ["docs/log/_template.md"], read, exists })).toEqual([NO_LOG]);
  });

  test("fails a PR body without an Acceptance line", () => {
    const changed = ["docs/log/2026-10-17-x.md"];
    expect(checkPr({ body: "no acceptance", changed, read, exists })).toEqual([ACCEPTANCE]);
  });

  test("fails a PR body that kept the template placeholder", () => {
    const changed = ["docs/log/2026-10-17-x.md"];
    const placeholder = "Acceptance: `<command>`";
    expect(checkPr({ body: placeholder, changed, read, exists })).toEqual([ACCEPTANCE]);
  });

  test("validates each changed log entry", () => {
    const changed = ["docs/log/2026-10-17-bad.md"];
    expect(checkPr({ body, changed, read, exists })).toEqual([
      "docs/log/2026-10-17-bad.md: type must be one of decision, finding, failure, measurement, change, milestone",
    ]);
  });

  test("skips a log entry the diff deleted", () => {
    const changed = ["docs/log/2026-10-17-x.md", "docs/log/2026-10-01-gone.md"];
    expect(checkPr({ body, changed, read, exists })).toEqual([]);
  });
});

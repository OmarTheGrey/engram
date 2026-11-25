// Acceptance for step-0 task S0.13: every roadmap card and every card added by
// ADR 0001 has a file under docs/tasks/, and every ADR in the index is decided
// with a `decision` log entry that cites it. OWNER_DECIDES lists any ADR left
// for the owner to decide. The lead accepted ADRs 0031 to 0033 on 2026-11-19
// (docs/log/2026-11-19-lead-decision-adrs-accepted.md). ADRs 0038 to 0041,
// proposed by the absorb plan on 2026-11-21, were accepted that day under the
// lead's delegation (docs/log/2026-11-21-orch-decision-adrs-0038-0041-accepted.md).
// The lead accepted ADR 0034 and ADRs 0042 to 0048 on 2026-11-25 ("accept the
// adrs"; docs/tasks/lead-decisions.md, items 34, 35 and 60 to 66; card
// ANS-2026-11-25), so no ADR is left for the owner now.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseFrontmatter } from "../lib/frontmatter.ts";

const OWNER_DECIDES = new Set<string>([]);
const ADDED_BY_ADR_0001 = ["PX1", "PX2", "PX3", "RN1", "RN2"];

const roadmap = readFileSync("docs/roadmap.md", "utf8");
const roadmapCards = [...roadmap.matchAll(/^\| ((?:E\d+\.\d+|[ABDLRX]\d+)) +\|/gm)].map(
  (m) => m[1],
);

const index = readFileSync("docs/decisions/README.md", "utf8");
const adrs = [...index.matchAll(/^\| (\d{4}) \| (.+?) \| (.+?) \|$/gm)].map((m) => ({
  number: m[1] ?? "",
  status: m[3] ?? "",
}));

const decisionEntries = readdirSync("docs/log")
  .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
  .map((f) => parseFrontmatter(readFileSync(`docs/log/${f}`, "utf8")).fields)
  .filter((fields) => fields.get("type") === "decision");

/** A decision entry cites the ADR, dated on or after `since` when given (ISO dates compare as strings). */
const cites = (number: string, since?: string) =>
  decisionEntries.some((fields) => {
    const evidence = fields.get("evidence");
    const date = fields.get("date");
    return (
      Array.isArray(evidence) &&
      evidence.some((e) => e.startsWith(`docs/decisions/${number}-`)) &&
      (since === undefined || (typeof date === "string" && date >= since))
    );
  });

/**
 * The bulk acceptances: decision entries that accepted a range of ADRs by
 * citing the index rather than each file (the lead's acceptance of ADRs 0002
 * to 0030 on 2026-11-02). Named by path, so no other entry that cites the
 * index, a proposal or a renumbering, counts as one (review finding ANS2-8).
 * Each counts only for an ADR whose own Status line carries the entry's date.
 */
const BULK_ACCEPTANCES = ["docs/log/2026-11-02-adrs-accepted.md"];

const acceptanceEntries = readdirSync("docs/log")
  .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
  .map((f) => {
    const path = `docs/log/${f}`;
    const { fields, body } = parseFrontmatter(readFileSync(path, "utf8"));
    return { path, fields, body };
  })
  .filter(({ fields }) => fields.get("type") === "decision");

/**
 * An acceptance of the ADR on or after `since`: a decision entry so dated
 * that cites the ADR's file and whose body names its number, or a named
 * bulk acceptance of exactly that date.
 */
const accepted = (number: string, since: string) =>
  acceptanceEntries.some(({ path, fields, body }) => {
    const date = fields.get("date");
    if (typeof date !== "string") return false;
    if (BULK_ACCEPTANCES.includes(path)) return date === since;
    const evidence = fields.get("evidence");
    return (
      date >= since &&
      Array.isArray(evidence) &&
      evidence.some((e) => e.startsWith(`docs/decisions/${number}-`)) &&
      body.includes(number)
    );
  });

/** The `Status:` line of an ADR's own file: its first word, and the first date on it (when it was decided). */
const fileStatus = (number: string) => {
  const file = readdirSync("docs/decisions").find((f) => f.startsWith(`${number}-`));
  if (file === undefined) return undefined;
  const line = readFileSync(`docs/decisions/${file}`, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("Status:"));
  if (line === undefined) return { word: "", date: undefined };
  const rest = line.slice("Status:".length).trim();
  return {
    word: rest.split(/[\s,.;(]/)[0] ?? "",
    date: rest.match(/\d{4}-\d{2}-\d{2}/)?.[0],
  };
};

describe("task cards", () => {
  test("the roadmap lists its cards", () => {
    expect(roadmapCards.length).toBeGreaterThan(60);
  });

  test.each([...roadmapCards, ...ADDED_BY_ADR_0001])("docs/tasks/%s.md exists", (id) => {
    expect(existsSync(`docs/tasks/${id}.md`)).toBe(true);
  });
});

describe("decisions", () => {
  test("the index lists ADRs 0001 to 0023 and every later one, consecutively", () => {
    expect(adrs.length).toBeGreaterThanOrEqual(23);
    expect(adrs.map((a) => a.number)).toEqual(
      Array.from({ length: adrs.length }, (_, i) => String(i + 1).padStart(4, "0")),
    );
  });

  test.each(adrs.filter((a) => !OWNER_DECIDES.has(a.number)))(
    "ADR $number is decided, has its own file and a decision log entry",
    ({ number, status }) => {
      expect(status).not.toMatch(/^proposed/);
      expect(readdirSync("docs/decisions").some((f) => f.startsWith(`${number}-`))).toBe(true);
      expect(cites(number)).toBe(true);
    },
  );

  // Review finding ANS2-3 of card ANS-2026-11-25: the ADR's own file must say
  // what the index says, and accepting an ADR is a decision entry dated on or
  // after the acceptance, so an index row flipped without one fails.
  test.each(adrs)("ADR $number's own Status line matches the index", ({ number, status }) => {
    const own = fileStatus(number);
    expect(own, `docs/decisions/${number}-*.md has no file`).toBeDefined();
    const indexWord = status.split(/[\s,.;(]/)[0] ?? "";
    expect(own?.word, `ADR ${number}: file says ${own?.word}, index says ${status}`).toBe(
      indexWord,
    );
  });

  test.each(adrs.filter((a) => !OWNER_DECIDES.has(a.number) && a.status.startsWith("accepted")))(
    "ADR $number has a decision entry dated on or after its acceptance",
    ({ number }) => {
      const own = fileStatus(number);
      expect(own?.date, `ADR ${number}'s Status line names no date`).toBeDefined();
      const date = own?.date ?? "";
      expect(
        accepted(number, date),
        `no decision entry on or after ${date} cites ADR ${number} and names it in its body`,
      ).toBe(true);
    },
  );
});

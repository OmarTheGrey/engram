// Acceptance for step-0 task S0.13: every roadmap card and every card added by
// ADR 0001 has a file under docs/tasks/, and every ADR in the index is decided
// with a `decision` log entry that cites it. OWNER_DECIDES lists any ADR left
// for the owner to decide; it is empty since ADR 0020 was decided.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseFrontmatter } from "../lib/frontmatter.ts";

const OWNER_DECIDES = new Set<string>();
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

const cites = (number: string) =>
  decisionEntries.some((fields) => {
    const evidence = fields.get("evidence");
    return (
      Array.isArray(evidence) && evidence.some((e) => e.startsWith(`docs/decisions/${number}-`))
    );
  });

describe("task cards", () => {
  test("the roadmap lists its cards", () => {
    expect(roadmapCards.length).toBeGreaterThan(60);
  });

  test.each([...roadmapCards, ...ADDED_BY_ADR_0001])("docs/tasks/%s.md exists", (id) => {
    expect(existsSync(`docs/tasks/${id}.md`)).toBe(true);
  });
});

describe("decisions", () => {
  test("the index lists ADRs 0001 to 0023", () => {
    expect(adrs.map((a) => a.number)).toEqual(
      Array.from({ length: 23 }, (_, i) => String(i + 1).padStart(4, "0")),
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
});

// The parser of a memory list Claude shows a person, pasted as text, and
// `engram import --claude` over it (card E9.8). The fixture is synthetic
// (AGENTS.md rule 12): fixtures/imports/claude-memory.txt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClaudeMemory } from "../src/import/claude.ts";
import { cli, logEvents, NOW, REPO, tempDir } from "./helpers.ts";

const FIXTURE = join(REPO, "fixtures/imports/claude-memory.txt");

describe("parseClaudeMemory", () => {
  it("reads paragraphs, bullets and dated lines under their headings, inside the code block only", () => {
    const entries = parseClaudeMemory(readFileSync(FIXTURE, "utf8"));
    expect(entries.map((e) => [e.section, e.text, e.valid_from])).toEqual([
      [
        "Work context",
        "Dana Example is a synthetic test persona who works on a demo platform team. She reviews pull requests in the morning.",
        null,
      ],
      ["Preferences", "Prefers short code reviews", null],
      [
        "Preferences",
        "Writes commit messages in the imperative and keeps them under seventy characters",
        null,
      ],
      ["Preferences", "Uses pnpm for every workspace", null],
      ["Dated entries", "Asked for answers without emoji", "2026-03-04T00:00:00.000Z"],
      ["Dated entries", "[unknown] - Mentioned a demo deadline in spring", null],
      ["Dated entries", "Likes tables over long lists", null],
    ]);
    expect(entries[1]?.line).toBe(9);
  });

  it("takes text with no code block, and drops a date that is not a real day", () => {
    const entries = parseClaudeMemory(
      "Notes:\n- [2026-02-30] - Not a day\n- [2026-02-28T09:30:00Z] - A timestamp\n\nA paragraph\n",
    );
    expect(entries).toEqual([
      { text: "[2026-02-30] - Not a day", section: "Notes", line: 2, valid_from: null, note: null },
      {
        text: "A timestamp",
        section: "Notes",
        line: 3,
        valid_from: "2026-02-28T09:30:00.000Z",
        note: null,
      },
      { text: "A paragraph", section: "Notes", line: 5, valid_from: null, note: null },
    ]);
  });

  it("reads only the fenced lines when the text holds a code block (review finding E9.8-5)", () => {
    const text = [
      "Sure! Here is everything I remember about you.",
      "",
      "```",
      "- Prefers tea to coffee",
      "```",
      "",
      "Let me know if anything is missing.",
    ].join("\n");
    expect(parseClaudeMemory(text).map((e) => e.text)).toEqual(["Prefers tea to coffee"]);
  });

  it("does not take a date after the import time, and says so", () => {
    const [entry] = parseClaudeMemory("- [2027-06-01] - Plans a demo", "2026-11-21T12:00:00.000Z");
    expect(entry).toMatchObject({ text: "Plans a demo", valid_from: null });
    expect(entry?.note).toBe(
      "the date 2027-06-01 is after the import time, so valid_from is the import time",
    );
    const [past] = parseClaudeMemory("- [2026-06-01] - Gave a demo", "2026-11-21T12:00:00.000Z");
    expect(past).toMatchObject({ valid_from: "2026-06-01T00:00:00.000Z", note: null });
  });

  it("finds nothing in empty or heading-only text", () => {
    expect(parseClaudeMemory("")).toEqual([]);
    expect(parseClaudeMemory("# Memory\n\n**Work context**\n")).toEqual([]);
  });
});

describe("engram import --claude", () => {
  it("writes each entry as a semantic candidate in the importer's scope, by the import actor", async () => {
    const root = await tempDir();
    const db = join(await tempDir(), "engram.db");
    const r = await cli([
      "import",
      "--claude",
      FIXTURE,
      "--store",
      "files",
      "--root",
      root,
      "--owner",
      "dana",
      "--db",
      db,
      "--json",
    ]);
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ source: "claude", rows: 7, allowed: 7, denied: 0 });
    const writes = logEvents(db).filter((e) => e.op === "write");
    expect(writes).toHaveLength(7);
    for (const w of writes) {
      expect(w.actor).toBe("import:person:dana");
      expect(w.item).toMatchObject({
        class: "semantic",
        scope: "person:dana",
        owner: "person:dana",
        status: "candidate",
        confidence: 0.7,
        grants: [],
        provenance: { kind: "import", actor: "import:person:dana" },
      });
    }
    expect(writes[1]?.item?.provenance.ref).toBe("claude-memory:Preferences:line-9");
    expect(writes[0]?.item?.valid_from).toBe(NOW);
    expect(writes[4]?.item?.valid_from).toBe("2026-03-04T00:00:00.000Z");
  });

  it("needs --scope when the importer is no scope", async () => {
    const r = await cli(["import", "--claude", FIXTURE, "--as", "agent:x", "--db", ":memory:"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("agent:x is not a scope");
  });
});

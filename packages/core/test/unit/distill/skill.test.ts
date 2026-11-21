// Card D2: SKILL.md for procedural items. The expectations in skill-spec/
// come from the Agent Skills specification's own validator (skills-ref at
// 83021e2be457a9b6679148719c1f6074f0ad975e), run offline by
// packages/core/scripts/skill-spec-golden.py (its header has the command).
// emitted.json is what toSkillMd writes for the sample items below;
// ENGRAM_UPDATE_FIXTURES=1 rewrites it, after which the golden script must
// be run again.
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  parseSkillMd,
  SkillFormatError,
  skillContent,
  skillDescription,
  skillName,
  skillTitle,
  toSkillMd,
  validateSkillMd,
} from "../../../src/distill/skill.ts";
import type { MemoryItem } from "../../../src/schema.ts";

const SPEC = new URL("./skill-spec/", import.meta.url);
type Case = { id: string; dir: string; text: string };
const readCases = (name: string) =>
  (JSON.parse(readFileSync(new URL(name, SPEC), "utf8")) as { cases: Case[] }).cases;
const EXPECTED = JSON.parse(readFileSync(new URL("expected.json", SPEC), "utf8")) as {
  errors: Record<string, string[]>;
};

const procedural = (id: string, body: string, tools: string[]): MemoryItem => ({
  id,
  class: "procedural",
  scope: "person:fixture",
  owner: "person:fixture",
  content: { body, tools },
  provenance: {
    kind: "model",
    ref: "distill:awm:s1",
    hash: `sha256:${"0".repeat(64)}`,
    actor: "person:fixture",
  },
  confidence: 0.5,
  valid_from: "2026-11-21T12:00:00.000Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "candidate",
  store_ref: null,
  schema_version: 1,
});

/** Sample items: each derivation rule of skill.ts's header at least once. */
const SAMPLES: { id: string; item: MemoryItem }[] = [
  {
    id: "emitted-awm",
    item: procedural(
      "01960000-0000-7000-8000-0000000000a1",
      '# Inspect a source file before changing it\n\nInspect a source file before changing it. Use when a task names a source file whose contents decide the change.\n\n## Steps\n\n1. Read the file the task names.\n\n   ```\n   read({"path":"{source-file}"})\n   ```\n',
      ["read", "edit"],
    ),
  },
  {
    id: "emitted-no-tools",
    item: procedural(
      "01960000-0000-7000-8000-0000000000a2",
      "# Ask before deleting\n\nAsk the user before deleting anything.\n",
      [],
    ),
  },
  {
    id: "emitted-unicode-quotes",
    item: procedural(
      "01960000-0000-7000-8000-0000000000a3",
      '# Créer un fichier « propre »\n\nWrite "clean" files --- no tabs,\n\tno separators, one\u007fDEL. Use when\nasked.\n\n## Steps\n',
      ["Bash(git:*)", "Read"],
    ),
  },
  {
    id: "emitted-long",
    item: procedural(
      "01960000-0000-7000-8000-0000000000a4",
      `# ${"Very long workflow title ".repeat(4)}\n\n${"word ".repeat(300)}\n`,
      ["bash"],
    ),
  },
];

const emitted = (): Case[] =>
  SAMPLES.map(({ id, item }) => {
    const text = toSkillMd(item);
    return { id, dir: parseSkillMd(text).name, text };
  });

describe("toSkillMd", () => {
  test("writes the committed SKILL.md for each sample item", () => {
    const now = emitted();
    const file = new URL("emitted.json", SPEC);
    if (process.env.ENGRAM_UPDATE_FIXTURES === "1")
      writeFileSync(
        file,
        `${JSON.stringify({ _comment: "Written by skill.test.ts under ENGRAM_UPDATE_FIXTURES=1: toSkillMd of its sample items. Validated by skill-spec-golden.py.", cases: now }, null, 2)}\n`,
      );
    expect(now).toEqual(readCases("emitted.json"));
  });

  test("every SKILL.md it writes passes the specification's validator, and validateSkillMd agrees", () => {
    for (const c of emitted()) {
      expect(EXPECTED.errors[c.id], `skills-ref on ${c.id}`).toEqual([]);
      expect(validateSkillMd(c.text, c.dir), c.id).toEqual([]);
    }
  });

  test("gives back the item's body and tools exactly through parseSkillMd", () => {
    for (const { item } of SAMPLES) {
      const skill = parseSkillMd(toSkillMd(item));
      expect(skillContent(skill)).toEqual(item.content);
      const body = (item.content as { body: string }).body;
      expect(skill.name).toBe(skillName(skillTitle(body)));
      expect(skill.description).toBe(skillDescription(body));
      expect(skill.metadata).toEqual({ "engram-item": item.id });
    }
  });

  test("omits allowed-tools when the allowlist is empty", () => {
    expect(toSkillMd(SAMPLES[1]?.item as MemoryItem)).not.toContain("allowed-tools");
  });

  test("refuses a non-procedural item, a body with no title or no description, and a tool with whitespace", () => {
    const base = SAMPLES[0]?.item as MemoryItem;
    expect(() => toSkillMd({ ...base, class: "semantic", content: "x" } as MemoryItem)).toThrow(
      SkillFormatError,
    );
    expect(() => toSkillMd(procedural(base.id, "No title\n", []))).toThrow(/# <title>/);
    expect(() => toSkillMd(procedural(base.id, "# Title\n\n## Steps\n", []))).toThrow(
      /description/,
    );
    expect(() => toSkillMd(procedural(base.id, "# Title\n\nText.\n", ["git status"]))).toThrow(
      /whitespace/,
    );
  });
});

describe("the derivations", () => {
  test("a name is the title folded to ASCII, lowercased, hyphenated and cut to 64", () => {
    expect(skillName("Rename a symbol, everywhere!")).toBe("rename-a-symbol-everywhere");
    expect(skillName("Créer un fichier")).toBe("creer-un-fichier");
    const long = skillName("x".repeat(63) + " tail");
    expect(long).toBe("x".repeat(63));
    expect(() => skillName("!!!")).toThrow(SkillFormatError);
  });

  test("a description is the first paragraph, whitespace collapsed, --- cut to --, at most 1024", () => {
    expect(skillDescription("# T\n\n  One\n  two --- three.\n\nNext.\n")).toBe("One two -- three.");
    expect([...skillDescription(`# T\n\n${"é".repeat(2000)}\n`)]).toHaveLength(1024);
  });
});

describe("validateSkillMd against the specification's validator", () => {
  for (const c of readCases("cases.json"))
    test(`case ${c.id}`, () => {
      const want = EXPECTED.errors[c.id] as string[];
      expect(want, `expected.json has case ${c.id}`).toBeDefined();
      const got = validateSkillMd(c.text, c.dir);
      // strictyaml's parse messages are its own; the kind of error is what must agree.
      const shape = (errors: string[]) =>
        errors.map((e) =>
          e.startsWith("Invalid YAML in frontmatter:") ? "Invalid YAML in frontmatter:" : e,
        );
      expect(shape(got)).toEqual(shape(want));
    });
});

describe("parseSkillMd", () => {
  test("reads plain, quoted and nested values", () => {
    const skill = parseSkillMd(
      "---\nname: pdf-processing  # a comment\ndescription: 'It''s for PDFs.'\nallowed-tools: \"Read  Bash(git:*)\"\nlicense: Apache-2.0\nmetadata:\n  author: example-org\n---\n\n# PDF\n",
    );
    expect(skill).toEqual({
      name: "pdf-processing",
      description: "It's for PDFs.",
      allowedTools: ["Read", "Bash(git:*)"],
      license: "Apache-2.0",
      metadata: { author: "example-org" },
      body: "# PDF\n",
    });
  });

  test("refuses a SKILL.md the specification refuses, naming why", () => {
    expect(() => parseSkillMd("---\nname: x\n---\n")).toThrow(/description/);
    expect(() => parseSkillMd("# no frontmatter\n")).toThrow(SkillFormatError);
    expect(() =>
      parseSkillMd("---\nname: x\ndescription: d\nallowed-tools:\n  a: b\n---\n"),
    ).toThrow(/allowed-tools/);
  });
});

// SKILL.md for procedural items (card D2): pure functions between a
// procedural item's content and the Agent Skills format, so Claude Code, pi
// and any other client of the format can load an admitted procedure without
// a converter.
//
// The format is the Agent Skills specification (agentskills/agentskills,
// docs/specification.mdx, Apache-2.0, read at commit
// 83021e2be457a9b6679148719c1f6074f0ad975e; mode idea). The rules
// validateSkillMd checks are those of the specification's own validator,
// skills-ref's `validate_metadata` at that commit (Apache-2.0; mode port:
// the rules and their messages, rewritten here): the six allowed fields;
// `name` 1 to 64 characters after NFKC, lowercase, letters, digits and
// hyphens, no hyphen at either end, no `--`, equal to its directory's name;
// `description` 1 to 1024 characters; `compatibility` at most 500.
// packages/core/scripts/skill-spec-golden.py runs that validator offline on
// the cases in packages/core/test/unit/distill/skill-spec/, and the test
// holds this module to what it returned. `allowed-tools` is, by the
// specification, a space-separated string (experimental, and its token
// syntax varies by harness, such as Claude Code's `Bash(git:*)`), so a tool
// here is any token without whitespace; the validator checks nothing more.
//
// ProceduralContent has only `body` and `tools`, so the frontmatter is
// derived from the body (decision entry 2026-11-21-d2-decision-skill-derivation):
// - the body opens with a `# <title>` line, and `name` is the title
//   folded to ASCII (NFKD, marks dropped), lowercased, each run of other
//   characters made one hyphen, trimmed of hyphens, cut to 64 characters;
// - `description` is the first paragraph after the title, its whitespace
//   collapsed to single spaces and every run of three or more hyphens cut to
//   two (the validator splits the file at the first two `---` anywhere),
//   cut to 1024 characters;
// - `allowed-tools` is `tools` joined by spaces, omitted when empty;
// - `metadata.engram-item` is the item's id, so a loaded skill names the
//   item it came from.
// The body follows the frontmatter after one blank line, unchanged, so
// parseSkillMd(toSkillMd(item)) gives back the item's body and tools
// exactly.
//
// parseSkillMd reads a subset of YAML: `key: value` lines, a value plain,
// single-quoted or double-quoted (JSON's escapes), and one level of
// `key: value` lines under `metadata:`; comments and blank lines are
// skipped. Anything else is refused as invalid YAML.
import type { z } from "zod";
import type { MemoryItem, ProceduralContent as ProceduralContentSchema } from "../schema.ts";

/** A procedural item's content: its SKILL.md body and tool allowlist. */
type ProceduralContent = z.infer<typeof ProceduralContentSchema>;

export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_COMPATIBILITY_MAX = 500;
/** The frontmatter fields the specification allows. */
export const SKILL_FIELDS = [
  "name",
  "description",
  "license",
  "allowed-tools",
  "metadata",
  "compatibility",
] as const;
/** The metadata key naming the item a SKILL.md was written from. */
export const SKILL_ITEM_KEY = "engram-item";

/** A SKILL.md that cannot be written or read as the specification requires. */
export class SkillFormatError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`SKILL.md: ${problems.join("; ")}`);
    this.name = "SkillFormatError";
    this.problems = problems;
  }
}

/** A parsed SKILL.md. */
export interface SkillMd {
  name: string;
  description: string;
  /** `allowed-tools` split on whitespace; empty when absent. */
  allowedTools: string[];
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  /** Everything after the frontmatter and the one blank line that follows it. */
  body: string;
}

const codePoints = (s: string) => [...s].length;

/** The first `count` code points of `s`. */
const cut = (s: string, count: number) => [...s].slice(0, count).join("");

/** The title of a body: its first line, `# <title>`. */
export function skillTitle(body: string): string {
  const first = body.split("\n", 1)[0]?.replace(/\r$/, "") ?? "";
  const m = /^# +(\S.*)$/.exec(first);
  if (!m) throw new SkillFormatError(["the body must open with a '# <title>' line"]);
  return (m[1] as string).trim();
}

/** The skill name a title gives (see the header). */
export function skillName(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const name = cut(slug, SKILL_NAME_MAX).replace(/-+$/, "");
  if (name === "")
    throw new SkillFormatError([`the title ${JSON.stringify(title)} gives no skill name`]);
  return name;
}

/** The description a body gives: the first paragraph after its title (see the header). */
export function skillDescription(body: string): string {
  const lines = body.split("\n").map((l) => l.replace(/\r$/, ""));
  let i = 1;
  while (i < lines.length && (lines[i] as string).trim() === "") i++;
  const paragraph: string[] = [];
  for (; i < lines.length && (lines[i] as string).trim() !== ""; i++)
    paragraph.push(lines[i] as string);
  const text = paragraph.join(" ");
  if (text.trim() === "" || /^\s*#/.test(text))
    throw new SkillFormatError(["the body has no description paragraph after its title"]);
  const description = cut(
    text.replace(/\s+/gu, " ").trim().replace(/-{3,}/g, "--"),
    SKILL_DESCRIPTION_MAX,
  );
  return description.trimEnd();
}

/** A tool token `allowed-tools` can carry: no whitespace, and no `---`. */
export function checkTool(tool: string): string | null {
  if (tool === "" || /\s/u.test(tool))
    return `tool ${JSON.stringify(tool)} contains whitespace or is empty; allowed-tools is space-separated`;
  if (tool.includes("---")) return `tool ${JSON.stringify(tool)} contains ---`;
  return null;
}

/** Whether YAML 1.2 can hold a code point as it stands in a quoted scalar (c-printable, less the line breaks). */
function printable(code: number): boolean {
  if (code === 0x2028 || code === 0x2029) return false;
  return (
    code === 0x09 ||
    (code >= 0x20 && code <= 0x7e) ||
    code === 0x85 ||
    (code >= 0xa0 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

/** One UTF-16 code unit as a JSON escape. */
const escapeUnit = (unit: number) => `\\u${unit.toString(16).padStart(4, "0")}`;

/** A double-quoted YAML scalar using JSON's escapes only, so JSON.parse reads it. */
function quote(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) as number;
    if (ch === "\\" || ch === '"') out += `\\${ch}`;
    else if (printable(code)) out += ch;
    else for (let i = 0; i < ch.length; i++) out += escapeUnit(ch.charCodeAt(i));
  }
  return `"${out}"`;
}

/** A procedural item as SKILL.md text (see the header). */
export function toSkillMd(item: MemoryItem): string {
  if (item.class !== "procedural")
    throw new SkillFormatError([`item ${item.id} is ${item.class}, not procedural`]);
  const content = item.content as ProceduralContent;
  const problems = content.tools.flatMap((t) => checkTool(t) ?? []);
  if (problems.length > 0) throw new SkillFormatError(problems);
  const lines = [
    "---",
    `name: ${skillName(skillTitle(content.body))}`,
    `description: ${quote(skillDescription(content.body))}`,
    ...(content.tools.length > 0 ? [`allowed-tools: ${quote(content.tools.join(" "))}`] : []),
    "metadata:",
    `  ${SKILL_ITEM_KEY}: ${quote(item.id)}`,
    "---",
    "",
  ];
  return `${lines.join("\n")}\n${content.body}`;
}

type Frontmatter = Record<string, string | Record<string, string>>;

/** The value of one scalar, or an error message. */
function scalar(raw: string): { value: string } | { error: string } {
  const v = raw.trim();
  if (v.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(v);
      if (typeof parsed === "string") return { value: parsed };
    } catch {
      // fall through
    }
    return { error: `unreadable double-quoted value ${v}` };
  }
  if (v.startsWith("'")) {
    const m = /^'((?:[^']|'')*)'$/.exec(v);
    return m
      ? { value: (m[1] as string).replaceAll("''", "'") }
      : { error: `unreadable single-quoted value ${v}` };
  }
  if (/^[[{|>&*!%@`]/.test(v)) return { error: `value ${v} is not a plain scalar` };
  const plain = v.replace(/\s+#.*$/, "");
  if (/:\s/.test(plain) || plain.endsWith(":")) return { error: `value ${v} holds a mapping` };
  return { value: plain };
}

/** The frontmatter text and body, or the validator's message for a file it cannot split. */
function split(text: string): { yaml: string; body: string } | { error: string } {
  if (!text.startsWith("---")) return { error: "SKILL.md must start with YAML frontmatter (---)" };
  const lines = text.split("\n");
  if (!/^---\r?$/.test(lines[0] as string))
    return { error: "Invalid YAML in frontmatter: the opening --- must stand alone on its line" };
  const close = lines.findIndex((l, i) => i > 0 && /^---\r?$/.test(l));
  if (close < 0) return { error: "SKILL.md frontmatter not properly closed with ---" };
  let body = lines.slice(close + 1).join("\n");
  if (body.startsWith("\r\n")) body = body.slice(2);
  else if (body.startsWith("\n")) body = body.slice(1);
  return { yaml: lines.slice(1, close).join("\n"), body };
}

/** The frontmatter as a mapping, or an error message. */
function frontmatter(yaml: string): { fm: Frontmatter } | { error: string } {
  const fm: Frontmatter = {};
  let nested: Record<string, string> | null = null;
  const lines = yaml.split("\n").map((l) => l.replace(/\r$/, ""));
  if (lines.every((l) => l.trim() === "" || /^\s*#/.test(l)))
    return { error: "SKILL.md frontmatter must be a YAML mapping" };
  for (const line of lines) {
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    const indented = /^\s/.test(line);
    const m = /^\s*([A-Za-z0-9_-]+):(?:\s(.*))?$/.exec(line);
    if (!m) {
      if (!indented && Object.keys(fm).length === 0 && !line.includes(":"))
        return { error: "SKILL.md frontmatter must be a YAML mapping" };
      return { error: `Invalid YAML in frontmatter: unreadable line ${JSON.stringify(line)}` };
    }
    const key = m[1] as string;
    const raw = m[2] ?? "";
    if (indented) {
      if (nested === null)
        return {
          error: `Invalid YAML in frontmatter: unexpected indentation at ${JSON.stringify(line)}`,
        };
      if (key in nested) return { error: `Invalid YAML in frontmatter: duplicate key ${key}` };
      const v = scalar(raw);
      if ("error" in v) return { error: `Invalid YAML in frontmatter: ${v.error}` };
      nested[key] = v.value;
      continue;
    }
    if (key in fm) return { error: `Invalid YAML in frontmatter: duplicate key ${key}` };
    nested = null;
    if (raw.trim() === "") {
      nested = {};
      fm[key] = nested;
      continue;
    }
    const v = scalar(raw);
    if ("error" in v) return { error: `Invalid YAML in frontmatter: ${v.error}` };
    fm[key] = v.value;
  }
  // A key with nothing under it is an empty string, as strictyaml reads it.
  for (const [k, v] of Object.entries(fm))
    if (typeof v !== "string" && Object.keys(v).length === 0) fm[k] = "";
  return { fm };
}

/** Python's repr of a sorted list of strings, as the validator prints its allowed fields. */
const pyList = (items: readonly string[]) => `[${items.map((s) => `'${s}'`).join(", ")}]`;

/** The Python `str.isalnum` of one character, as Unicode letters and numbers. */
const isAlnum = (c: string) => /^[\p{L}\p{N}]$/u.test(c);

/** The validator's checks of a parsed frontmatter (skills-ref `validate_metadata`). */
function checkFields(fm: Frontmatter, dir?: string): string[] {
  const errors: string[] = [];
  const extra = Object.keys(fm)
    .filter((k) => !(SKILL_FIELDS as readonly string[]).includes(k))
    .sort();
  if (extra.length > 0)
    errors.push(
      `Unexpected fields in frontmatter: ${extra.join(", ")}. Only ${pyList([...SKILL_FIELDS].sort())} are allowed.`,
    );
  if (!("name" in fm)) errors.push("Missing required field in frontmatter: name");
  else {
    const raw = fm.name;
    if (typeof raw !== "string" || raw.trim() === "")
      errors.push("Field 'name' must be a non-empty string");
    else {
      const name = raw.trim().normalize("NFKC");
      const n = codePoints(name);
      if (n > SKILL_NAME_MAX)
        errors.push(`Skill name '${name}' exceeds ${SKILL_NAME_MAX} character limit (${n} chars)`);
      if (name !== name.toLowerCase()) errors.push(`Skill name '${name}' must be lowercase`);
      if (name.startsWith("-") || name.endsWith("-"))
        errors.push("Skill name cannot start or end with a hyphen");
      if (name.includes("--")) errors.push("Skill name cannot contain consecutive hyphens");
      if (![...name].every((c) => isAlnum(c) || c === "-"))
        errors.push(
          `Skill name '${name}' contains invalid characters. Only letters, digits, and hyphens are allowed.`,
        );
      if (dir !== undefined && dir.normalize("NFKC") !== name)
        errors.push(`Directory name '${dir}' must match skill name '${name}'`);
    }
  }
  if (!("description" in fm)) errors.push("Missing required field in frontmatter: description");
  else {
    const d = fm.description;
    if (typeof d !== "string" || d.trim() === "")
      errors.push("Field 'description' must be a non-empty string");
    else if (codePoints(d) > SKILL_DESCRIPTION_MAX)
      errors.push(
        `Description exceeds ${SKILL_DESCRIPTION_MAX} character limit (${codePoints(d)} chars)`,
      );
  }
  if ("compatibility" in fm) {
    const c = fm.compatibility;
    if (typeof c !== "string") errors.push("Field 'compatibility' must be a string");
    else if (codePoints(c) > SKILL_COMPATIBILITY_MAX)
      errors.push(
        `Compatibility exceeds ${SKILL_COMPATIBILITY_MAX} character limit (${codePoints(c)} chars)`,
      );
  }
  return errors;
}

/**
 * The specification's validation of a SKILL.md text, with the validator's
 * messages; `dir`, the name of the directory holding it, when known. Empty
 * means valid.
 */
export function validateSkillMd(text: string, dir?: string): string[] {
  const parts = split(text);
  if ("error" in parts) return [parts.error];
  const parsed = frontmatter(parts.yaml);
  if ("error" in parsed) return [parsed.error];
  return checkFields(parsed.fm, dir);
}

/** A SKILL.md text read; one the specification refuses throws SkillFormatError. */
export function parseSkillMd(text: string): SkillMd {
  const parts = split(text);
  if ("error" in parts) throw new SkillFormatError([parts.error]);
  const parsed = frontmatter(parts.yaml);
  if ("error" in parsed) throw new SkillFormatError([parsed.error]);
  const fm = parsed.fm;
  const errors = checkFields(fm);
  const str = (k: string) => (typeof fm[k] === "string" ? (fm[k] as string) : undefined);
  if ("allowed-tools" in fm && typeof fm["allowed-tools"] !== "string")
    errors.push("Field 'allowed-tools' must be a space-separated string");
  for (const k of ["license", "compatibility"])
    if (k in fm && typeof fm[k] !== "string") errors.push(`Field '${k}' must be a string`);
  if ("metadata" in fm && typeof fm.metadata === "string" && fm.metadata !== "")
    errors.push("Field 'metadata' must be a mapping of strings to strings");
  if (errors.length > 0) throw new SkillFormatError(errors);
  const metadata = typeof fm.metadata === "object" ? { ...fm.metadata } : undefined;
  const license = str("license");
  const compatibility = str("compatibility");
  return {
    name: (str("name") as string).trim(),
    description: (str("description") as string).trim(),
    allowedTools: (str("allowed-tools") ?? "").split(/\s+/u).filter((t) => t !== ""),
    ...(license === undefined ? {} : { license }),
    ...(compatibility === undefined ? {} : { compatibility }),
    ...(metadata === undefined ? {} : { metadata }),
    body: parts.body,
  };
}

/** A parsed skill as procedural content: its body and its allowlist. */
export const skillContent = (skill: SkillMd): ProceduralContent => ({
  body: skill.body,
  tools: [...skill.allowedTools],
});

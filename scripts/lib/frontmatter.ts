// Parser for the restricted frontmatter used by docs/log entries: scalar
// `key: value` lines and `key:` followed by `  - item` lists. Anything else
// is an error, so entries stay machine-readable without a YAML dependency.

export type FrontmatterValue = string | string[];

export interface ParsedEntry {
  fields: Map<string, FrontmatterValue>;
  body: string;
}

export class FrontmatterError extends Error {}

function stripComment(value: string): string {
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') quoted = !quoted;
    if (c === "#" && !quoted && (i === 0 || /\s/.test(value[i - 1] ?? ""))) {
      return value.slice(0, i);
    }
  }
  return value;
}

function unquote(value: string): string {
  const v = stripComment(value).trim();
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
}

export function parseFrontmatter(text: string): ParsedEntry {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") {
    throw new FrontmatterError("frontmatter must start with an opening --- line");
  }
  const close = lines.indexOf("---", 1);
  if (close === -1) throw new FrontmatterError("frontmatter has no closing --- line");

  const fields = new Map<string, FrontmatterValue>();
  let listKey: string | undefined;
  for (let i = 1; i < close; i++) {
    const line = lines[i] ?? "";
    if (stripComment(line).trim() === "") continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey !== undefined) {
      (fields.get(listKey) as string[]).push(unquote(item[1] ?? ""));
      continue;
    }
    const pair = /^([a-z_]+):(.*)$/.exec(line);
    if (!pair) throw new FrontmatterError(`line ${i + 1}: expected "key: value" or "  - item"`);
    const key = pair[1] ?? "";
    if (fields.has(key)) throw new FrontmatterError(`line ${i + 1}: duplicate key ${key}`);
    const value = unquote(pair[2] ?? "");
    if (value === "") {
      fields.set(key, []);
      listKey = key;
    } else {
      fields.set(key, value);
      listKey = undefined;
    }
  }
  return { fields, body: lines.slice(close + 1).join("\n") };
}

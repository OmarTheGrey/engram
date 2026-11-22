// A memory list Claude shows a person, pasted as text (card E9.8). Claude's
// help centre (support.claude.com, article 12123587, read on 2026-11-21) has
// a person view their memory in Settings, or ask Claude to "write out your
// memories of me verbatim", and copy the text; it fixes no format. Its own
// export prompt for other services asks for one code block with each entry
// as "[date saved, if available] - memory content". So the parser takes what
// such text holds, leniently:
//
// - when the text holds a code fence, only the lines inside fences are read:
//   Claude's own remarks before and after the block are not memories;
// - a heading (`# Work`, `**Work context**`, or a short line ending in a
//   colon) names the section the entries under it belong to;
// - a bullet (`-`, `*`, `+`, a bullet sign, or `1.` / `1)`) is one entry, and
//   an indented line after it continues it;
// - a line `[date] - content` is one entry, with or without a bullet; when
//   the date is an ISO date (2026-01-31, or a full timestamp) it becomes the
//   entry's valid_from, unless it is after the import time, when the import
//   time is (the entry's note says so); otherwise the bracket stays in the
//   content;
// - any other run of lines up to a blank line, heading or bullet is one entry
//   (Claude's memory summary is paragraphs under headings).
//
// Nothing is read as trust: an entry is text, a section, a line number and
// perhaps a date. Synthetic examples only in tests (AGENTS.md rule 12).

export interface ClaudeEntry {
  /** The entry's text, its lines joined by single spaces. */
  text: string;
  /** The heading it sits under, or null. */
  section: string | null;
  /** The 1-based line it starts on, in the pasted text. */
  line: number;
  /** valid_from from a leading ISO date, or null. */
  valid_from: string | null;
  /** What the parser changed about the entry, such as a future date it did not take; or null. */
  note: string | null;
}

const FENCE = /^\s*(?:```|~~~)/;
const HASH_HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const BOLD_HEADING = /^\*\*(.+?)\*\*:?\s*$/;
const COLON_HEADING = /^([^\s\-*+\u2022\d[][^:]{0,58}):\s*$/u;
const BULLET = /^(?:[-*+\u2022]|\d{1,3}[.)])\s+(.*)$/u;
const DATED = /^\[([^\]]*)\]\s*(?:-|\u2013|\u2014|:)\s*(.+)$/u;
const ISO_DATE = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z)?$/;

/** An ISO date or UTC timestamp as a timestamp, or null when it is neither or not a real day. */
function isoTime(text: string): string | null {
  const m = ISO_DATE.exec(text.trim());
  if (!m) return null;
  const t = m[2] === undefined ? `${m[1]}T00:00:00.000Z` : `${m[1]}${m[2]}`;
  const ms = Date.parse(t);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== m[1]) return null;
  return new Date(ms).toISOString();
}

/**
 * The entries of a pasted memory list, in the order they appear. `now`, the
 * import time, bounds a date: a later one is not taken as valid_from.
 */
export function parseClaudeMemory(text: string, now?: string): ClaudeEntry[] {
  const lines = text.split(/\r?\n/);
  const out: ClaudeEntry[] = [];
  let section: string | null = null;
  let open: {
    parts: string[];
    line: number;
    valid_from: string | null;
    note: string | null;
  } | null = null;
  let bullet = false;
  let fenced = false;
  const anyFence = lines.some((l) => FENCE.test(l));

  const close = () => {
    if (open !== null) {
      const joined = open.parts.join(" ").replace(/\s+/g, " ").trim();
      if (joined !== "")
        out.push({
          text: joined,
          section,
          line: open.line,
          valid_from: open.valid_from,
          note: open.note,
        });
    }
    open = null;
    bullet = false;
  };
  const start = (content: string, line: number, isBullet: boolean) => {
    close();
    const dated = DATED.exec(content.trim());
    const when = dated ? isoTime(dated[1] ?? "") : null;
    const future = when !== null && now !== undefined && Date.parse(when) > Date.parse(now);
    open = {
      parts: [when !== null && dated ? (dated[2] ?? "") : content],
      line,
      valid_from: future ? null : when,
      note: future
        ? `the date ${dated?.[1]?.trim()} is after the import time, so valid_from is the import time`
        : null,
    };
    bullet = isBullet;
  };

  for (const [i, raw] of lines.entries()) {
    const n = i + 1;
    if (FENCE.test(raw)) {
      close();
      // Text after the closing fence is Claude's own remark, not a memory.
      if (fenced) break;
      fenced = true;
      continue;
    }
    // With a code block, the text around it is Claude's, not a memory.
    if (anyFence && !fenced) continue;
    const line = raw.trim();
    if (line === "") {
      close();
      continue;
    }
    const heading =
      HASH_HEADING.exec(line)?.[1] ?? BOLD_HEADING.exec(line)?.[1] ?? COLON_HEADING.exec(line)?.[1];
    if (heading !== undefined && !BULLET.test(line)) {
      close();
      section = heading.trim();
      continue;
    }
    const b = BULLET.exec(line);
    if (b) {
      start(b[1] ?? "", n, true);
      continue;
    }
    if (DATED.test(line)) {
      start(line, n, true);
      continue;
    }
    // An indented line continues a bullet; any other line continues a paragraph.
    const current = open as { parts: string[] } | null;
    if (current !== null && (!bullet || /^\s/.test(raw))) {
      current.parts.push(line);
      continue;
    }
    start(line, n, false);
  }
  close();
  return out;
}

// Shell words (card E8.15b, moved here by card E8.15e): the argument vector
// as the command line a person types, quoted for the shell they are in, a
// pasted command line split back into words, and what quitting prints. Pure:
// no pi-tui, so line mode (./line.ts, node:readline only) shares it with the
// full screen (./argv.ts re-exports it).
import { redactSecrets } from "../setup.ts";
import type { Ran } from "./screen.ts";

/** The shell the command line is quoted for. */
export type Shell = "posix" | "powershell";

/** PowerShell quoting when PSModulePath is set and SHELL is not (docs/design/tui.md 6.2), else POSIX. */
export function detectShell(env: Readonly<Record<string, string | undefined>>): Shell {
  return env.PSModulePath && !env.SHELL ? "powershell" : "posix";
}

/** Characters a word may hold and still be written bare. */
const BARE: Record<Shell, RegExp> = {
  posix: /^[A-Za-z0-9_\-+=.,/:@%^]+$/,
  // No comma (an array in PowerShell), no @ (splatting), no braces or parentheses.
  powershell: /^[A-Za-z0-9_\-+=./:\\%]+$/,
};
/** Characters that double quotes do not keep literal. */
const UNSAFE_IN_DOUBLE: Record<Shell, RegExp> = {
  posix: /[$`\\"!]/,
  powershell: /[$`"]/,
};

/** One word, quoted so the shell passes it through unchanged. */
export function quote(word: string, shell: Shell): string {
  if (word !== "" && BARE[shell].test(word)) return word;
  if (!UNSAFE_IN_DOUBLE[shell].test(word) && !/[\r\n]/.test(word)) return `"${word}"`;
  if (shell === "powershell") return `'${word.replaceAll("'", "''")}'`;
  return `'${word.replaceAll("'", `'\\''`)}'`;
}

/** The command line `engram <argv...>`, each word quoted for `shell`. */
export function commandLine(argv: readonly string[], shell: Shell): string {
  return ["engram", ...argv.map((w) => quote(w, shell))].join(" ");
}

/**
 * The words of a pasted command line, as a POSIX shell or PowerShell splits
 * simple ones: spaces separate words, single and double quotes group them, a
 * backslash escapes the next character outside single quotes (POSIX only).
 * A leading `engram` is dropped. Undefined when a quote is left open.
 */
export function splitWords(line: string, shell: Shell = "posix"): string[] | undefined {
  const words: string[] = [];
  let word = "";
  let inWord = false;
  let quoteChar: "'" | '"' | undefined;
  const chars = [...line];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] as string;
    if (quoteChar !== undefined) {
      if (ch === quoteChar) {
        // PowerShell doubles a quote inside quotes.
        if (shell === "powershell" && chars[i + 1] === quoteChar) {
          word += ch;
          i++;
        } else quoteChar = undefined;
      } else if (ch === "\\" && quoteChar === '"' && shell === "posix" && i + 1 < chars.length) {
        const next = chars[i + 1] as string;
        if ('$`"\\'.includes(next)) {
          word += next;
          i++;
        } else word += ch;
      } else word += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quoteChar = ch;
      inWord = true;
    } else if (ch === "\\" && shell === "posix" && i + 1 < chars.length) {
      word += chars[i + 1];
      i++;
      inWord = true;
    } else if (/\s/.test(ch)) {
      if (inWord) words.push(word);
      word = "";
      inWord = false;
    } else {
      word += ch;
      inWord = true;
    }
  }
  if (quoteChar !== undefined) return undefined;
  if (inWord) words.push(word);
  if (words[0] === "engram") words.shift();
  return words;
}

/** An escape sequence: CSI, a string (OSC, DCS, APC, PM, SOS) up to BEL or ST, or any other escape and its byte. */
const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const SEQUENCE = new RegExp(
  String.raw`${ESC}\[[0-?]*[ -/]*[@-~]|${ESC}[\]P_^X][\s\S]*?(?:${BEL}|${ESC}\\|$)|${ESC}[\s\S]?`,
  "g",
);

/**
 * `text` with every escape sequence and every other C0 and C1 control
 * character removed but the newline, tabs as four spaces: what line mode
 * and the quit summary print of a command line never drives the terminal.
 */
export function stripControls(text: string): string {
  let out = "";
  for (const ch of text.replace(SEQUENCE, "")) {
    const c = ch.codePointAt(0) ?? 0;
    if (ch === "\n") out += ch;
    else if (ch === "\t") out += "    ";
    else if (c >= 32 && (c < 127 || c > 159)) out += ch;
  }
  return out;
}

/** A command line as it is printed: every URL's credentials redacted as the CLI redacts a log's label, no control character. */
export function printedLine(argv: readonly string[], shell: Shell): string {
  let text = commandLine(argv, shell);
  for (const word of argv) if (word.includes("://")) text = redactSecrets(text, word);
  return stripControls(text);
}

/** What the session leaves for the shell on quit. */
export interface Summary {
  ran: readonly Ran[];
  /** Commands `c` could not copy, printed instead. */
  deferred: readonly string[];
  /** Set when the person asked for line mode (L): the full screen ends and line mode starts (card E8.15e). */
  line?: boolean;
}

/** What quitting prints (docs/design/tui.md 4.1): the session's commands, each with its exit code. */
export function summaryText(summary: Summary, shell: Shell, quiet: boolean): string {
  const lines: string[] = [];
  if (!quiet && summary.ran.length > 0) {
    lines.push("# engram tui: the commands this session ran");
    for (const r of summary.ran)
      lines.push(
        `${printedLine(r.argv, shell)}  # exit ${r.code}${r.note === undefined ? "" : `, ${r.note}`}`,
      );
  }
  if (summary.deferred.length > 0) {
    lines.push("# engram tui: what c could not copy (this terminal has no clipboard path)");
    // Printed, so redacted like every printed command; the secret stays the person's to type.
    for (const d of summary.deferred) {
      let text = d;
      for (const url of d.match(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi) ?? [])
        text = redactSecrets(text, url);
      lines.push(stripControls(text));
    }
  }
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

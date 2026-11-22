// Argument vectors and the command lines they print as (card E8.15b,
// docs/design/tui.md 4.1 and 6.2): every action of the TUI is an argument
// vector, the one `run` gets; this file turns it into the command line the
// command row shows and `c` copies, quoted for the shell the person is in,
// and splits a pasted command line back into words for the palette.
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

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
 * `text` cut in the middle with `...` when wider than `width`, so the start
 * of the command and its last flags both show (docs/design/tui.md 7).
 */
export function middleCut(text: string, width: number): string {
  if (visibleWidth(text) <= width) return text;
  if (width <= 3) return truncateToWidth(text, width, "");
  const head = Math.ceil((width - 3) / 2);
  const tail = width - 3 - head;
  const chars = [...text];
  let end = "";
  for (let i = chars.length - 1; i >= 0 && visibleWidth(end) < tail; i--) end = chars[i] + end;
  while (visibleWidth(end) > tail) end = end.slice(1);
  return `${truncateToWidth(text, head, "")}...${end}`;
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

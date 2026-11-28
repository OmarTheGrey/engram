// The procedure safety scan (card D5 of the second absorb plan): a
// deterministic scan of a procedural item's body and tools for shell
// injection, destructive commands, exfiltration sinks and prompt-injection
// phrases, and what `procedures.safety_scan` does with its findings at
// admission. Pure: no clock, no randomness, no model, no store. A replay
// proves a procedure works, not that it is safe (Malicious Agent Skills,
// 2602.06547); this scan is a floor with a measured hold rate and false-hold
// rate (research/results/h5-procedure-scan.json), never a defence. Its
// patterns are English and shell-centred: a careful author writes around any
// regular expression, and a procedure in another language passes unread.
// Known evasions (review of card D5, finding 5): homoglyphs (a Cyrillic letter
// in `curl` or `ignore`) and fullwidth forms (`｜`, `＜system＞`), shell quoting
// and escapes (`c''url`, `c\url`, `| s\h`), a variable naming the shell or
// the target (`| $S`, `D=/; rm -rf $D`), other destructive commands such as
// `find / -delete`, and look-alike slashes (U+2215). Hidden characters (zero
// width, tag characters) are not this scan's: the promotion gate refuses them
// first (engram/promote/hidden-text, ADR 0026 P5-14). Every rule runs in
// linear time: each lazy or open run is bounded (credential-upload's to 200
// characters), and a test times every rule on 200,000 adversarial characters.
//
// What the option does (plane/promote.ts calls `applySafetyScan` on the
// promotion gate's decision for a procedural item):
//   off or absent  nothing; the decision and its reason are as before
//   report         every finding is appended to the decision's reason, which
//                  the event records; no decision changes
//   hold           the same, and an allowed promotion with a critical finding
//                  becomes `ask` under engram/promote/safety-scan: one `gate`
//                  event, the item stays as it is. It lands only when an
//                  actor ADRs 0026 and 0049 allow (the owner in their own
//                  person scope; elsewhere a distinct user-sourced member of
//                  the target who neither owns nor wrote it) presents it again
//                  with a release reason (PromoteOptions.release), which the
//                  event's reason records. A warning annotates and never holds.
// The operator's release path: no surface carries a replay or a release yet
// (ADR 0046, decision 7), so a held procedure is released in process, by the
// same Plane.promote call with the same replay (or, for a widening, the same
// review) and `release: "<reason>"`, as packages/core/scripts/procedural-corpus.ts
// calls it. Cards E8.8 and E2.19 build the surface.
// No finding carries an excerpt of the content, only its field and offsets,
// so a payload is never echoed into the log (as ADR 0039, item 4, for the
// injection screen).
//
// Absorbed (ADR 0037, docs/absorbed.md):
//
// - Ported from caura-ai/caura, commit
//   8dbb7f40a76cdc75827923f1a82597b4c8393130,
//   core-api/src/core_api/services/forge/sentinel_scan.py, Apache License
//   2.0, Copyright 2026 Caura (NOTICE): the tables as data, rewritten in
//   TypeScript: the prompt-injection markers (check 1), the attack patterns
//   of check 2 (fetch piped to a shell or a stdin interpreter on one command
//   line, `sh -c "$(curl`, `eval "$(curl`, `bash <(curl`, `iwr | iex`, a
//   download saved and later run, `$(rm`, the fork bomb, reading
//   /etc/passwd, shadow or sudoers, `eval(atob(`, `exec("sh"`), the root
//   wipe and `chmod 777` on a wipe target, the routine admin lines that only
//   warn (`rm -rf /path`, `dd if=/dev/zero`, `mkfs.*`, `chmod 777`), and the
//   URL exfiltration patterns of check 3; the logical-line reading, where a
//   trailing backslash or pipe continues a command and a markdown table row
//   does not. Changed here: a wipe target is resolved by walking its path
//   segments rather than by caura's possessive regex, which JavaScript lacks;
//   `^\s*system:` became `^[ \t]*system:` (quadratic on a run of newlines,
//   as the injection screen found); the webhook POST pattern's two
//   unbounded runs are bounded to 200 characters; the known sink hosts and
//   `base64 -d | sh` are critical here (caura warns on them), under
//   exfiltration and shell injection; `decode-pipe-shell` also takes
//   `--decode`; `sink-host` is one bare-URL pattern (caura asks for a curl or
//   wget before its collector hosts and a trailing `/` after its paste hosts)
//   and adds oast.*, pipedream.net and ngrok, which caura names only in its
//   webhook POST pattern; the admin lines only warn, as in caura's skill text
//   (they are critical in its support-file scripts, and `tools` are names, not
//   scripts); a warning overlapping a critical finding in the same field is
//   dropped. Checks 4 to 8 (support-file paths,
//   PII, cited ids, sizes) have no procedural counterpart or are the write
//   gate's (policy/secrets.ts).
// - Ideas, no code: devmemory (vasikmansuri/devmemory, commit
//   52f0416fc6c5e1df2e7133dee61b34fc9c92d0fb, src/security/injection.ts, MIT)
//   for the concealment phrase, role tags, a "new instructions:" heading and
//   "send the secrets to"; Malicious Agent Skills (2602.06547) for its two
//   attack strategies, credential theft through code run from the network
//   and instructions that hide actions from the user, hence the credential
//   upload and credential pipe rules.
import type { Actor } from "../actor.ts";
import { scopeLevel } from "../policy/evaluate.ts";
import {
  hiddenCharacters,
  PROMOTE_MEMBERSHIP_ID,
  type PromotionDecision,
  reviewerProblem,
} from "../policy/promotion.ts";
import type { MemoryEvent, MemoryItem, Policy } from "../schema.ts";

/** The four classes of finding, in the order a reason lists them. */
export const SCAN_CLASSES = [
  "shell-injection",
  "destructive",
  "exfiltration",
  "prompt-injection",
] as const;
export type ScanClass = (typeof SCAN_CLASSES)[number];

/** A critical finding holds under `hold`; a warning only annotates. */
export type ScanSeverity = "critical" | "warn";

/** The rule id a held promotion's event names. */
export const SAFETY_SCAN_ID = "engram/promote/safety-scan";

/** The longest release reason accepted, in characters after trimming. */
export const RELEASE_MAX = 500;

/** A span of the scanned text, start inclusive, end exclusive. */
interface Span {
  start: number;
  end: number;
}

/** What a rule asks of the text: the first span it matches, or null. */
interface Matcher {
  search(text: string): Span | null;
}

/** One row of the tables. */
export interface ScanRule {
  id: string;
  class: ScanClass;
  severity: ScanSeverity;
  /** Where the rule comes from: `caura` (ported), `idea` (devmemory or 2602.06547), `engram`. */
  source: "caura" | "idea" | "engram";
  match: Matcher;
}

/** One finding: the rule that matched, in which field and where. */
export interface ScanFinding {
  rule: string;
  class: ScanClass;
  severity: ScanSeverity;
  /** `body`, or `tools[<i>]`. */
  field: string;
  start: number;
  end: number;
}

/** A regular expression as a matcher; a fresh one per search, so no lastIndex is shared. */
function re(source: string, flags = "i"): Matcher {
  return {
    search(text) {
      const m = new RegExp(source, flags.replace("g", "")).exec(text);
      return m ? { start: m.index, end: m.index + m[0].length } : null;
    },
  };
}

/**
 * `(start, end)` of each command line. A newline after a trailing `\` or
 * `|` continues the command, as the shell reads it; a line that starts with
 * `|` is a markdown table row, so its trailing `|` does not (caura).
 */
export function logicalLines(text: string): Span[] {
  const out: Span[] = [];
  let start = 0;
  let pos = 0;
  for (;;) {
    const nl = text.indexOf("\n", pos);
    if (nl === -1) break;
    let j = nl - 1;
    while (j >= start && " \t\r".includes(text[j] as string)) j--;
    const last = j >= start ? text[j] : undefined;
    if (last === "\\" || (last === "|" && !text.slice(pos, nl).trimStart().startsWith("|"))) {
      pos = nl + 1;
      continue;
    }
    out.push({ start, end: nl });
    start = pos = nl + 1;
  }
  out.push({ start, end: text.length });
  return out;
}

/** A first pattern and, later on the same command line, a second (caura's _FetchThenTail). */
function thenOnLine(first: string, then: string): Matcher {
  // Compiled once; neither is global or sticky, so no lastIndex is shared.
  const firstRe = new RegExp(first, "i");
  const thenRe = new RegExp(then, "i");
  return {
    search(text) {
      for (const { start, end } of logicalLines(text)) {
        const line = text.slice(start, end);
        const a = firstRe.exec(line);
        if (!a) continue;
        const from = a.index + a[0].length;
        const b = thenRe.exec(line.slice(from));
        if (b) return { start: start + a.index, end: start + from + b.index + b[0].length };
      }
      return null;
    },
  };
}

// The command grammar caura's patterns share.
const SHELL = "(?:ba|z|da|k)?sh";
/** An interpreter reading its program from stdin: `| python3` or `| python3 -`, not `| python3 -m json.tool`. */
const STDIN_INTERPRETER = "(?:python[0-9.]*|perl|ruby|node)(?:\\s+-)?(?=\\s*(?:$|[;&|)`'\"]))";
const SUDO = "(?:sudo(?:\\s+-\\S+(?:\\s+[^-\\s]\\S*)?)*\\s+)?";
const ENV = "(?:(?:[\\w./-]*/)?env(?:\\s+(?:-\\S+|\\w+=\\S*))*\\s+)?";
const RUNNER = `${SUDO}${ENV}(?:[\\w./-]*/)?`;
/** A pipe, not either half of `||`. */
const PIPE = "(?<!\\|)\\|(?!\\|)";

// --- A download saved to a file and later run (caura's _DownloadThenRun) ---

const FETCH_COMMAND = /\b(curl|wget)\b/gi;
/** One statement: a quoted string is one unit; an unclosed quote runs to the end. */
const STATEMENT = /(?:'[^']*'?|"(?:[^"\\]|\\[\s\S])*"?|[^'"&|;])*/y;
const TEE = new RegExp(`\\|[ \\t]*${RUNNER}tee(?:[ \\t]+-\\S+)*[ \\t]+["']?([^\\s;&|<>"']+)`, "iy");
const RUN_OF_FILE = new RegExp(
  `(?:^|&&|\\|\\||;)[ \\t]*${RUNNER}(?:(?:${SHELL}|python[0-9.]*|source|\\.)(?:[ \\t]+(?:-\\w+|--))*[ \\t]+|(?=\\./))["']?([\\w./-]+)`,
  "gim",
);

function baseName(path: string): string {
  const bare = (path.replace(/^["']+|["']+$/g, "").split("?")[0] as string).split("#")[0] as string;
  return bare.slice(bare.lastIndexOf("/") + 1);
}

/**
 * The base name of the file a curl or wget command saves, or null: curl
 * saves with `-o FILE` or `-O` (the URL's name), wget under the URL's name
 * unless `-O` names another; what either writes to stdout is saved by a
 * `> FILE` redirect (caura's _saved_name).
 */
function savedName(tool: string, tokens: string[]): string | null {
  let out: string | null = null;
  let redirect: string | null = null;
  let remoteName = false;
  let urlName: string | null = null;
  const outFlag = tool === "curl" ? "o" : "O";
  for (let i = 0; i < tokens.length; i++) {
    const tok = (tokens[i] as string).replace(/^["']+|["']+$/g, "");
    const next = tokens[i + 1] ?? null;
    if (tok.startsWith(">")) {
      const target = tok.replace(/^>+/, "");
      redirect = target || next;
      if (!target) i++;
    } else if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      const name = eq === -1 ? tok : tok.slice(0, eq);
      if (name === (tool === "curl" ? "--output" : "--output-document")) {
        out = eq === -1 ? next : tok.slice(eq + 1);
        if (eq === -1) i++;
      } else if (tool === "curl" && (name === "--remote-name" || name === "--remote-name-all"))
        remoteName = true;
    } else if (tok.startsWith("-") && tok.length > 1) {
      const flags = tok.slice(1);
      if (flags.includes(outFlag)) {
        const rest = flags.slice(flags.indexOf(outFlag) + 1);
        out = rest || next;
        if (!rest) i++;
      } else if (tool === "curl" && flags.includes("O")) remoteName = true;
    } else if (urlName === null && tok.includes("://")) urlName = baseName(tok);
  }
  if (out !== null && !["", "-"].includes(baseName(out))) return baseName(out);
  if (out !== null || (tool === "curl" && !remoteName)) {
    const name = redirect ? baseName(redirect) : "";
    return ["", "-"].includes(name) ? null : name;
  }
  return urlName || null;
}

const downloadThenRun: Matcher = {
  search(text) {
    const runs = new Map<string, Span>();
    for (const m of text.matchAll(RUN_OF_FILE))
      runs.set(baseName(m[1] as string), { start: m.index, end: m.index + m[0].length });
    if (runs.size === 0) return null;
    for (const { start, end } of logicalLines(text)) {
      const line = text.slice(start, end);
      let pos = 0;
      for (;;) {
        FETCH_COMMAND.lastIndex = pos;
        const fetch = FETCH_COMMAND.exec(line);
        if (!fetch) break;
        const after = fetch.index + fetch[0].length;
        STATEMENT.lastIndex = after;
        const statement = STATEMENT.exec(line);
        let stop = statement ? after + statement[0].length : line.length;
        const tokens = line.slice(after, stop).match(/\S+/g) ?? [];
        let name = savedName((fetch[1] as string).toLowerCase(), tokens);
        if (name === null) {
          TEE.lastIndex = stop;
          const tee = TEE.exec(line);
          if (tee) {
            name = baseName(tee[1] as string);
            stop = tee.index + tee[0].length;
          }
        }
        const run = name ? runs.get(name) : undefined;
        if (run && run.start >= start + stop) return { start: start + fetch.index, end: run.end };
        pos = Math.max(stop, after);
      }
    }
    return null;
  },
};

// --- A command naming what a root wipe names (caura's _OnWipeTarget) ---

const TOP_DIR =
  /^(?:bin|boot|dev|etc|home|lib(?:32|64|x32)?|media|mnt|opt|proc|root|run|sbin|srv|sys|usr|var)$/i;

/**
 * Whether one operand names the filesystem root, a top-level system
 * directory or the home directory, bare or with `/`, `/*` or `/.*`, after
 * its `.` and `..` segments are walked. A quoted `~` or a single-quoted
 * `$HOME` is a literal name, not home (caura).
 */
export function isWipeTarget(word: string): boolean {
  let w = word;
  let quote: string | null = null;
  if (w.startsWith('"') || w.startsWith("'")) {
    quote = w[0] as string;
    w = w.slice(1);
  }
  w = w.replaceAll('"', "").replaceAll("'", "");
  let home = false;
  let rest: string;
  const homeVar = /^\$(?:HOME|\{HOME\})(?=\/|$)/.exec(w);
  if (w.startsWith("~") && quote === null && (w.length === 1 || w[1] === "/")) {
    home = true;
    rest = w.slice(1);
  } else if (homeVar && quote !== "'") {
    home = true;
    rest = w.slice(homeVar[0].length);
  } else if (w.startsWith("/")) rest = w;
  else return false;
  const segments = rest.split("/").filter((s) => s !== "");
  const last = segments.at(-1);
  if (last === "*" || last === ".*") segments.pop();
  if (home) return segments.every((s) => s === "." || s === "..");
  const stack: string[] = [];
  for (const s of segments) {
    if (s === ".") continue;
    if (s === "..") stack.pop();
    else stack.push(s);
  }
  return stack.length === 0 || (stack.length === 1 && TOP_DIR.test(stack[0] as string));
}

/** Where a command ends: a separator, a comment, or a newline the shell does not continue. */
const STATEMENT_END = /[;&|`)]|(?<=\s)#|(?<!\\)(?<!\\\r)\n/g;

function onWipeTarget(head: string, options: (opts: string[]) => boolean): Matcher {
  return {
    search(text) {
      const heads = new RegExp(head, "gi");
      for (;;) {
        const h = heads.exec(text);
        if (!h) return null;
        STATEMENT_END.lastIndex = h.index + h[0].length;
        const stop = STATEMENT_END.exec(text);
        const end = stop ? stop.index : text.length;
        const opts: string[] = [];
        let target: Span | null = null;
        const words = /\S+/g;
        const segment = text.slice(h.index + h[0].length, end);
        for (const w of segment.matchAll(words)) {
          if (w[0].startsWith("-")) opts.push(w[0]);
          else if (target === null && isWipeTarget(w[0])) {
            const at = h.index + h[0].length + w.index;
            target = { start: at, end: at + w[0].length };
          }
        }
        if (target && options(opts)) return { start: h.index, end: target.end };
        heads.lastIndex = Math.max(end, h.index + 1);
      }
    },
  };
}

/** `rm`'s options ask for `-r` and `-f`, together or apart. */
function recursiveAndForced(opts: string[]): boolean {
  const short = opts
    .filter((o) => !o.startsWith("--"))
    .map((o) => o.slice(1).toLowerCase())
    .join("");
  return (
    (short.includes("r") || opts.includes("--recursive")) &&
    (short.includes("f") || opts.includes("--force"))
  );
}

// --- Credentials (2602.06547, idea) ---

/** A path that holds credentials: SSH keys, cloud and package-manager tokens, a `.env`. */
const CREDENTIAL =
  "(?:\\.ssh\\b|\\.aws/credentials|\\.netrc\\b|\\.npmrc\\b|\\.pypirc\\b|\\.git-credentials\\b|\\.docker/config\\.json|\\.kube/config\\b|(?<![\\w.])\\.env(?![\\w.])|\\bid_(?:rsa|ed25519|ecdsa|dsa)\\b(?!\\.pub))";

/** Hosts that collect requests or hold throwaway pastes. */
const SINK_HOSTS =
  "(?:requestbin\\.(?:com|net)|webhook\\.site|hookbin\\.com|interactsh\\.com|burpcollaborator\\.net|oast\\.(?:fun|pro|me|site|live|online)|pipedream\\.net|ngrok(?:-free)?\\.(?:io|app|dev)|pastebin\\.com|paste\\.ee|hastebin\\.com|0x0\\.st|transfer\\.sh)";

/** The tables, in the order a field is scanned. Each rule gives at most one finding per field. */
export const SCAN_RULES: readonly ScanRule[] = [
  // Shell injection: code fetched from the network and run as it lands, or
  // run obfuscated. Critical wherever it appears (caura's _ATTACK_PATTERNS).
  {
    id: "fetch-pipe-shell",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: thenOnLine(
      "\\b(?:curl|wget)\\b",
      `${PIPE}\\s*${RUNNER}(?:${SHELL}\\b|${STDIN_INTERPRETER})`,
    ),
  },
  {
    id: "shell-c-fetch",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: re(`\\b${SHELL}\\s+-c\\s+["']?\\$\\(\\s*(?:curl|wget)\\b`),
  },
  {
    id: "eval-fetch",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: re("\\beval\\s+[\"']?\\$\\(\\s*(?:curl|wget)\\b"),
  },
  {
    id: "process-substitution-fetch",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: re(`(?:\\b(?:${SHELL}|source)|(?:^|[\\s;&|])\\.)\\s+<\\(\\s*(?:curl|wget)\\b`, "im"),
  },
  {
    id: "powershell-fetch-iex",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: thenOnLine(
      "\\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\\b",
      `${PIPE}\\s*(?:iex|Invoke-Expression)\\b`,
    ),
  },
  {
    id: "download-then-run",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: downloadThenRun,
  },
  {
    id: "decode-pipe-shell",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: re("base64\\s*(?:-d|--decode)\\s*\\|\\s*(?:curl|wget|sh|bash)\\b"),
  },
  {
    id: "command-substitution-rm",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: re("\\$\\(\\s*rm\\s"),
  },
  {
    id: "fork-bomb",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: re(":\\(\\s*\\)\\s*\\{\\s*:\\|:&\\s*\\}\\s*;\\s*:", ""),
  },
  {
    id: "system-file-read",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: re("\\b(?:cat|less|more|head|tail)\\s+/etc/(?:passwd|shadow|sudoers)\\b"),
  },
  {
    id: "eval-decoded",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: re("\\beval\\s*\\(\\s*(?:base64_decode|atob|fromCharCode)"),
  },
  {
    id: "exec-shell",
    class: "shell-injection",
    severity: "critical",
    source: "caura",
    match: re("\\bexec\\s*\\(\\s*['\"]?(?:cmd|powershell|sh|bash)\\b"),
  },
  // Destructive: a wipe or an opening of what leaves the host unusable is
  // critical; a routine admin line on a host the operator owns warns.
  {
    id: "root-wipe",
    class: "destructive",
    severity: "critical",
    source: "caura",
    match: onWipeTarget("(?<![\\w-])rm\\b", recursiveAndForced),
  },
  {
    id: "open-root",
    class: "destructive",
    severity: "critical",
    source: "caura",
    match: onWipeTarget("\\bchmod\\s+(?:-R\\s+)?[0-7]*7{2,3}\\b", () => true),
  },
  {
    id: "admin-path-wipe",
    class: "destructive",
    severity: "warn",
    source: "caura",
    match: re("\\brm\\s+-(?:rf|fr)\\s+[\"']?/(?!tmp\\b)"),
  },
  {
    id: "admin-dd",
    class: "destructive",
    severity: "warn",
    source: "caura",
    match: re("\\bdd\\s+if=/dev/(?:zero|random|urandom)\\b"),
  },
  {
    id: "admin-mkfs",
    class: "destructive",
    severity: "warn",
    source: "caura",
    match: re("\\bmkfs\\.[a-z0-9]+\\s"),
  },
  {
    id: "admin-chmod-777",
    class: "destructive",
    severity: "warn",
    source: "caura",
    match: re("\\bchmod\\s+(?:-R\\s+)?[0-7]*7{2,3}\\b", ""),
  },
  // Exfiltration: a known collector or paste host, credentials uploaded or
  // piped to the network, a request to send secrets somewhere.
  {
    id: "sink-host",
    class: "exfiltration",
    severity: "critical",
    source: "caura",
    match: re(`https?://(?:[a-z0-9-]+\\.)*${SINK_HOSTS}(?=[/:?#\\s"'\`)]|$)`),
  },
  {
    id: "webhook-post",
    class: "exfiltration",
    severity: "warn",
    source: "caura",
    match: re(
      "(?:curl|wget|https?\\.post|fetch)\\s*[^,\\n]{0,200}POST[^,\\n]{0,200}(?:webhook|hooks?\\.|paste\\.|requestbin|ngrok|pipedream)",
    ),
  },
  {
    id: "credential-upload",
    class: "exfiltration",
    severity: "critical",
    source: "idea",
    match: thenOnLine(
      "\\b(?:curl|wget)\\b",
      `(?:-d|--data(?:-binary|-raw|-urlencode)?|-F|--form|-T|--upload-file|--post-file|--body-file)[ \\t=]{0,20}["']?(?:[\\w-]{1,64}=)?@?[^\\s"']{0,200}?${CREDENTIAL}`,
    ),
  },
  {
    id: "credential-pipe",
    class: "exfiltration",
    severity: "critical",
    source: "idea",
    match: thenOnLine(CREDENTIAL, "\\|\\s*(?:curl|wget|nc|ncat|netcat|socat)\\b"),
  },
  {
    id: "send-secrets",
    class: "exfiltration",
    severity: "critical",
    source: "idea",
    match: re(
      "\\b(?:exfiltrate|send\\s+(?:the\\s+|all\\s+(?:the\\s+)?)?(?:secrets?|credentials?|tokens?|api\\s+keys?|passwords?)\\s+to)\\b",
    ),
  },
  // Prompt injection: text addressed to the agent that loads the procedure.
  {
    id: "ignore-previous",
    class: "prompt-injection",
    severity: "critical",
    source: "caura",
    match: re(
      "\\bignore\\s+(?:all\\s+)?(?:the\\s+)?(?:previous|above|prior)\\s+(?:instructions?|prompts?)\\b",
    ),
  },
  {
    id: "disregard-above",
    class: "prompt-injection",
    severity: "critical",
    source: "caura",
    match: re(
      "\\bdisregard\\s+(?:the\\s+)?(?:above|previous|prior)\\s+(?:instructions?|prompts?|context)\\b",
    ),
  },
  {
    id: "forget-everything",
    class: "prompt-injection",
    severity: "critical",
    source: "caura",
    match: re("\\bforget\\s+(?:everything|all)\\s+(?:above|prior|previously)\\b"),
  },
  {
    id: "pseudo-system",
    class: "prompt-injection",
    severity: "critical",
    source: "caura",
    match: re(
      "^[ \\t]*system[ \\t]*:[ \\t]*(?:you\\s+(?:are|must|will)|ignore|act\\s+as|disregard|forget|override)\\b",
      "im",
    ),
  },
  {
    id: "system-template",
    class: "prompt-injection",
    severity: "critical",
    source: "caura",
    match: re("\\{\\{\\s*system\\s*\\}\\}|<\\|im_start\\|>\\s*system"),
  },
  {
    id: "jailbreak",
    class: "prompt-injection",
    severity: "critical",
    source: "caura",
    match: re(
      "\\b(?:jailbreak|DAN\\s+mode|developer\\s+mode\\s+enabled)\\b|\\boverride\\s+(?:the\\s+)?(?:safety|guardrails?|filters?)\\b",
    ),
  },
  {
    id: "role-takeover",
    class: "prompt-injection",
    severity: "critical",
    source: "caura",
    match: re(
      "\\byou\\s+are\\s+now\\s+a?\\s*(?:new|different)\\s+(?:assistant|ai|model)\\b|\\bact\\s+as\\s+(?:if\\s+you\\s+(?:are|were)\\s+)?(?:an?\\s+)?unrestricted\\b",
    ),
  },
  {
    id: "conceal-from-user",
    class: "prompt-injection",
    severity: "critical",
    source: "idea",
    match: re(
      "\\b(?:do\\s+not|don['\u2019]t|never)\\s+(?:tell|mention|inform|alert|notify)\\b[^.\\n]{0,40}?\\bthe\\s+user\\b(?!['\u2019]s)",
    ),
  },
  {
    id: "role-tag",
    class: "prompt-injection",
    severity: "critical",
    source: "idea",
    match: re("</?\\s*(?:system|assistant)\\s*>"),
  },
  {
    id: "new-instructions",
    class: "prompt-injection",
    severity: "critical",
    source: "idea",
    match: re("\\b(?:new|updated|real)\\s+(?:system\\s+)?(?:instructions?|prompt)\\s*:"),
  },
];

/** The strings a procedural content carries, by field: its body, then each tool. */
function fieldsOf(content: unknown): [field: string, text: string][] {
  if (content === null || typeof content !== "object") return [];
  const { body, tools } = content as { body?: unknown; tools?: unknown };
  const out: [string, string][] = [];
  if (typeof body === "string") out.push(["body", body]);
  if (Array.isArray(tools))
    tools.forEach((t, i) => {
      if (typeof t === "string") out.push([`tools[${i}]`, t]);
    });
  return out;
}

/**
 * Every finding in a procedural item's content: per field (body, then each
 * tool) and per rule in the tables' order, the first match, a warning
 * dropped when it overlaps a critical finding in the same field.
 */
export function scanProcedure(content: unknown): ScanFinding[] {
  const out: ScanFinding[] = [];
  for (const [field, text] of fieldsOf(content)) {
    const found: ScanFinding[] = [];
    for (const rule of SCAN_RULES) {
      const span = rule.match.search(text);
      if (span)
        found.push({ rule: rule.id, class: rule.class, severity: rule.severity, field, ...span });
    }
    const critical = found.filter((f) => f.severity === "critical");
    out.push(
      ...found.filter(
        (f) =>
          f.severity === "critical" || !critical.some((c) => c.start < f.end && f.start < c.end),
      ),
    );
  }
  return out;
}

/** `critical shell-injection (fetch-pipe-shell) in body at 12 to 58`. */
export function findingText(f: ScanFinding): string {
  return `${f.severity} ${f.class} (${f.rule}) in ${f.field} at ${f.start} to ${f.end}`;
}

/** The scan's clause in a reason: what it found, or that it found nothing. */
export function scanNote(mode: "report" | "hold", findings: readonly ScanFinding[]): string {
  if (findings.length === 0)
    return `the procedure safety scan (procedures.safety_scan: ${mode}) found nothing`;
  const critical = findings.filter((f) => f.severity === "critical").length;
  return `the procedure safety scan (procedures.safety_scan: ${mode}) found ${critical} critical and ${findings.length - critical} warning: ${findings.map(findingText).join("; ")}`;
}

/** Why a release reason is malformed, or null (absent is no release). */
export function releaseProblem(release: unknown): string | null {
  if (release === undefined) return null;
  if (typeof release !== "string" || release.trim() === "")
    return "a release of the safety scan's hold needs a reason, a non-empty string";
  if (release.trim().length > RELEASE_MAX)
    return `a release reason is at most ${RELEASE_MAX} characters; this one has ${release.trim().length}`;
  // A release reason is stored in an event's reason, so it may hold no
  // character a reader would not see (as content may not, P5-14).
  if (hiddenCharacters(release) > 0)
    return "a release reason may hold no hidden characters (default-ignorable, format or tag characters)";
  return null;
}

/** What `applySafetyScan` needs beyond the decision: the release, the target and the item's authors. */
export interface ReleaseContext {
  /** The release reason the caller gave, if any (PromoteOptions.release). */
  release?: string;
  /** The promotion's target scope. */
  target: string;
  /** Every actor of an allowed write or update of the item or its lineage; asked only for a release. */
  authors: () => readonly string[];
}

/**
 * Is this the owner's own release, ADR 0049's one exception: the item's
 * owner, at the person level, keeping it in their own person scope? The
 * actor's source is judged apart.
 */
function ownRelease(actor: Actor, item: MemoryItem, target: string): boolean {
  return (
    target === item.scope &&
    scopeLevel(item.scope) === "person" &&
    item.scope === actor.id &&
    item.owner === actor.id &&
    actor.level === "person"
  );
}

/** Who may release a hold of `item` into `target`, as the reasons say it. */
function releaser(item: MemoryItem, target: string): string {
  return scopeLevel(target) === "person" && target === item.scope && item.scope === item.owner
    ? "its owner, acting as user, or a user-sourced member of the scope who neither owns nor wrote it,"
    : `a user-sourced member of ${target} who neither owns nor wrote it`;
}

/**
 * Whether a reviewer's approval could land the promotion `event` refused or
 * held, for a surface choosing whether to offer one (the TUI's handoff): not
 * for a hold of the safety scan, which a review alone only holds again; its
 * release needs the replay and a release reason (PromoteOptions), which no
 * surface carries yet (ADR 0046, decision 7). The decision lives here, not in
 * the TUI (AGENTS.md rule 1).
 */
export function reviewCouldLand(event: Pick<MemoryEvent, "policy_id">): boolean {
  return event.policy_id !== SAFETY_SCAN_ID;
}

/**
 * The promotion gate's decision for `item` as `procedures.safety_scan`
 * leaves it (card D5). Off or absent, a non-procedural item, or the opaque
 * membership refusal (which says nothing of the item): `d` unchanged.
 * Otherwise the scan's findings are appended to the reason; under `hold`, an
 * allowed promotion with a critical finding is held (`ask`, no item, under
 * SAFETY_SCAN_ID) unless the promoting actor gives a release reason and may
 * release it, which the reason then records. Who may release applies ADRs
 * 0026 and 0049, with no new ADR: in the owner's own person scope the owner,
 * acting as user, may (ADR 0049's exception, which authorises nothing for
 * anyone else); in any other target, a widening of an active procedure
 * included, only a distinct reviewer may: user-sourced, a member of the
 * target, neither the owner nor an author of any version (ADR 0026's
 * reviewerProblem). Any other release is a deny event under SAFETY_SCAN_ID.
 */
export function applySafetyScan(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
  d: PromotionDecision,
  ctx: ReleaseContext,
): PromotionDecision {
  const mode = policy.procedures?.safety_scan;
  if (mode === undefined || mode === "off") return d;
  if (item.class !== "procedural" || d.policy_id === PROMOTE_MEMBERSHIP_ID) return d;
  const findings = scanProcedure(item.content);
  const note = scanNote(mode, findings);
  const critical = findings.filter((f) => f.severity === "critical").length;
  const holds = mode === "hold" && critical > 0;
  if (!holds) return { ...d, reason: `${d.reason}; ${note}` };
  const who = releaser(item, ctx.target);
  if (d.decision !== "allow")
    return {
      ...d,
      reason: `${d.reason}; ${note}; under hold it is not admitted until ${who} releases it with a reason`,
    };
  const held = { ...d, transition: null, promoted: null } as const;
  const { release } = ctx;
  if (release === undefined)
    return {
      ...held,
      decision: "ask",
      check: "review-needed",
      policy_id: SAFETY_SCAN_ID,
      reason: `held, not admitted: ${note}; item ${item.id} stays as it is until ${who} presents it again with a reason to release it; the gate otherwise allowed it (${d.policy_id}): ${d.reason}`,
    };
  // Defence in depth: through Plane.promote a non-user actor never reaches an
  // allowed procedural promotion (its replay is refused under
  // engram/promote/validation-source, a widening under widening-source or
  // reviewer), so this deny is reached only by other callers of this function,
  // as reviewerProblem's membership line is (card RV7, RV-CORE-9).
  const problem =
    actor.source !== "user"
      ? `${actor.id} acts with source ${actor.source ?? "none"}; only a user-sourced actor may release the safety scan's hold`
      : ownRelease(actor, item, ctx.target)
        ? null
        : reviewerProblem(actor, item, ctx.target, ctx.authors());
  if (problem)
    return {
      ...held,
      decision: "deny",
      check: "reviewer",
      policy_id: SAFETY_SCAN_ID,
      reason: `the safety scan's hold is not released: ${problem}; ${who} may release it; ${note}`,
    };
  return {
    ...d,
    reason: `${d.reason}; ${note}; released by ${actor.id}, acting as user: ${release.trim()}`,
  };
}

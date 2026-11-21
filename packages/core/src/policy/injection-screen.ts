// The deterministic injection screen (card E2.10, ADR 0039): weighted rules
// that read a write's content for an instruction addressed to the agent, a
// default and a hardened profile, and a threshold at or above which the gate
// holds the write as a candidate (evaluate.ts) and the deterministic lint
// `injection-signature` flags a stored item (lint/det.ts). Pure: no clock, no
// randomness, no model, no store. It is a floor with a measured escape rate
// and false-hold rate (research/results/h1-injection-screen.json), never a
// defence: a careful attacker writes around any regular expression, and the
// patterns are English.
//
// Absorbed (ADR 0037, docs/absorbed.md):
//
// - Copied from joshuaswarren/remnic, commit
//   ce22909cc219e36d0e31b1158a4ab74f175008a0,
//   packages/remnic-core/src/security/injection-screen.ts, MIT License,
//   Copyright (c) 2025 Joshua Warren (NOTICE): the weighted-rule design and
//   its threshold of 4; the two readings of invisible formatting and the
//   whitespace folding (`normalised`); the imperative-to-agent and
//   ignore-previous patterns; the encoded-blob patterns. Changed here:
//   Remnic's own tool names (its authority-escalation pattern) and its CANARY
//   terms are removed with the rules that carried them (tool-invocation,
//   conditional-trigger, response-control, tool-routing); the
//   imperative-to-agent separator no longer takes a full stop or a hyphen
//   and its bare "to" is dropped ("the model. Use", "model-run", "the model
//   to use" are prose); imperative-to-agent reads only the kinds a person
//   did not type (a person addressing their own assistant is how a memory is
//   written, decision of 2026-11-21); ignore-previous also takes "any", "all
//   of", "your" and "the ... above"; no finding carries an excerpt (ADR
//   0039, item 4).
// - Copied from OWASP/www-project-agent-memory-guard, commit
//   b052787cc3426ff5f5f7e8e0eecb514052a168ba, Apache License 2.0,
//   Copyright 2026 OWASP Foundation (NOTICE): the pattern text of
//   src/agent_memory_guard/detectors/injection.py (authority-escalation:
//   its patterns other than the ignore family, with word boundaries added
//   around "you are now"'s targets), memory_persistence_injection.py
//   (memory-persistence; "^\s*" became "^[ \t]*", which the timeout test
//   showed quadratic on a run of newlines) and standing_directive.py
//   (standing-directive), with the latter two's condition that only
//   content from a source the user does not control is screened.
// - Copied from Mnemowall/mnemowall-sdk, commit
//   37da9daecadc127667cd436ca421d4361fe7a03e, Apache License 2.0,
//   Copyright 2026 The Mnemowall Authors (NOTICE): the pattern text of
//   packages/python/src/mnemowall/signals/s3_sinks.py (exfil-sink: image
//   URLs with a query, credential paths, download-and-run shell commands,
//   screened only from untrusted sources as Mnemowall's are) and s4_obfuscation.py
//   (obfuscation: tag characters, bidi controls, invisible characters inside
//   a word, mixed-script words, short base64 that decodes to readable text;
//   and the hash-length exception for hex runs) and its NFKC fold. Changed
//   here: hex runs weigh 2 under default (Mnemowall's own risk for them is
//   0.4), and encoded-blob skips SSH public keys, media data URIs and JWTs
//   (decision of 2026-11-21).
import type { MemoryItem, Policy, Provenance } from "../schema.ts";

type ProvenanceKind = Provenance["kind"];

export type ScreenProfile = "default" | "hardened";

/** The rule id a held write's event names. */
export const INJECTION_SCREEN_ID = "engram/write/injection-screen";

/** A score at or above this holds the write (Remnic's threshold). */
export const SCREEN_THRESHOLD = 4;

/**
 * The most characters a rule screens. A longer reading fails closed: the
 * write is held rather than screened in part. Every rule's timeout test runs
 * its adversarial inputs at this length (ADR 0039, item 6).
 */
export const SCREEN_BOUND = 100_000;

/**
 * The kinds a person did not type (ADR 0039, item 5). The kind-conditioned
 * rules read only these; user and import content is a person's own word.
 */
export const SCREENED_KINDS: ReadonlySet<ProvenanceKind> = new Set<ProvenanceKind>([
  "external",
  "tool",
  "document",
  "model",
  "compaction",
]);

/** One pattern of a rule: the length of its first match in `text`, or null. */
export interface ScreenSignal {
  id: string;
  weight: Record<ScreenProfile, number>;
  find: (text: string) => number | null;
}

export interface ScreenRule {
  id: string;
  /** `screened`: only for the kinds a person did not type; `all`: every kind. */
  kinds: "all" | "screened";
  /** `normalised` reads the folded readings; `raw` reads the text as written (the obfuscation signals). */
  reads: "normalised" | "raw";
  /** The most characters the rule reads; more fails closed. */
  bound: number;
  signals: readonly ScreenSignal[];
}

export interface ScreenHit {
  rule: string;
  signal: string;
  weight: number;
  /** The match's length in characters; never its text. */
  length: number;
}

export interface ScreenResult {
  profile: ScreenProfile;
  score: number;
  hits: ScreenHit[];
  /** The first rule that threw or was given more than its bound; it holds the write. */
  failure: { rule: string; why: string } | null;
  held: boolean;
}

const both = (w: number) => ({ default: w, hardened: w });
const graded = { default: 2, hardened: 4 };

/** A signal from a pattern; a global or sticky flag is refused, since `exec` state would leak between calls. */
function pattern(id: string, weight: Record<ScreenProfile, number>, re: RegExp): ScreenSignal {
  if (re.global || re.sticky) throw new Error(`signal ${id}: a stateless pattern, please`);
  return { id, weight, find: (text) => re.exec(text)?.[0].length ?? null };
}

// Remnic's verb list for an imperative addressed to the agent.
const AGENT_VERBS =
  "ignore|disregard|call|run|execute|send|delete|reveal|email|store|remember|follow|use|do|answer|respond|reply|emit|output|return|include|produce|say";

const IMPERATIVE_TO_AGENT: ScreenRule = {
  id: "imperative-to-agent",
  kinds: "screened",
  reads: "normalised",
  bound: SCREEN_BOUND,
  signals: [
    pattern(
      "addressed",
      both(4),
      new RegExp(
        String.raw`\b(?:agent|assistant|ai|model)[ \t]{0,8}[,!:][ \t]{0,8}(?:please[ \t]{1,8})?(?:${AGENT_VERBS})\b`,
        "i",
      ),
    ),
    pattern(
      "obliged",
      both(4),
      new RegExp(
        String.raw`\b(?:agent|assistant|ai|model)[ \t]{1,8}(?:must|should|need to|please)[ \t]{1,8}(?:${AGENT_VERBS})\b`,
        "i",
      ),
    ),
  ],
};

const IGNORE_PREVIOUS: ScreenRule = {
  id: "ignore-previous",
  kinds: "all",
  reads: "normalised",
  bound: SCREEN_BOUND,
  signals: [
    pattern(
      "reset",
      both(4),
      /\b(?:ignore|disregard|skip|forget|dismiss)\s+(?:(?:all|any)\s+(?:of\s+)?)?(?:the\s+|your\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|directions?|rules?|messages?|context)\b/i,
    ),
    pattern(
      "above",
      both(4),
      /\b(?:ignore|disregard|forget|dismiss)\s+(?:(?:all|any)\s+(?:of\s+)?)?(?:the\s+|your\s+)?(?:instructions?|directions?|rules?)\s+above\b/i,
    ),
    pattern(
      "do-not-follow",
      both(4),
      /\b(?:do\s+not|don't)\s+(?:follow|obey)\s+(?:the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|rules?|directions?)\b/i,
    ),
  ],
};

const AUTHORITY_ESCALATION: ScreenRule = {
  id: "authority-escalation",
  kinds: "all",
  reads: "normalised",
  bound: SCREEN_BOUND,
  signals: [
    pattern(
      "you-are-now",
      both(4),
      /\byou are now\b[\s\S]{0,40}?\b(?:dan|jailbroken|admin|root|developer mode)\b/i,
    ),
    pattern("system-prefix", both(4), /\bsystem\s*[:-]\s*you (?:are|must|will)\b/i),
    pattern("role-tag", both(4), /<\/?\s*(?:system|assistant|tool)\s*>/i),
    pattern("act-as", both(4), /\bact as (?:an? )?(?:admin|root|system|developer|unrestricted)\b/i),
    pattern(
      "reveal",
      both(4),
      /\b(?:reveal|print|leak|dump|exfiltrate)\s+(?:the\s+)?(?:system\s+)?(?:prompt|instructions|secrets|api[_\s-]?key)\b/i,
    ),
    pattern("new-instructions", both(4), /\bnew (?:instructions|directive|persona)\s*[:-]/i),
    pattern("override-safety", both(4), /\boverride\s+(?:safety|security|guardrails|policy)\b/i),
    pattern("system-override", both(4), /\bsystem\s+override\s*[:-]/i),
  ],
};

const STANDING_DIRECTIVE: ScreenRule = {
  id: "standing-directive",
  kinds: "screened",
  reads: "normalised",
  bound: SCREEN_BOUND,
  signals: [
    pattern(
      "future-scope",
      graded,
      /\b(?:from\s+now\s+on|going\s+forward|henceforth|in\s+(?:all\s+)?(?:future|later|subsequent)\s+(?:conversations?|sessions?|turns?|replies|answers|chats?))\b/i,
    ),
    pattern(
      "always-never",
      graded,
      /\b(?:always|never)\s+(?:recommend|suggest|use|choose|pick|prefer|send|forward|open|share|trust|approve|pay|transfer|click|run|install|mention|say|reply|answer|cc|bcc)\b/i,
    ),
    pattern(
      "whenever-user",
      graded,
      /\bwhenever\s+(?:the\s+)?user\s+(?:asks?|mentions?|requests?|says?|wants?|needs?)\b/i,
    ),
    pattern(
      "user-trust-claim",
      graded,
      /\b(?:the\s+)?user\s+(?:trusts|has\s+(?:already\s+)?(?:approved|authori[sz]ed|allow-?listed|whitelisted|verified)|(?:wants|prefers)\s+(?:them|it|these|those|links?|files?|attachments?)\s+(?:to\s+be\s+)?opened)\b/i,
    ),
    pattern(
      "without-confirmation",
      graded,
      /\bwithout\s+(?:asking|confirmation|confirming|checking|verification|verifying|warning|prompting)\b/i,
    ),
    pattern(
      "payment-change",
      graded,
      /\b(?:new|updated|changed|correct|current)\s+(?:payment|bank(?:ing)?|wire|billing|iban|routing|payout|wallet)\s+(?:details|address|number|account|info(?:rmation)?|instructions?)\b/i,
    ),
  ],
};

const MEMORY_PERSISTENCE: ScreenRule = {
  id: "memory-persistence",
  kinds: "screened",
  reads: "normalised",
  bound: SCREEN_BOUND,
  signals: [
    pattern(
      "ignore-then-persist",
      both(4),
      /\bignore\s+(?:previous|prior|all|earlier)\s+(?:instructions?|prompts?|rules?)\b[^.]{0,80}\b(?:once\s+stored|after\s+saving|when\s+persisted|in\s+future\s+turns?|from\s+now\s+on)\b/i,
    ),
    pattern(
      "store-as-system",
      both(4),
      /\b(?:store|save|persist|remember|memorize)\s+(?:this|the\s+following)\s+as\s+(?:a\s+)?(?:system|root|admin)\s+(?:instruction|prompt|directive)\b/i,
    ),
    pattern(
      "persist-tag",
      both(4),
      /\[(?:SYSTEM[-_\s]?MEMORY[-_\s]?PERSIST|MEMORY[-_\s]?PERSIST|PERSIST[-_\s]?INSTRUCTION|REMEMBER[-_\s]?ALWAYS)\]/,
    ),
    pattern(
      "chained-memory-keys",
      both(4),
      /\[user_memory\s*=\s*[^\]]{5,200}\]\s*\[user_memory\s*=/,
    ),
    pattern(
      "role-line",
      both(4),
      /^[ \t]*(?:SYSTEM|ASSISTANT|DEVELOPER|ROOT)[ \t]*[:>][^.]{0,200}\b(?:you\s+are|act\s+as|pretend\s+to\s+be|from\s+now\s+on)\b/im,
    ),
  ],
};

/** A hex run, bare or `0x`-prefixed: hex-run judges it, base64-run leaves it alone. */
const HEX = /^(?:0x)?[0-9a-fA-F]+$/;
const BASE64_RUN = /[A-Za-z0-9+/]{121,}={0,2}/g;
/**
 * The tokens a blob can sit in, one pass and disjoint: base64, base64url, and
 * the separators of a data URI and a JWT. Each token is judged whole, by
 * anchored patterns, so no exemption scans past its own token.
 */
const TOKEN = /[A-Za-z0-9+/=_.:;,-]+/g;
/** A JWT: three base64url segments, the first two JSON objects (`eyJ` is `{"`). */
const JWT = /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
/** A data URI of an image, font, audio or video; a text payload is not exempt. */
const MEDIA_DATA_URI =
  /^data:(?:image|font|audio|video)\/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/i;
/** An SSH public key's body (the wire format starts `AAAA`), after its key type and a space. */
const SSH_KEY_BODY = /^AAAA[A-Za-z0-9+/]+={0,3}$/;
const SSH_KEY_TYPE =
  /(?:^|\s)(?:ssh-(?:rsa|ed25519|dss)|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com)[ \t]+$/;

/** A token encoded-blob leaves alone: an SSH public key, a media data URI or a JWT (decision of 2026-11-21). */
function benignEncoding(text: string, token: string, at: number): boolean {
  return (
    JWT.test(token) ||
    MEDIA_DATA_URI.test(token) ||
    (SSH_KEY_BODY.test(token) && SSH_KEY_TYPE.test(text.slice(Math.max(0, at - 48), at)))
  );
}

const ENCODED_BLOB: ScreenRule = {
  id: "encoded-blob",
  kinds: "all",
  reads: "normalised",
  bound: SCREEN_BOUND,
  signals: [
    // Longer than a SHA-512 digest (128 hex characters, Mnemowall's exception).
    pattern("hex-run", graded, /[0-9a-fA-F]{129,}/),
    {
      id: "base64-run",
      weight: both(5),
      find: (text) => {
        for (const token of text.matchAll(TOKEN)) {
          if (token[0].length < 121 || benignEncoding(text, token[0], token.index)) continue;
          for (const m of token[0].matchAll(BASE64_RUN)) if (!HEX.test(m[0])) return m[0].length;
        }
        return null;
      },
    },
  ],
};

const EXFIL_SINK: ScreenRule = {
  id: "exfil-sink",
  kinds: "screened",
  reads: "normalised",
  bound: SCREEN_BOUND,
  signals: [
    {
      id: "image-beacon",
      weight: graded,
      find: (text) =>
        /!\[[^\]\n]{0,500}\]\(\s*<?[^\s)>?]{0,2000}\?[^\s)>]/.exec(text)?.[0].length ??
        /<img\b[^>\n]{0,500}?\bsrc\s*=\s*["']?[^"'\s>?]{0,2000}\?[^"'\s>]/i.exec(text)?.[0]
          .length ??
        null,
    },
    pattern(
      "credential-path",
      graded,
      /(?:[/\\]\.(?:ssh|aws|gnupg|kube|docker|azure)[/\\]|\bid_(?:rsa|dsa|ecdsa|ed25519)\b|\.(?:netrc|pgpass|npmrc|pypirc|git-credentials)\b|\/etc\/(?:shadow|passwd|sudoers)\b|\bcredentials\.json\b|\bservice[-_]?account[\w.-]{0,100}\.json\b|\bwallet\.dat\b)/i,
    ),
    pattern(
      "download-and-run",
      graded,
      /(?:\b(?:curl|wget)\b[^\n|]{0,300}\|[ \t]*(?:sudo[ \t]+)?(?:ba|z|da|k)?sh\b|\bbash[ \t]+-i\b|\/dev\/tcp\/|\b(?:nc|ncat|netcat)\b[^\n]{0,60}[ \t]-e[ \t]|\bpowershell(?:\.exe)?\b[^\n]{0,80}[ \t]-(?:e|en|enc|encodedcommand)\b|\b(?:iex|invoke-expression)\b|\binvoke-webrequest\b|\bbase64[ \t]+(?:-d|--decode)\b[^\n]{0,80}\|[ \t]*(?:ba)?sh\b|\bcertutil\b[^\n]{0,40}-urlcache\b|\bchmod[ \t]+\+x\b)/i,
    ),
  ],
};

/** A word's letters in a confusable script other than Latin (Mnemowall's set, Latin aside). */
const CONFUSABLE = /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}\p{Script=Cherokee}]/u;
const LATIN = /\p{Script=Latin}/u;
const B64_CANDIDATE = /[A-Za-z0-9+/]{16,}={0,2}/g;
const MAX_CANDIDATES = 20;
const MAX_DECODE = 4096;

/** Decoded bytes that read as a sentence: printable ASCII, at least two spaces, mostly letters (Mnemowall). */
function readable(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  let spaces = 0;
  let letters = 0;
  for (const b of bytes) {
    if (b === 0x20) spaces++;
    else if ((b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a)) letters++;
    else if (!(b > 0x20 && b < 0x7f) && b !== 0x0a && b !== 0x09) return false;
  }
  return spaces >= 2 && letters >= 0.6 * bytes.length;
}

const B64_ALPHABET = /^[A-Za-z0-9+/]*$/;

function decodeBase64(blob: string): Uint8Array | null {
  const body = blob.replace(/=+$/, "");
  if (!B64_ALPHABET.test(body) || body.length % 4 === 1) return null;
  const binary = atob(body + "=".repeat((4 - (body.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const OBFUSCATION: ScreenRule = {
  id: "obfuscation",
  kinds: "all",
  reads: "raw",
  bound: SCREEN_BOUND,
  signals: [
    pattern("tag-characters", both(4), /[\u{E0000}-\u{E007F}]/u),
    pattern("bidi-control", graded, /[\u202A-\u202E\u2066-\u2069\u061C]/),
    pattern(
      "invisible-in-word",
      graded,
      /\p{L}(?:\u200B|\u200C|\u200D|\u2060|\uFEFF|\u00AD){1,16}\p{L}/u,
    ),
    {
      id: "mixed-script",
      weight: graded,
      find: (text) => {
        // One pass, word by word: a word mixing Latin with a look-alike script.
        let latin = false;
        let other = false;
        let start = 0;
        for (let i = 0; i <= text.length; i++) {
          const ch = i < text.length ? text[i] : " ";
          if (ch === undefined || /[\s\p{P}]/u.test(ch)) {
            if (latin && other) return i - start;
            latin = false;
            other = false;
            start = i + 1;
            continue;
          }
          if (!latin && LATIN.test(ch)) latin = true;
          else if (!other && CONFUSABLE.test(ch)) other = true;
        }
        return null;
      },
    },
    {
      id: "encoded-text",
      weight: graded,
      find: (text) => {
        let n = 0;
        for (const m of text.matchAll(B64_CANDIDATE)) {
          if (++n > MAX_CANDIDATES) break;
          const bytes = decodeBase64(m[0].slice(0, MAX_DECODE));
          if (bytes && readable(bytes)) return m[0].length;
        }
        return null;
      },
    },
  ],
};

/** The rules, in the order they run and a reason names them. */
export const SCREEN_RULES: readonly ScreenRule[] = [
  IMPERATIVE_TO_AGENT,
  IGNORE_PREVIOUS,
  AUTHORITY_ESCALATION,
  STANDING_DIRECTIVE,
  MEMORY_PERSISTENCE,
  ENCODED_BLOB,
  EXFIL_SINK,
  OBFUSCATION,
];

// Remnic's normaliser: invisible formatting is ambiguous (deleted inside a
// word, a space between words), so both readings are screened and a rule
// fires if it fires on either; non-ASCII spaces and ASCII space runs fold to
// one space; newlines survive. Mnemowall's NFKC fold comes first, so
// full-width and compatibility letters read as ASCII.
// U+034F (combining grapheme joiner) and U+180E join the class as alternatives:
// a combining mark inside a character class is one biome refuses (review E2.10-5).
const INVISIBLE_FORMATTING = /[\u00AD\u180E\u200B-\u200F\u2060\u2028\u2029\uFEFF]|\u034F/g;
const NON_ASCII_SPACE_LIKE = /[\f\v\u0085\u1680\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const ASCII_SPACE_RUN = /[ \t]{2,}/g;

/** The readings a normalised rule screens. */
export function normalised(raw: string): readonly string[] {
  const text = raw.normalize("NFKC");
  const spaced = text
    .replace(NON_ASCII_SPACE_LIKE, " ")
    .replace(INVISIBLE_FORMATTING, " ")
    .replace(ASCII_SPACE_RUN, " ");
  const deleted = text
    .replace(INVISIBLE_FORMATTING, "")
    .replace(NON_ASCII_SPACE_LIKE, " ")
    .replace(ASCII_SPACE_RUN, " ");
  return spaced === deleted ? [spaced] : [spaced, deleted];
}

/**
 * An item's content as the screen reads it: a string as it is; a record or
 * procedural content as `key: value` lines, nested values in order, as
 * OWASP's `_stringify` does. Iterative, so no depth of nesting overflows
 * the stack; a cycle throws (the screen then fails closed: screenContent).
 */
export function contentText(content: unknown): string {
  const out: string[] = [];
  const stack: { value: unknown; prefix: string }[] = [{ value: content, prefix: "" }];
  const seen = new WeakSet<object>();
  while (stack.length > 0) {
    const { value, prefix } = stack.pop() as { value: unknown; prefix: string };
    if (value !== null && typeof value === "object") {
      if (seen.has(value)) throw new TypeError("the content refers to itself");
      seen.add(value);
    }
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--)
        stack.push({ value: value[i], prefix: i === 0 ? prefix : "" });
    } else if (value !== null && typeof value === "object") {
      const entries = Object.entries(value);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [k, v] = entries[i] as [string, unknown];
        stack.push({ value: v, prefix: `${prefix}${k}: ` });
      }
    } else out.push(`${prefix}${value === null || value === undefined ? "" : String(value)}`);
  }
  return out.join("\n");
}

/**
 * Screens `text` as content of provenance `kind` under `profile`. A rule
 * that throws, or whose reading is longer than its bound, stops the screen
 * and holds: failure is closed (ADR 0039, item 6). `rules` is the table, for
 * tests that inject a failing rule.
 */
export function screenText(
  text: string,
  kind: ProvenanceKind,
  profile: ScreenProfile,
  rules: readonly ScreenRule[] = SCREEN_RULES,
): ScreenResult {
  let readings: Record<ScreenRule["reads"], readonly string[]>;
  try {
    readings = { raw: [text], normalised: normalised(text) };
  } catch (e) {
    return fail(profile, [], "normalisation", `threw ${errorName(e)}`);
  }
  const hits: ScreenHit[] = [];
  for (const rule of rules) {
    if (rule.kinds === "screened" && !SCREENED_KINDS.has(kind)) continue;
    const texts = readings[rule.reads];
    const longest = Math.max(...texts.map((t) => t.length));
    if (longest > rule.bound)
      return fail(
        profile,
        hits,
        rule.id,
        `${longest} characters exceed its bound of ${rule.bound}`,
      );
    try {
      for (const signal of rule.signals)
        for (const t of texts) {
          const length = signal.find(t);
          if (length !== null) {
            hits.push({ rule: rule.id, signal: signal.id, weight: signal.weight[profile], length });
            break;
          }
        }
    } catch (e) {
      return fail(profile, hits, rule.id, `threw ${errorName(e)}`);
    }
  }
  const score = hits.reduce((s, h) => s + h.weight, 0);
  return { profile, score, hits, failure: null, held: score >= SCREEN_THRESHOLD };
}

/** An error's class name, never its message, which may quote the content. */
const errorName = (e: unknown): string => (e instanceof Error ? e.constructor.name : typeof e);

function fail(profile: ScreenProfile, hits: ScreenHit[], rule: string, why: string): ScreenResult {
  const score = hits.reduce((s, h) => s + h.weight, 0);
  return { profile, score, hits, failure: { rule, why }, held: true };
}

/**
 * Screens content of provenance `kind`: its text (contentText), then the
 * rules. Content whose text cannot be read (a cycle) fails closed.
 */
export function screenContent(
  content: unknown,
  kind: ProvenanceKind,
  profile: ScreenProfile,
  rules: readonly ScreenRule[] = SCREEN_RULES,
): ScreenResult {
  let text: string;
  try {
    text = contentText(content);
  } catch (e) {
    return fail(profile, [], "content-text", `threw ${errorName(e)}`);
  }
  return screenText(text, kind, profile, rules);
}

/** Screens an item's content under its own provenance kind. */
export function screenItem(item: MemoryItem, profile: ScreenProfile): ScreenResult {
  return screenContent(item.content, item.provenance.kind, profile);
}

/** The profile a policy's gate stage screens with, or null when the stage is off. */
export function screenProfile(policy: Policy): ScreenProfile | null {
  const mode = policy.content_guards?.injection_screen;
  return mode === "default" || mode === "hardened" ? mode : null;
}

/** What the screen found, in words: each hit as rule/signal with its weight and length; no character of the content. */
export function describeScreen(result: ScreenResult): string {
  const head = `the injection screen (${result.profile} profile, a deterministic floor)`;
  const found = result.hits.map(
    (h) => `${h.rule}/${h.signal} (weight ${h.weight}, ${h.length} characters)`,
  );
  if (result.failure)
    return `${head} fails closed: rule ${result.failure.rule} ${result.failure.why}${found.length > 0 ? `; before it, ${found.join(", ")}` : ""}`;
  return `${head} scores ${result.score} at threshold ${SCREEN_THRESHOLD}: ${found.join(", ")}`;
}

/**
 * The gate stage (evaluate.ts): the reason to hold `item` as a candidate,
 * when the policy turns the screen on and the screen holds it; else null.
 */
export function injectionHold(
  policy: Policy,
  item: MemoryItem,
  rules: readonly ScreenRule[] = SCREEN_RULES,
): string | null {
  const profile = screenProfile(policy);
  if (profile === null) return null;
  const result = screenContent(item.content, item.provenance.kind, profile, rules);
  if (!result.held) return null;
  return `${describeScreen(result)}; held as a candidate until a reviewer promotes it`;
}

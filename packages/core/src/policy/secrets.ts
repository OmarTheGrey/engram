// The secret and personal-data guard at the write gate (card E2.9, ADR 0039).
// A pure detector over a write's content, driven by one rule table, and the
// write-gate stage that reads the policy's `content_guards` block: off does
// nothing, review holds the write as a candidate (the mechanism a rule's
// `requires_review` uses), block denies it. Nothing is ever redacted or
// masked: that would change the content hash and store what the writer did
// not write. A reason names the rule's kind and the match's length, and no
// character of the value (decision 4).
//
// Two tiers. BLOCK: a recognised secret (a vendor prefix, a key block, a
// credential in a URL) or recognised personal data (a card number passing
// Luhn, an IBAN passing mod-97, a national id). REVIEW: what only looks like
// one (a high-entropy token, hexadecimal or opaque key material next to a
// credential word, a generic `password=` assignment, an email address or a
// phone number). The policy's mode is the most a match can do: under `block`
// a BLOCK-tier match denies and a REVIEW-tier match holds; under `review`
// every match holds.
//
// The table is also the redactor's (plane/bypass.ts, ADR 0014): its entries
// with a `redact` replacement are the ones bypassAttempt applies, in order,
// so there is one list to maintain (ADR 0039, Consequences).
//
// Absorbed under ADR 0037 (docs/absorbed.md has the commits; NOTICE the
// notices of the copies):
//
// - Copied from claude-mem (https://github.com/thedotmack/claude-mem),
//   src/utils/redaction.ts at commit f1bb834527637231e23575e2a70c57375efdac04,
//   Copyright 2026 Alex Newman, Apache License 2.0: the vendor pattern table
//   (BUILTIN_REDACTION_PATTERNS) and the generic keyed patterns
//   (GENERIC_REDACTION_PATTERNS, with keyedLookbehind, GENERIC_VALUE and the
//   bounded whitespace), and the 1M-character scan cap that fails closed.
//   Modified: names in kebab case, patterns that a claude-mem product key or
//   a JSON-escaped capture needed left out, the url and cookie patterns
//   replaced (below), no replacement markers.
// - Copied from walrus-memory (https://github.com/MystenLabs/walrus-memory),
//   services/server/scripts/mcp/tools/redaction.ts at commit
//   856fb01793fdb4301cc1b1a9c8673c4c55595f08, Apache License 2.0: refusing
//   instead of redacting and reporting kinds only; the backtracking bounds of
//   URL_USERINFO (the scheme capped at 30 characters, no `?`, `=` or `&` in
//   the userinfo); the label-gated hexadecimal and opaque key-material rules
//   (HEX_RUN, HEX_CREDENTIAL_LABEL, HEX_LABEL_AFTER, the 48-character window,
//   OPAQUE_RUN with looksLikeOpaqueToken); the seed-phrase rule; and the
//   shape guard of the high-entropy rule (mixed case and a digit, not hex).
// - Copied from graphCTX (https://github.com/coder-company/graphCTX),
//   src/security/secrets.ts at commit c74644cd1808aef35fb8aa0e4368d0dba76f086d,
//   Copyright (c) 2026 coder-company, MIT License: shannonEntropy,
//   isBenignOpaqueToken and the high-entropy token rule (24 characters,
//   entropy above 4.0, a letter and a digit), and the credential words of its
//   hex-in-context rule, added to walrus' label.
// - Ported from Hindsight (https://github.com/vectorize-io/hindsight),
//   hindsight-api-slim/hindsight_api/extensions/memory_defense.py at commit
//   62a03bfc96f175e9ac155acc72f292bed9ac4449, MIT License: ASCII token
//   lookarounds instead of `\b`, so a key beside CJK text is found; the Luhn
//   check rejecting a single repeated digit; a card number inside a UUID is
//   not a card.
// - Ported from caura (https://github.com/caura-ai/caura),
//   common/governance/pii_patterns.py at commit
//   7004f65dce8f1f39b4f58da161661865b4ffff4d, Apache License 2.0: the
//   personal-data table as data (email, phone, payment card, IBAN, US SSN
//   and ITIN, UK National Insurance number, Spanish DNI), its validators
//   (Luhn, ISO 13616 mod-97, the UK number length, the DNI check letter),
//   its severities as tiers (high is BLOCK, low and medium are REVIEW), the
//   upper-case environment-variable rule, and overlap resolution.
// - Ported from gitleaks (https://github.com/gitleaks/gitleaks), see
//   ../vendor/gitleaks-rules.ts, which scripts/gitleaks-rules.ts generates.

import { canonicalJson } from "../model.ts";
import type { MemoryItem, Policy } from "../schema.ts";
import { GITLEAKS_ALLOW, GITLEAKS_RULES, type GitleaksAllow } from "../vendor/gitleaks-rules.ts";
import type { WriteDecision } from "./evaluate.ts";

/** A guard's rule ids (ADR 0039). */
export const SECRET_ID = "engram/write/secret";
export const PII_ID = "engram/write/pii";
export const CONTENT_SIZE_ID = "engram/write/content-size";
export const GUARD_FAILURE_ID = "engram/write/guard-failure";

/**
 * Content longer than this, in UTF-16 code units, is not scanned: with a guard
 * on, it is held as a candidate (decision 6; claude-mem's cap, which fails
 * closed the same way). Every rule is timed on inputs far below it, and the
 * work per rule is linear, so the bound keeps one write's scan bounded.
 */
export const SCAN_LIMIT = 1024 * 1024;

export type GuardName = "secrets" | "pii";
export type Tier = "block" | "review";

/** One rule of the guard: where it matches, what the value is, and what must hold of it. */
export interface GuardRule {
  /** `secret/<name>` or `pii/<name>`; what a reason names. */
  kind: string;
  guard: GuardName;
  tier: Tier;
  /** Compiled with the `g` and `d` flags. */
  pattern: RegExp;
  /** The capture group holding the value: a number, or `first` for the first non-empty group; else the match. */
  group?: number | "first";
  /** The rule runs only on content whose lower case holds one of these. */
  keywords?: readonly string[];
  /** The value's Shannon entropy must exceed this. */
  entropy?: number;
  /** What must hold of the value, given the content and the value's span. */
  validate?: (value: string, text: string, start: number, end: number) => boolean;
}

/** An entry of the one table: a guard rule, a redaction for plane/bypass.ts, or both. */
export interface TableEntry {
  kind: string;
  pattern: RegExp;
  /** The replacement bypassAttempt makes; `$1` keeps the name or flag before the value. */
  redact?: string;
  rule?: GuardRule;
}

/** One match: the rule's kind, guard and tier, and the value's span. Never the value. */
export interface Finding {
  kind: string;
  guard: GuardName;
  tier: Tier;
  start: number;
  end: number;
}

// ---------------------------------------------------------------------------
// Validators and measures.

/** Shannon entropy in bits per character (graphCTX). */
export function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  const n = [...s].length;
  let h = 0;
  for (const c of freq.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * The Luhn checksum over the digits of `value` (caura, Hindsight): at least
 * 13 digits, not one digit repeated (a placeholder of zeroes passes Luhn).
 */
export function luhn(value: string): boolean {
  const digits = [...value].filter((c) => c >= "0" && c <= "9").map(Number);
  if (digits.length < 13 || new Set(digits).size === 1) return false;
  let sum = 0;
  for (const [i, d] of digits.reverse().entries()) {
    const twice = d * 2;
    sum += i % 2 === 1 ? (twice > 9 ? twice - 9 : twice) : d;
  }
  return sum % 10 === 0;
}

/**
 * ISO 13616 mod-97 (caura): 15 to 34 characters once spaces go, the first
 * four moved to the end, letters as 10 to 35, the number congruent to 1.
 */
export function ibanMod97(value: string): boolean {
  const s = value.replace(/\s/g, "").toUpperCase();
  if (s.length < 15 || s.length > 34) return false;
  let rem = 0;
  for (const ch of s.slice(4) + s.slice(0, 4)) {
    if (ch >= "0" && ch <= "9") rem = (rem * 10 + Number(ch)) % 97;
    else if (ch >= "A" && ch <= "Z") rem = (rem * 100 + ch.charCodeAt(0) - 55) % 97;
    else return false;
  }
  return rem === 1;
}

const digitCount = (s: string) => [...s].filter((c) => c >= "0" && c <= "9").length;

/** A UK national number, leading 0 included, is 10 or 11 digits (caura). */
const ukLength = (v: string) => digitCount(v) === 10 || digitCount(v) === 11;

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
/** The Spanish DNI check letter is DNI_LETTERS[number % 23] (caura). */
const dniLetter = (v: string) =>
  v.at(-1)?.toUpperCase() === DNI_LETTERS[Number(v.slice(0, 8)) % 23];

/** graphCTX: a version assignment or a subresource-integrity hash is not a secret. */
function isBenignOpaqueToken(s: string): boolean {
  return (
    /^[A-Za-z_][A-Za-z0-9_]*=\d+(?:\.\d+)+(?:[-+][A-Za-z0-9.]+)?$/.test(s) ||
    /^sha\d+-[A-Za-z0-9+/=]{8,}$/i.test(s)
  );
}

/** walrus: a generated credential is mixed case, or carries digits, or base64 padding and separators. */
function looksLikeOpaqueToken(token: string): boolean {
  const lower = /[a-z]/.test(token);
  const upper = /[A-Z]/.test(token);
  return (lower && upper) || /[0-9]/.test(token) || /[+/=]/.test(token);
}

// walrus: words that make an adjacent hex or opaque run key material, searched
// in the 48 characters before it, or in the joining phrase after it.
// graphCTX's `token`, `password` and `passwd` are added; `credential` stays
// out, as walrus leaves it out (a file name like credentials.json is prose).
const LABEL_WINDOW = 48;
const CREDENTIAL_LABEL =
  /private[\s_-]*key|secret[\s_-]*key|delegate[\s_-]*key|delegate[\s_-]*private|signing[\s_-]*key|priv[\s_-]*key|encryption[\s_-]*keys?(?![A-Za-z0-9])|enc[\s_-]*keys?(?![A-Za-z0-9])|api[\s_-]*key|access[\s_-]*key|auth[\s_-]*key|db[\s_-]*pass(?:word)?s?(?![A-Za-z0-9])|secret|seed|mnemonic|passphrase|token|passw(?:or)?d/i;
const LABEL_AFTER =
  /^[^A-Za-z0-9]{0,4}(?:is|was)?[^A-Za-z0-9]{0,4}(?:my|the|our|his|her|their)?[^A-Za-z0-9]{0,4}(?:delegate[\s_-]*)?(?:private[\s_-]*key|secret[\s_-]*key|priv[\s_-]*key|encryption[\s_-]*keys?(?![A-Za-z0-9])|enc[\s_-]*keys?(?![A-Za-z0-9])|seed|mnemonic|passphrase|api[\s_-]*key|db[\s_-]*pass(?:word)?s?(?![A-Za-z0-9]))/i;

function labelled(text: string, start: number, end: number): boolean {
  return (
    CREDENTIAL_LABEL.test(text.slice(Math.max(0, start - LABEL_WINDOW), start)) ||
    LABEL_AFTER.test(text.slice(end, end + LABEL_WINDOW))
  );
}

// ---------------------------------------------------------------------------
// The table.

const rx = (pattern: RegExp) =>
  new RegExp(pattern.source, `${pattern.flags.replace(/[gd]/g, "")}gd`);

// Hindsight: ASCII token boundaries, so a key beside CJK text is found and a
// partial ASCII token is not.
const START = "(?<![A-Za-z0-9_])";
const END = "(?![A-Za-z0-9_])";
const token = (body: string, flags = "") => new RegExp(`${START}${body}${END}`, `${flags}gd`);

// claude-mem's generic value: eight value-class characters and one letter, so
// a number (`max_tokens=4096`) or a short word never counts; the class stops at
// whitespace, quotes and angle brackets.
const GENERIC_VALUE_CLASS = String.raw`[A-Za-z0-9_.\-+/=~@#$%^*!?]`;
const GENERIC_VALUE = `(?=${GENERIC_VALUE_CLASS}{8})${GENERIC_VALUE_CLASS}*[A-Za-z]${GENERIC_VALUE_CLASS}*`;
const OPTIONAL_QUOTE = String.raw`(?:\\{0,3}["'])?`;
// Bounded on purpose (claude-mem): an unbounded `\s*` in a lookbehind
// rescans the whole run at every position in it.
const BOUNDED_SPACE = String.raw`\s{0,8}`;
const keyedLookbehind = (key: string) =>
  `(?<=${key}${OPTIONAL_QUOTE}${BOUNDED_SPACE}[=:]${BOUNDED_SPACE}${OPTIONAL_QUOTE})`;
const BARE_TOKEN_KEY = "(?:token|secret|api_key)";
const ESCAPED_QUOTE = String.raw`\\{0,3}["']`;
const STRING_EDGE = String.raw`(?<!\\)"`;
const ASSIGNMENT_START = String.raw`(?:^|[\s?&]|\\[nrt]|${STRING_EDGE})`;
const LINE_START = String.raw`(?:^|\n|\\n|${STRING_EDGE})[ \t]{0,8}(?:-[ \t]{1,8})?`;
const LINE_END = String.raw`(?:${ESCAPED_QUOTE})?[ \t]{0,8}(?:$|\r?\n|\\{1,3}[rn]|#|${STRING_EDGE})`;
const GENERIC_TOKEN = new RegExp(
  [
    `${keyedLookbehind(String.raw`\b\w*_${BARE_TOKEN_KEY}`)}${GENERIC_VALUE}`,
    `(?<=${ESCAPED_QUOTE}${BARE_TOKEN_KEY}${ESCAPED_QUOTE}${BOUNDED_SPACE}:${BOUNDED_SPACE}${ESCAPED_QUOTE})${GENERIC_VALUE}`,
    `(?<=${ASSIGNMENT_START}${BARE_TOKEN_KEY}=${OPTIONAL_QUOTE})${GENERIC_VALUE}(?!\\(|${GENERIC_VALUE_CLASS})`,
    String.raw`(?<=--(?:[a-z0-9]+[-_])*(?:token|secret|api[-_]key)(?:=|[ \t]{1,8})${OPTIONAL_QUOTE})${GENERIC_VALUE}`,
    `(?<=${LINE_START}${BARE_TOKEN_KEY}:[ \\t]{1,8}${OPTIONAL_QUOTE})${GENERIC_VALUE}(?=${LINE_END})`,
  ].join("|"),
  "gid",
);

const secret = (kind: string, pattern: RegExp, extra: Partial<GuardRule> = {}): GuardRule => ({
  kind: `secret/${kind}`,
  guard: "secrets",
  tier: "block",
  pattern,
  ...extra,
});
const pii = (
  kind: string,
  tier: Tier,
  pattern: RegExp,
  extra: Partial<GuardRule> = {},
): GuardRule => ({
  kind: `pii/${kind}`,
  guard: "pii",
  tier,
  pattern,
  ...extra,
});

/** The vendor table (claude-mem), with Hindsight's ASCII boundaries where claude-mem had none. */
const VENDOR: GuardRule[] = [
  secret("aws-access-key", token("(?:AKIA|ASIA)[0-9A-Z]{16}")),
  secret(
    "aws-secret-key",
    new RegExp(
      `${keyedLookbehind(String.raw`(?:aws_secret_access_key|\bSecretAccessKey)`)}[A-Za-z0-9/+=]{40}`,
      "gid",
    ),
  ),
  secret(
    "aws-session-token",
    new RegExp(
      `${keyedLookbehind(String.raw`\b(?:aws_session_token|SessionToken)`)}[A-Za-z0-9/+=]{100,}`,
      "gid",
    ),
  ),
  secret("github-token", rx(/\bgh[oprsu]_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{82}\b/g)),
  secret("openai-key", rx(/\bsk-(?!ant-)[A-Za-z0-9_-]{20,}(?!\w)/g)),
  secret("anthropic-key", rx(/\bsk-ant-[A-Za-z0-9_-]{20,}(?!\w)/g)),
  secret("slack-token", rx(/\b(?:xox[abeprs]|xapp)-[A-Za-z0-9-]{10,}(?!\w)/g)),
  secret("jwt", rx(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?!\w)/g)),
  // walrus' open form: the BEGIN line alone is enough to refuse, and a key
  // cut off before its END line is refused too.
  secret("private-key", rx(/-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY(?: BLOCK)?-----/g)),
  secret(
    "stripe-key",
    rx(/\b(?:(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{24,}|whsec_[A-Za-z0-9]{32,})\b/g),
  ),
  secret("google-api-key", rx(/\bAIza[0-9A-Za-z_-]{35}(?!\w)/g)),
  secret("google-oauth-token", rx(/\bya29\.(?:c\.)?[0-9A-Za-z_-]{20,}(?!\w)/g)),
  secret("gitlab-token", rx(/\bgl(?:pat|dt|rt)-[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]+)*(?!\w)/g)),
  secret("huggingface-token", rx(/\bhf_[A-Za-z0-9]{30,}\b/g)),
  secret("npm-token", rx(/\bnpm_[A-Za-z0-9]{36}\b/g)),
  secret("docker-pat", rx(/\bdckr_pat_[A-Za-z0-9_-]{27,}(?!\w)/g)),
  secret("linear-key", rx(/\blin_api_[A-Za-z0-9]{40}(?!\w)/g)),
  secret("notion-token", rx(/\b(?:ntn_[A-Za-z0-9]{46}|secret_[A-Za-z0-9]{43})(?!\w)/g)),
  secret("sendgrid-key", rx(/\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}(?![\w-])/g)),
  secret("digitalocean-token", rx(/\bdo[opr]_v1_[a-f0-9]{64}\b/g)),
  secret("shopify-token", rx(/\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/g)),
  secret("pypi-token", rx(/\bpypi-AgE[A-Za-z0-9_-]{50,}(?!\w)/g)),
  secret("databricks-token", rx(/\bdapi[a-f0-9]{32}(?:-\d)?(?!\w)/g)),
  secret("vault-token", rx(/\b(?:hvs\.[\w-]{90,120}|hvb\.[\w-]{138,300})(?![\w-])/g)),
  secret("nvidia-nim-key", rx(/\bnvapi-[A-Za-z0-9_-]{32,}(?!\w)/g)),
  secret("groq-key", rx(/\bgsk_[A-Za-z0-9]{52}(?!\w)/g)),
  secret("xai-key", rx(/\bxai-[A-Za-z0-9_]{80}(?!\w)/g)),
  secret("perplexity-key", rx(/\bpplx-[A-Za-z0-9]{48}(?!\w)/g)),
  secret("supabase-token", rx(/\bsbp_[a-f0-9]{40}(?!\w)/g)),
  secret(
    "sentry-token",
    rx(
      /\b(?:sntryu_[a-f0-9]{64}(?!\w)|sntrys_[A-Za-z0-9+/]{20,}={0,2}_[A-Za-z0-9+/]{43}(?![\w+/]))/g,
    ),
  ),
  secret(
    "grafana-token",
    rx(
      /\b(?:glsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8}(?!\w)|glc_[A-Za-z0-9+/]{32,400}={0,2}(?![\w+/=]))/g,
    ),
  ),
  secret("postman-key", rx(/\bPMAK-[a-f0-9]{24}-[a-f0-9]{34}(?!\w)/g)),
  secret("pulumi-token", rx(/\bpul-[a-f0-9]{40}(?!\w)/g)),
  secret("doppler-token", rx(/\bdp\.pt\.[A-Za-z0-9]{43}(?!\w)/g)),
  secret("heroku-key", rx(/\bHRKU-AA[0-9A-Za-z_-]{58}(?![\w-])/g)),
  secret("atlassian-token", rx(/\bATATT3[A-Za-z0-9_=-]{186}(?![\w=-])/g)),
  secret(
    "slack-webhook",
    rx(
      /(?<=(?:^|\/\/|@|[^\w./@%-])[hH][oO][oO][kK][sS]\.[sS][lL][aA][cC][kK]\.[cC][oO][mM]\/(?:services|workflows|triggers)\/T[A-Z0-9]+\/[A-Z0-9]+\/(?:[0-9]+\/)?)[A-Za-z0-9]{20,}(?!\w)/g,
    ),
  ),
  secret(
    "discord-webhook",
    rx(
      /(?<=(?:^|\/\/|@|[^\w./@%-])(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/[0-9]{17,20}\/)[A-Za-z0-9_-]{60,}(?![\w-])/gi,
    ),
  ),
  // walrus' URL_USERINFO with its bounds: the password of `scheme://user:password@`.
  secret(
    "url-credentials",
    rx(/([A-Za-z][A-Za-z0-9+.-]{0,30}:\/\/)([^\s/@:?=&]+):([^\s/@?=&]+)@/g),
    {
      group: 3,
      // A `${DB_PASS}` placeholder or an earlier marker is not a password (claude-mem).
      validate: (v) => !/^[$<{]/.test(v),
    },
  ),
  // walrus: a BIP-39 mnemonic, gated on the label naming it.
  secret(
    "seed-phrase",
    rx(
      /(?:\b|(?<=[a-z]))((?:seed|recovery|secret|mnemonic)[\s_-]*(?:phrase|words)|mnemonic)([^A-Za-z0-9]{0,4}(?:is|are)?[^A-Za-z0-9]{0,4})((?:[a-z]{3,8}[ \t]+){11,23}[a-z]{3,8})\b/gi,
    ),
    { group: 3 },
  ),
];

/** Generic and heuristic secrets: the REVIEW tier. */
const HEURISTIC: GuardRule[] = [
  // claude-mem's generic group; `pwd` only as a suffix (`DB_PWD`), since PWD is a folder.
  secret(
    "generic-password",
    new RegExp(
      `${keyedLookbehind(String.raw`\b(?:\w*_?(?:password|passwd)|\w+_pwd)`)}${GENERIC_VALUE}`,
      "gid",
    ),
    { tier: "review" },
  ),
  secret("generic-token", GENERIC_TOKEN, { tier: "review" }),
  secret(
    "bearer-token",
    new RegExp(
      `(?<=\\bAuthorization${OPTIONAL_QUOTE}${BOUNDED_SPACE}:${BOUNDED_SPACE}${OPTIONAL_QUOTE}(?:Bearer|Basic)${BOUNDED_SPACE})${GENERIC_VALUE}`,
      "gid",
    ),
    { tier: "review" },
  ),
  // caura: an upper-case environment variable naming a credential, its value entropy-gated.
  secret(
    "env-credential",
    rx(
      /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:API_?KEY|TOKEN|SECRET|SECRET_KEY|ACCESS_KEY|PASSWORD|PASSWD)\b['"]?\s{0,8}[:=]\s{0,8}['"]?([A-Za-z0-9+/_-]{16,})['"]?/g,
    ),
    { tier: "review", group: 1, validate: (v) => shannonEntropy(v) >= 3 },
  ),
  // walrus: hexadecimal key material is caught by the label beside it, never
  // by its shape, so a bare commit SHA passes.
  secret("hex-near-keyword", rx(/\b(?:0x)?[0-9a-fA-F]{32,}\b/g), {
    tier: "review",
    validate: (_v, text, start, end) => labelled(text, start, end),
  }),
  // walrus: other opaque key material, label-gated and shape-guarded.
  secret("labelled-key-material", rx(/[A-Za-z0-9+/_=-]{20,}/g), {
    tier: "review",
    validate: (v, text, start, end) =>
      !/^[0-9a-fA-F]+$/.test(v) && looksLikeOpaqueToken(v) && labelled(text, start, end),
  }),
  // graphCTX's entropy rule, over base64-alphabet runs, with walrus' shape
  // guard: mixed case and a digit, not hexadecimal.
  secret("high-entropy", rx(/[A-Za-z0-9+/_=-]{24,}/g), {
    tier: "review",
    validate: (v) =>
      !isBenignOpaqueToken(v) &&
      shannonEntropy(v) > 4 &&
      /[a-z]/.test(v) &&
      /[A-Z]/.test(v) &&
      /[0-9]/.test(v) &&
      !/^[0-9a-fA-F]+$/.test(v),
  }),
];

/** Personal data (caura), as data: severity high is BLOCK, low and medium REVIEW. */
const PERSONAL: GuardRule[] = [
  pii("email", "review", rx(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g)),
  pii("phone", "review", rx(/\+\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}/g)),
  pii("phone", "review", rx(/(?<!\d)(?:\(\d{3}\)\s?|\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g)),
  pii("phone", "review", rx(/(?<!\d)0[12378]\d{1,3}[ -]\d{3,4}[ -]?\d{3,4}\b/g), {
    validate: ukLength,
  }),
  pii("phone", "review", rx(/(?<!\d)07\d{9}\b/g)),
  pii(
    "phone",
    "review",
    rx(/\b(?:tel|phone|telephone|mobile|mob|cell|landline)\b[^0-9\n]{0,12}(0[12378]\d{8,9})\b/gi),
    { group: 1 },
  ),
  pii(
    "payment-card",
    "block",
    rx(
      /\b(?:4\d{3}|5[1-5]\d{2}|2[2-7]\d{2}|3[47]\d{2}|6(?:011|5\d{2})|3(?:0[0-5]|[68]\d)\d)(?:[-\s]?\d){9,15}\b/g,
    ),
    { validate: luhn },
  ),
  pii("iban", "block", rx(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/g), {
    validate: ibanMod97,
  }),
  pii("us-ssn", "block", rx(/\b(?!000|666|9\d\d)\d{3}([- ])(?!00)\d{2}\1(?!0000)\d{4}\b/g)),
  pii(
    "us-ssn",
    "block",
    rx(
      /\b(?:ssn|s\.s\.n\.|social[\s-]?security(?:\s+(?:number|no\.?|#))?|soc\.?\s?sec\.?)\b[^0-9\n]{0,16}((?!000|666|9\d\d)\d{3}(?!00)\d{2}(?!0000)\d{4})\b/gi,
    ),
    { group: 1 },
  ),
  pii("uk-nino", "block", rx(/\b[ABCEGHJ-PRSTW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g)),
  pii("us-itin", "block", rx(/\b9\d{2}([- ])[78]\d\1\d{4}\b/g)),
  pii(
    "us-itin",
    "block",
    rx(
      /\b(?:itin|individual\s+taxpayer\s+identification(?:\s+number)?)\b[^0-9\n]{0,16}(9\d{2}[78]\d{5})\b/gi,
    ),
    { group: 1 },
  ),
  pii("es-dni", "block", rx(/\b\d{8}-?[A-HJ-NP-TV-Z]\b/g), { validate: dniLetter }),
  pii(
    "es-dni",
    "block",
    rx(/\b(?:dni|nif|d\.n\.i\.|n\.i\.f\.)(?!\w)[^0-9\n]{0,16}(\d{8} [A-HJ-NP-TV-Z])\b/gi),
    { group: 1, validate: (v) => dniLetter(v.replace(" ", "")) },
  ),
];

/** A gitleaks allowlist holds when its target matches one of its regexes or the secret holds a stopword. */
function allowed(
  allow: GitleaksAllow,
  compiled: RegExp[],
  secretText: string,
  match: string,
  line: string,
): boolean {
  const target = allow.target === "match" ? match : allow.target === "line" ? line : secretText;
  if (compiled.some((re) => re.test(target))) return true;
  const lower = secretText.toLowerCase();
  return allow.stopwords.some((w) => lower.includes(w));
}

const compileAllow = (a: GitleaksAllow) => a.regexes.map(([s, f]) => new RegExp(s, f));
const GLOBAL_ALLOW = compileAllow(GITLEAKS_ALLOW);

/**
 * gitleaks' rules (vendor/gitleaks-rules.ts), as gitleaks judges a finding: the
 * secret is the rule's group, else the first non-empty group, else the match;
 * its entropy must reach the rule's floor, and a generic rule's secret must
 * hold a digit; neither the rule's allowlists nor the global one may hold.
 * The generic rules are the REVIEW tier; every other is BLOCK.
 */
const GITLEAKS: GuardRule[] = GITLEAKS_RULES.map((r) => {
  const allows = (r.allow ?? []).map((a) => [a, compileAllow(a)] as const);
  const generic = r.id.startsWith("generic");
  const rule: GuardRule = {
    kind: `secret/gitleaks/${r.id}`,
    guard: "secrets",
    tier: generic ? "review" : "block",
    pattern: new RegExp(r.source, `${r.flags}gd`),
    group: r.group ?? "first",
    keywords: r.keywords,
    validate: (v, text, start, end) => {
      if (generic && !/[0-9]/.test(v)) return false;
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = text.indexOf("\n", end);
      const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
      const match = text.slice(start, end);
      return (
        !allowed(GITLEAKS_ALLOW, GLOBAL_ALLOW, v, match, line) &&
        !allows.some(([a, compiled]) => allowed(a, compiled, v, match, line))
      );
    },
  };
  if (r.entropy !== undefined) rule.entropy = r.entropy;
  return rule;
});

/**
 * The redactor of plane/bypass.ts (card PX1, finding R7-9 of ADR 0014), in
 * the order it applies them; its output for every existing test and fixture
 * is unchanged by the move into this table (card E2.9).
 */
/** A name that says it holds a secret; the redactor's first entry reads it, and so does plane/bypass.ts's isSecretName. */
export const SECRET_NAME =
  "[A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|AUTH|CREDENTIALS?)[A-Za-z0-9_]*";
const VALUE = `(?:'[^']*'|"[^"]*"|\\S+)`;
const REDACTED = "<redacted>";
const BYPASS: TableEntry[] = [
  // NAME=value where the name says it holds a secret.
  {
    kind: "secret/named-assignment",
    pattern: new RegExp(`(\\b${SECRET_NAME}=)${VALUE}`, "gi"),
    redact: `$1${REDACTED}`,
  },
  // --api-key value, --token=value, --password value.
  {
    kind: "secret/flag-value",
    pattern: new RegExp(
      `(--?(?:api[-_]?key|key|token|secret|password|passwd|pass|auth)(?:=|\\s+))${VALUE}`,
      "gi",
    ),
    redact: `$1${REDACTED}`,
  },
  // Authorization: Bearer value.
  { kind: "secret/bearer", pattern: /(\bBearer\s+)[^\s'"]+/gi, redact: `$1${REDACTED}` },
  // Credentials in a URL.
  { kind: "secret/url-userinfo", pattern: /(:\/\/)[^\s/@'"]+@/g, redact: `$1${REDACTED}@` },
  // Strings that look like a key whatever stands before them.
  { kind: "secret/sk-key", pattern: /\bsk-[A-Za-z0-9_-]{8,}/g, redact: REDACTED },
  { kind: "secret/long-token", pattern: /\b[A-Za-z0-9_-]{32,}\b/g, redact: REDACTED },
];

/** The one table: the redactor's entries, then the guard's rules. */
export const SECRET_TABLE: readonly TableEntry[] = [
  ...BYPASS,
  ...[...VENDOR, ...HEURISTIC, ...PERSONAL, ...GITLEAKS].map((rule) => ({
    kind: rule.kind,
    pattern: rule.pattern,
    rule,
  })),
];

/** The guard's rules, in table order. */
export const GUARD_RULES: readonly GuardRule[] = SECRET_TABLE.flatMap((e) =>
  e.rule ? [e.rule] : [],
);

/** The redactor's last entry, any run of 32 or more key characters, which plane/bypass.ts applies apart. */
export const REDACTION_LONG_TOKEN = (() => {
  const e = BYPASS[BYPASS.length - 1] as TableEntry;
  return [e.pattern, e.redact as string] as const;
})();

/** The redactor's patterns and replacements, in table order (plane/bypass.ts). */
export const REDACTIONS: readonly (readonly [RegExp, string])[] = SECRET_TABLE.flatMap((e) =>
  e.redact === undefined ? [] : [[e.pattern, e.redact] as const],
);

// ---------------------------------------------------------------------------
// Scanning.

/**
 * Identifiers that are never a secret or personal data, whatever a rule says
 * of a span inside them: a UUID (uuidv7 ids included) and an Engram content
 * hash (`sha256:` and 64 hexadecimal digits). A card number that is part of
 * a UUID is not a card (Hindsight).
 */
const BENIGN =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|sha256:[0-9a-f]{64}/g;

/** A rule threw while it ran; it names the rule, never what it was given. */
export class GuardFailure extends Error {
  readonly kind: string;
  constructor(kind: string) {
    super(`content guard rule ${kind} failed`);
    this.kind = kind;
  }
}

function valueSpan(m: RegExpExecArray, group: GuardRule["group"]): [number, number] | null {
  const indices = m.indices as RegExpIndicesArray;
  if (group === "first") {
    for (let g = 1; g < indices.length; g++) {
      const span = indices[g];
      if (span && span[1] > span[0]) return span;
    }
    return indices[0] as [number, number];
  }
  return indices[group ?? 0] ?? null;
}

/**
 * Every match of the enabled guards' rules in `text`, in order of start, with
 * overlaps resolved (after caura): one match per region, the most specific
 * kept, a span overlapping one kept already dropped. A rule that throws is a
 * GuardFailure.
 */
export function scan(
  text: string,
  guards: ReadonlySet<GuardName>,
  rules: readonly GuardRule[] = GUARD_RULES,
): Finding[] {
  const lower = text.toLowerCase();
  const benign = [...text.matchAll(BENIGN)].map((m) => [m.index, m.index + m[0].length] as const);
  const inBenign = (s: number, e: number) => benign.some(([bs, be]) => bs <= s && e <= be);
  const found: (Finding & { rule: number })[] = [];
  for (const [index, rule] of rules.entries()) {
    if (!guards.has(rule.guard)) continue;
    if (rule.keywords && !rule.keywords.some((k) => lower.includes(k))) continue;
    try {
      rule.pattern.lastIndex = 0;
      for (const m of text.matchAll(rule.pattern)) {
        const span = valueSpan(m, rule.group);
        if (!span || span[1] <= span[0]) continue;
        const [start, end] = span;
        const value = text.slice(start, end);
        if (rule.entropy !== undefined && shannonEntropy(value) <= rule.entropy) continue;
        if (rule.validate && !rule.validate(value, text, start, end)) continue;
        if (inBenign(start, end)) continue;
        found.push({
          kind: rule.kind,
          guard: rule.guard,
          tier: rule.tier,
          start,
          end,
          rule: index,
        });
      }
    } catch {
      throw new GuardFailure(rule.kind);
    }
  }
  // The most specific match keeps its region: the BLOCK tier first, then the
  // rule earlier in the table (vendor rules before gitleaks', specific before
  // heuristic), then the earlier start. Sorting is stable, so a tie keeps
  // the order found.
  const rank = (f: Finding & { rule: number }) => [f.tier === "block" ? 0 : 1, f.rule, f.start];
  found.sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return (
      (x[0] as number) - (y[0] as number) ||
      (x[1] as number) - (y[1] as number) ||
      (x[2] as number) - (y[2] as number)
    );
  });
  const kept: Finding[] = [];
  for (const { rule: _rule, ...f } of found)
    if (kept.every((k) => f.end <= k.start || k.end <= f.start)) kept.push(f);
  kept.sort((a, b) => a.start - b.start);
  return kept;
}

/** The text a guard scans: a string as it is; structured content as its keys and string values, one per line. */
export function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(contentText).join("\n");
  if (content !== null && typeof content === "object")
    return Object.entries(content)
      .map(([k, v]) => `${k}\n${contentText(v)}`)
      .join("\n");
  return "";
}

/** The content's size in bytes: a string's UTF-8, structured content's canonical JSON. */
export function contentBytes(content: unknown): number {
  return new TextEncoder().encode(typeof content === "string" ? content : canonicalJson(content))
    .length;
}

const LISTED = 3;

/** What a reason says of the findings: kinds and lengths, in order, never a character of a value. */
export function describeFindings(findings: readonly Finding[]): string {
  const one = (f: Finding) => `${f.kind} (${f.end - f.start} characters)`;
  if (findings.length === 1) return `the content holds ${one(findings[0] as Finding)}`;
  const more = findings.length - LISTED;
  return `the content holds ${findings.length} matches: ${findings
    .slice(0, LISTED)
    .map(one)
    .join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
}

/**
 * The content-guard stage of the write gate (ADR 0039), run after every
 * other check of evaluateWrite and before review: the decision when the
 * policy's `content_guards` decides the write, or null when it lets the
 * write through to the rest of the gate.
 *
 * - No block, or every guard off: null.
 * - An item landing retired is never judged: retiring what a guard would
 *   refuse is how a held candidate is rejected.
 * - A rewrite of an active item that keeps its content is not judged again:
 *   that content was admitted, and a reviewer may have promoted it.
 * - `max_content_bytes`: larger content is denied (`engram/write/content-size`).
 * - With `secrets` or `pii` on: content beyond SCAN_LIMIT, or a rule that
 *   throws, holds the write (`engram/write/guard-failure`, decision 6). A
 *   BLOCK-tier match of a guard in `block` denies; any other match of an
 *   enabled guard holds the write as a candidate. The rule id is the guard's
 *   (`engram/write/secret` or `engram/write/pii`) of the deciding match.
 */
export function contentGuard(
  policy: Policy,
  item: MemoryItem,
  existing: MemoryItem | undefined,
  rules: readonly GuardRule[] = GUARD_RULES,
): WriteDecision | null {
  const guards = policy.content_guards;
  if (!guards || item.status === "retired") return null;
  if (
    existing?.status === "active" &&
    canonicalJson(existing.content) === canonicalJson(item.content)
  )
    return null;
  const deny = (reason: string, policy_id: string): WriteDecision => ({
    decision: "deny",
    status: null,
    check: "content-guard",
    reason,
    policy_id,
  });
  const hold = (reason: string, policy_id: string): WriteDecision => ({
    decision: "allow",
    status: item.status === "active" ? "candidate" : item.status,
    check: "review",
    reason: `${reason}; stored as a candidate until a reviewer promotes it`,
    policy_id,
  });
  const max = guards.max_content_bytes;
  if (max !== undefined) {
    const bytes = contentBytes(item.content);
    if (bytes > max)
      return deny(
        `the content is ${bytes} bytes, above the policy's max_content_bytes of ${max}`,
        CONTENT_SIZE_ID,
      );
  }
  const mode = (g: GuardName) => guards[g] ?? "off";
  const on = new Set((["secrets", "pii"] as const).filter((g) => mode(g) !== "off"));
  if (on.size === 0) return null;
  const text = contentText(item.content);
  if (text.length > SCAN_LIMIT)
    return hold(
      `the content is ${text.length} characters, beyond the ${SCAN_LIMIT} a content guard scans, so it fails closed`,
      GUARD_FAILURE_ID,
    );
  let findings: Finding[];
  try {
    findings = scan(text, on, rules);
  } catch (e) {
    // scan throws nothing but a GuardFailure, which names the rule alone.
    const { kind } = e as GuardFailure;
    return hold(`the content guard rule ${kind} failed, so it fails closed`, GUARD_FAILURE_ID);
  }
  if (findings.length === 0) return null;
  const id = (f: Finding) => (f.guard === "secrets" ? SECRET_ID : PII_ID);
  const what = describeFindings(findings);
  const blocking = findings.find((f) => f.tier === "block" && mode(f.guard) === "block");
  if (blocking)
    return deny(`${what}; the policy's ${blocking.guard} guard blocks it`, id(blocking));
  const first = findings[0] as Finding;
  return hold(
    `${what}; the policy's ${first.guard} guard is ${mode(first.guard)}${
      mode(first.guard) === "block" ? `, and a ${first.tier}-tier match is held` : ""
    }`,
    id(first),
  );
}

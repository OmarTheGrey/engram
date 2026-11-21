// The recorder's scrub (card D1): a best-effort pre-filter, run before an
// episode is stored. The guaranteed write-time control is card E2.9's
// content guard, which judges every Plane.write the recorder makes once the
// recording policy sets `content_guards.secrets` (backlog row "Recording
// policy: the content guard"); this scrub only lowers what reaches it.
//
// What it does. The secret table of the bypass redactor (plane/bypass.ts,
// `redactSecrets`) runs over every text, unchanged, so every bypass reason
// is too. Then rules of the scrub's own:
// - a named value on one line, in a header, a JSON or YAML pair or an
//   assignment, when the name's last word is a secret's (`isSecretValueName`:
//   `X-Api-Key: v`, `"secret_key": "v"`, `DB_PWD: v`, a quoted value whole),
//   except a literal, a keyword, a type name or an opening `{` or `[`;
// - the MySQL clients' `-p` password and `curl -u user:password`, each on
//   its own command (the text is cut at newlines and `;&|`, so the scan is
//   linear);
// - the body of a PEM private key.
// In tool arguments, the whole value under a secret-named key goes
// (`isSecretName`); in an array a secret flag takes the element after it,
// whatever it is, and beside a MySQL client `-pvalue` loses its value; an
// object `{ name, value }` loses its value when its name is a secret's.
//
// Identifiers (the session and task ids, entry ids, tool and model names,
// argument names, times) are not rewritten, since the episode is linked by
// them; one that still matches is reported, and the recorder holds the
// session instead of storing it. pi's own id shapes (an 8-hex entry id, a
// canonical UUID) are not held. Names that are long by design (a tool name
// such as `mcp__server__tool`, a model id, a custom type, a stop reason) are
// checked without the table's rule for a run of 32 or more key characters,
// and read once more with underscores as spaces against the key-shaped rules
// only (`sk-` keys, URL credentials), so `mcp__x__sk-...` is held and
// `mcp__firebase-auth__list_users` is not.
//
// Not covered (E2.9's content guard is the covering control):
// - escaped JSON (`{\"password\": \"v\"}`) and an escaped quote inside a value;
// - header pairs as arrays (`[["X-Api-Key", v]]`) and `ParameterKey` and
//   `ParameterValue` pairs;
// - `os.environ["API_KEY"] = "v"`, XML (`<password>v</password>`), `:=`
//   and `=>`;
// - a value on the next line (YAML block scalars), a secret with no
//   telltale shape in prose, and one split across two fields or messages;
// - a flag and its value in two keys of one object, and `-p` beside a tool
//   other than the MySQL clients, where it is usually a port;
// - over-redaction kept as is: prose such as `Authorization: the header`
//   and test counts such as `pass: 12`; the table's `--password-stdin`
//   taking the next word (`-u`); argument keys the table's name rule takes
//   (`author`, `max_tokens`, backlog row "Secret-name over-match"); and the
//   table's rule that takes full SHAs and UUIDs, from before card D1.
import { isSecretName, REDACTED_SECRET, redactSecrets } from "../plane/bypass.ts";
import type { AbandonedBranch, Episode, EpisodeJson, Outcome, Step } from "./episode.ts";

export type Scrubbed = {
  /** The episode with its free text redacted. */
  episode: Episode;
  /** How many text fields the redaction changed. */
  redacted: number;
  /** The identifier fields that still match, by path; empty when the episode may be stored. */
  held: string[];
};

const PI_ID = /^(?:[0-9a-f]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Words that make a name a secret's, when the name is split into words. */
const SECRET_NAME_WORDS = new Set([
  "token",
  "secret",
  "password",
  "passwd",
  "passphrase",
  "pwd",
  "pw",
  "pass",
  "cookie",
  "credential",
  "credentials",
  "auth",
  "authorization",
  "apikey",
  "authtoken",
]);
/** `key` is a secret's after one of these words: `api_key`, `secretKey`, `private_key`, `aws_secret_access_key`. */
const KEY_QUALIFIERS = new Set(["api", "secret", "private", "access", "signing"]);

/** The words of a name: split at `_`, `-`, `.` and a lower-to-upper case change, lowercased. */
function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[_.-]+/)
    .filter((w) => w !== "");
}

/**
 * Whether the named-value rule takes a name's value: its last word is a
 * secret's (`GITHUB_TOKEN`, `DB_PWD`, `X-Auth-Token`; not `tokens`,
 * `author`, `max_tokens`, `token_count` or `password_hash`), or it ends in
 * `key` after a qualifier (`secret_key`, `privateKey`, `x-api-key`,
 * `aws_secret_access_key`).
 */
export function isSecretValueName(name: string): boolean {
  const words = nameWords(name);
  const last = words.at(-1);
  if (last === undefined) return false;
  return (
    SECRET_NAME_WORDS.has(last) ||
    (last === "key" && words.length > 1 && KEY_QUALIFIERS.has(words.at(-2) as string))
  );
}

/**
 * A named field in a header, a JSON or YAML pair or an assignment, on one
 * line: the name (group 2), an optional auth scheme, then a quoted value
 * whole or a bare one (group 3). `==`, `!=`, `===`, `=>` and `:=` are not
 * assignments, and nothing crosses a newline. Whether the value goes is
 * decided by `namedValue` below, by the name's words.
 */
const NAMED_VALUE =
  /((?:^|[\s'"{,([])["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?[ \t]*(?<![=!:<>])[:=](?![=>])[ \t]*(?:(?:Bearer|Basic|Token)[ \t]+)?)("[^"\n]*"|'[^'\n]*'|["']?[^\s'",;}]+)/gi;

/** Values that are code or a type, not a secret: a keyword, a literal, a type name. */
const NOT_A_VALUE = new Set([
  "null",
  "true",
  "false",
  "undefined",
  "none",
  "await",
  "str",
  "string",
  "int",
  "integer",
  "bool",
  "boolean",
  "number",
  "bytes",
  "float",
  "any",
  "unknown",
  "object",
]);

function namedValue(match: string, before: string, name: string, value: string): string {
  if (!isSecretValueName(name)) return match;
  const q = value[0];
  const bare = (q === '"' || q === "'" ? value.slice(1, value.endsWith(q) ? -1 : undefined) : value)
    .replace(/[)]+$/, "")
    .toLowerCase();
  // A literal, a keyword or a type annotation (`password: str`), or a value
  // that opens a structure (`token: {`), is kept: it is code, not a secret.
  if (NOT_A_VALUE.has(bare) || /^[{[]/.test(bare)) return match;
  if (q === '"' || q === "'")
    return value.length > 1 && value.endsWith(q)
      ? `${before}${q}${REDACTED_SECRET}${q}`
      : `${before}${q}${REDACTED_SECRET}`;
  return `${before}${REDACTED_SECRET}`;
}

/** A MySQL client's command line; `-p` beside it is the password flag. */
const MYSQL_WORD = /\b(?:mysql|mysqldump|mysqladmin|mariadb)\b/;
/** The password after `-p` on a MySQL command, spaced or attached; a following flag is not a value. */
const MYSQL_P = /(\s-p)(\s*)((?!-)[^\s'"]+)/g;
/** `curl -u user:password` and `--user user:password`: the password after the colon. */
const CURL_WORD = /\bcurl\b/;
const CURL_USER = /(\s(?:-u|--user)\s+[^\s:'"]+:)([^\s'"]+)/g;

/**
 * Command-scoped rules, linear in the text: it is cut once at newlines and
 * at `;`, `&` and `|`, and each piece that names the command is scanned once
 * after the command's name.
 */
function commandRules(text: string): string {
  if (!MYSQL_WORD.test(text) && !CURL_WORD.test(text)) return text;
  return text
    .split(/([\n;&|])/)
    .map((piece) => {
      let out = piece;
      const mysql = MYSQL_WORD.exec(out);
      if (mysql)
        out =
          out.slice(0, mysql.index) +
          out.slice(mysql.index).replace(MYSQL_P, `$1$2${REDACTED_SECRET}`);
      const curl = CURL_WORD.exec(out);
      if (curl)
        out =
          out.slice(0, curl.index) +
          out.slice(curl.index).replace(CURL_USER, `$1${REDACTED_SECRET}`);
      return out;
    })
    .join("");
}

/** A PEM private key's body, terminated or cut off; the BEGIN and END lines stay. */
const PEM_KEY =
  /(-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g;

/** The table, then the named-value rule, the command rules and PEM key bodies. */
export function scrubText(value: string, options: { longTokens?: boolean } = {}): string {
  return commandRules(redactSecrets(value, options).replace(NAMED_VALUE, namedValue)).replace(
    PEM_KEY,
    `$1\n${REDACTED_SECRET}\n$2`,
  );
}

/** The key-shaped rules of the table (`sk-` keys, URL credentials), for a name read with `_` as spaces. */
const KEY_SHAPED = [/\bsk-[A-Za-z0-9_-]{8,}/, /:\/\/[^\s/@'"]+@/];

/** Whether an argv element is a flag whose next element is a secret. */
function secretFlag(arg: string, besideMysql: boolean): boolean {
  if (arg === "-p") return besideMysql;
  const flag = /^--?([A-Za-z][A-Za-z0-9_-]*)$/.exec(arg);
  return flag !== null && isSecretName(flag[1] as string);
}

/** What a secret flag takes: anything but null and a boolean, which hold nothing to leak. */
const takes = (v: EpisodeJson): boolean => v !== null && typeof v !== "boolean";

/** The scrubbed episode, the count of redactions, and what still matches. */
export function scrubEpisode(episode: Episode): Scrubbed {
  let redacted = 0;
  const held: string[] = [];

  const text = (value: string): string => {
    const out = scrubText(value);
    if (out !== value) redacted++;
    return out;
  };
  const nullableText = (value: string | null) => (value === null ? null : text(value));
  /** An identifier: checked, never rewritten. */
  const ident = (path: string, value: string | null): void => {
    if (value !== null && scrubText(value) !== value) held.push(path);
  };
  /** An entry or session id: pi's own shapes pass. */
  const id = (path: string, value: string | null): void => {
    if (value !== null && !PI_ID.test(value)) ident(path, value);
  };
  /** A name that may be long by design: checked without the long-run rule, underscores as boundaries. */
  const name = (path: string, value: string | null): void => {
    if (value === null) return;
    // Read with underscores as spaces, only the key-shaped rules apply: the
    // flag rule would read `mcp__firebase-auth__list` as `-auth list`.
    const spaced = value.replaceAll("_", " ");
    if (
      scrubText(value, { longTokens: false }) !== value ||
      KEY_SHAPED.some((rule) => rule.test(spaced))
    )
      held.push(path);
  };
  /** A value removed whole. */
  const gone = (v: EpisodeJson): EpisodeJson => {
    if (v !== REDACTED_SECRET) redacted++;
    return REDACTED_SECRET;
  };

  const args = (path: string, value: EpisodeJson): EpisodeJson => {
    let keyHeld = false;
    const walk = (v: EpisodeJson, besideMysql: boolean): EpisodeJson => {
      if (typeof v === "string") return text(v);
      if (Array.isArray(v)) {
        const mysql = besideMysql || v.some((x) => typeof x === "string" && MYSQL_WORD.test(x));
        // Pairwise: a secret flag takes the element after it, whatever it
        // holds; beside a MySQL client `-pvalue` loses its value.
        return v.map((x, i) => {
          const prev = i > 0 ? v[i - 1] : undefined;
          if (typeof prev === "string" && secretFlag(prev, mysql) && takes(x)) return gone(x);
          if (mysql && typeof x === "string" && /^-p(?!-)\S/.test(x)) {
            redacted++;
            return `-p${REDACTED_SECRET}`;
          }
          return walk(x, mysql);
        });
      }
      if (v === null || typeof v !== "object") return v;
      const entries = Object.entries(v);
      const mysql =
        besideMysql || entries.some(([, x]) => typeof x === "string" && MYSQL_WORD.test(x));
      // `{ name: "DB_PASSWORD", value: v }`: the pair's name says what its value holds.
      const pairName = ["name", "key", "Name", "Key"]
        .map((k) => v[k])
        .find((n): n is string => typeof n === "string");
      const secretPair = pairName !== undefined && isSecretName(pairName);
      const out: Record<string, EpisodeJson> = {};
      for (const [k, inner] of entries) {
        if (scrubText(k) !== k) keyHeld = true;
        const whole = isSecretName(k) || (secretPair && (k === "value" || k === "Value"));
        // Under a secret name the whole value goes: a string, a number, an
        // array or an object; null and booleans hold nothing to leak.
        out[k] =
          whole && inner !== null && typeof inner !== "boolean"
            ? gone(inner as EpisodeJson)
            : walk(inner as EpisodeJson, mysql);
      }
      return out;
    };
    const out = walk(value, false);
    if (keyHeld) held.push(path);
    return out;
  };

  const step = (path: string, s: Step): Step => {
    id(`${path}.entry_id`, s.entry_id);
    const marked =
      s.replacement === undefined ? s : ({ ...s, replacement: text(s.replacement) } as Step);
    switch (marked.kind) {
      case "user":
        return { ...marked, text: text(marked.text) };
      case "generation":
        name(`${path}.model`, marked.model);
        name(`${path}.stop_reason`, marked.stop_reason);
        return { ...marked, text: text(marked.text) };
      case "function": {
        name(`${path}.tool`, marked.tool);
        id(`${path}.result_entry_id`, marked.result_entry_id);
        const argsOut = args(`${path}.arguments`, marked.arguments);
        return { ...marked, arguments: argsOut, result: nullableText(marked.result) };
      }
      case "summary":
        id(`${path}.from_id`, marked.from_id);
        return { ...marked, text: text(marked.text) };
      case "custom":
        name(`${path}.custom_type`, marked.custom_type);
        return { ...marked, text: text(marked.text) };
    }
  };
  const steps = (path: string, run: readonly Step[]) => run.map((s, i) => step(`${path}[${i}]`, s));
  const outcome = (path: string, o: Outcome): Outcome => {
    name(`${path}.stop_reason`, o.stop_reason);
    id(`${path}.leaf_id`, o.leaf_id);
    return { ...o };
  };

  id("session_id", episode.session_id);
  ident("task_id", episode.task_id);
  ident("started_at", episode.started_at);
  ident("ended_at", episode.ended_at);
  name("model", episode.model);
  const kept: Episode = {
    ...episode,
    steps: steps("steps", episode.steps),
    outcome: outcome("outcome", episode.outcome),
    abandoned: episode.abandoned.map((b, i): AbandonedBranch => {
      const path = `abandoned[${i}]`;
      id(`${path}.left_at`, b.left_at);
      id(`${path}.leaf_id`, b.leaf_id);
      return {
        ...b,
        summary: nullableText(b.summary),
        outcome: outcome(`${path}.outcome`, b.outcome),
        steps: steps(`${path}.steps`, b.steps),
      };
    }),
    omitted: episode.omitted.map((o, i) => {
      for (const [j, e] of o.entry_ids.entries()) id(`omitted[${i}].entry_ids[${j}]`, e);
      name(`omitted[${i}].stop_reason`, o.stop_reason);
      return { ...o, entry_ids: [...o.entry_ids] };
    }),
  };
  return { episode: kept, redacted, held };
}

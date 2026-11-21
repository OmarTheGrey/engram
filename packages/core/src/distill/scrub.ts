// The recorder's scrub (card D1): before an episode is stored, the secret
// table of the bypass redactor (plane/bypass.ts, `redactSecrets`) runs over
// it, with two rules of its own the table does not carry: a secret-named
// field in a header, a JSON or YAML pair or an assignment (`Name: value`,
// `"name": "value"`, `NAME_PASS=value`, a quoted value whole), and the
// password flag of the MySQL clients (`mysql -p value`, `mysql -pvalue`).
// The table, and so every bypass reason, is unchanged. Free text (what was
// typed, said, run and returned, what replaced it, and every summary) is
// redacted in place. In tool arguments, the whole value under a
// secret-named key goes, whatever its shape (`isSecretName`); in an array a
// secret flag takes the element after it (`["--password", v]`, and `["-p",
// v]` beside a MySQL client); and an object `{ name, value }` loses its
// value when its name is a secret's (`{ name: "DB_PASSWORD", value: v }`).
//
// Identifiers (the session and task ids, entry ids, tool and model names,
// argument names, times) are not rewritten, since the episode is linked by
// them; one that still matches is reported, and the recorder holds the
// session instead of storing it. pi's own id shapes (an 8-hex entry id, a
// canonical UUID; pi's session-format.md) are not held, and names that are
// long by design (a tool name such as `mcp__server__tool`, a model id, a
// custom type, a stop reason) are checked without the table's rule for a
// run of 32 or more key characters, which every UUID and hash matches, but
// with underscores read as word boundaries, so `mcp__x__sk-...` is held.
//
// What it cannot catch: the table and these rules are lists of shapes, not
// a detector. A secret with no telltale shape (a bare short password in
// prose), one split across two fields or two messages, a flag and its value
// in two arguments of an object rather than an array, and `-p` beside a tool
// other than the MySQL clients (where it is usually a port) are kept. Card
// E2.9's write-gate guard is the detector; this scrub is the floor the card
// asks for.
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

/** The names whose value the named-value rule removes. `auth` is a word, so `Author` is not one. */
const NAMES =
  "(?:[A-Za-z0-9_-]*(?:api[-_]?key|token|secret|password|passwd|passphrase|credentials?|cookie)" +
  "|[A-Za-z0-9_-]*(?:authorization|auth[-_]?token|auth)" +
  "|(?:[A-Za-z0-9-]*[_-])?(?:pass|pw))";

/**
 * A secret-named field in a header, a JSON or YAML pair or an assignment:
 * `X-Api-Key: v`, `"token": "v"`, `password: "a b c"`, `DB_PASS=v`,
 * `Cookie: session=v` and `Authorization: Basic v`. The name keeps itself;
 * the value goes, a quoted one whole.
 */
const NAMED_VALUE = new RegExp(
  `((?:^|[\\s'"{,(\\[])["']?${NAMES}["']?\\s*[:=]\\s*(?:(?:Bearer|Basic|Token)\\s+)?)("[^"]*"|'[^']*'|["']?[^\\s'",;}]+)`,
  "gi",
);

/** A MySQL client's command line; `-p` beside it is the password flag. */
const MYSQL_WORD = /\b(?:mysql|mysqldump|mysqladmin|mariadb)\b/;
/** `mysql ... -p value` and `mysql ... -pvalue`, on one command; a following flag is not a value. */
const MYSQL_P = /(\b(?:mysql|mysqldump|mysqladmin|mariadb)\b[^\n|;&]*?\s-p)(\s*)((?!-)[^\s'"]+)/g;

function quotedRedaction(_match: string, before: string, value: string): string {
  const q = value[0];
  if (q === '"' || q === "'")
    return value.length > 1 && value.endsWith(q)
      ? `${before}${q}${REDACTED_SECRET}${q}`
      : `${before}${q}${REDACTED_SECRET}`;
  return `${before}${REDACTED_SECRET}`;
}

/** The table, then the named-value rule, then the MySQL password flag. */
export function scrubText(value: string, options: { longTokens?: boolean } = {}): string {
  return redactSecrets(value, options)
    .replace(NAMED_VALUE, quotedRedaction)
    .replace(MYSQL_P, `$1$2${REDACTED_SECRET}`);
}

/** Whether an argv element is a flag whose next element is a secret. */
function secretFlag(arg: string, besideMysql: boolean): boolean {
  if (arg === "-p") return besideMysql;
  const flag = /^--?([A-Za-z][A-Za-z0-9_-]*)$/.exec(arg);
  return flag !== null && isSecretName(flag[1] as string);
}

const isLeaf = (v: EpisodeJson): boolean => typeof v === "string" || typeof v === "number";

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
    const spaced = value.replaceAll("_", " ");
    if (
      scrubText(value, { longTokens: false }) !== value ||
      scrubText(spaced, { longTokens: false }) !== spaced
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
        // Pairwise: a secret flag takes the element after it.
        return v.map((x, i) => {
          const prev = i > 0 ? v[i - 1] : undefined;
          return typeof prev === "string" && secretFlag(prev, mysql) && isLeaf(x)
            ? gone(x)
            : walk(x, mysql);
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

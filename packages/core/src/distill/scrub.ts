// The recorder's scrub (card D1): before an episode is stored, the secret
// table of the bypass redactor (plane/bypass.ts, `redactSecrets`) runs over
// it, with one rule of its own for header and key-value forms the table does
// not read (`Name: value`, `"name": "value"`, `NAME_PASS=value`); the table,
// and so every bypass reason, is unchanged. Free text (what was typed, said,
// run and returned, what replaced it, and every summary) is redacted in
// place, and under a tool argument whose name says it holds a secret
// (`isSecretName`) the whole value goes, whatever its shape.
//
// Identifiers (the session and task ids, entry ids, tool and model names,
// argument names, times) are not rewritten, since the episode is linked by
// them; one that still matches is reported, and the recorder holds the
// session instead of storing it. pi's own id shapes (an 8-hex entry id, a
// canonical UUID; pi's session-format.md) are not held, and names that are
// long by design (a tool name such as `mcp__server__tool`, a model id, a
// custom type, a stop reason) are checked without the table's rule for a
// run of 32 or more key characters, which every UUID and hash matches.
//
// What it cannot catch: the table and this rule are lists of shapes, not a
// detector. A secret with no telltale shape (a bare short password in
// prose), or one split across two fields or two messages, is kept. Card
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

/**
 * A secret-named field in a header, a JSON or YAML pair or an assignment:
 * `X-Api-Key: v`, `"token": "v"`, `password: v`, `DB_PASS=v`, and
 * `Authorization: Basic v`. The name keeps itself; the value goes.
 */
const NAMED_VALUE =
  /((?:^|[\s'"{,(])["']?(?:[A-Za-z0-9_-]*(?:api[-_]?key|token|secret|password|passwd|auth[a-z]*|credentials?)|(?:[A-Za-z0-9-]*[_-])?pass)["']?\s*[:=]\s*["']?(?:(?:Bearer|Basic|Token)\s+)?)([^\s'",;}]+)/gi;

/** The table, then the named-value rule. */
export function scrubText(value: string, options: { longTokens?: boolean } = {}): string {
  return redactSecrets(value, options).replace(NAMED_VALUE, `$1${REDACTED_SECRET}`);
}

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
  /** A name that may be long by design: checked without the long-run rule. */
  const name = (path: string, value: string | null): void => {
    if (value !== null && scrubText(value, { longTokens: false }) !== value) held.push(path);
  };

  const args = (path: string, value: EpisodeJson): EpisodeJson => {
    let keyHeld = false;
    const walk = (v: EpisodeJson): EpisodeJson => {
      if (typeof v === "string") return text(v);
      if (Array.isArray(v)) return v.map(walk);
      if (v === null || typeof v !== "object") return v;
      const out: Record<string, EpisodeJson> = {};
      for (const [k, inner] of Object.entries(v)) {
        if (scrubText(k) !== k) keyHeld = true;
        // Under a secret name the whole value goes: a string, a number, an
        // array or an object; null and booleans hold nothing to leak.
        if (isSecretName(k) && inner !== null && typeof inner !== "boolean") {
          if (inner !== REDACTED_SECRET) redacted++;
          out[k] = REDACTED_SECRET;
        } else out[k] = walk(inner as EpisodeJson);
      }
      return out;
    };
    const out = walk(value);
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

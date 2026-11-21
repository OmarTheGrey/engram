// The recorder's scrub (card D1, AGENTS.md rule 12): before an episode is
// stored, the secret table of the bypass redactor (plane/bypass.ts,
// `redactSecrets`) runs over it. Free text (what was typed, said, run and
// returned, and every summary) is redacted in place, and a tool argument
// whose name says it holds a secret (the table's own name rule) loses its
// value whatever it is. Identifiers (the session and task ids, entry ids,
// tool and model names, argument names) are not rewritten, since the episode
// is linked by them; one that still matches the table is reported, and the
// recorder holds the session instead of storing it. pi's own id shapes (an
// 8-hex entry id, a canonical UUID; pi's session-format.md) are not held,
// because the table's 32-character key rule matches every UUID.
import { isSecretName, REDACTED_SECRET, redactSecrets } from "../plane/bypass.ts";
import type { AbandonedBranch, Episode, EpisodeJson, Outcome, Step } from "./episode.ts";

export type Scrubbed = {
  /** The episode with its free text redacted. */
  episode: Episode;
  /** How many text fields the redaction changed. */
  redacted: number;
  /** The identifier fields that still match the table, by path; empty when the episode may be stored. */
  held: string[];
};

const PI_ID = /^(?:[0-9a-f]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** The scrubbed episode, the count of redactions, and what still matches. */
export function scrubEpisode(episode: Episode): Scrubbed {
  let redacted = 0;
  const held: string[] = [];

  const text = (value: string): string => {
    const out = redactSecrets(value);
    if (out !== value) redacted++;
    return out;
  };
  const nullableText = (value: string | null) => (value === null ? null : text(value));
  /** An identifier: checked, never rewritten. */
  const ident = (path: string, value: string | null, piShaped = false): void => {
    if (value === null) return;
    if (piShaped && PI_ID.test(value)) return;
    if (redactSecrets(value) !== value) held.push(path);
  };
  const id = (path: string, value: string | null) => ident(path, value, true);

  const args = (path: string, value: EpisodeJson): EpisodeJson => {
    let keyHeld = false;
    const walk = (v: EpisodeJson): EpisodeJson => {
      if (typeof v === "string") return text(v);
      if (Array.isArray(v)) return v.map(walk);
      if (v === null || typeof v !== "object") return v;
      const out: Record<string, EpisodeJson> = {};
      for (const [k, inner] of Object.entries(v)) {
        if (redactSecrets(k) !== k) keyHeld = true;
        if (isSecretName(k) && (typeof inner === "string" || typeof inner === "number")) {
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
    switch (s.kind) {
      case "user":
        return { ...s, text: text(s.text) };
      case "generation":
        ident(`${path}.model`, s.model);
        ident(`${path}.stop_reason`, s.stop_reason);
        return { ...s, text: text(s.text) };
      case "function": {
        ident(`${path}.tool`, s.tool);
        id(`${path}.result_entry_id`, s.result_entry_id);
        const argsOut = args(`${path}.arguments`, s.arguments);
        return { ...s, arguments: argsOut, result: nullableText(s.result) };
      }
      case "summary":
        id(`${path}.from_id`, s.from_id);
        return { ...s, text: text(s.text) };
      case "custom":
        ident(`${path}.custom_type`, s.custom_type);
        return { ...s, text: text(s.text) };
    }
  };
  const steps = (path: string, run: readonly Step[]) => run.map((s, i) => step(`${path}[${i}]`, s));
  const outcome = (path: string, o: Outcome): Outcome => {
    ident(`${path}.stop_reason`, o.stop_reason);
    id(`${path}.leaf_id`, o.leaf_id);
    return { ...o };
  };

  id("session_id", episode.session_id);
  ident("task_id", episode.task_id);
  ident("model", episode.model);
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
  };
  return { episode: kept, redacted, held };
}

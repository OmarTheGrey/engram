// The session recorder (card D1): reads pi session files and writes each one
// through Plane.write as an episodic item (AGENTS.md rule 2), the input
// every later Distill card reads (ADR 0001 point 5, ADR 0012). The episode
// is core's (`episodeOf`, packages/core/src/distill/episode.ts), and so is
// the scrub (`scrubEpisode`, distill/scrub.ts): what this module decides is
// only what a harness decides, the actor's source and the item's frame.
//
// - Scrub first (rule 12). An episode whose identifiers still match the
//   secret table after the scrub is held: no item, no store write, no event,
//   and the report names the fields, never their values.
// - The actor's source is set here, as every harness sets it (ADR 0004,
//   decision D4): a session mixes user, model and tool content, and an item
//   derived from others takes the least trusted of its inputs, so an episode
//   is `model`, or `compaction` when a model-written summary (a compaction or
//   a branch summary) is in it.
// - The item is the episode, as JSON content, valid from the session's start,
//   with the session file's sha256 as the hash of its evidence and the final
//   leaf as its session entry.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  type Actor,
  episodeOf,
  InvalidSessionError,
  type MemoryEvent,
  type MemoryItem,
  type Plane,
  parseSessionJsonl,
  scrubEpisode,
  Timestamp,
} from "@engram/core";

export interface RecorderOptions {
  plane: Plane;
  /** Who records; the recorder sets its `source`, whatever the caller gives. */
  actor: Omit<Actor, "source">;
  /** The scope every episode is written into, such as `person:<id>`. */
  scope: string;
  /** The items' owner. */
  owner: string;
  /** The time of every write, injected. */
  at: string;
  /** UUIDv7 ids for the items. */
  newId: () => string;
}

export type Recorded =
  | {
      status: "stored";
      file: string;
      session_id: string;
      task_id: string | null;
      item_id: string;
      /** How many text fields the scrub redacted. */
      redacted: number;
      event: MemoryEvent;
    }
  | {
      status: "denied";
      file: string;
      session_id: string;
      task_id: string | null;
      redacted: number;
      event: MemoryEvent;
    }
  | {
      status: "held";
      file: string;
      /** The identifier fields that still match the secret table, by path. */
      held: string[];
    }
  | { status: "invalid"; file: string; reason: string };

/** The source the recorder sets for an episode (ADR 0004: the least trusted of its inputs). */
export function episodeSource(episode: { summarised: boolean }): "model" | "compaction" {
  return episode.summarised ? "compaction" : "model";
}

const sha256 = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

/** Records one session's JSONL text; `file` names it in the report. */
export async function recordSession(
  text: string,
  file: string,
  options: RecorderOptions,
): Promise<Recorded> {
  let parsed: ReturnType<typeof parseSessionJsonl>;
  try {
    parsed = parseSessionJsonl(text);
  } catch (e) {
    if (e instanceof InvalidSessionError) return { status: "invalid", file, reason: e.message };
    throw e;
  }
  const scrubbed = scrubEpisode(episodeOf(parsed));
  if (scrubbed.held.length > 0) return { status: "held", file, held: scrubbed.held };
  const episode = scrubbed.episode;
  const source = episodeSource(episode);
  const actor: Actor = { ...options.actor, source };
  const validFrom = Timestamp.safeParse(parsed.timestamp).success ? parsed.timestamp : options.at;
  const item: MemoryItem = {
    id: options.newId(),
    class: "episodic",
    scope: options.scope,
    owner: options.owner,
    content: episode,
    provenance: {
      kind: source,
      ref: `pi-session:${episode.session_id}`,
      hash: sha256(text),
      actor: actor.id,
      ...(episode.outcome.leaf_id === null ? {} : { session_entry_id: episode.outcome.leaf_id }),
      ...(episode.model === null ? {} : { model: episode.model }),
    },
    // The episode is what the file records, exactly; whether the work in it
    // was right is its outcome, not its confidence.
    confidence: 1,
    valid_from: validFrom,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  };
  const written = await options.plane.write(actor, item, options.at);
  const common = {
    file,
    session_id: episode.session_id,
    task_id: episode.task_id,
    redacted: scrubbed.redacted,
    event: written.event,
  };
  return written.item === null
    ? { status: "denied", ...common }
    : { status: "stored", ...common, item_id: written.item.id };
}

/** Records each session file in the order given, one write at a time. */
export async function recordSessionFiles(
  paths: readonly string[],
  options: RecorderOptions,
): Promise<Recorded[]> {
  const out: Recorded[] = [];
  for (const path of paths)
    out.push(await recordSession(readFileSync(path, "utf8"), basename(path), options));
  return out;
}

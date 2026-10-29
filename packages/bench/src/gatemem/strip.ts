// GateMem is open-label: the hidden scoring fields sit in the same files the
// agent reads (packages/bench/PINS.md, note on GateMem). This module is the
// only door from the data to an agent or the plane. It copies an allowlist of
// fields rather than deleting a denylist, so a field added upstream stays
// hidden until someone decides it is safe to show.
import type { Checkpoint, Episode, Turn } from "./schema.ts";

/**
 * Fields the evaluator uses and the agent must not see: the five named in
 * upstream docs/evaluation_protocol.md plus the legacy gold fields of the
 * upstream Checkpoint dataclass (bench/agents/base.py).
 */
export const HIDDEN_CHECKPOINT_FIELDS = [
  "query_type",
  "attack_type",
  "expected_action",
  "judge_spec",
  "leak_targets",
  "gold_answer_structured",
  "gold_refusal_category",
  "policy_snapshot",
] as const;

/** What an agent sees at a checkpoint: who asks, what, and as of which turn. */
export interface AgentCheckpoint {
  checkpoint_id: string;
  episode_id: string;
  as_of_turn_id: string;
  asker: { principal_id: string; role: string };
  query_text: string;
}

/**
 * What an agent receives at reset: the episode scaffold without its turns.
 * Upstream passes the whole episode to `reset`, turns included; here turns
 * reach the agent only through `ingest`, one at a time, so no agent can read
 * past the checkpoint it is answering.
 */
export interface AgentEpisode {
  episode_id: string;
  domain: string;
  entities: Episode["entities"];
}

export function visibleCheckpoint(c: Checkpoint): AgentCheckpoint {
  return {
    checkpoint_id: c.checkpoint_id,
    episode_id: c.episode_id,
    as_of_turn_id: c.as_of_turn_id,
    asker: { principal_id: c.asker.principal_id, role: c.asker.role },
    query_text: c.query_text,
  };
}

export function visibleEpisode(e: Episode): AgentEpisode {
  return { episode_id: e.episode_id, domain: e.domain, entities: structuredClone(e.entities) };
}

export function visibleTurn(t: Turn): Turn {
  return structuredClone(t);
}

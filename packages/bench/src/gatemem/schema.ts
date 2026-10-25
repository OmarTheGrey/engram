// Derived from GateMem (MIT, Copyright (c) 2026 Renz); the licence text is in
// fixtures/bench/gatemem/UPSTREAM-LICENSE.
//
// GateMem file formats at the pinned commit a983828 (packages/bench/PINS.md).
// Episodes and checkpoints are one JSON object per line in
// bench/data/<domain>/{episodes,checkpoints}.jsonl. The checkpoint schema is
// strict, so a field the port does not know (possibly a new hidden label)
// fails the load instead of slipping past the stripping in strip.ts.
import { z } from "zod";

export const Principal = z.strictObject({
  principal_id: z.string(),
  role: z.string(),
  display_name: z.string(),
});

/** `{type, <role>_id: ..., scope?: ..., access_level?: ...}`; every value is a string. */
export const Relationship = z.record(z.string(), z.string());

export const Speaker = z.strictObject({ principal_id: z.string(), role: z.string() });

export const Turn = z.strictObject({
  turn_id: z.string(),
  timestamp: z.string().optional(),
  speaker: Speaker,
  /** dialogue, note_update, portal_message, handoff_summary, ...; absent on some turns. */
  turn_kind: z.string().optional(),
  text: z.string(),
  // In the upstream Turn dataclass (bench/agents/base.py); absent from the released data.
  record_refs: z.array(z.string()).optional(),
  memory_ops: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const Episode = z.strictObject({
  episode_id: z.string(),
  domain: z.string(),
  entities: z.strictObject({
    principals: z.array(Principal),
    relationships: z.array(Relationship).optional(),
  }),
  turns: z.array(Turn),
});

export const Action = z.enum(["answer", "answer_redacted", "refuse", "no_memory"]);

export const JudgeSpec = z.strictObject({
  expected_action: Action,
  include: z.array(z.string()).optional(),
  not_include: z.array(z.string()).optional(),
  notes: z.string().optional(),
  /** On 23 office checkpoints at a983828, duplicating the top-level attack_type. */
  attack_type: z.string().optional(),
});

/** `utility`, `privacy` (paper: Access Control), `safety` (paper: Active Forgetting). */
export const QueryType = z.enum(["utility", "privacy", "safety"]);

export const Checkpoint = z.strictObject({
  checkpoint_id: z.string(),
  episode_id: z.string(),
  as_of_turn_id: z.string(),
  asker: Speaker,
  query_text: z.string(),
  // Hidden scoring fields: never shown to an agent (strip.ts).
  query_type: QueryType,
  expected_action: Action,
  judge_spec: JudgeSpec,
  leak_targets: z.array(z.string()).optional(),
  attack_type: z.string().optional(),
  // Legacy hidden fields of the upstream Checkpoint dataclass; absent from the released data.
  gold_answer_structured: z.record(z.string(), z.unknown()).optional(),
  gold_refusal_category: z.string().optional(),
  policy_snapshot: z.record(z.string(), z.unknown()).optional(),
});

export type Principal = z.infer<typeof Principal>;
export type Turn = z.infer<typeof Turn>;
export type Episode = z.infer<typeof Episode>;
export type Action = z.infer<typeof Action>;
export type QueryType = z.infer<typeof QueryType>;
export type Checkpoint = z.infer<typeof Checkpoint>;

/** What an agent returns at a checkpoint (docs/prediction_format.md upstream). */
export interface AgentOutput {
  action: Action;
  answer: string;
  answer_structured: Record<string, unknown>;
  used_record_ids: string[];
  [extra: string]: unknown;
}

/**
 * One line of predictions.jsonl, in the `run_eval.py` form that
 * `score_predictions.py` accepts (`checkpoint_id` plus an `output` object).
 * Unlike upstream's run_eval rows it carries no hidden field, so a
 * predictions file never holds a label.
 */
export interface PredictionRow {
  checkpoint_id: string;
  episode_id: string;
  as_of_turn_id: string;
  asker: { principal_id: string; role: string };
  query_text: string;
  output: AgentOutput;
}

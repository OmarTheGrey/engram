// The Distiller interface (docs/architecture.md "Interfaces", ADR 0012):
// sessions in, candidate procedural items out. Candidates are never active;
// replay validation (card D3) promotes them. The implementation (card D2)
// receives an injected ModelCall at construction (AGENTS.md rule 4).
import type { MemoryItem } from "./schema.ts";

/**
 * One entry of a pi session tree (JSONL version 3), as plain data so core
 * needs no pi import. Fields beyond these are kept as they appear in the file.
 */
export interface SessionEntry {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
  [field: string]: unknown;
}

/** A recorded session: its entries without the header line, and the task it ran. */
export interface Session {
  id: string;
  task_id?: string;
  entries: SessionEntry[];
}

/** The induction method; only the pre-registered one exists (ADR 0012, Agent Workflow Memory). */
export interface DistillMethod {
  id: "awm";
  /** `provider/model-id` the induction prompt is sent to. */
  model: string;
  /** From the experiment config (AGENTS.md rule 6). */
  seed: number;
}

export interface Distiller {
  /** Candidate procedural items, each with status `candidate`. */
  distill(sessions: Session[], method: DistillMethod): Promise<MemoryItem[]>;
}

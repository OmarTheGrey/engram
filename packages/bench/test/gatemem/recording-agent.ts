// An agent that records every call the harness makes, for protocol tests.
import type { GateMemAgent } from "../../src/gatemem/harness.ts";
import type { AgentOutput, Turn } from "../../src/gatemem/schema.ts";
import type { AgentCheckpoint, AgentEpisode } from "../../src/gatemem/strip.ts";

export type Call =
  | { kind: "reset"; episode: AgentEpisode }
  | { kind: "ingest"; turn: Turn }
  | { kind: "query"; checkpoint: AgentCheckpoint; ingested: string[] };

export function recordingAgent(): GateMemAgent & { calls: Call[] } {
  const calls: Call[] = [];
  let ingested: string[] = [];
  return {
    calls,
    reset(episode) {
      calls.push({ kind: "reset", episode });
      ingested = [];
    },
    ingest(turn) {
      calls.push({ kind: "ingest", turn });
      ingested.push(turn.turn_id);
    },
    async query(checkpoint): Promise<AgentOutput> {
      calls.push({ kind: "query", checkpoint, ingested: [...ingested] });
      return { action: "refuse", answer: "recorded", answer_structured: {}, used_record_ids: [] };
    },
  };
}

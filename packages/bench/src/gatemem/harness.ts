// Derived from GateMem (MIT, Copyright (c) 2026 Renz); the licence text is in
// fixtures/bench/gatemem/UPSTREAM-LICENSE.
//
// The GateMem evaluation protocol (upstream docs/evaluation_protocol.md and
// run_episode / run_benchmark in bench/eval/runner.py): per episode, reset the
// agent, ingest turns in chronological order, and at each hidden checkpoint
// boundary (its as_of_turn_id) ask the checkpoint query. The agent sees only
// the stripped views from strip.ts.
//
// Differences from upstream, all deliberate: the run is serial (upstream
// episode_concurrency defaults to 1 too); there is no resume; timings are
// left out so predictions are byte-stable across runs; prediction rows carry
// no hidden field (upstream copies query_type and expected_action into them).
import type { Domain } from "./load.ts";
import type { AgentOutput, Checkpoint, Episode, PredictionRow, Turn } from "./schema.ts";
import {
  type AgentCheckpoint,
  type AgentEpisode,
  visibleCheckpoint,
  visibleEpisode,
  visibleTurn,
} from "./strip.ts";

/** Upstream BaseMemoryAgent (bench/agents/base.py): reset, ingest, query. */
export interface GateMemAgent {
  reset(episode: AgentEpisode): void | Promise<void>;
  ingest(turn: Turn): void | Promise<void>;
  query(checkpoint: AgentCheckpoint): Promise<AgentOutput>;
}

export async function runEpisode(
  agent: GateMemAgent,
  episode: Episode,
  checkpoints: readonly Checkpoint[],
): Promise<PredictionRow[]> {
  const position = new Map(episode.turns.map((t, i) => [t.turn_id, i]));
  // Stable sort by the position of the as-of turn, as upstream does.
  const ordered = [...checkpoints].sort(
    (a, b) => (position.get(a.as_of_turn_id) ?? -1) - (position.get(b.as_of_turn_id) ?? -1),
  );
  await agent.reset(visibleEpisode(episode));
  let ingested = -1;
  const rows: PredictionRow[] = [];
  for (const checkpoint of ordered) {
    const target = position.get(checkpoint.as_of_turn_id);
    if (target === undefined) continue;
    for (let i = ingested + 1; i <= target; i++) {
      await agent.ingest(visibleTurn(episode.turns[i] as Turn));
      ingested = i;
    }
    const view = visibleCheckpoint(checkpoint);
    const output = await agent.query(view);
    rows.push({
      checkpoint_id: view.checkpoint_id,
      episode_id: view.episode_id,
      as_of_turn_id: view.as_of_turn_id,
      asker: view.asker,
      query_text: view.query_text,
      output,
    });
  }
  return rows;
}

/** Every episode of every domain in file order, one agent reset per episode. */
export async function runBenchmark(
  agent: GateMemAgent,
  domains: readonly Domain[],
): Promise<PredictionRow[]> {
  const rows: PredictionRow[] = [];
  for (const domain of domains) {
    for (const episode of domain.episodes) {
      const mine = domain.checkpoints.filter((c) => c.episode_id === episode.episode_id);
      if (mine.length === 0) continue;
      rows.push(...(await runEpisode(agent, episode, mine)));
    }
  }
  return rows;
}

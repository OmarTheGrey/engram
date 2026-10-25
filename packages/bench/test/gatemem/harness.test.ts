import { describe, expect, test } from "vitest";
import { runBenchmark } from "../../src/gatemem/harness.ts";
import { fixture } from "./fixture.ts";
import { recordingAgent } from "./recording-agent.ts";

describe("GateMem harness protocol", () => {
  test("resets once per episode, before any of its turns", async () => {
    const agent = recordingAgent();
    await runBenchmark(agent, fixture());
    const resets = agent.calls.filter((c) => c.kind === "reset");
    expect(resets.map((c) => c.episode.episode_id)).toEqual(
      fixture().flatMap((d) => d.episodes.map((e) => e.episode_id)),
    );
    expect(agent.calls[0]?.kind).toBe("reset");
  });

  test("ingests turns in episode order and queries each checkpoint after exactly its as-of turn", async () => {
    const domains = fixture();
    const agent = recordingAgent();
    await runBenchmark(agent, domains);
    const queries = agent.calls.flatMap((c) => (c.kind === "query" ? [c] : []));
    expect(queries).toHaveLength(20);
    for (const q of queries) {
      const episode = domains
        .flatMap((d) => d.episodes)
        .find((e) => e.episode_id === q.checkpoint.episode_id);
      if (!episode) throw new Error(`no episode for ${q.checkpoint.checkpoint_id}`);
      const upto = episode.turns.findIndex((t) => t.turn_id === q.checkpoint.as_of_turn_id);
      expect(q.ingested).toEqual(episode.turns.slice(0, upto + 1).map((t) => t.turn_id));
    }
  });

  test("never ingests a turn after the episode's last checkpoint", async () => {
    const domains = fixture();
    const agent = recordingAgent();
    await runBenchmark(agent, domains);
    const ingested = agent.calls.filter((c) => c.kind === "ingest").length;
    const expected = domains
      .flatMap((d) => d.episodes.map((e) => ({ e, cs: d.checkpoints })))
      .reduce((n, { e, cs }) => {
        const last = Math.max(
          ...cs.map((c) => e.turns.findIndex((t) => t.turn_id === c.as_of_turn_id)),
        );
        return n + last + 1;
      }, 0);
    expect(ingested).toBe(expected);
  });

  test("queries checkpoints in as-of order and returns one prediction per checkpoint", async () => {
    const domains = fixture();
    const agent = recordingAgent();
    const rows = await runBenchmark(agent, domains);
    expect(rows.map((r) => r.checkpoint_id).sort()).toEqual(
      domains.flatMap((d) => d.checkpoints.map((c) => c.checkpoint_id)).sort(),
    );
    const sizes = agent.calls.flatMap((c) => (c.kind === "query" ? [c.ingested.length] : []));
    // Within an episode the ingested prefix only grows.
    let previous = 0;
    for (const call of agent.calls) {
      if (call.kind === "reset") previous = 0;
      if (call.kind === "query") {
        expect(call.ingested.length).toBeGreaterThanOrEqual(previous);
        previous = call.ingested.length;
      }
    }
    expect(sizes).toHaveLength(20);
  });
});

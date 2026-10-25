// GateMem's reference agents, ported from bench/agents/ at a983828.
//
// LongContextAgent (bench/agents/long_context.py, with the shared prompt and
// output path of BaseMemoryAgent._run_llm in bench/agents/base.py) is the
// paper's Long-Context method and the simplest one that calls a model: keep
// every ingested turn, put the most recent `maxTurns` in the prompt, ask once.
// run_eval.py builds it with max_turns = max(300, top_k), so 300 is the
// default here.
//
// ExampleAgent (bench/agents/example_agent.py) is upstream's interface demo:
// it stores turns and always refuses, and calls no model.
//
// The answer model is reached only through an injected ModelCall (AGENTS.md
// rule 4). `model` is called with the checkpoint id so the caller can key its
// cache on the benchmark item (rule 7); see `cached()` in @engram/runner.
import type { ModelCall } from "@engram/core";
import type { GateMemAgent } from "./harness.ts";
import { parseModelOutput } from "./parse.ts";
import { type AnswerModel, type MemoryItem, memoryBlock, queryRequest } from "./prompt.ts";
import type { AgentOutput, Turn } from "./schema.ts";
import type { AgentCheckpoint, AgentEpisode } from "./strip.ts";

/** A ModelCall per benchmark item, so every call is cached under its checkpoint. */
export type ModelForItem = (checkpointId: string) => ModelCall;

export interface LongContextOptions extends AnswerModel {
  call: ModelForItem;
  maxTurns?: number;
}

/** _audit_memory_items and _build_memory_audit, context_format "standard". */
function memoryAudit(items: readonly MemoryItem[], block: string) {
  return {
    schema_version: 1,
    stage: "prompt_context",
    context_format: "standard",
    prompt_context: {
      text: block,
      n_chars: [...block].length, // code points, as Python len()
      n_items: items.length,
      items: items.map((item, i) => ({
        rank: i + 1,
        record_id: item.record_id,
        turn_id: item.turn_id,
        principal_id: item.principal_id,
        role: item.role,
        record_refs: item.record_refs,
        score: item.score ?? null,
        text: item.text,
      })),
    },
  };
}

export class LongContextAgent implements GateMemAgent {
  readonly maxTurns: number;
  private episode: AgentEpisode | undefined;
  private turns: Turn[] = [];
  private readonly options: LongContextOptions;

  constructor(options: LongContextOptions) {
    this.options = options;
    this.maxTurns = options.maxTurns ?? 300;
  }

  reset(episode: AgentEpisode): void {
    this.episode = episode;
    this.turns = [];
  }

  ingest(turn: Turn): void {
    this.turns.push(turn);
  }

  /** The memory items for the prompt: the last `maxTurns` ingested turns. */
  context(): MemoryItem[] {
    return this.turns.slice(-this.maxTurns).map((t) => ({
      record_id: t.record_refs?.[0] ?? t.turn_id,
      turn_id: t.turn_id,
      principal_id: t.speaker.principal_id,
      role: t.speaker.role,
      text: t.text,
      record_refs: t.record_refs ?? [],
    }));
  }

  async query(checkpoint: AgentCheckpoint): Promise<AgentOutput> {
    if (!this.episode) throw new Error("LongContextAgent.query before reset");
    const items = this.context();
    const block = memoryBlock(items);
    const request = queryRequest(this.episode, checkpoint, block, this.options);
    const response = await this.options.call(checkpoint.checkpoint_id)(request);
    const [provider, ...rest] = request.model.split("/");
    return {
      ...parseModelOutput(response.text),
      llm_usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      llm_provider: rest.length > 0 ? provider : "",
      llm_model: rest.length > 0 ? rest.join("/") : request.model,
      retrieved_memory: items,
      prompt_memory_block: block,
      memory_audit: memoryAudit(items, block),
      answer_protocol: "standard",
      retrieval_s: 0,
      context_turns: items.length,
    };
  }
}

export class ExampleAgent implements GateMemAgent {
  private turns: Turn[] = [];

  reset(_episode: AgentEpisode): void {
    this.turns = [];
  }

  ingest(turn: Turn): void {
    this.turns.push(turn);
  }

  async query(_checkpoint: AgentCheckpoint): Promise<AgentOutput> {
    return {
      action: "refuse",
      answer: "I cannot provide that information.",
      answer_structured: {},
      used_record_ids: [],
      debug: { agent: "example", n_ingested_turns: this.turns.length },
    };
  }
}

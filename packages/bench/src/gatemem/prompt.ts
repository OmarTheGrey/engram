// Derived from GateMem (MIT, Copyright (c) 2026 Renz), as is the verbatim
// vendor/query_prompt.txt; the licence text is in
// fixtures/bench/gatemem/UPSTREAM-LICENSE.
//
// The query prompt of GateMem's shared agent base (BaseMemoryAgent._run_llm
// in bench/agents/base.py at a983828): the vendored template
// (vendor/query_prompt.txt, verbatim) split into system and user parts and
// filled with the requester, the requester's relationship facts, the memory
// block and the domain access policy.
import { readFileSync } from "node:fs";
import type { ModelRequest } from "@engram/core";
import type { AgentCheckpoint, AgentEpisode } from "./strip.ts";
import {
  detectDomainFromEpisode,
  formatRelationshipFact,
  getDomainLabel,
  getQueryPolicyBlock,
} from "./vendor/domains.ts";

export const QUERY_PROMPT_TEMPLATE = readFileSync(
  new URL("./vendor/query_prompt.txt", import.meta.url),
  "utf8",
);

/** A memory item as the agent puts it in front of the answer model. */
export interface MemoryItem {
  record_id: string;
  turn_id: string;
  principal_id: string;
  role: string;
  text: string;
  record_refs: string[];
  score?: number | null;
}

/** _split_system_user */
export function splitSystemUser(template: string): { system: string; user: string } {
  if (template.includes("[SYSTEM]") && template.includes("[REQUEST CONTEXT]")) {
    const at = template.indexOf("[REQUEST CONTEXT]");
    const before = template.slice(0, at);
    const after = template.slice(at + "[REQUEST CONTEXT]".length);
    return {
      system: before.replaceAll("[SYSTEM]", "").trim(),
      user: `[REQUEST CONTEXT]${after}`.trim(),
    };
  }
  return { system: "", user: template };
}

/** _relationship_mentions_principal */
function mentionsPrincipal(rel: Record<string, unknown>, principalId: string): boolean {
  const id = principalId.trim();
  if (!id) return false;
  return Object.entries(rel).some(
    ([k, v]) => typeof v === "string" && k.toLowerCase().endsWith("_id") && v === id,
  );
}

/** _format_relationship_facts: only relationships that name the requester. */
export function relationshipFacts(episode: AgentEpisode, checkpoint: AgentCheckpoint): string {
  const rels = episode.entities.relationships ?? [];
  const mine = rels.filter((r) => mentionsPrincipal(r, checkpoint.asker.principal_id));
  return mine.length === 0 ? "(none)" : mine.map(formatRelationshipFact).join("\n");
}

/** _format_retrieved_memory_block */
export function memoryBlock(items: readonly MemoryItem[]): string {
  if (items.length === 0) return "(none)";
  return items
    .map((r, i) => {
      const speaker = r.principal_id || "unknown";
      const text = r.text.trim().replaceAll("\n", " ");
      return `Memory ${i + 1} (speaker=${speaker}): ${text}`;
    })
    .join("\n");
}

/** Python str.format with named fields only; the template has no literal braces. */
function format(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_m, name: string) => {
    const value = vars[name];
    if (value === undefined) {
      throw new Error(`Missing query prompt variable '${name}' when formatting template.`);
    }
    return value;
  });
}

export function renderQueryPrompt(
  episode: AgentEpisode,
  checkpoint: AgentCheckpoint,
  block: string,
  template = QUERY_PROMPT_TEMPLATE,
): { system: string; user: string } {
  const { system, user } = splitSystemUser(template);
  const domain = detectDomainFromEpisode(episode);
  const vars = {
    asker_principal_id: checkpoint.asker.principal_id,
    asker_role: checkpoint.asker.role,
    relationship_facts_block: relationshipFacts(episode, checkpoint),
    retrieved_memory_block: block,
    query_text: checkpoint.query_text,
    domain_label: getDomainLabel(domain),
    global_access_policy_block: getQueryPolicyBlock(domain),
  };
  return { system: format(system, vars), user: format(user, vars) };
}

export interface AnswerModel {
  /** `provider/model-id`, from the run config. */
  model: string;
  seed: number;
  /** Upstream configs/runs/paper_main.yaml: 0.2. */
  temperature: number;
  /** Upstream configs/runs/paper_main.yaml: 4096. */
  maxTokens: number;
}

/** The ModelRequest for one checkpoint: the upstream system and user prompts, one user message. */
export function queryRequest(
  episode: AgentEpisode,
  checkpoint: AgentCheckpoint,
  block: string,
  model: AnswerModel,
): ModelRequest {
  const { system, user } = renderQueryPrompt(episode, checkpoint, block);
  return {
    model: model.model,
    system,
    messages: [{ role: "user", content: user }],
    seed: model.seed,
    temperature: model.temperature,
    maxTokens: model.maxTokens,
  };
}

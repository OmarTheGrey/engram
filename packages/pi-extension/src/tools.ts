// The memory tools as the model sees them: names, descriptions, parameters
// and result wording (decision D13). One definition, used by the Engram
// extension and by the runner's ungoverned tools (conditions C2 and C3), so
// the conditions present the same tools and differ only in mechanism: what
// runs behind them, and in C5 the Plane's reasons and the memory tag. The
// Engram MCP server (packages/mcp, card E8.4) imports this file too, so Claude
// Code and Codex see the same names, descriptions and wording; it loads no
// pi package at run time (only typebox), which packages/mcp's tests check.
import { Type } from "typebox";

export const MEMORY_WRITE = {
  name: "memory_write",
  label: "Memory write",
  description: "Write one item to memory in a scope such as person:<id>, team:<id> or org.",
  parameters: Type.Object({
    scope: Type.String(),
    content: Type.String(),
    class: Type.Optional(Type.Union([Type.Literal("semantic"), Type.Literal("episodic")])),
    confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  }),
} as const;

export const MEMORY_READ = {
  name: "memory_read",
  label: "Memory read",
  description: "Read the memory items that match a query.",
  parameters: Type.Object({ query: Type.String() }),
} as const;

/** What a memory_write result says, in every condition. */
export const writeResultText = (item: { id: string; scope: string; status: string }) =>
  `stored ${item.id} in ${item.scope} as ${item.status}`;

export const MEMORY_EXPLAIN = {
  name: "memory_explain",
  label: "Memory explain",
  description:
    "Explain why one of this session's reads returned what it did: score components, rank, admitting rule, grants, validity.",
  parameters: Type.Object({ read_id: Type.String() }),
} as const;

export const MEMORY_SIMULATE = {
  name: "memory_simulate",
  label: "Memory simulate",
  description:
    "Replay this session's memory calls under the current policy and a candidate preset (strict, medium or permissive; default the current policy) and report which decisions, recall and evictions would change. Nothing is written.",
  parameters: Type.Object({
    candidate: Type.Optional(
      Type.Union([Type.Literal("strict"), Type.Literal("medium"), Type.Literal("permissive")]),
    ),
  }),
} as const;

/** What a memory tool says when the Plane method behind it has not landed. */
export const notImplementedText = (tool: string, card: string) =>
  `${tool}: not implemented yet (card ${card})`;

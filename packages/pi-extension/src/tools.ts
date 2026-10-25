// The memory tools as the model sees them: names, descriptions, parameters
// and result wording (decision D13). One definition, used by the Engram
// extension and by the runner's ungoverned tools (conditions C2 and C3), so
// the conditions present the same tools and differ only in mechanism: what
// runs behind them, and in C5 the Plane's reasons and the memory tag.
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

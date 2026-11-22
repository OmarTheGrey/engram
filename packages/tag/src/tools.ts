// memory_write and memory_read as the model sees them (decision D13): names,
// descriptions, parameters and the write result's wording, one definition on
// every path. Moved here from packages/pi-extension/src/tools.ts by card
// E8.14's review fix pass (finding E8.14-4); the pi extension re-exports them
// beside memory_explain and memory_simulate.
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

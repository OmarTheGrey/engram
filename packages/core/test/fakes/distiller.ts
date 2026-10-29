// A scripted Distiller, in the manner of the scripted ModelCall: it answers
// from a table keyed on the method and the session ids, and fails loudly on an
// unknown key. Every scripted item must be a procedural candidate, because
// that is all a distiller may return.
import type { Distiller, DistillMethod, Session } from "../../src/distill.ts";
import { MemoryItem } from "../../src/schema.ts";

/** The table key for a distill call: method, model and seed, then the session ids in order. */
export function distillKey(sessions: readonly Session[], method: DistillMethod): string {
  return `${method.id}|${method.model}|${method.seed}|${sessions.map((s) => s.id).join(",")}`;
}

export function createFakeDistiller(table: Record<string, readonly MemoryItem[]> = {}): Distiller {
  const scripted = new Map(
    Object.entries(table).map(([key, items]) => [
      key,
      items.map((raw) => {
        const item = MemoryItem.parse(raw);
        if (item.class !== "procedural" || item.status !== "candidate") {
          throw new Error(
            `fake distiller: item ${item.id} under ${key} is not a procedural candidate`,
          );
        }
        return item;
      }),
    ]),
  );
  return {
    async distill(sessions, method) {
      const key = distillKey(sessions, method);
      const items = scripted.get(key);
      if (!items) throw new Error(`fake distiller: no scripted candidates for ${key}`);
      return structuredClone(items);
    },
  };
}

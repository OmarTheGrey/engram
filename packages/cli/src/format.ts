// Human-readable output. Everything printed comes from what the Plane returned.
import type { Explanation, MemoryEvent, MemoryItem } from "@engram/core";

const n4 = (x: number) => x.toFixed(4);

/** The lines that explain one returned item: score components, admitting rule, grants, validity. */
export function explanationLines(e: Explanation): string[] {
  const parts = Object.entries(e.score.components).map(([k, v]) => `${k} ${n4(v)}`);
  const lines = [`score ${n4(e.score.total)} = ${parts.join(" + ")}`, `admitted by ${e.policy_id}`];
  if (e.grants_used.length > 0) lines.push(`grants ${e.grants_used.join(", ")}`);
  lines.push(
    `valid ${e.validity.valid_from} to ${e.validity.valid_to ?? "open"}, at ${e.validity.at}`,
  );
  return lines;
}

/** The first non-empty line of the content, cut at 100 characters. */
export function preview(item: MemoryItem): string {
  const text =
    typeof item.content === "string"
      ? item.content
      : "body" in item.content && typeof item.content.body === "string"
        ? item.content.body
        : JSON.stringify(item.content);
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (line === undefined) return "";
  return line.length > 100 ? `${line.slice(0, 100)}...` : line;
}

export function decisionLines(event: MemoryEvent, item: MemoryItem | null): string[] {
  const lines = [
    `${event.op} ${event.id} at ${event.ts} by ${event.actor}`,
    `${event.decision}: ${event.reason}`,
    `policy ${event.policy_id}`,
  ];
  if (item) {
    const ref = item.store_ref ? `${item.store_ref.adapter}:${item.store_ref.key}` : "nowhere";
    lines.push(
      `item ${item.id} ${item.class} in ${item.scope}, status ${item.status}, stored at ${ref}`,
    );
  }
  return lines;
}

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

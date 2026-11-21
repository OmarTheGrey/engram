// C5's plane against C2's store (review B11-1 to B11-3): on the same person
// items, the plane returns what C2 returns, in its order (one retrieval
// pipeline, the pre-registration's "Shared retrieval for C2 to C5"); it
// judges time at the items' own date, so an episodic item it admits is read
// back; and its read ids are seeded, so two runs show the model the same tag.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFilesAdapter } from "@engram/adapters";
import type { MemoryItem } from "@engram/core";
import { afterEach, describe, expect, test } from "vitest";
import { agentActor } from "../../src/tau2/launcher.ts";
import { startUngovernedMemory } from "../../src/tau2/memory.ts";
import { startPlaneMemory } from "../../src/tau2/plane.ts";

const AT = "2024-05-15T15:00:00Z";
const actor = agentActor("airline");
const store = () =>
  createFilesAdapter({ root: mkdtempSync(join(tmpdir(), "tau2-plane-")), owner: "tau2-agent" });

const item = (n: number, content: string, cls: "semantic" | "episodic" = "semantic"): MemoryItem =>
  ({
    id: `0190a000-0000-7000-8000-${String(n).padStart(12, "0")}`,
    class: cls,
    scope: "person:tau2-agent",
    owner: actor.id,
    content,
    provenance: {
      kind: "model",
      ref: `tau2:tool_call/c${n}`,
      hash: `sha256:${"0".repeat(64)}`,
      actor: actor.id,
    },
    confidence: 0.9,
    valid_from: AT,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  }) as MemoryItem;

const post = async (url: string, path: string, body: unknown) => {
  const res = await fetch(`${url}/api/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
};

const ITEMS = [
  item(1, "Insurance requests on a booked reservation are refused by the policy."),
  item(2, "A basic economy reservation cannot be modified."),
  item(3, "Olivia Gonzalez cancelled reservation Z7GOZK on 2024-05-15.", "episodic"),
  item(4, "Unrelated note about baggage."),
];

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((m) => m.close()));
});

async function both() {
  const c2 = await startUngovernedMemory({ adapter: store(), at: AT, readLimit: 20 });
  const c5 = await startPlaneMemory({ adapter: store(), preset: "medium", at: AT, readLimit: 20 });
  open.push(c2, c5);
  for (const i of ITEMS) {
    await post(c2.url, "items", { actor, item: i });
    const written = await post(c5.url, "items", { actor, item: i });
    expect((written.event as { decision: string }).decision).toBe("allow");
  }
  return { c2, c5 };
}

const ids = (items: unknown) => (items as MemoryItem[]).map((i) => i.id);

describe("C5's plane is C2's store plus the read filter", () => {
  test("a two-term query that each item matches on one term: C5 returns C2's items in C2's order", async () => {
    const { c2, c5 } = await both();
    // "change" is in no item: the files store's own search, which needs every term, would return none.
    const query = { actor, text: "reservation change" };
    const ungoverned = await post(c2.url, "read", query);
    const governed = await post(c5.url, "read", query);
    expect([...ids(ungoverned.items)].sort()).toEqual(
      [ITEMS[0], ITEMS[1], ITEMS[2]].map((i) => i?.id).sort(),
    );
    const ranked = (governed.explanations as { item_id: string; rank: number }[])
      .sort((a, b) => a.rank - b.rank)
      .map((e) => e.item_id);
    expect(ranked).toEqual(ids(ungoverned.items));
  });

  test("an episodic item written at the items' date is read back, its validity judged at that date", async () => {
    const { c5 } = await both();
    const read = await post(c5.url, "read", { actor, text: "cancelled" });
    expect(ids(read.items)).toEqual([ITEMS[2]?.id]);
    expect(read.filtered).toBe(0);
  });

  test("read ids are seeded: two fresh planes give the same read the same id", async () => {
    const first = await both();
    const second = await both();
    const a = await post(first.c5.url, "read", { actor, text: "reservation" });
    const b = await post(second.c5.url, "read", { actor, text: "reservation" });
    const idOf = (r: Record<string, unknown>) => (r.event as { id: string }).id;
    expect(idOf(a)).toBe(idOf(b));
    expect(idOf(a)).toMatch(/^01920000-0000-7000-9000-\d{12}$/);
  });
});

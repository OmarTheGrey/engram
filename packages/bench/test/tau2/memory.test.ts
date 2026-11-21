import { createFakeAdapter } from "@engram/adapters";
import { type MemoryItem, retrieve } from "@engram/core";
import { afterEach, describe, expect, test } from "vitest";
import { startUngovernedMemory, type UngovernedMemory } from "../../src/tau2/memory.ts";

const AT = "2024-05-15T15:00:00Z";
const actor = { id: "person:tau2-agent", level: "person", memberships: [], source: "model" };

const item = (n: number, scope: string, content: string): MemoryItem =>
  ({
    id: `0190a000-0000-7000-8000-${String(n).padStart(12, "0")}`,
    class: "semantic",
    scope,
    owner: actor.id,
    content,
    provenance: { kind: "model", ref: `tau2:tool_call/c${n}`, hash: "sha256:00", actor: actor.id },
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

const post = async (memory: UngovernedMemory, path: string, body: unknown) => {
  const res = await fetch(`${memory.url}/api/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

let open: UngovernedMemory | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

describe("C2's memory: the store with no plane", () => {
  test("stores every write where it asks, a team scope a model may not write under C5 included", async () => {
    const adapter = createFakeAdapter();
    open = await startUngovernedMemory({ adapter, at: AT, readLimit: 20 });
    const written = await post(open, "items", {
      actor,
      item: item(1, "team:tau2-airline", "insurance cannot be added"),
    });
    expect(written.status).toBe(200);
    expect(written.body.event).toBeNull();
    expect((written.body.item as MemoryItem).store_ref).not.toBeNull();
    expect((await adapter.list("team:tau2-airline")).map((i) => i.id)).toEqual([
      item(1, "", "").id,
    ]);
  });

  test("a read is core's retrieval over every scope written, in its order, cut to the read limit", async () => {
    const adapter = createFakeAdapter();
    open = await startUngovernedMemory({ adapter, at: AT, readLimit: 2 });
    const items = [
      item(1, "team:tau2-airline", "reservation insurance refused"),
      item(2, "person:tau2-agent", "reservation basic economy"),
      item(3, "person:tau2-agent", "reservation reservation cancel"),
      item(4, "person:tau2-agent", "unrelated note"),
    ];
    for (const i of items) await post(open, "items", { actor, item: i });
    const read = await post(open, "read", { actor, text: "reservation" });
    const expected = retrieve(items, "reservation", AT, 2).map((r) => r.item.id);
    expect((read.body.items as MemoryItem[]).map((i) => i.id)).toEqual(expected);
    expect(read.body.filtered).toBe(0);
  });

  test("answers only the two routes the shim calls", async () => {
    open = await startUngovernedMemory({ adapter: createFakeAdapter(), at: AT, readLimit: 20 });
    expect((await post(open, "grants", { actor })).status).toBe(404);
    expect((await post(open, "items", { actor, item: "x" })).status).toBe(400);
  });
});

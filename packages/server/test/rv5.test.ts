// Card RV5, findings RV-SRF-1 and RV-SRF-2 of the repository review of the
// surfaces. RV-SRF-1: a read swept the store's scope as its owner at the
// request's `at`, whoever read, so any reader could retire the owner's items
// by naming a future time. RV-SRF-2: every request's `at` became its event's
// ts, so a backdated read got past a grant's expiry and the dogfood report,
// which judges a read at its ts, counted no violation (the report's side is
// tested in packages/core/test/unit/plane/read-time.test.ts).
import { type MemoryEvent, type MemoryItem, readValidAt } from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import * as C from "../src/contract.ts";
import { BASE, dana, eve, itemFor, NOW, PORT, testWorkspace } from "./helpers.ts";

const FUTURE = "2030-01-01T00:00:00.000Z";
const user = { ...dana, source: "user" as const };
const retirements = (events: MemoryEvent[]) =>
  events.filter((e) => e.op === "retire" || e.op === "evict");

/** A workspace with a store, and dana's item whose own ttl ran out a minute after NOW. */
async function expiring() {
  const w = testWorkspace({ store: true });
  const item = itemFor(1, { valid_from: NOW, ttl: 60 }) as unknown as MemoryItem;
  const written = await w.workspace.plane.write(user, item, NOW);
  expect(written.event.decision).toBe("allow");
  return w;
}

/** The generated client over the same workspace at another server clock. */
function clientAt(workspace: ReturnType<typeof testWorkspace>["workspace"], now: string) {
  const app = createApp(workspace, { port: PORT, now: () => now });
  return createEngramClient({ baseUrl: BASE, fetch: async (r) => app.fetch(r) });
}

describe("RV-SRF-1: a read sweeps only as the owner reading, at the server's clock", () => {
  it("a non-owner's read with a future at retires nothing and appends no retire event", async () => {
    const { client, workspace } = await expiring();
    const { data, response } = await client.POST("/api/v1/read", {
      body: { actor: eve, at: FUTURE },
    });
    expect(response.status).toBe(200);
    expect(C.ReadResponse.parse(data).sync).toBeNull();
    expect(retirements(workspace.plane.events())).toEqual([]);
  });

  it("the owner's read with a future at retires nothing either: the sweep runs at the server's clock", async () => {
    const { client, workspace } = await expiring();
    const { data } = await client.POST("/api/v1/read", { body: { actor: dana, at: FUTURE } });
    const body = C.ReadResponse.parse(data);
    expect(body.sync?.retention.expired).toEqual([]);
    expect(retirements(workspace.plane.events())).toEqual([]);
  });

  it("the owner's read once the server's own clock passes the ttl retires the item (control)", async () => {
    const { workspace } = await expiring();
    const later = clientAt(workspace, "2026-10-29T12:05:00.000Z");
    const { data } = await later.POST("/api/v1/read", { body: { actor: dana } });
    expect(C.ReadResponse.parse(data).sync?.retention.expired).toEqual([itemFor(1).id]);
    const retired = retirements(workspace.plane.events());
    expect(retired.map((e) => [e.op, e.actor, e.ts])).toEqual([
      ["retire", "person:dana", "2026-10-29T12:05:00.000Z"],
    ]);
  });

  it("a non-owner's read at the server's later clock retires nothing: only the owner's read sweeps", async () => {
    const { workspace } = await expiring();
    const later = clientAt(workspace, "2026-10-29T12:05:00.000Z");
    await later.POST("/api/v1/read", { body: { actor: eve } });
    expect(retirements(workspace.plane.events())).toEqual([]);
  });
});

describe("RV-SRF-2: the server stamps ts from its own clock; at is a read's valid_at only", () => {
  it.each([
    ["/api/v1/items", { actor: user, item: itemFor(1) }],
    ["/api/v1/items/check", { actor: user, item: itemFor(1) }],
    ["/api/v1/retain", { actor: dana, scope: "person:dana" }],
    ["/api/v1/lint", { actor: dana, scope: "person:dana" }],
    ["/api/v1/events", { actor: dana }],
    ["/api/v1/bypass", { actor: dana, bypass: { command: "mem0 add x", store: "mem0" } }],
    ["/api/v1/promote", { actor: user, item_id: itemFor(1).id, to: "team:x" }],
    ["/api/v1/grants", { actor: user, item_id: itemFor(1).id, add: [] }],
  ] as const)("%s refuses a request that names its own at, with no event", async (path, body) => {
    const { client, workspace } = testWorkspace({ store: true });
    const { response, error } = await client.POST(path as "/api/v1/items", {
      body: { ...(body as object), at: NOW } as never,
    });
    expect(response.status).toBe(400);
    expect(error).toMatchObject({ error: { code: "bad_request" } });
    expect(workspace.plane.events()).toEqual([]);
  });

  it("a read's at is recorded apart from its ts, which is the server's clock", async () => {
    const { client } = testWorkspace();
    const asked = "2026-10-10T00:00:00.000Z";
    const { data } = await client.POST("/api/v1/read", { body: { actor: dana, at: asked } });
    const body = C.ReadResponse.parse(data);
    expect(body.event.ts).toBe(NOW);
    expect(readValidAt(body.event)).toBe(asked);
    const plain = await client.POST("/api/v1/read", { body: { actor: dana } });
    expect(readValidAt(C.ReadResponse.parse(plain.data).event)).toBeNull();
  });

  it("a backdated read cannot defeat a grant's expiry", async () => {
    const { client } = testWorkspace();
    // The grant to eve expired ten minutes before the server's clock.
    const expires = "2026-10-29T11:50:00.000Z";
    await client.POST("/api/v1/items", {
      body: {
        actor: user,
        item: itemFor(1, { grants: [{ to: "person:eve", mode: "read", expires }] }),
      },
    });
    const { data } = await client.POST("/api/v1/read", {
      body: { actor: eve, at: "2026-10-29T11:49:30.000Z" },
    });
    const body = C.ReadResponse.parse(data);
    expect(body.items).toEqual([]);
    expect(body.event.ts).toBe(NOW);
    expect(body.event.item_ids).toEqual([]);
  });

  it("a read's at judges validity windows only", async () => {
    const { client } = testWorkspace();
    // True from October 1 to 15: outside its window at the server's clock.
    const item = itemFor(1, { valid_to: "2026-10-15T00:00:00.000Z" });
    await client.POST("/api/v1/items", { body: { actor: user, item } });
    const now = await client.POST("/api/v1/read", { body: { actor: dana } });
    expect(C.ReadResponse.parse(now.data).items).toEqual([]);
    const then = await client.POST("/api/v1/read", {
      body: { actor: dana, at: "2026-10-10T00:00:00.000Z" },
    });
    const body = C.ReadResponse.parse(then.data);
    expect(body.items.map((i) => i.id)).toEqual([item.id]);
    expect(body.explanations[0]?.validity.at).toBe("2026-10-10T00:00:00.000Z");
    expect(body.event.ts).toBe(NOW);
  });
});

describe("RV-CORE-3: the timeline is never judged before the log's head", () => {
  it("/events withholds an item past its ttl at the log's head, even at an earlier server clock", async () => {
    const { workspace } = testWorkspace();
    // Thirty days from October 1: expired from October 31.
    const item = itemFor(1, { ttl: 30 * 86_400 });
    await clientAt(workspace, "2026-10-02T00:00:00.000Z").POST("/api/v1/items", {
      body: { actor: user, item },
    });
    // The log's head: dana's read on November 15.
    await clientAt(workspace, "2026-11-15T00:00:00.000Z").POST("/api/v1/read", {
      body: { actor: dana },
    });
    // A server whose clock reads October 15, before the head.
    const early = clientAt(workspace, "2026-10-15T00:00:00.000Z");
    const { data } = await early.POST("/api/v1/events", { body: { actor: dana } });
    const write = C.EventsResponse.parse(data).events.find((e) => e.op === "write");
    expect(write).toBeDefined();
    expect(write?.item).toBeUndefined();
  });
});

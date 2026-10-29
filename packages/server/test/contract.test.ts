// Card E8.1's acceptance: contract tests hit every route against the fake
// adapter, through the generated client (card E8.3: a client call round-trips
// against the server), each response checked against the route's response
// schema; and every route is in the OpenAPI document.
import { type MemoryEvent, readCounts } from "@engram/core";
import { describe, expect, it } from "vitest";
import * as C from "../src/contract.ts";
import { openApiDocument } from "../src/openapi.ts";
import { API_PREFIX, ROUTES } from "../src/routes.ts";
import { dana, eve, id, itemFor, NOW, testWorkspace } from "./helpers.ts";

/** Every route id the tests below call; checked against the table at the end. */
const hit = new Set<string>();

describe("the routes, through the generated client, on the fake store", () => {
  it("write: an allowed write is 200 with its allow event and the stored item", async () => {
    const { client } = testWorkspace();
    const { data, response } = await client.POST("/api/v1/items", {
      body: { actor: { ...dana, source: "user" }, item: itemFor(1) },
    });
    hit.add("write");
    expect(response.status).toBe(200);
    const body = C.WriteResponse.parse(data);
    expect(body.event).toMatchObject({ op: "write", decision: "allow", ts: NOW });
    expect(body.item?.store_ref?.adapter).toBe("fake");
  });

  it("write: a denied write is 200 with its deny event, not an HTTP error", async () => {
    const { client } = testWorkspace();
    const { data, response } = await client.POST("/api/v1/items", {
      body: { actor: { ...dana, source: "user" }, item: itemFor(1, { scope: "person:bob" }) },
    });
    expect(response.status).toBe(200);
    const body = C.WriteResponse.parse(data);
    expect(body.item).toBeNull();
    expect(body.event).toMatchObject({ decision: "deny", policy_id: "engram/write/membership" });
  });

  it("write: an item failing the schema is a deny event from the plane", async () => {
    const { client } = testWorkspace();
    const { data } = await client.POST("/api/v1/items", {
      body: { actor: dana, item: { content: "no id" }, at: NOW },
    });
    expect(C.WriteResponse.parse(data).event.policy_id).toBe("engram/write/schema");
  });

  it("check: the decision a write would get, with no event", async () => {
    const { client, workspace } = testWorkspace();
    const { data } = await client.POST("/api/v1/items/check", {
      body: { actor: { ...dana, source: "user" }, item: itemFor(1) },
    });
    hit.add("checkWrite");
    expect(C.CheckResponse.parse(data).decision).toBe("allow");
    expect(workspace.plane.events()).toEqual([]);
  });

  it("read: returns the item with its explanation and the read event", async () => {
    const { client } = testWorkspace();
    await client.POST("/api/v1/items", {
      body: { actor: { ...dana, source: "user" }, item: itemFor(1) },
    });
    const { data } = await client.POST("/api/v1/read", { body: { actor: dana, text: "fact" } });
    hit.add("read");
    const body = C.ReadResponse.parse(data);
    expect(body.items.map((i) => i.content)).toEqual(["fact 1"]);
    expect(body.explanations[0]?.rank).toBe(1);
    expect(body.event.op).toBe("read");
    expect(body.sync).toBeNull();
  });

  it("read: a workspace with a store sweeps and adopts as its owner first, and tells only the owner", async () => {
    const { client } = testWorkspace({ store: true });
    const { data } = await client.POST("/api/v1/read", { body: { actor: dana } });
    const body = C.ReadResponse.parse(data);
    expect(body.sync?.store.scope).toBe("person:dana");
    expect(body.sync?.retention.decision).toBe("allow");
    expect(body.sync?.adoption.listed).toBe(0);
    // Review finding R3-3: another reader learns nothing of the owner's adoption.
    const other = await client.POST("/api/v1/read", { body: { actor: eve } });
    expect(C.ReadResponse.parse(other.data).sync).toBeNull();
  });

  it("events: an item in a scope the read matrix keeps from the viewer is withheld (R3-4)", async () => {
    const { client } = testWorkspace();
    await client.POST("/api/v1/items", {
      body: { actor: { ...dana, source: "user" }, item: itemFor(1) },
    });
    // A team-level member of person:dana: the medium preset's team row reads no person scope.
    const team = { id: "team:ops", level: "team" as const, memberships: ["person:dana"] };
    const { data } = await client.POST("/api/v1/events", { body: { actor: team } });
    const [write] = C.EventsResponse.parse(data).events;
    expect(write).toMatchObject({ op: "write", scope_to: "person:dana" });
    expect(write?.item).toBeUndefined();
    const own = await client.POST("/api/v1/events", { body: { actor: dana } });
    expect(C.EventsResponse.parse(own.data).events[0]?.item?.content).toBe("fact 1");
  });

  it("explain: the reader gets the explanations its read recorded and its counts", async () => {
    const { client } = testWorkspace();
    await client.POST("/api/v1/items", {
      body: { actor: { ...dana, source: "user" }, item: itemFor(1) },
    });
    const read = C.ReadResponse.parse(
      (await client.POST("/api/v1/read", { body: { actor: dana } })).data,
    );
    const { data, response } = await client.POST("/api/v1/explain/{readId}", {
      params: { path: { readId: read.event.id } },
      body: { actor: dana },
    });
    hit.add("explain");
    expect(response.status).toBe(200);
    expect(C.ExplainResponse.parse(data)).toEqual({
      read_id: read.event.id,
      explanations: read.explanations,
      counts: readCounts(read.event),
    });
    expect(C.ExplainResponse.parse(data).counts?.filtered).toBe(read.filtered);
  });

  it("promote: a promotion the gate refuses is 200 with its deny event", async () => {
    const { client } = testWorkspace();
    const { data, response } = await client.POST("/api/v1/promote", {
      body: { actor: { ...dana, source: "user" }, item_id: id(999), to: "team:x" },
    });
    hit.add("promote");
    expect(response.status).toBe(200);
    const body = C.GateResponse.parse(data);
    expect(body.decision).toBe("deny");
    expect(body.event.op).toBe("promote");
  });

  it("retain: a member sweeps its scope; a non-member gets a deny event", async () => {
    const { client } = testWorkspace();
    const own = await client.POST("/api/v1/retain", {
      body: { actor: dana, scope: "person:dana" },
    });
    hit.add("retain");
    expect(C.RetentionReport.parse(own.data).decision).toBe("allow");
    const other = await client.POST("/api/v1/retain", {
      body: { actor: dana, scope: "team:x" },
    });
    expect(C.RetentionReport.parse(other.data)).toMatchObject({ decision: "deny" });
  });

  it("events: the viewer sees its own and its member scopes' events, after a seq", async () => {
    const { client } = testWorkspace();
    await client.POST("/api/v1/items", {
      body: { actor: { ...dana, source: "user" }, item: itemFor(1) },
    });
    await client.POST("/api/v1/read", { body: { actor: eve } });
    const mine = await client.POST("/api/v1/events", { body: { actor: dana } });
    hit.add("events");
    const seen = C.EventsResponse.parse(mine.data).events;
    expect(seen.map((e: MemoryEvent) => e.op)).toEqual(["write"]);
    const theirs = await client.POST("/api/v1/events", { body: { actor: eve, after: 0 } });
    expect(C.EventsResponse.parse(theirs.data).events.map((e) => e.op)).toEqual(["read"]);
  });

  it("policy: the workspace's policy and its label", async () => {
    const { client } = testWorkspace();
    const { data } = await client.GET("/api/v1/policy");
    hit.add("policy");
    expect(C.PolicyResponse.parse(data).label).toBe("preset.medium v1");
  });

  it.each([
    ["lint", "/api/v1/lint", { scope: "person:dana" }, "L1"],
    ["simulate", "/api/v1/simulate", { workload: { id: "w", events: [] } }, "E8.9"],
    [
      "distill",
      "/api/v1/distill",
      { sessions: [], method: { id: "awm", model: "m", seed: 1 } },
      "D2",
    ],
  ] as const)("%s: 501 naming card %s", async (route, path, body, card) => {
    const { client } = testWorkspace();
    const { error, response } = await client.POST(path, { body: body as never });
    hit.add(route);
    expect(response.status).toBe(501);
    expect(C.ErrorResponse.parse(error).error).toEqual({
      code: "not_implemented",
      message: `not implemented yet (card ${card})`,
      card,
    });
  });

  it("bypass: one bypass_blocked deny event with the attempt in its reason", async () => {
    const { client } = testWorkspace();
    const { data } = await client.POST("/api/v1/bypass", {
      body: { actor: dana, bypass: { command: "mem0 add x", store: "mem0" } },
    });
    hit.add("bypass");
    expect(C.EventResponse.parse(data).event).toMatchObject({
      op: "bypass_blocked",
      decision: "deny",
      policy_id: "engram/bypass/store-command",
    });
  });

  it("viewer: the identity serve named, or null", async () => {
    const named = await testWorkspace({ viewer: true }).client.GET("/api/v1/viewer");
    hit.add("viewer");
    expect(C.ViewerResponse.parse(named.data).viewer).toEqual(dana);
    const none = await testWorkspace().client.GET("/api/v1/viewer");
    expect(C.ViewerResponse.parse(none.data).viewer).toBeNull();
  });

  it("health: ok", async () => {
    const { data } = await testWorkspace().client.GET("/api/v1/health");
    hit.add("health");
    expect(C.HealthResponse.parse(data).status).toBe("ok");
  });

  it("every route of the table was hit above", () => {
    expect([...hit].sort()).toEqual(ROUTES.map((r) => r.id).sort());
  });
});

describe("the OpenAPI document", () => {
  const doc = openApiDocument() as {
    openapi: string;
    paths: Record<string, Record<string, { operationId: string }>>;
    components: { schemas: Record<string, unknown> };
  };

  it("is OpenAPI 3.1 and has every route of the table, under its method and id", () => {
    expect(doc.openapi).toBe("3.1.0");
    for (const r of ROUTES)
      expect(doc.paths[`${API_PREFIX}${r.path}`]?.[r.method]?.operationId).toBe(r.id);
    const operations = Object.values(doc.paths).flatMap((p) => Object.keys(p));
    expect(operations).toHaveLength(ROUTES.length);
  });

  it("names core's contracts as sdk/schema does", () => {
    for (const name of [
      "MemoryItem",
      "MemoryEvent",
      "Policy",
      "Grant",
      "Explanation",
      "LintFinding",
      "JsonValue",
    ])
      expect(doc.components.schemas[name]).toBeDefined();
  });

  it("has no dangling reference", () => {
    const refs = JSON.stringify(doc).match(/#\/components\/schemas\/(\w+)/g) ?? [];
    for (const ref of refs)
      expect(doc.components.schemas[ref.split("/").pop() ?? ""]).toBeDefined();
  });
});

// ADR 0027 decision 6: a policy decision is a response, not an error; the
// errors a route can raise map to fixed statuses with a JSON body, and an
// unexpected one is 500 with no internals (it goes to onError instead).
import { createEngramClient } from "@engram/sdk";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { NO_STORE, NoStoreError, workspaceOf } from "../src/workspace.ts";
import { BASE, dana, eve, itemFor, NOW, PORT, testWorkspace } from "./helpers.ts";

describe("error statuses", () => {
  it("400 for a body that fails its schema", async () => {
    const { client } = testWorkspace();
    const { response, error } = await client.POST("/api/v1/read", {
      body: { actor: { id: "", level: "boss", memberships: [] } } as never,
    });
    expect(response.status).toBe(400);
    expect(error?.error.code).toBe("bad_request");
  });

  it("400 for a body that is not JSON", async () => {
    const { app } = testWorkspace();
    const response = await app.fetch(
      new Request(`${BASE}/api/v1/read`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("400 for a call the plane refuses as invalid (InvalidCallError)", async () => {
    const { client } = testWorkspace();
    const { response, error } = await client.POST("/api/v1/promote", {
      body: { actor: dana, item_id: "not-an-id", to: "team:x", at: NOW },
    });
    expect(response.status).toBe(400);
    expect(error?.error.code).toBe("invalid_call");
  });

  it("403 when another actor asks to explain a read", async () => {
    const { client } = testWorkspace();
    const read = await client.POST("/api/v1/read", { body: { actor: dana } });
    const readId = read.data?.event.id ?? "";
    const { response, error } = await client.POST("/api/v1/explain/{readId}", {
      params: { path: { readId } },
      body: { actor: eve },
    });
    expect(response.status).toBe(403);
    expect(error?.error.message).toContain("only its reader may explain it");
  });

  it("404 for a read id that names no read, and for an unknown route", async () => {
    const { client, app } = testWorkspace();
    const { response, error } = await client.POST("/api/v1/explain/{readId}", {
      params: { path: { readId: "nope" } },
      body: { actor: dana },
    });
    expect(response.status).toBe(404);
    expect(error?.error.message).toContain("names no read event");
    expect((await app.fetch(new Request(`${BASE}/api/v1/nothing`))).status).toBe(404);
  });

  it("503 for a write in a workspace with no store", async () => {
    const { workspace } = testWorkspace();
    const bare = workspaceOf({ ...workspace.deps, adapter: NO_STORE });
    const app = createApp(bare, { port: PORT, now: () => NOW });
    const client = createEngramClient({ baseUrl: BASE, fetch: async (r) => app.fetch(r) });
    const { response, error } = await client.POST("/api/v1/items", {
      body: { actor: { ...dana, source: "user" }, item: itemFor(1) },
    });
    expect(response.status).toBe(503);
    expect(error?.error.message).toBe(new NoStoreError().message);
  });

  it("500 with no internals for an unexpected error, which goes to onError", async () => {
    const { workspace } = testWorkspace();
    const seen: unknown[] = [];
    const broken = {
      ...workspace,
      plane: {
        ...workspace.plane,
        read: () => Promise.reject(new Error("secret internals at /home/x")),
      },
    };
    const app = createApp(broken, { port: PORT, now: () => NOW, onError: (e) => seen.push(e) });
    const response = await app.fetch(
      new Request(`${BASE}/api/v1/read`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: dana }),
      }),
    );
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("secret");
    expect(JSON.parse(text).error).toEqual({ code: "internal", message: "internal error" });
    expect(seen).toHaveLength(1);
  });
});

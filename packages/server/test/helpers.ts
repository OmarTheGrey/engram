// A workspace for the server's tests: an in-memory log over the fake store,
// the medium preset, ids from a counter and a fixed clock; and the generated
// client bound to the app in process (no socket).
import { createFakeAdapter } from "@engram/adapters";
import { loadPreset, migrate, openSqlite } from "@engram/core";
import { createEngramClient, type WriteRequest } from "@engram/sdk";
import { createApp } from "../src/app.ts";
import { type Store, type Workspace, workspaceOf } from "../src/workspace.ts";

export const NOW = "2026-10-29T12:00:00.000Z";
export const PORT = 7313;
export const BASE = `http://127.0.0.1:${PORT}`;
export const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, "0")}`;

export const dana = { id: "person:dana", level: "person" as const, memberships: ["person:dana"] };
export const eve = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };

export function testWorkspace(options: { store?: boolean; viewer?: boolean } = {}) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter();
  let n = 0;
  const store: Store | null = options.store
    ? { name: "fake", root: "(memory)", adapter, owner: "dana", scope: "person:dana" }
    : null;
  const workspace: Workspace = workspaceOf(
    { db, adapter, policy: loadPreset("medium"), newId: () => id(++n) },
    { store, viewer: options.viewer ? dana : null },
  );
  const errors: unknown[] = [];
  const app = createApp(workspace, { port: PORT, now: () => NOW, onError: (e) => errors.push(e) });
  const requests: Request[] = [];
  const client = createEngramClient({
    baseUrl: BASE,
    fetch: async (request) => {
      requests.push(request.clone());
      return app.fetch(request);
    },
  });
  return { db, adapter, workspace, app, client, errors, requests };
}

/** An item as a caller assembles it; the plane fills nothing in. */
export function itemFor(n: number, over: WriteRequest["item"] = {}): WriteRequest["item"] {
  return {
    id: id(500 + n),
    class: "semantic",
    scope: "person:dana",
    owner: "person:dana",
    content: `fact ${n}`,
    provenance: {
      kind: "user",
      ref: "test",
      hash: `sha256:${"0".repeat(64)}`,
      actor: "person:dana",
    },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00.000Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    ...over,
  };
}

// The memory seam (card B7): what MERIT's memory interface reaches through
// the Python shim (packages/bench/scripts/merit-shim.py), one backend per
// arc, since MERIT builds a fresh memory per arc (`cond_cls()` in
// scripts/run_pilot.py) and the runner builds a fresh store per session
// (packages/runner/src/stores.ts).
//
// - C5, `plane`: `engram serve`'s app in process (@engram/server's listen),
//   on a scratch log and the store, so the shim calls /api/v1 and every
//   write crosses Plane.write and every read Plane.read. The plane is the
//   runner's C5: writes through createPlane, reads through a plane over the
//   same log and store built with the core pipeline and the shared limit
//   (coreReadPlane in packages/runner/src/conditions.ts).
// - C2, `ungoverned`: the runner's ungoverned baseline over HTTP: a write
//   lands in the store as given and a read is core's `retrieve` over every
//   item the store lists in the scopes it holds, cut to the shared limit
//   (ungoverned memory tools and ungoverned read, conditions.ts). It is the
//   measured absence of the plane, so it calls the adapter directly, as the
//   runner's C2 does and for the same reason (AGENTS.md rule 2 governs the
//   product paths); it holds no policy logic (rule 1). It answers the same
//   request shapes as /api/v1's write and read, under /ungoverned/v1.
//
// The server's clock is fixed (`MERIT_READ_AT`), as the runner's probes fix
// theirs, so a read's recency scores, and therefore its order and the
// prompt it lands in, do not depend on when the run happens (rule 7).
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Adapter,
  createFakeAdapter,
  createHashingEmbedder,
  createLettaAdapter,
  createMem0Adapter,
} from "@engram/adapters";
import {
  type Actor,
  allEvents,
  createPlane,
  type Db,
  loadPreset,
  type MemoryEvent,
  MemoryItem,
  migrate,
  openSqlite,
  type PresetName,
  retrieve,
} from "@engram/core";
import { API_PREFIX, listen, workspaceOf } from "@engram/server";
import { z } from "zod";
import type { MeritStore } from "./config.ts";

/** How many items a read returns in every condition: the runner's READ_LIMIT (conditions.ts). */
export const MERIT_READ_LIMIT = 20;

/** The server's clock: every write, read and event of a MERIT run happens at this instant. */
export const MERIT_READ_AT = "2026-01-02T00:00:00.000Z";

/** The first item's valid_from; the shim adds one second per item it writes, so recency orders them. */
export const MERIT_VALID_FROM_BASE = "2026-01-01T00:00:00.000Z";

/** The path the ungoverned backend serves under, beside /api/v1's shapes. */
export const UNGOVERNED_PREFIX = "/ungoverned/v1";

/**
 * Who MERIT's agent acts as: one person, whose own scope takes the
 * transcripts. `source: "model"` is what the pi extension sets for an
 * agent's tool calls (packages/pi-extension/src/extension.ts, decision D4):
 * the transcript is what the model and its tools produced.
 */
export const MERIT_ACTOR: Actor = {
  id: "person:merit-agent",
  level: "person",
  memberships: ["person:merit-agent"],
  source: "model",
};

/** Deterministic UUIDv7-shaped ids, as the runner's sequentialIds (gatemem-probe.ts): the shim's items use variant 8. */
export const sequentialIds = (variant: "8" | "9") => {
  let n = 0;
  return () => `01920000-0000-7000-${variant}000-${String(++n).padStart(12, "0")}`;
};

/** The prefix of every Letta store's temporary repository. */
export const MERIT_LETTA_PREFIX = "engram-merit-letta-";

/** A fresh, empty store, as the runner's openStore builds each (packages/runner/src/stores.ts). */
export async function openMeritStore(
  name: MeritStore,
): Promise<{ adapter: Adapter; close(): Promise<void> }> {
  switch (name) {
    case "fake":
      return { adapter: createFakeAdapter(), close: async () => {} };
    case "mem0":
      return {
        adapter: await createMem0Adapter({ embedder: createHashingEmbedder(), dbPath: ":memory:" }),
        close: async () => {},
      };
    case "letta": {
      const root = mkdtempSync(join(tmpdir(), MERIT_LETTA_PREFIX));
      const close = () => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
      try {
        return { adapter: await createLettaAdapter({ root }), close };
      } catch (e) {
        await close();
        throw e;
      }
    }
  }
}

export type BackendKind = "plane" | "ungoverned";

/** One arc's memory: the base URL the shim calls (`<url>/api/v1` or `<url>/ungoverned/v1`). */
export interface MemoryBackend {
  kind: BackendKind;
  base: string;
  /** The plane's events, in order (C5); empty for the ungoverned backend, which keeps no log. */
  events(): MemoryEvent[];
  /** What the store holds now, every scope it was written in. */
  stored(): Promise<number>;
  close(): Promise<void>;
}

const WriteBody = z.strictObject({ actor: z.unknown(), item: z.unknown() });
const ReadBody = z.strictObject({ actor: z.unknown(), text: z.string().optional() });

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(text)),
  });
  res.end(text);
}

/** The ungoverned baseline (C2) over one store, on a free loopback port. */
async function ungovernedBackend(adapter: Adapter, close: () => Promise<void>) {
  const scopes = new Set<string>();
  const listed = async () => {
    const all = await Promise.all([...scopes].sort().map((s) => adapter.list(s)));
    return all.flat();
  };
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (req.method !== "POST") return sendJson(res, 405, { error: `${req.method} ${path}` });
    if (path === `${UNGOVERNED_PREFIX}/items`) {
      const body = WriteBody.parse(await readJson(req));
      // The shape every store takes; no decision is made on it.
      const item = MemoryItem.parse(body.item);
      await adapter.write(item);
      scopes.add(item.scope);
      return sendJson(res, 200, { item });
    }
    if (path === `${UNGOVERNED_PREFIX}/read`) {
      const body = ReadBody.parse(await readJson(req));
      const ranked = retrieve(await listed(), body.text ?? "", MERIT_READ_AT, MERIT_READ_LIMIT);
      return sendJson(res, 200, { items: ranked.map((r) => r.item) });
    }
    return sendJson(res, 404, { error: `no route ${path}` });
  };
  const server = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      if (!res.headersSent) sendJson(res, 400, { error: (e as Error).message ?? String(e) });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  const backend: MemoryBackend = {
    kind: "ungoverned",
    base: `http://127.0.0.1:${port}${UNGOVERNED_PREFIX}`,
    events: () => [],
    stored: async () => (await listed()).length,
    close: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      await close();
    },
  };
  return backend;
}

/** The enforced condition (C5): engram serve's app over a scratch log and the store. */
async function planeBackend(
  adapter: Adapter,
  preset: PresetName,
  close: () => Promise<void>,
): Promise<MemoryBackend> {
  const db: Db = openSqlite(":memory:");
  migrate(db);
  const policy = loadPreset(preset);
  const newId = sequentialIds("9");
  const deps = { db, adapter, policy, newId };
  // The runner's C5 (coreReadPlane): the same Plane, its read from a plane
  // over the same log and store built with the core pipeline and the limit.
  const core = createPlane({ ...deps, retrieval: { pipeline: "core", limit: MERIT_READ_LIMIT } });
  const base = workspaceOf(deps);
  const workspace = {
    ...base,
    plane: {
      ...base.plane,
      read: (actor: Actor, query: Parameters<typeof core.read>[1]) => core.read(actor, query),
    },
  };
  const server = await listen(workspace, { port: 0, now: () => MERIT_READ_AT, ui: null });
  const scopes = () => [...new Set(currentScopes(db))].sort();
  return {
    kind: "plane",
    base: `${server.url}${API_PREFIX}`,
    events: () => allEvents(db),
    stored: async () => (await Promise.all(scopes().map((s) => adapter.list(s)))).flat().length,
    close: async () => {
      await server.close();
      db.close();
      await close();
    },
  };
}

/** The scopes the plane's log has items in. */
function currentScopes(db: Db): string[] {
  return allEvents(db).flatMap((e) => (e.scope_to === null ? [] : [e.scope_to]));
}

/** One arc's memory under a condition with a store. */
export async function openMemoryBackend(
  kind: BackendKind,
  store: MeritStore,
  preset: PresetName,
): Promise<MemoryBackend> {
  const opened = await openMeritStore(store);
  try {
    return kind === "plane"
      ? await planeBackend(opened.adapter, preset, opened.close)
      : await ungovernedBackend(opened.adapter, opened.close);
  } catch (e) {
    await opened.close();
    throw e;
  }
}

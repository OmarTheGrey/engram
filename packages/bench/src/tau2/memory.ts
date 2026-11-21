// C2's memory for tau2 (card B11): the ungoverned baseline, the store with no
// plane, on loopback, so the Python shim reaches C2 and C5 the same way and
// only the URL differs. It answers the two routes of `engram serve` the shim
// calls, with the same request bodies:
//
//   POST /api/v1/items   {actor, item}  the item lands where it asks
//   POST /api/v1/read    {actor, text}  the store's items in core's order
//
// It is the runner's C2 (packages/runner/src/conditions.ts,
// ungovernedMemoryTools and ungovernedRead), which this package may not
// import: every write is stored as sent and every read is core's retrieval
// pipeline (`retrieve`) over every item the store lists in the scopes it
// holds, cut to the read limit. So C5 differs from it by the plane's filter
// (and by the retrieval `engram serve` runs, docs/log/2026-11-21-b11-finding-serve-retrieval.md).
// This is the one place outside an adapter's own tests that calls an
// adapter directly, as the runner's C2 tools are: the measured absence of
// the plane (AGENTS.md rule 2 governs the product paths). There is no policy
// logic here (rule 1): nothing is checked, nothing is refused.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { type Adapter, canonicalJson, type MemoryItem, retrieve } from "@engram/core";

export interface UngovernedMemory {
  /** `http://127.0.0.1:<port>`: what the shim calls `/api/v1/...` under. */
  url: string;
  /** Every item written, in order. */
  written: MemoryItem[];
  close(): Promise<void>;
}

export interface UngovernedMemoryOptions {
  adapter: Adapter;
  /** The clock a read ranks at: the config's memory time, never the wall clock. */
  at: string;
  /** The runner's READ_LIMIT. */
  readLimit: number;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function body(req: IncomingMessage): Promise<unknown> {
  return new Promise((done, fail) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        done(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        fail(e);
      }
    });
    req.on("error", fail);
  });
}

function send(res: ServerResponse, status: number, value: unknown) {
  const text = canonicalJson(value);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(text)),
  });
  res.end(text);
}

/** Starts C2's memory on 127.0.0.1, a free port. */
export async function startUngovernedMemory(
  options: UngovernedMemoryOptions,
): Promise<UngovernedMemory> {
  const { adapter, at, readLimit } = options;
  const scopes = new Set<string>();
  const written: MemoryItem[] = [];

  const listed = async () =>
    (await Promise.all([...scopes].sort().map((s) => adapter.list(s)))).flat();

  const serve = async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (req.method !== "POST") return send(res, 405, { error: `${req.method} is not served` });
    const sent = await body(req);
    if (!isObject(sent)) return send(res, 400, { error: "the body is not a JSON object" });
    if (path === "/api/v1/items") {
      if (!isObject(sent.item) || typeof sent.item.scope !== "string") {
        return send(res, 400, { error: "item must be an object with a scope" });
      }
      const item = sent.item as unknown as MemoryItem;
      const ref = await adapter.write(item);
      scopes.add(item.scope);
      written.push(item);
      return send(res, 200, { item: { ...item, store_ref: ref }, event: null, retention: [] });
    }
    if (path === "/api/v1/read") {
      const text = typeof sent.text === "string" ? sent.text : undefined;
      const items = retrieve(await listed(), text, at, readLimit).map((r) => r.item);
      return send(res, 200, { items, filtered: 0 });
    }
    return send(res, 404, { error: `no route ${path}` });
  };

  const server = createServer((req, res) => {
    serve(req, res).catch((e: unknown) => {
      if (!res.headersSent) send(res, 500, { error: e instanceof Error ? e.message : String(e) });
      else res.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const port = (server.address() as AddressInfo).port;
  let closing: Promise<void> | undefined;
  return {
    url: `http://127.0.0.1:${port}`,
    written,
    close() {
      closing ??= new Promise<void>((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
        server.closeAllConnections();
      });
      return closing;
    },
  };
}

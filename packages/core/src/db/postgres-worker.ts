// The worker thread behind openPostgres (postgres.ts, ADR 0024). It holds one
// postgres.js connection and answers one request at a time: it posts the reply
// on its port, then raises the shared flag the main thread waits on with
// Atomics.wait, which then takes the reply with receiveMessageOnPort.
import { type MessagePort, workerData } from "node:worker_threads";
import postgres from "postgres";
import type { Request, Response } from "./postgres.ts";

const { url, flag, port } = workerData as {
  url: string;
  flag: SharedArrayBuffer;
  port: MessagePort;
};
const signal = new Int32Array(flag);

const sql = postgres(url, {
  max: 1,
  idle_timeout: 0,
  onnotice: () => {},
  types: { bigint: postgres.BigInt },
});

// Rows cross to the main thread by structured clone. An int8 arrives as a
// number when it is a safe integer, as node:sqlite returns it, and as a bigint
// otherwise; a bytea arrives as a Uint8Array, as a SQLite blob does.
function value(v: unknown): unknown {
  if (typeof v === "bigint") return Number.isSafeInteger(Number(v)) ? Number(v) : v;
  if (v instanceof Uint8Array) return new Uint8Array(v);
  return v;
}

function rows(result: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return result.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, value(v)])));
}

async function answer(req: Request): Promise<Response> {
  switch (req.op) {
    case "connect":
      await sql.unsafe("SELECT 1");
      return { ok: true, rows: [], changes: 0 };
    case "exec":
      await sql.unsafe(req.sql).simple();
      return { ok: true, rows: [], changes: 0 };
    case "query": {
      const result = await sql.unsafe(req.sql, req.params as never[]);
      return { ok: true, rows: rows(result), changes: result.count ?? 0 };
    }
    case "close":
      await sql.end({ timeout: 5 });
      return { ok: true, rows: [], changes: 0 };
  }
}

function reply(res: Response): void {
  port.postMessage(res);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
}

port.on("message", (req: Request) => {
  answer(req).then(reply, (e: unknown) => {
    const err = e as { message?: unknown; code?: unknown };
    reply({
      ok: false,
      message: String(err?.message ?? e),
      code: typeof err?.code === "string" ? err.code : undefined,
    });
  });
});

// The log backends of the erasure-residue check (card X19): SQLite in a file
// (WAL mode, as openSqlite sets it) and a throwaway embedded Postgres 17 with
// its own data directory (no Docker; ADR 0024's amendment), so the bytes each
// keeps on disk can be searched: SQLite's database file, free pages included,
// and its write-ahead log; Postgres's heap files under base/ and its WAL
// under pg_wal/, after a CHECKPOINT writes the dirty pages out.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { type Db, openPostgres, openSqlite } from "@engram/core";
// The embedded server's loader without its exit hooks, shared with core's
// tests (it says it is reusable by any other package).
import { loadEmbeddedPostgres } from "../../../core/test/db/embedded-postgres.ts";

export interface BackendHandle {
  db: Db;
  /** The database's own files: SQLite's file; Postgres's heap files. */
  fileBytes(): Promise<Uint8Array[]>;
  /** The write-ahead log's files. */
  walBytes(): Promise<Uint8Array[]>;
  close(): Promise<void>;
}

/** Every file under `dir`, in path order, as bytes; none when `dir` is missing. */
export function filesUnder(dir: string): Uint8Array[] {
  if (!existsSync(dir)) return [];
  const out: Uint8Array[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(readFileSync(path));
    }
  };
  walk(dir);
  return out;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

export async function openBackend(
  name: "sqlite" | "postgres",
  dir: string,
): Promise<BackendHandle> {
  mkdirSync(dir, { recursive: true });
  if (name === "sqlite") {
    const path = join(dir, "plane.sqlite");
    const db = openSqlite(path);
    const read = (p: string) => (existsSync(p) ? [readFileSync(p)] : []);
    return {
      db,
      fileBytes: async () => read(path),
      walBytes: async () => read(`${path}-wal`),
      close: async () => db.close(),
    };
  }
  const data = join(dir, "data");
  const EmbeddedPostgres = await loadEmbeddedPostgres();
  const output: string[] = [];
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: data,
    port,
    user: "engram",
    password: "engram",
    persistent: false,
    // No autovacuum: it runs on its own timer, so whether it has pruned a
    // page when the files are read would differ from run to run, and the
    // bytes must not (the result's limits say what this leaves out).
    postgresFlags: ["-c", "autovacuum=off"],
    onLog: () => {},
    onError: (e) => output.push(String(e)),
  });
  try {
    await pg.initialise();
    await pg.start();
  } catch (e) {
    await pg.stop().catch(() => {});
    throw new Error(`embedded Postgres did not start: ${String(e)} ${output.join(" ")}`.trim());
  }
  let db: Db;
  try {
    db = openPostgres(`postgres://engram:engram@127.0.0.1:${port}/postgres`);
  } catch (e) {
    await pg.stop().catch(() => {});
    throw e;
  }
  return {
    db,
    async fileBytes() {
      db.exec("CHECKPOINT");
      return filesUnder(join(data, "base"));
    },
    async walBytes() {
      db.exec("CHECKPOINT");
      return filesUnder(join(data, "pg_wal"));
    },
    async close() {
      try {
        db.close();
      } finally {
        await pg.stop();
      }
    },
  };
}

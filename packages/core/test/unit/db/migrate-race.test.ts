// The first migration is race-free (card E1.9; the finding of card E1.6's
// verification, docs/log/2026-11-21-e1-6-verify-finding-migrate-race.md).
// Two processes open one fresh log and migrate it at once, on SQLite (one
// file) and on Postgres (one schema). Before the fix both read every
// migration as pending outside the transaction that applies it, and the
// second failed with "table events already exists". Now each migration is
// re-read inside its own transaction, under the log's lock, and skipped when
// the other process applied it: both succeed, every migration is applied
// exactly once, by one of them, and recorded once.
//
// The shape of the regression (racers held at a barrier so they overlap,
// several rounds, then the log checked by construction) follows
// world-model-mcp's concurrent-append regression (MIT,
// SaravananJaichandar/world-model-mcp at
// c8be3765e87dfd1d69931e37622af048ba67fcb3,
// tests/test_tamper_evident_concurrent_append.py), ported to migrations.
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import type { Db } from "../../../src/db/db.ts";
import { MIGRATIONS, migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import {
  BACKENDS,
  forEachBackend,
  freshSchema,
  openInSchema,
  postgresUrl,
} from "../../db/backends.ts";

const RACER = fileURLToPath(new URL("../../db/migrate-racer.ts", import.meta.url));
const ROUNDS = 6;
/** Racer i of round r waits (i - 1) * (r + 1) ms after the barrier. */
const delay = (round: number, racer: number) => String((racer - 1) * (round + 1));
const RACERS = 4;

interface Report {
  racer: string;
  applied: number[];
  error?: string;
}

const race = (args: (racer: number) => string[]) =>
  Promise.all(
    Array.from({ length: RACERS }, (_, i) =>
      promisify(execFile)(process.execPath, [RACER, ...args(i + 1)]).then(
        (r) => r.stdout,
        (e: { stdout?: string }) => e.stdout ?? "",
      ),
    ),
  ).then((outs) => outs.map((o) => JSON.parse(o.trim().split("\n").at(-1) ?? "{}") as Report));

/** Every racer succeeded, and between them they applied each migration once. */
function expectOnce(reports: Report[], recorded: number[]) {
  const ids = MIGRATIONS.map((m) => m.id);
  for (const r of reports) expect(r.error, `racer ${r.racer}`).toBeUndefined();
  expect(reports.flatMap((r) => r.applied).sort((a, b) => a - b)).toEqual(ids);
  expect(recorded).toEqual(ids);
}

const sqliteSkip = BACKENDS.find((b) => b.name === "sqlite")?.skip;
const postgresSkip = BACKENDS.find((b) => b.name === "postgres")?.skip;

// The race made deterministic: a handle that lets the other one migrate the
// whole log just after its own first read of the migrations table, which
// found every migration pending. The window the processes below fall into by
// timing, entered every time.
forEachBackend((backend) => {
  test("a migration the other handle applied after this one read the table is skipped", () => {
    const [a, b] = backend.pair();
    let interleaved = false;
    const late: Db = {
      get dialect() {
        return a.dialect;
      },
      exec: (sql) => a.exec(sql),
      prepare(sql) {
        const statement = a.prepare(sql);
        if (sql !== "SELECT id FROM schema_migrations") return statement;
        return {
          ...statement,
          run: (...p) => statement.run(...p),
          get: (...p) => statement.get(...p),
          all(...p) {
            const rows = statement.all(...p);
            if (!interleaved) {
              interleaved = true;
              expect(rows).toEqual([]);
              expect(migrate(b)).toEqual(MIGRATIONS.map((m) => m.id));
            }
            return rows;
          },
        };
      },
      transaction: (fn) => a.transaction(fn),
      close: () => a.close(),
    };
    expect(migrate(late)).toEqual([]);
    expect(interleaved).toBe(true);
    const recorded = a.prepare("SELECT id FROM schema_migrations ORDER BY id").all();
    expect(recorded.map((r) => Number(r.id))).toEqual(MIGRATIONS.map((m) => m.id));
  });
});

describe("two processes migrating one fresh log at once", () => {
  test.skipIf(sqliteSkip !== undefined)(
    "sqlite: both succeed and every migration is applied once",
    async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const path = join(mkdtempSync(join(tmpdir(), "engram-race-")), "plane.sqlite");
        const db = openSqlite(path);
        try {
          db.exec("CREATE TABLE ready (racer TEXT)");
          const reports = await race((i) => [
            "sqlite",
            path,
            String(i),
            String(RACERS),
            delay(round, i),
          ]);
          const recorded = db
            .prepare("SELECT id FROM schema_migrations ORDER BY id")
            .all()
            .map((r) => Number(r.id));
          expectOnce(reports, recorded);
          expect(db.prepare("SELECT count(*) AS n FROM events").get()?.n).toBe(0);
        } finally {
          db.close();
        }
      }
    },
    60_000,
  );

  test.skipIf(postgresSkip !== undefined)(
    "postgres: both succeed and every migration is applied once",
    async () => {
      const url = postgresUrl() as string;
      for (let round = 0; round < ROUNDS; round++) {
        const schema = freshSchema();
        const db = openInSchema(url, schema);
        try {
          db.exec("CREATE TABLE ready (racer TEXT)");
          const reports = await race((i) => [
            "postgres",
            url,
            String(i),
            String(RACERS),
            delay(round, i),
            schema,
          ]);
          const recorded = db
            .prepare("SELECT id FROM schema_migrations ORDER BY id")
            .all()
            .map((r) => Number(r.id));
          expectOnce(reports, recorded);
        } finally {
          db.close();
        }
      }
    },
    90_000,
  );
});

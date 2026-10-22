import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { MIGRATIONS, migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";

test("applies every migration once, in order, and records it", () => {
  const db = openSqlite(":memory:");
  expect(migrate(db)).toEqual(MIGRATIONS.map((m) => m.id));
  expect(migrate(db)).toEqual([]);
  const applied = db.prepare("SELECT id FROM schema_migrations ORDER BY id").all();
  expect(applied.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
});

test("rolls back a failing migration and records nothing for it", () => {
  const db = openSqlite(":memory:");
  const broken = [...MIGRATIONS, { id: 999, name: "broken", up: "CREATE TABLE x(a); NOT SQL" }];
  expect(() => migrate(db, broken)).toThrow();
  const ids = db
    .prepare("SELECT id FROM schema_migrations")
    .all()
    .map((r) => r.id);
  expect(ids).not.toContain(999);
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'x'").all()).toEqual([]);
});

test("a transaction rolls back when its body throws", () => {
  const db = openSqlite(":memory:");
  db.exec("CREATE TABLE t(a)");
  expect(() =>
    db.transaction(() => {
      db.prepare("INSERT INTO t VALUES (?)").run(1);
      throw new Error("boom");
    }),
  ).toThrow("boom");
  expect(db.prepare("SELECT count(*) AS n FROM t").get()).toEqual({ n: 0 });
});

test("a transaction refuses an async body, which would commit before its awaited work", () => {
  const db = openSqlite(":memory:");
  db.exec("CREATE TABLE t(a)");
  expect(() =>
    db.transaction(() => Promise.resolve(db.prepare("INSERT INTO t VALUES (1)").run())),
  ).toThrow(/synchronous/);
  expect(db.prepare("SELECT count(*) AS n FROM t").get()).toEqual({ n: 0 });
});

test("a file database waits for a lock instead of failing at once, in WAL mode", () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-db-"));
  const db = openSqlite(join(dir, "plane.sqlite"));
  expect(db.prepare("PRAGMA busy_timeout").get()).toEqual({ timeout: 5000 });
  expect(db.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
  db.close();
});

test("two connections to one file share a dense sequence", () => {
  const path = join(mkdtempSync(join(tmpdir(), "engram-db-")), "plane.sqlite");
  const a = openSqlite(path);
  migrate(a);
  const b = openSqlite(path);
  a.exec("CREATE TABLE t(seq INTEGER PRIMARY KEY)");
  for (const db of [a, b, a, b]) {
    db.transaction(() => {
      const next = db.prepare("SELECT coalesce(max(seq) + 1, 0) AS n FROM t").get();
      db.prepare("INSERT INTO t VALUES (?)").run(Number(next?.n));
    });
  }
  expect(
    b
      .prepare("SELECT seq FROM t ORDER BY seq")
      .all()
      .map((r) => r.seq),
  ).toEqual([0, 1, 2, 3]);
  a.close();
  b.close();
});

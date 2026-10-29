// The Db contract (ADR 0024, decision 1): what every backend behind the
// synchronous Db interface must do, as a suite run through a backend factory.
// contract.test.ts runs it on node:sqlite and on Postgres. Column types differ
// by dialect only where SQL itself differs (BLOB and BYTEA, REAL and DOUBLE
// PRECISION); everything a caller observes is the same.
import { afterEach, describe, expect, test } from "vitest";
import type { Db, Param } from "../../src/db/db.ts";
import { MIGRATIONS, migrate } from "../../src/db/migrate.ts";
import type { Backend } from "./backends.ts";

const typed = (db: Db) =>
  db.dialect === "postgres"
    ? "CREATE TABLE p (s TEXT, i INTEGER, f DOUBLE PRECISION, b BIGINT, n TEXT, y BYTEA)"
    : "CREATE TABLE p (s TEXT, i INTEGER, f REAL, b BIGINT, n TEXT, y BLOB)";

export function dbContract(backend: Backend): void {
  const open: Db[] = [];
  const fresh = () => {
    const db = backend.open();
    open.push(db);
    return db;
  };
  afterEach(() => {
    for (const db of open.splice(0)) {
      try {
        db.close();
      } catch {
        // already closed by the test
      }
    }
  });

  describe("statements", () => {
    test("exec runs several statements in one call", () => {
      const db = fresh();
      db.exec("CREATE TABLE t (a INTEGER); INSERT INTO t VALUES (1); INSERT INTO t VALUES (2)");
      expect(db.prepare("SELECT a FROM t ORDER BY a").all()).toEqual([{ a: 1 }, { a: 2 }]);
    });

    test("prepare binds every Param type and reads each back as it was bound", () => {
      const db = fresh();
      db.exec(typed(db));
      const row: Param[] = [
        'it\'s "quoted", ? and é',
        42,
        0.5,
        2n ** 40n,
        null,
        new Uint8Array([0, 1, 254, 255]),
      ];
      db.prepare("INSERT INTO p (s, i, f, b, n, y) VALUES (?, ?, ?, ?, ?, ?)").run(...row);
      const back = db.prepare("SELECT s, i, f, b, n, y FROM p").get();
      // A bigint within the safe range reads back as a number, as node:sqlite returns it.
      expect(back).toEqual({
        s: row[0],
        i: 42,
        f: 0.5,
        b: 2 ** 40,
        n: null,
        y: new Uint8Array([0, 1, 254, 255]),
      });
      expect(back?.y).toBeInstanceOf(Uint8Array);
    });

    test("a ? inside a string literal is text, not a placeholder", () => {
      const db = fresh();
      db.exec("CREATE TABLE t (s TEXT, i INTEGER)");
      db.prepare("INSERT INTO t (s, i) VALUES ('what?', ?)").run(7);
      expect(db.prepare("SELECT s, i FROM t WHERE i = ? AND s = 'what?'").get(7)).toEqual({
        s: "what?",
        i: 7,
      });
    });

    test("run reports how many rows it changed", () => {
      const db = fresh();
      db.exec("CREATE TABLE t (a INTEGER)");
      const insert = db.prepare("INSERT INTO t VALUES (?)");
      expect(Number(insert.run(1).changes)).toBe(1);
      insert.run(2);
      expect(Number(db.prepare("UPDATE t SET a = a + 10").run().changes)).toBe(2);
      expect(Number(db.prepare("DELETE FROM t WHERE a < 0").run().changes)).toBe(0);
    });

    test("get returns the first row keyed by column name, or undefined", () => {
      const db = fresh();
      db.exec("CREATE TABLE t (a INTEGER, b TEXT)");
      expect(db.prepare("SELECT a, b FROM t").get()).toBeUndefined();
      db.prepare("INSERT INTO t VALUES (?, ?)").run(1, "x");
      db.prepare("INSERT INTO t VALUES (?, ?)").run(2, "y");
      expect(db.prepare("SELECT a, b AS label FROM t ORDER BY a").get()).toEqual({
        a: 1,
        label: "x",
      });
    });

    test("all returns every row in order, or an empty list", () => {
      const db = fresh();
      db.exec("CREATE TABLE t (a INTEGER)");
      expect(db.prepare("SELECT a FROM t").all()).toEqual([]);
      for (const a of [3, 1, 2]) db.prepare("INSERT INTO t VALUES (?)").run(a);
      expect(db.prepare("SELECT a FROM t ORDER BY a DESC").all()).toEqual([
        { a: 3 },
        { a: 2 },
        { a: 1 },
      ]);
    });

    test("integer aggregates read back as numbers", () => {
      const db = fresh();
      db.exec("CREATE TABLE t (seq BIGINT)");
      expect(db.prepare("SELECT count(*) AS n FROM t").get()).toEqual({ n: 0 });
      expect(db.prepare("SELECT coalesce(max(seq) + 1, 0) AS n FROM t").get()).toEqual({ n: 0 });
      db.prepare("INSERT INTO t VALUES (?)").run(4);
      expect(db.prepare("SELECT coalesce(max(seq) + 1, 0) AS n FROM t").get()).toEqual({ n: 5 });
    });

    test("a failing statement throws and leaves the connection usable", () => {
      const db = fresh();
      expect(() => db.prepare("SELECT a FROM no_such_table").all()).toThrow();
      expect(db.prepare("SELECT 1 AS one").get()).toEqual({ one: 1 });
    });
  });

  describe("transactions", () => {
    const table = () => {
      const db = fresh();
      db.exec("CREATE TABLE t (a INTEGER)");
      const insert = (a: number) => db.prepare("INSERT INTO t VALUES (?)").run(a);
      const rows = () =>
        db
          .prepare("SELECT a FROM t ORDER BY a")
          .all()
          .map((r) => r.a);
      return { db, insert, rows };
    };

    test("commits the body's writes and returns its value", () => {
      const { db, insert, rows } = table();
      expect(
        db.transaction(() => {
          insert(1);
          return "done";
        }),
      ).toBe("done");
      expect(rows()).toEqual([1]);
    });

    test("rolls back when the body throws, and rethrows", () => {
      const { db, insert, rows } = table();
      expect(() =>
        db.transaction(() => {
          insert(1);
          throw new Error("boom");
        }),
      ).toThrow("boom");
      expect(rows()).toEqual([]);
      db.transaction(() => insert(2));
      expect(rows()).toEqual([2]);
    });

    test("a nested transaction is a savepoint: its rollback keeps the outer work", () => {
      const { db, insert, rows } = table();
      db.transaction(() => {
        insert(1);
        expect(() =>
          db.transaction(() => {
            insert(2);
            throw new Error("inner");
          }),
        ).toThrow("inner");
        db.transaction(() => insert(3));
      });
      expect(rows()).toEqual([1, 3]);
    });

    test("an outer rollback undoes a committed savepoint", () => {
      const { db, insert, rows } = table();
      expect(() =>
        db.transaction(() => {
          db.transaction(() => insert(1));
          throw new Error("outer");
        }),
      ).toThrow("outer");
      expect(rows()).toEqual([]);
    });

    test("a failed statement inside a savepoint does not abort the outer transaction", () => {
      const { db, insert, rows } = table();
      db.transaction(() => {
        insert(1);
        expect(() =>
          db.transaction(() => db.prepare("SELECT a FROM no_such_table").all()),
        ).toThrow();
        insert(2);
      });
      expect(rows()).toEqual([1, 2]);
    });

    test("refuses an asynchronous body, which would commit before its awaited work, and rolls back", () => {
      const { db, insert, rows } = table();
      expect(() => db.transaction(() => Promise.resolve(insert(1)))).toThrow(/synchronous/);
      expect(rows()).toEqual([]);
      db.transaction(() => insert(2));
      expect(rows()).toEqual([2]);
    });

    test("two connections to one database share a dense sequence", () => {
      const [a, b] = backend.pair();
      open.push(a, b);
      a.exec("CREATE TABLE t (seq INTEGER PRIMARY KEY)");
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
    });
  });

  describe("migrations", () => {
    test("applies every migration once, in order, and records it", () => {
      const db = fresh();
      expect(migrate(db)).toEqual(MIGRATIONS.map((m) => m.id));
      expect(migrate(db)).toEqual([]);
      const applied = db.prepare("SELECT id FROM schema_migrations ORDER BY id").all();
      expect(applied.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
    });

    test("rolls back a failing migration and records nothing for it", () => {
      const db = fresh();
      const broken = [
        ...MIGRATIONS,
        { id: 999, name: "broken", up: "CREATE TABLE x (a INTEGER); NOT SQL" },
      ];
      expect(() => migrate(db, broken)).toThrow();
      const ids = db
        .prepare("SELECT id FROM schema_migrations")
        .all()
        .map((r) => r.id);
      expect(ids).not.toContain(999);
      expect(() => db.prepare("SELECT a FROM x").all()).toThrow();
    });
  });

  describe("close", () => {
    test("a closed Db refuses statements", () => {
      const db = fresh();
      db.close();
      expect(() => db.prepare("SELECT 1 AS one").get()).toThrow();
    });
  });
}

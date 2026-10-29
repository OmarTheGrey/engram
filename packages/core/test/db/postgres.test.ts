// Card E1.1, ADR 0024: what the Postgres backend does beyond the Db contract
// (contract.ts): the placeholder rewrite, the statement timeout, a lost
// connection, the advisory lock that serialises writers in different
// processes, and the mapping of values the contract's SQLite cannot hold.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";
import { type Db, DbTimeoutError } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openPostgres, type PostgresOptions, rewritePlaceholders } from "../../src/db/postgres.ts";
import { allEvents } from "../../src/events.ts";
import { freshSchema, openInSchema, postgresUrl } from "./backends.ts";

describe("rewritePlaceholders", () => {
  test("numbers each ? in order", () => {
    expect(rewritePlaceholders("SELECT a FROM t WHERE b = ? AND c IN (?, ?)")).toBe(
      "SELECT a FROM t WHERE b = $1 AND c IN ($2, $3)",
    );
  });

  test("leaves a ? inside a string, a quoted identifier or a comment alone", () => {
    expect(
      rewritePlaceholders(
        `SELECT 'it''s ?', "col?" FROM t -- why?\nWHERE a = ? /* or ? */ AND b = ?`,
      ),
    ).toBe(`SELECT 'it''s ?', "col?" FROM t -- why?\nWHERE a = $1 /* or ? */ AND b = $2`);
  });

  test("leaves text without placeholders unchanged", () => {
    expect(rewritePlaceholders("SELECT 1")).toBe("SELECT 1");
  });

  test("leaves a ? inside a dollar-quoted body alone, with or without a tag", () => {
    expect(rewritePlaceholders("DO $$ BEGIN PERFORM 1 WHERE 1 = ?; END $$; SELECT ?")).toBe(
      "DO $$ BEGIN PERFORM 1 WHERE 1 = ?; END $$; SELECT $1",
    );
    expect(rewritePlaceholders("SELECT $fn$ a ? $x$ b $fn$, ?")).toBe(
      "SELECT $fn$ a ? $x$ b $fn$, $1",
    );
  });

  test("reads an E'' string's backslash escapes, so its quote does not end it", () => {
    expect(rewritePlaceholders("SELECT E'it\\'s ?', ?")).toBe("SELECT E'it\\'s ?', $1");
  });

  test("tracks nested block comments", () => {
    expect(rewritePlaceholders("SELECT /* a /* b ? */ ? */ ?")).toBe(
      "SELECT /* a /* b ? */ ? */ $1",
    );
  });

  test("?? is a literal ?, the escape for Postgres's jsonb operators", () => {
    expect(rewritePlaceholders("SELECT body::jsonb ?? 'k' FROM t WHERE id = ?")).toBe(
      "SELECT body::jsonb ? 'k' FROM t WHERE id = $1",
    );
  });

  test("refuses SQLite's numbered ?1 placeholders, which it cannot rewrite in order", () => {
    expect(() => rewritePlaceholders("SELECT ?1, ?1")).toThrow(/numbered/);
  });
});

const url = postgresUrl();

describe.skipIf(url === undefined)("openPostgres", () => {
  const pgUrl = url ?? "";
  const opened: Db[] = [];
  const open = (options?: PostgresOptions) => keep(openPostgres(pgUrl, options));
  const keep = (db: Db) => {
    opened.push(db);
    return db;
  };
  afterEach(() => {
    for (const db of opened.splice(0)) {
      try {
        db.close();
      } catch {
        // closed by the test
      }
    }
  });

  test("a statement past the timeout is cancelled by the server: DbTimeoutError, and the Db stays usable", () => {
    const db = open({ timeoutMs: 500 });
    const started = Date.now();
    expect(() => db.prepare("SELECT pg_sleep(5)").get()).toThrow(DbTimeoutError);
    expect(Date.now() - started).toBeLessThan(4000);
    expect(db.prepare("SELECT 1 AS one").get()).toEqual({ one: 1 });
  });

  test("a statement the server does not cancel hits the client's backstop: DbTimeoutError, and the Db is closed", () => {
    const db = open({ timeoutMs: 500 });
    db.exec("SET statement_timeout = 0");
    const started = Date.now();
    expect(() => db.prepare("SELECT pg_sleep(8)").get()).toThrow(DbTimeoutError);
    expect(Date.now() - started).toBeLessThan(6000);
    expect(() => db.prepare("SELECT 1 AS one").get()).toThrow(/closed/);
  });

  test("after a timeout inside a transaction, another writer gets the log's lock at once", () => {
    const schema = freshSchema();
    const a = keep(openInSchema(pgUrl, schema, { timeoutMs: 1000 }));
    const b = keep(openInSchema(pgUrl, schema));
    expect(() => a.transaction(() => a.prepare("SELECT pg_sleep(6)").get())).toThrow(
      DbTimeoutError,
    );
    const started = Date.now();
    b.transaction(() => b.exec("SELECT 1"));
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test("a lost connection fails the transaction and closes the Db; nothing half-commits", () => {
    const schema = freshSchema();
    const db = keep(openInSchema(pgUrl, schema));
    const killer = open();
    // The same table in public, where a reconnected session without the
    // schema would write.
    const table = `w_${schema}`;
    killer.exec(
      `CREATE TABLE ${schema}.${table} (a INTEGER); CREATE TABLE public.${table} (a INTEGER)`,
    );
    const pid = db.prepare("SELECT pg_backend_pid() AS pid").get()?.pid as number;
    const insert = (a: number) => db.prepare(`INSERT INTO ${table} VALUES (?)`).run(a);
    expect(() =>
      db.transaction(() => {
        insert(1);
        killer.prepare("SELECT pg_terminate_backend(?) AS ok").get(pid);
        insert(2);
        insert(3);
      }),
    ).toThrow();
    const rows = (s: string) => killer.prepare(`SELECT a FROM ${s}.${table}`).all();
    expect(rows(schema)).toEqual([]);
    expect(rows("public")).toEqual([]);
    expect(() => db.prepare("SELECT 1 AS one").get()).toThrow(/closed|lost/);
    killer.exec(`DROP TABLE public.${table}`);
  });

  test("a url the driver cannot parse fails the open at once with its cause, not a timeout", () => {
    const started = Date.now();
    let error: unknown;
    try {
      keep(openPostgres("not a url at all", { connectTimeoutMs: 20_000 }));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(DbTimeoutError);
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  test("a failed outer begin, such as a lock timeout, rolls back and leaves the Db usable", () => {
    const schema = freshSchema();
    const a = keep(openInSchema(pgUrl, schema));
    const b = keep(openInSchema(pgUrl, schema));
    b.exec("SET lock_timeout = '200ms'");
    a.transaction(() => {
      expect(() => b.transaction(() => b.exec("SELECT 1"))).toThrow(/lock timeout/);
    });
    expect(b.prepare("SELECT 1 AS one").get()).toEqual({ one: 1 });
    b.transaction(() => b.exec("SELECT 1"));
  });

  test("a transaction reads committed data whatever the session's default isolation", () => {
    const db = keep(openInSchema(pgUrl, freshSchema()));
    db.exec("SET default_transaction_isolation = 'serializable'");
    db.transaction(() => {
      expect(db.prepare("SHOW transaction_isolation").get()).toEqual({
        transaction_isolation: "read committed",
      });
    });
  });

  test("the lock is taken even when the search path names no existing schema", () => {
    const db = keep(openInSchema(pgUrl, freshSchema()));
    db.exec("SET search_path TO no_such_schema_anywhere");
    db.transaction(() => {
      expect(
        Number(
          db
            .prepare(
              "SELECT count(*) AS n FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()",
            )
            .get()?.n,
        ),
      ).toBe(1);
    });
  });

  test("an unreachable server fails the open, not a later statement", () => {
    expect(() => keep(openPostgres("postgres://engram:engram@127.0.0.1:1/postgres"))).toThrow();
  });

  test("a closed Db refuses statements", () => {
    const db = open();
    db.close();
    expect(() => db.prepare("SELECT 1 AS one").get()).toThrow(/closed/);
  });

  test("an int8 beyond the safe integer range reads back as a bigint", () => {
    const db = keep(openInSchema(pgUrl, freshSchema()));
    db.exec("CREATE TABLE t (b BIGINT)");
    db.prepare("INSERT INTO t VALUES (?)").run(2n ** 62n);
    expect(db.prepare("SELECT b FROM t").get()).toEqual({ b: 2n ** 62n });
  });

  test("the outer transaction holds the log's advisory lock; a savepoint takes no other", () => {
    const db = keep(openInSchema(pgUrl, freshSchema()));
    const held = () =>
      Number(
        db
          .prepare(
            "SELECT count(*) AS n FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()",
          )
          .get()?.n,
      );
    expect(held()).toBe(0);
    db.transaction(() => {
      expect(held()).toBe(1);
      db.transaction(() => expect(held()).toBe(1));
    });
    expect(held()).toBe(0);
  });

  test("writers in two processes appending to one log are serialised into one dense sequence", async () => {
    const schema = freshSchema();
    const db = keep(openInSchema(pgUrl, schema));
    migrate(db);
    db.exec("CREATE TABLE ready (actor TEXT)");
    const writer = fileURLToPath(new URL("./append-writer.ts", import.meta.url));
    const count = 150;
    const run = (index: number) =>
      promisify(execFile)(process.execPath, [
        writer,
        pgUrl,
        schema,
        String(index),
        "2",
        String(count),
      ]).then(
        (r) => r.stdout,
        (e: { stdout?: string; stderr?: string }) => `${e.stdout ?? ""}${e.stderr ?? ""}`,
      );
    const outputs = await Promise.all([run(1), run(2)]);
    const reports = outputs.map((o) => JSON.parse(o.trim().split("\n").at(-1) ?? "{}"));
    expect(reports).toEqual([
      { actor: "agent:writer1", appended: count },
      { actor: "agent:writer2", appended: count },
    ]);
    const events = allEvents(db);
    expect(events.map((e) => e.seq)).toEqual([...Array(2 * count).keys()]);
    // The two writers really overlapped: their events interleave in the log.
    const switches = events.filter((e, i) => i > 0 && e.actor !== events[i - 1]?.actor).length;
    expect(switches).toBeGreaterThan(1);
  }, 60_000);
});

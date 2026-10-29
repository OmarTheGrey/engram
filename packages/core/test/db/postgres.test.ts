// Card E1.1, ADR 0024: what the Postgres backend does beyond the Db contract
// (contract.ts): the placeholder rewrite, the statement timeout, the
// advisory lock that serialises writers in different processes, and the
// mapping of values the contract's SQLite cannot hold.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { DbTimeoutError } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openPostgres, rewritePlaceholders } from "../../src/db/postgres.ts";
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
});

const url = postgresUrl();

describe.skipIf(url === undefined)("openPostgres", () => {
  const pgUrl = url ?? "";

  test("a statement that does not answer within the timeout throws DbTimeoutError and closes the Db", () => {
    const db = openPostgres(pgUrl, { timeoutMs: 500 });
    const started = Date.now();
    expect(() => db.prepare("SELECT pg_sleep(5)").get()).toThrow(DbTimeoutError);
    expect(Date.now() - started).toBeLessThan(4000);
    expect(() => db.prepare("SELECT 1 AS one").get()).toThrow(/closed/);
    db.close();
  });

  test("an unreachable server fails the open, not a later statement", () => {
    expect(() => openPostgres("postgres://engram:engram@127.0.0.1:1/postgres")).toThrow();
  });

  test("a closed Db refuses statements", () => {
    const db = openPostgres(pgUrl);
    db.close();
    expect(() => db.prepare("SELECT 1 AS one").get()).toThrow(/closed/);
  });

  test("an int8 beyond the safe integer range reads back as a bigint", () => {
    const db = openInSchema(pgUrl, freshSchema());
    db.exec("CREATE TABLE t (b BIGINT)");
    db.prepare("INSERT INTO t VALUES (?)").run(2n ** 62n);
    expect(db.prepare("SELECT b FROM t").get()).toEqual({ b: 2n ** 62n });
    db.close();
  });

  test("the outer transaction holds the log's advisory lock; a savepoint takes no other", () => {
    const db = openInSchema(pgUrl, freshSchema());
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
    db.close();
  });

  test("writers in two processes appending to one log are serialised into one dense sequence", async () => {
    const schema = freshSchema();
    const db = openInSchema(pgUrl, schema);
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
    db.close();
  }, 60_000);
});

// The test backends themselves (backends.ts): a pooled Postgres Db must not
// leak session state into the next test that reuses its connection (review
// finding P2-13).
import { describe, expect, test } from "vitest";
import { BACKENDS } from "./backends.ts";

const postgres = BACKENDS.find((b) => b.name === "postgres");

describe.skipIf(postgres?.skip !== undefined)("the pooled Postgres backend", () => {
  test("a setting made on a pooled Db is back to its default when the connection is reused", () => {
    if (!postgres) throw new Error("no postgres backend");
    const first = postgres.open();
    const pid = first.prepare("SELECT pg_backend_pid() AS pid").get()?.pid;
    const before = first.prepare("SHOW lock_timeout").get();
    first.exec("SET lock_timeout = '1234ms'");
    first.close();
    const second = postgres.open();
    try {
      // The same session, so the reset is what is tested.
      expect(second.prepare("SELECT pg_backend_pid() AS pid").get()?.pid).toBe(pid);
      expect(second.prepare("SHOW lock_timeout").get()).toEqual(before);
    } finally {
      second.close();
    }
  });
});

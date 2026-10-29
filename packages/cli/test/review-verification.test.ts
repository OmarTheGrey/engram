// Card E0.4, the verification of review P3: an `@` in a query value or a
// fragment leaks nothing (P3-16), a short password does not garble messages
// (P3-17), write and read refuse a database that is not an Engram log or is
// newer (P3-18), and doctor names a file that is not a database (P3-19).
import { statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openPostgres } from "@engram/core";
import { describe, expect, it } from "vitest";
import { dbTarget, redactSecrets, redactUrl, UsageError } from "../src/setup.ts";
import { cli, readArgs, tempDir } from "./helpers.ts";
import { freshDatabase, postgresTarget } from "./postgres.ts";

const where = { cwd: "/work", home: "/home/dana", env: {} };

describe("P3-16: the userinfo @ is found only in the authority; query values and fragments are masked", () => {
  const cases: [string, RegExp, string][] = [
    [
      "postgres://127.0.0.1:1/db?password=s%40cretQAT",
      /cret|QAT/,
      "postgres://127.0.0.1:1/db?password=***",
    ],
    [
      "postgres://u:pw@127.0.0.1:1/db?sslpassword=a%40HIDDENSUFFIX",
      /HIDDEN|SUFFIX|:pw@/,
      "postgres://***@127.0.0.1:1/db?sslpassword=***",
    ],
    [
      "postgres://u:pw@h:5432/db?sslmode=require&foo=FOOVALUE#fragSECRETFRAG",
      /SECRETFRAG|FOOVALUE|:pw@/,
      "postgres://***@h:5432/db?sslmode=require&foo=***#***",
    ],
    [
      "postgres://h/db?application_name=engram&connect_timeout=5&target_session_attrs=any&options=-c%20x&user_secret=Q1",
      /Q1/,
      "postgres://h/db?application_name=engram&connect_timeout=5&target_session_attrs=any&options=***&user_secret=***",
    ],
  ];

  it("labels keep the host and the allow-listed parameters and hide everything else", () => {
    for (const [url, secret, label] of cases) {
      expect(redactUrl(url)).toBe(label);
      expect(dbTarget(url, where).label).not.toMatch(secret);
    }
  });

  it("P3-21: a bracketed IPv6 host is usage, asking for a hostname or an IPv4 address", async () => {
    // postgres.js splits the host on ":" (src/index.js, `host.split(':')[0]`),
    // so [::1] becomes "[" and the connection can never succeed.
    for (const url of ["postgres://u:IPV6SECRET@[::1]:1/db", "postgres://[::1]/db"]) {
      expect(() => dbTarget(url, where)).toThrow(/use a hostname or an IPv4 address/);
      const r = await cli(["doctor", "--db", url]);
      expect(r.code).toBe(2);
      expect(r.out + r.err).not.toContain("IPV6SECRET");
    }
  });

  it("a path holding an @ (a password with a raw delimiter) is masked whole after the scheme", () => {
    expect(redactUrl("postgres://u:5432/x@host/db")).toBe("postgres://<hidden: unparseable>");
  });

  /** A raw `@` after the authority makes a URL unparseable (P3-20): only the scheme is printed. */
  const unparseable: [string, RegExp][] = [
    ["postgres://127.0.0.1:1/db?password=s@cretQAT", /cret|QAT/],
    ["postgres://u:pw@127.0.0.1:1/db?sslpassword=a@HIDDENSUFFIX", /HIDDEN|SUFFIX|:pw@/],
    ["postgres://u:pw@h:5432/db?foo=FOOVALUE#frag@SECRETFRAG", /SECRETFRAG|FOOVALUE|:pw@/],
  ];

  it("a raw @ after the authority is unparseable usage and prints nothing after the scheme", () => {
    for (const [url, secret] of unparseable) {
      expect(redactUrl(url)).toBe("postgres://<hidden: unparseable>");
      expect(() => dbTarget(url, where)).toThrow(UsageError);
      try {
        dbTarget(url, where);
      } catch (e) {
        expect((e as Error).message).not.toMatch(secret);
      }
    }
  });

  it("doctor and write print no part of the secret", async () => {
    for (const [url, secret] of [...cases, ...unparseable]) {
      const d = await cli(["doctor", "--db", url]);
      expect(d.out + d.err, url).not.toMatch(secret);
      const w = await cli([
        "write",
        "--root",
        await tempDir(),
        "--owner",
        "dana",
        "--content",
        "x",
        "--db",
        url,
      ]);
      expect(w.out + w.err, url).not.toMatch(secret);
    }
  });
});

describe("P3-17: short secrets are scrubbed only as whole tokens", () => {
  it("a one-letter password leaves the words around it intact", () => {
    const url = "postgres://u:e@127.0.0.1:1/db";
    expect(redactSecrets("connect ECONNREFUSED 127.0.0.1:1", url)).toBe(
      "connect ECONNREFUSED 127.0.0.1:1",
    );
    expect(redactSecrets("password e was rejected", url)).toBe("password *** was rejected");
    expect(redactSecrets(`failed on ${url} now`, url)).toBe(
      "failed on postgres://***@127.0.0.1:1/db now",
    );
  });

  it("a long secret is scrubbed anywhere", () => {
    expect(redactSecrets("xxLONGSECRETyy", "postgres://u:LONGSECRET@h/db")).toBe("xx***yy");
  });
});

/** Tables of a SQLite file, read-only. */
const sqliteTables = (path: string) => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => r.name);
  } finally {
    db.close();
  }
};

const writeTo = async (db: string) =>
  cli(["write", "--root", await tempDir(), "--owner", "dana", "--content", "x", "--db", db]);

describe("P3-18: write and read refuse what doctor calls foreign or newer, on SQLite", () => {
  it("a write into another tool's database is refused and adds no table", async () => {
    const path = join(await tempDir(), "other.db");
    const other = new DatabaseSync(path);
    other.exec("CREATE TABLE other (x)");
    other.close();
    const w = await writeTo(path);
    expect(w.err).toMatch(/other\.db: not an Engram log/);
    expect(w.code).toBe(1);
    const r = await cli(readArgs(path));
    expect(r.code).toBe(1);
    expect(sqliteTables(path)).toEqual(["other"]);
  });

  it("a write into a log newer than this Engram is refused", async () => {
    const path = join(await tempDir(), "new.db");
    await cli(readArgs(path));
    const log = new DatabaseSync(path);
    log.exec("INSERT INTO schema_migrations (id, name) VALUES (999, 'from the future')");
    log.close();
    const w = await writeTo(path);
    expect(w.err).toMatch(/new\.db: newer than this Engram \(migration 999\)/);
    expect(w.code).toBe(1);
  });
});

const pg = postgresTarget();

describe.skipIf(!("url" in pg))("P3-18 on Postgres", () => {
  const admin = "url" in pg ? pg.url : "";
  const exec = (url: string, sql: string) => {
    const db = openPostgres(url);
    try {
      db.exec(sql);
    } finally {
      db.close();
    }
  };
  const tables = (url: string) => {
    const db = openPostgres(url);
    try {
      return db
        .prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
        .all()
        .map((r) => r.tablename);
    } finally {
      db.close();
    }
  };

  it("a write into a database with another app's tables is refused and adds no table", async () => {
    const url = freshDatabase(admin, "wforeign");
    exec(url, "CREATE TABLE accounts (id int)");
    const w = await writeTo(url);
    expect(w.err).toMatch(/postgres:\/\/\*\*\*@\S+: not an Engram log/);
    expect(w.code).toBe(1);
    expect(tables(url)).toEqual(["accounts"]);
  });

  it("a write into a newer log is refused", async () => {
    const url = freshDatabase(admin, "wnewer");
    expect((await writeTo(url)).code).toBe(0);
    exec(url, "INSERT INTO schema_migrations (id, name) VALUES (999, 'from the future')");
    const w = await writeTo(url);
    expect(w.err).toMatch(/newer than this Engram \(migration 999\)/);
    expect(w.code).toBe(1);
  });
});

describe("P3-19: doctor names a file that is not a database", () => {
  it("prefixes the error with the backend and the path", async () => {
    const path = join(await tempDir(), "junk.db");
    await writeFile(path, "this is not a database, just text\n".repeat(20));
    const { code, out } = await cli(["doctor", "--db", path]);
    expect(out).toMatch(/^fail\s+log\s+sqlite \S*junk\.db: /m);
    expect(statSync(path).size).toBe(680);
    expect(code).toBe(1);
  });
});

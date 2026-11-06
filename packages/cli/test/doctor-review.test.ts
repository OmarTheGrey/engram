// `engram doctor`, review P3 of card E0.4: the log check never changes a
// database (P3-3), the files check fails on unreadable memories (P3-5), an
// empty key variable is not a key (P3-9), and the pins check hashes lines as
// the manifest does and requires a manifest per fixture (P3-12).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openPostgres } from "@engram/core";
import { describe, expect, it } from "vitest";
import { BENCH_FIXTURES, DEPS, PINS, PROVIDER_KEYS } from "../src/doctor.ts";
import { cli, REPO, readArgs, tempDir } from "./helpers.ts";
import { freshDatabase, PG_PASSWORD, PG_PASSWORD_ENCODED, postgresTarget } from "./postgres.ts";

const logLine = (out: string) => /^\S+\s+log\s+.*$/m.exec(out)?.[0] ?? "";

/** Tables and schema_migrations rows of a SQLite file, read without changing it. */
function sqliteState(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => r.name);
    const rows = tables.includes("schema_migrations")
      ? db.prepare("SELECT * FROM schema_migrations ORDER BY id").all()
      : [];
    return { tables, rows };
  } finally {
    db.close();
  }
}

describe("doctor log check on SQLite never changes the file (P3-3)", () => {
  it("an empty file stays 0 bytes and is reported as holding no log", async () => {
    const db = join(await tempDir(), "empty.db");
    await writeFile(db, "");
    const { code, out } = await cli(["doctor", "--db", db]);
    expect(logLine(out)).toMatch(/^ok\s+log\s+sqlite .*empty\.db: no log yet/);
    expect(statSync(db).size).toBe(0);
    expect(code).toBe(0);
  });

  it("another tool's database fails as not an Engram log and keeps exactly its tables", async () => {
    const path = join(await tempDir(), "other.db");
    const other = new DatabaseSync(path);
    other.exec("CREATE TABLE other (x); INSERT INTO other VALUES (1)");
    other.close();
    const before = sqliteState(path);
    const { code, out } = await cli(["doctor", "--db", path]);
    expect(logLine(out)).toMatch(/^fail\s+log\s+sqlite .*other\.db: not an Engram log/);
    expect(sqliteState(path)).toEqual(before);
    expect(code).toBe(1);
  });

  it("someone else's schema_migrations is not an Engram log either", async () => {
    const path = join(await tempDir(), "rails.db");
    const other = new DatabaseSync(path);
    other.exec(
      "CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL); INSERT INTO schema_migrations VALUES (1, 'create users')",
    );
    other.close();
    const before = sqliteState(path);
    const { out } = await cli(["doctor", "--db", path]);
    expect(logLine(out)).toMatch(/^fail\s+log\s+sqlite .*: not an Engram log/);
    expect(sqliteState(path)).toEqual(before);
  });

  it("an older log reports its pending migrations and keeps its migration rows", async () => {
    const path = join(await tempDir(), "old.db");
    await cli(readArgs(path));
    const log = new DatabaseSync(path);
    log.exec("DELETE FROM schema_migrations WHERE id = (SELECT max(id) FROM schema_migrations)");
    log.close();
    const before = sqliteState(path);
    const { code, out } = await cli(["doctor", "--db", path]);
    expect(logLine(out)).toMatch(
      /^ok\s+log\s+sqlite .*old\.db: 1 migration pending; the next read or write applies it/,
    );
    expect(sqliteState(path)).toEqual(before);
    expect(code).toBe(0);
  });

  it("a log newer than this Engram fails and is left alone", async () => {
    const path = join(await tempDir(), "new.db");
    await cli(readArgs(path));
    const log = new DatabaseSync(path);
    log.exec("INSERT INTO schema_migrations (id, name) VALUES (999, 'from the future')");
    log.close();
    const before = sqliteState(path);
    const { out } = await cli(["doctor", "--db", path]);
    expect(logLine(out)).toMatch(
      /^fail\s+log\s+sqlite .*: newer than this Engram \(migration 999\)/,
    );
    expect(sqliteState(path)).toEqual(before);
  });
});

const pg = postgresTarget();

describe.skipIf(!("url" in pg))("doctor log check on Postgres runs SELECTs only (P3-3)", () => {
  const admin = "url" in pg ? pg.url : "";
  const state = (url: string) => {
    const db = openPostgres(url);
    try {
      const tables = db
        .prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
        .all()
        .map((r) => r.tablename);
      const rows = tables.includes("schema_migrations")
        ? db.prepare("SELECT * FROM schema_migrations ORDER BY 1").all()
        : [];
      return { tables, rows };
    } finally {
      db.close();
    }
  };
  const exec = (url: string, sql: string) => {
    const db = openPostgres(url);
    try {
      db.exec(sql);
    } finally {
      db.close();
    }
  };
  const clean = (out: string) =>
    expect(out.includes(PG_PASSWORD) || out.includes(PG_PASSWORD_ENCODED)).toBe(false);

  it("a database with another app's tables is not an Engram log and keeps exactly its tables", async () => {
    const url = freshDatabase(admin, "foreign");
    exec(url, "CREATE TABLE accounts (id int); INSERT INTO accounts VALUES (1)");
    const before = state(url);
    const { code, out } = await cli(["doctor", "--db", url]);
    expect(logLine(out)).toMatch(
      /^fail\s+log\s+postgres postgres:\/\/\*\*\*@\S+: not an Engram log/,
    );
    expect(state(url)).toEqual(before);
    expect(code).toBe(1);
    clean(out);
  });

  it("a foreign schema_migrations table is not an Engram log, and doctor does not touch it", async () => {
    const url = freshDatabase(admin, "foreignmig");
    exec(
      url,
      "CREATE TABLE schema_migrations (version text PRIMARY KEY); INSERT INTO schema_migrations VALUES ('20240101')",
    );
    const before = state(url);
    const { out } = await cli(["doctor", "--db", url]);
    expect(logLine(out)).toMatch(/^fail\s+log\s+postgres \S+: not an Engram log/);
    expect(state(url)).toEqual(before);
  });

  it("an older log reports its pending migration and keeps its rows", async () => {
    const url = freshDatabase(admin, "older");
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
    expect(w.code).toBe(0);
    exec(url, "DELETE FROM schema_migrations WHERE id = (SELECT max(id) FROM schema_migrations)");
    const before = state(url);
    const { code, out } = await cli(["doctor", "--db", url]);
    expect(logLine(out)).toMatch(
      /^ok\s+log\s+postgres \S+: 1 migration pending; the next read or write applies it/,
    );
    expect(state(url)).toEqual(before);
    expect(code).toBe(0);
    clean(out);
  });
});

describe("doctor files check counts unreadable memories (P3-5)", () => {
  it("fails when the files adapter cannot read memories in the root, printing counts only", async () => {
    const root = await tempDir();
    await writeFile(
      join(root, "broken_one.md"),
      "---\nname: one\ndescription: x: [unclosed MARKERONE\ntype: user\n---\nbody MARKERONE\n",
    );
    await writeFile(
      join(root, "broken_two.md"),
      "---\nname: two\ndescription: two\ntype: user\nengram:\n  class: TOPSECRET2\n---\nbody TOPSECRET2\n",
    );
    const { code, out } = await cli([
      "doctor",
      "--db",
      join(await tempDir(), "e.db"),
      "--root",
      root,
    ]);
    expect(out).toMatch(/^fail\s+adapter files\s+.*2 files unreadable by the files adapter/m);
    expect(out).not.toMatch(/MARKERONE|TOPSECRET2/);
    expect(code).toBe(1);
  });
});

describe("doctor provider keys (P3-9)", () => {
  it("an empty variable is not a key, and its value is never printed", async () => {
    const db = join(await tempDir(), "e.db");
    const { out } = await cli(["doctor", "--db", db], {
      env: { OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "sk-doctor-value-xyz" },
    });
    const line = /^ok\s+provider keys\s+.*$/m.exec(out)?.[0] ?? "";
    expect(line).toContain("ANTHROPIC_API_KEY (anthropic)");
    expect(line).not.toContain("OPENAI_API_KEY");
    expect(out).not.toContain("sk-doctor-value-xyz");
  });

  it("names the providers whose credentials are not a key variable as not checked", async () => {
    const { out } = await cli(["doctor", "--db", join(await tempDir(), "e.db")]);
    const line = /^ok\s+provider keys\s+.*$/m.exec(out)?.[0] ?? "";
    expect(line).toMatch(/not checked: amazon-bedrock, google-vertex \(ADC\), openai-codex/);
  });
});

/** A copy of the repository files the pins check reads. */
async function pinsRepo(): Promise<string> {
  const dir = await tempDir();
  for (const rel of [PINS, DEPS, PROVIDER_KEYS, BENCH_FIXTURES])
    await cp(join(REPO, rel), join(dir, rel), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    const manifest = join("packages", pkg, "package.json");
    try {
      readFileSync(join(REPO, manifest));
    } catch {
      continue;
    }
    await cp(join(REPO, manifest), join(dir, manifest));
  }
  return dir;
}

const pinsLine = (out: string) => /^\S+\s+benchmark pins\s+.*$/m.exec(out)?.[0] ?? "";

describe("doctor benchmark pins (P3-12)", () => {
  it("fails when a blank line is inserted into a vendored file", async () => {
    const repo = await pinsRepo();
    const file = join(repo, BENCH_FIXTURES, "gatemem", "office", "checkpoints.jsonl");
    const lines = readFileSync(file, "utf8").split("\n");
    lines.splice(1, 0, "");
    await writeFile(file, lines.join("\n"));
    const { out } = await cli(["doctor", "--db", join(await tempDir(), "e.db")], { repo });
    expect(pinsLine(out)).toMatch(
      /^fail\s+benchmark pins\s+.*office\/checkpoints\.jsonl does not match/,
    );
  });

  it("fails when a fixture directory has no manifest.json", async () => {
    const repo = await pinsRepo();
    await mkdir(join(repo, BENCH_FIXTURES, "merit"));
    await writeFile(join(repo, BENCH_FIXTURES, "merit", "items.jsonl"), "{}\n");
    const { out } = await cli(["doctor", "--db", join(await tempDir(), "e.db")], { repo });
    expect(pinsLine(out)).toMatch(
      /^fail\s+benchmark pins\s+fixtures\/bench\/merit has no manifest\.json/,
    );
  });
});

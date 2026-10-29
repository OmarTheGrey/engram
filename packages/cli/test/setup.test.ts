// Which event log a command opens (ADR 0024): --db, else ENGRAM_DB_URL, else
// the per-user default; a SQLite path, :memory: or a postgres:// URL.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  dbTarget,
  defaultDb,
  hasLog,
  MEMORY_DB,
  openDb,
  openLog,
  redactSecrets,
  redactUrl,
} from "../src/setup.ts";
import { cli, fixtureCopy, logEvents, REPO, tempDir } from "./helpers.ts";
import { freshDatabase, hasLogTables, PG_PASSWORD, postgresTarget } from "./postgres.ts";

const where = (env: Record<string, string> = {}) => ({ cwd: "/work", home: "/home/dana", env });

describe("dbTarget", () => {
  it("defaults to the per-user SQLite file", () => {
    expect(dbTarget(undefined, where())).toMatchObject({
      backend: "sqlite",
      path: defaultDb("/home/dana"),
    });
  });

  it("takes ENGRAM_DB_URL when --db is not given, and --db over it", () => {
    const env = { ENGRAM_DB_URL: "postgres://localhost/engram" };
    expect(dbTarget(undefined, where(env)).backend).toBe("postgres");
    expect(dbTarget(MEMORY_DB, where(env))).toMatchObject({ backend: "sqlite", path: MEMORY_DB });
  });

  it("treats an empty ENGRAM_DB_URL as unset", () => {
    expect(dbTarget(undefined, where({ ENGRAM_DB_URL: "" })).backend).toBe("sqlite");
  });

  it("reads postgres:// and postgresql:// as Postgres, with the password redacted in the label", () => {
    const t = dbTarget("postgresql://engram:hunter2@db:5432/engram", where());
    expect(t).toMatchObject({
      backend: "postgres",
      label: "postgresql://engram:***@db:5432/engram",
    });
    expect(redactUrl("postgres://db/engram")).toBe("postgres://db/engram");
  });

  it("resolves a SQLite path against the working folder", () => {
    expect(dbTarget("logs/e.db", where())).toMatchObject({ backend: "sqlite" });
    expect(dbTarget("logs/e.db", where()).label).toMatch(/work[\\/]logs[\\/]e\.db$/);
  });
});

describe("openDb", () => {
  it("opens SQLite in memory", () => {
    const db = openDb(dbTarget(MEMORY_DB, where()));
    expect(db.prepare("select 1 as one").get()).toEqual({ one: 1 });
    db.close();
  });

  it("names an unreachable Postgres by its redacted label, never its password", () => {
    // Port 1 on loopback: nothing listens, so the connection is refused at once.
    const target = dbTarget("postgres://u:hunter2@127.0.0.1:1/db", where());
    let message = "";
    try {
      openDb(target).close();
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message.startsWith("postgres://u:***@127.0.0.1:1/db: ")).toBe(true);
    expect(message).not.toContain("hunter2");
  });

  it("redactSecrets removes the URL and its password, raw and percent-encoded", () => {
    const url = "postgres://u:p%40ss@h/db";
    expect(redactSecrets(`failed ${url} with p@ss and p%40ss`, url)).toBe(
      "failed postgres://u:***@h/db with *** and ***",
    );
  });
});

const pg = postgresTarget();

describe.skipIf(!("url" in pg))("on Postgres (embedded, from core's globalSetup)", () => {
  const admin = "url" in pg ? pg.url : "";

  it("openDb connects to a fresh database that holds no log, and openLog makes one", () => {
    const url = freshDatabase(admin, "open");
    const db = openDb(dbTarget(url, where()));
    expect(db.dialect).toBe("postgres");
    expect(hasLog(db)).toBe(false);
    db.close();
    const log = openLog(dbTarget(url, where()));
    expect(log.applied.length).toBeGreaterThan(0);
    expect(hasLog(log.db)).toBe(true);
    log.db.close();
  });

  it("openLog with mustExist refuses a database with no log, and creates nothing", () => {
    const url = freshDatabase(admin, "must");
    expect(() => openLog(dbTarget(url, where()), true)).toThrow(/^no event log at postgres:/);
    expect(hasLogTables(url)).toBe(false);
  });

  it("write, read and explain through ENGRAM_DB_URL, with the password in no output", async () => {
    const url = freshDatabase(admin, "cmds");
    const env = { ENGRAM_DB_URL: url };
    const root = await fixtureCopy();
    const owner = ["--root", root, "--owner", "dana"];
    const w = await cli(["write", ...owner, "--content", "Lunch is at noon."], { env });
    expect(w.code).toBe(0);
    const r = await cli(["read", "lunch", ...owner], { env });
    expect(r.code).toBe(0);
    expect(r.out).toContain("Lunch is at noon.");
    const readId = /^read (\S+) at /m.exec(r.out)?.[1] ?? "";
    const x = await cli(["explain", readId, "--owner", "dana"], { env });
    expect(x.out).toMatch(/^read \S+: \d+ explanations?/m);
    expect(x.code).toBe(0);
    for (const out of [w, r, x]) expect(out.out + out.err).not.toContain(PG_PASSWORD);
    expect(r.out).toContain("postgres://");
  });
});

describe("commands open the log ENGRAM_DB_URL names", () => {
  it("a write lands in the SQLite file ENGRAM_DB_URL names", async () => {
    const db = join(await tempDir(), "from-env.db");
    const root = await fixtureCopy();
    const { code } = await cli(
      ["write", "--root", root, "--owner", "dana", "--content", "Lunch is at noon."],
      { env: { ENGRAM_DB_URL: db } },
    );
    expect(code).toBe(0);
    expect(logEvents(db).map((e) => e.op)).toContain("write");
  });
});

describe("packages/cli never imports pi", () => {
  it("has no pi package in package.json and no pi import in its sources", () => {
    const manifest = readFileSync(join(REPO, "packages/cli/package.json"), "utf8");
    expect(manifest).not.toContain("@earendil-works/");
    const src = join(REPO, "packages/cli/src");
    for (const file of readdirSync(src))
      expect(readFileSync(join(src, file), "utf8"), file).not.toMatch(/from "@earendil-works\//);
  });
});

describe("dev files", () => {
  it(".env.example names ENGRAM_DB_URL and every provider key doctor checks, with no value", () => {
    const example = readFileSync(join(REPO, ".env.example"), "utf8");
    const { providers } = JSON.parse(
      readFileSync(join(REPO, "packages/runner/src/model/provider-keys.json"), "utf8"),
    ) as { providers: Record<string, string[]> };
    const names = new Set(["ENGRAM_DB_URL", ...Object.values(providers).flat()]);
    for (const name of names) expect(example).toMatch(new RegExp(`^# ?${name}=$`, "m"));
  });

  it("docker-compose.yml says it is for deployment only", () => {
    expect(existsSync(join(REPO, "docker-compose.yml"))).toBe(true);
    expect(readFileSync(join(REPO, "docker-compose.yml"), "utf8")).toMatch(/deployment only/i);
  });
});

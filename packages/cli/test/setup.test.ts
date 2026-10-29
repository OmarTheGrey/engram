// Which event log a command opens (ADR 0024): --db, else ENGRAM_DB_URL, else
// the per-user default; a SQLite path, :memory: or a postgres:// URL.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BackendUnavailableError,
  dbTarget,
  defaultDb,
  MEMORY_DB,
  openDb,
  redactUrl,
} from "../src/setup.ts";
import { cli, fixtureCopy, logEvents, REPO, tempDir } from "./helpers.ts";

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

  it("refuses Postgres until card E1.1 with a clear error", () => {
    expect(() => openDb(dbTarget("postgres://u:p@h/db", where()))).toThrow(
      new BackendUnavailableError(
        "postgres://u:***@h/db: Postgres backend not available yet (card E1.1)",
      ),
    );
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

  it("a read against a Postgres URL fails with the card that brings it", async () => {
    const { code, err } = await cli(["read", "--root", await fixtureCopy(), "--owner", "dana"], {
      env: { ENGRAM_DB_URL: "postgres://localhost/engram" },
    });
    expect(err).toContain("Postgres backend not available yet (card E1.1)");
    expect(code).toBe(1);
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

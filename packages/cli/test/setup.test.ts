// Which event log a command opens (ADR 0024): --db, else ENGRAM_DB_URL, else
// the per-user default; a SQLite path, :memory: or a postgres:// URL. No
// secret in a URL (userinfo, or a password-like query parameter) ever
// reaches the output, whatever goes wrong.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
  UsageError,
} from "../src/setup.ts";
import { cli, fixtureCopy, logEvents, REPO, tempDir } from "./helpers.ts";
import {
  freshDatabase,
  hasLogTables,
  PG_PASSWORD,
  PG_PASSWORD_ENCODED,
  postgresTarget,
} from "./postgres.ts";

const where = (env: Record<string, string> = {}) => ({ cwd: "/work", home: "/home/dana", env });
const MAIN = fileURLToPath(new URL("../src/main.ts", import.meta.url));

/** The binary as a process, timed, with a temporary home and the given extra environment. */
async function engram(args: string[], env: Record<string, string> = {}) {
  const home = await tempDir();
  const started = Date.now();
  const r = spawnSync(process.execPath, [MAIN, ...args], {
    cwd: home,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, ENGRAM_DB_URL: "", HOME: home, USERPROFILE: home, ...env },
  });
  return { code: r.status, text: r.stdout + r.stderr, ms: Date.now() - started, cwd: home };
}

describe("dbTarget", () => {
  it("defaults to the per-user SQLite file", () => {
    expect(dbTarget(undefined, where())).toMatchObject({
      backend: "sqlite",
      path: defaultDb("/home/dana"),
      source: "default",
    });
  });

  it("takes ENGRAM_DB_URL when --db is not given, and --db over it", () => {
    const env = { ENGRAM_DB_URL: "postgres://localhost/engram" };
    expect(dbTarget(undefined, where(env))).toMatchObject({ backend: "postgres", source: "env" });
    expect(dbTarget(MEMORY_DB, where(env))).toMatchObject({
      backend: "sqlite",
      path: MEMORY_DB,
      source: "flag",
    });
  });

  it("treats an empty ENGRAM_DB_URL as unset", () => {
    expect(dbTarget(undefined, where({ ENGRAM_DB_URL: "" })).backend).toBe("sqlite");
  });

  it("reads postgres:// and postgresql:// as Postgres, with the userinfo redacted in the label", () => {
    const t = dbTarget("postgresql://engram:hunter2@db:5432/engram", where());
    expect(t).toMatchObject({ backend: "postgres", label: "postgresql://***@db:5432/engram" });
    expect(redactUrl("postgres://db/engram")).toBe("postgres://db/engram");
  });

  it("redacts password-like query parameters and keeps the others (P3-2)", () => {
    const url =
      "postgres://db/e?sslmode=require&password=QS1&sslpassword=QS2&api_token=QS3&Secret=QS4&apikey=QS5";
    const label = dbTarget(url, where()).label;
    expect(label).toBe(
      "postgres://db/e?sslmode=require&password=***&sslpassword=***&api_token=***&Secret=***&apikey=***",
    );
  });

  it("refuses any other scheme as usage, naming the scheme only (P3-4)", () => {
    for (const spec of [
      "postgress://engram:LEAKME@db:5432/engram",
      "pg://u:LEAKME@db/x",
      "mysql://h/x",
    ]) {
      let error: unknown;
      try {
        dbTarget(spec, where());
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(UsageError);
      expect((error as Error).message).not.toContain("LEAKME");
      expect((error as Error).message).toMatch(/scheme/);
    }
  });

  it("refuses a Postgres URL that postgres.js cannot parse as usage, with no secret (P3-1)", () => {
    for (const spec of [
      "postgres://u:RAWSECRET@[::1/db",
      "postgres://u:ab%zzMALFSECRET@127.0.0.1:1/db",
    ]) {
      let error: unknown;
      try {
        dbTarget(spec, where());
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(UsageError);
      expect((error as Error).message).toMatch(/not a valid Postgres URL/);
      expect((error as Error).message).not.toMatch(/RAWSECRET|MALFSECRET|ab%zz/);
    }
  });

  it("resolves a SQLite path against the working folder", () => {
    expect(dbTarget("logs/e.db", where())).toMatchObject({ backend: "sqlite" });
    expect(dbTarget("logs/e.db", where()).label).toMatch(/work[\\/]logs[\\/]e\.db$/);
  });
});

describe("the binary on a bad --db or ENGRAM_DB_URL", () => {
  const bad = [
    "postgres://u:RAWSECRET@[::1/db",
    "postgres://u:ab%zzMALFSECRET@127.0.0.1:1/db",
    "postgress://engram:LEAKME@db:5432/engram",
  ];
  const secrets = /RAWSECRET|MALFSECRET|LEAKME/;

  it("exits 2 within seconds, with no secret and no stack trace, for doctor and write", {
    timeout: 120_000,
  }, async () => {
    for (const url of bad) {
      for (const args of [
        ["doctor", "--db", url],
        ["write", "--root", ".", "--owner", "dana", "--content", "x", "--db", url],
      ]) {
        const r = await engram(args);
        expect(r.code, `${args[0]} ${url}`).toBe(2);
        expect(r.ms).toBeLessThan(15_000);
        expect(r.text).not.toMatch(secrets);
        expect(r.text).not.toMatch(/^\s+at /m);
        expect(readdirSync(r.cwd)).toEqual([]);
      }
      const viaEnv = await engram(["doctor"], { ENGRAM_DB_URL: url });
      expect(viaEnv.code).toBe(2);
      expect(viaEnv.text).not.toMatch(secrets);
      expect(viaEnv.text).toContain("ENGRAM_DB_URL");
    }
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
    expect(message.startsWith("postgres://***@127.0.0.1:1/db: ")).toBe(true);
    expect(message).not.toContain("hunter2");
  });

  it("redactSecrets removes the URL, its userinfo and secret parameters, raw and percent-encoded", () => {
    const url = "postgres://u:p%40ss@h/db?password=q%26s";
    expect(redactSecrets(`failed ${url} with p@ss, p%40ss, q&s and q%26s`, url)).toBe(
      "failed postgres://***@h/db?password=*** with ***, ***, *** and ***",
    );
  });
});

const pg = postgresTarget();

describe.skipIf(!("url" in pg))("on Postgres (embedded, from core's globalSetup)", () => {
  const admin = "url" in pg ? pg.url : "";
  const leaks = (text: string) => text.includes(PG_PASSWORD) || text.includes(PG_PASSWORD_ENCODED);

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

  it("write, read and the printed explain hint through ENGRAM_DB_URL, with the password in no output (P3-6)", async () => {
    const url = freshDatabase(admin, "cmds");
    const env = { ENGRAM_DB_URL: url };
    const root = await fixtureCopy();
    const owner = ["--root", root, "--owner", "dana"];
    const w = await cli(["write", ...owner, "--content", "Lunch is at noon."], { env });
    expect(w.code).toBe(0);
    const r = await cli(["read", "lunch", ...owner], { env });
    expect(r.code).toBe(0);
    expect(r.out).toContain("Lunch is at noon.");
    // The hint is a command the user can run as printed, with the same environment.
    const hint = /^log .*; (engram explain .*)$/m.exec(r.out)?.[1] ?? "";
    expect(hint).toMatch(/^engram explain \S+$/);
    const x = await cli([...hint.split(" ").slice(1), "--owner", "dana"], { env });
    expect(x.out).toMatch(/^read \S+: \d+ explanations?/m);
    expect(x.code).toBe(0);
    for (const out of [w, r, x]) expect(leaks(out.out + out.err)).toBe(false);
  });

  it("a Postgres --db hint asks for the same URL instead of printing a redacted one (P3-6)", async () => {
    const url = freshDatabase(admin, "hint");
    const r = await cli(["read", "--root", await fixtureCopy(), "--owner", "dana", "--db", url]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/engram explain \S+ --db <the same postgres URL>/);
    expect(r.out).not.toMatch(/--db postgres:/);
    expect(leaks(r.out + r.err)).toBe(false);
  });

  it("a password in the query string never reaches the output (P3-2)", async () => {
    const u = new URL(freshDatabase(admin, "query"));
    u.password = "";
    u.search = "?password=QUERYSECRET";
    for (const args of [
      ["doctor", "--db", u.toString()],
      [
        "write",
        "--root",
        await tempDir(),
        "--owner",
        "dana",
        "--content",
        "x",
        "--db",
        u.toString(),
      ],
    ]) {
      const r = await cli(args);
      expect(r.out + r.err).not.toContain("QUERYSECRET");
    }
  });

  it("openDb scrubs a secret the server echoes back (holds only while openDb redacts, P3-7)", () => {
    // postgres.js sends unknown query parameters to the server as startup
    // parameters; password_encryption is a real one, so the server rejects the
    // bad value and quotes it. Its name matches the secret pattern.
    const u = new URL(freshDatabase(admin, "echo"));
    u.search = "?password_encryption=ECHOSECRET%26x";
    const target = dbTarget(u.toString(), where());
    expect(target.label).toContain("password_encryption=***");
    let message = "";
    try {
      openDb(target).close();
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/password_encryption/);
    expect(message).not.toMatch(/ECHOSECRET/);
    expect(leaks(message)).toBe(false);
  });

  it("a wrong password with reserved characters is reported without it, raw or encoded", async () => {
    const u = new URL(freshDatabase(admin, "wrong"));
    u.password = `x${PG_PASSWORD_ENCODED}`;
    const r = await cli(["doctor", "--db", u.toString()]);
    expect(r.code).toBe(1);
    expect(leaks(r.out + r.err)).toBe(false);
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

  it("the hint after a write or read on the default log leaves out --db", async () => {
    const home = await tempDir();
    const r = await cli(["read", "--root", await fixtureCopy(), "--owner", "dana"], { home });
    expect(r.out).toMatch(/; engram explain \S+$/m);
  });

  it("the hint after a SQLite --db names that path", async () => {
    const db = join(await tempDir(), "e.db");
    const r = await cli(["read", "--root", await fixtureCopy(), "--owner", "dana", "--db", db]);
    expect(r.out).toContain(`engram explain `);
    expect(r.out).toContain(`--db ${db}`);
  });
});

/** Every file under `dir`, recursively. */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/** A static import, an export-from, a dynamic import() or a require() of a pi package. */
const PI_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["'`]@earendil-works\//;

describe("packages/cli never imports pi (P3-15)", () => {
  it("the pattern catches every import form", () => {
    for (const source of [
      'import { x } from "@earendil-works/pi-ai";',
      'export * from "@earendil-works/pi-ai";',
      'const m = await import("@earendil-works/pi-ai/compat");',
      "const m = await import( '@earendil-works/pi-ai' );",
      'const m = require("@earendil-works/pi-coding-agent");',
      'import "@earendil-works/pi-ai";',
    ])
      expect(source).toMatch(PI_IMPORT);
    expect("const PI = /^@earendil-works\\/pi-/;").not.toMatch(PI_IMPORT);
  });

  it("has no pi package in package.json and no pi import in any file under src", () => {
    const manifest = readFileSync(join(REPO, "packages/cli/package.json"), "utf8");
    expect(manifest).not.toContain("@earendil-works/");
    const files = walk(join(REPO, "packages/cli/src"));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(PI_IMPORT);
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

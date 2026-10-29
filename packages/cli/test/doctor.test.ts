// `engram doctor` (card E0.4): every check passes on this checkout, and each
// one fails when the thing it checks is removed or broken. Checks that read
// the repository run against a copy of the files they read, so a test can
// break one without touching the checkout.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { cp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFakeAdapter, createLettaAdapter } from "@engram/adapters";
import type { Adapter } from "@engram/core";
import { describe, expect, it } from "vitest";
import {
  BENCH_FIXTURES,
  checkLettaAdapter,
  checkMem0Adapter,
  DEPS,
  PINS,
  PROVIDER_KEYS,
  parsePins,
} from "../src/doctor.ts";
import { run } from "../src/run.ts";
import { cli, FIXTURE, NOW, REPO, readArgs, tempDir, testId } from "./helpers.ts";
import {
  freshDatabase,
  hasLogTables,
  PG_PASSWORD,
  PG_PASSWORD_ENCODED,
  postgresTarget,
} from "./postgres.ts";

/** A copy of exactly the repository files doctor reads. */
async function repoCopy(): Promise<string> {
  const dir = await tempDir();
  const copy = (rel: string) => cp(join(REPO, rel), join(dir, rel), { recursive: true });
  await copy(PINS);
  await copy(DEPS);
  await copy(PROVIDER_KEYS);
  await copy(BENCH_FIXTURES);
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    const manifest = join("packages", pkg, "package.json");
    if (!existsSync(join(REPO, manifest))) continue;
    await copy(manifest);
    const pi = join("packages", pkg, "node_modules", "@earendil-works");
    if (!existsSync(join(REPO, pi))) continue;
    for (const name of readdirSync(join(REPO, pi))) await copy(join(pi, name, "package.json"));
  }
  return dir;
}

const edit = async (file: string, from: string | RegExp, to: string) => {
  const text = readFileSync(file, "utf8");
  const next = text.replace(from, to);
  expect(next).not.toBe(text);
  await writeFile(file, next);
};

/** Doctor with a fresh log path and the given options. */
const doctor = async (opts: Parameters<typeof cli>[1] = {}, ...args: string[]) =>
  cli(["doctor", "--db", join(await tempDir(), "e.db"), ...args], opts);

describe("engram doctor on this checkout", () => {
  it("passes every check with no log yet, a preset and a readable root, and creates nothing", async () => {
    const db = join(await tempDir(), "engram.db");
    const { code, out } = await cli(["doctor", "--db", db, "--root", FIXTURE]);
    expect(out).toMatch(/^ok\s+log\s+sqlite .*no log yet; the first read or write creates it/m);
    expect(existsSync(db)).toBe(false);
    expect(out).toMatch(/^ok\s+policy\s+preset\.medium v1/m);
    expect(out).toMatch(/^ok\s+store\s+.*is a readable folder/m);
    expect(out).toMatch(/^ok\s+adapter files\s+.*4 memories listed through the plane, 4 admitted/m);
    expect(out).toMatch(/^ok\s+adapter mem0\s+in-memory Mem0 with the hashing embedder/m);
    expect(out).toMatch(
      /^ok\s+adapter letta\s+git version .*a MemFS repository in a temporary folder: a write and a read round-trip through the plane, one commit, and a delete, offline/m,
    );
    expect(out).toMatch(/^ok\s+provider keys\s+none of \d+ key variables for \d+ providers/m);
    expect(out).toMatch(/^ok\s+benchmark pins\s+.*6 benchmarks, 5 pinned; .*gatemem 24 lines/m);
    expect(out).toMatch(/^ok\s+pi pin\s+pi-ai 1\.3\.0, pi-coding-agent 1\.3\.0/m);
    expect(out).toMatch(/^ok\s+node\s+Node \d+/m);
    expect(out).toContain("doctor: all checks passed");
    expect(code).toBe(0);
  });

  it("reports an up-to-date log that a read created, naming the backend", async () => {
    const db = join(await tempDir(), "engram.db");
    await cli(readArgs(db));
    const { out } = await cli(["doctor", "--db", db]);
    expect(out).toMatch(/^ok\s+log\s+sqlite .*engram\.db: opens; up to date/m);
  });

  it("looks for the default log under the home folder and does not create it", async () => {
    const home = await tempDir();
    const { out } = await cli(["doctor"], { home });
    expect(out).toContain(join(home, ".engram", "engram.db"));
    expect(existsSync(join(home, ".engram"))).toBe(false);
  });

  it("reports --json with one entry per check", async () => {
    const { out } = await doctor({}, "--json");
    const report = JSON.parse(out) as { checks: { name: string }[]; failed: number };
    expect(report.checks.map((c) => c.name)).toEqual([
      "log",
      "policy",
      "store",
      "adapter files",
      "adapter mem0",
      "adapter letta",
      "provider keys",
      "benchmark pins",
      "pi pin",
      "node",
    ]);
    expect(report.failed).toBe(0);
  });
});

const pg = postgresTarget();

describe.skipIf(!("url" in pg))("engram doctor on Postgres (embedded)", () => {
  const admin = "url" in pg ? pg.url : "";

  it("connects to a database with no log, reports it and creates no table", async () => {
    const url = freshDatabase(admin, "doctor");
    const { code, out } = await cli(["doctor", "--db", url]);
    expect(out).toMatch(
      /^ok\s+log\s+postgres postgres:\/\/\*\*\*@\S+: connects, no log yet; the first read or write creates it/m,
    );
    expect(out).not.toContain(PG_PASSWORD);
    expect(out).not.toContain(PG_PASSWORD_ENCODED);
    expect(code).toBe(0);
    expect(hasLogTables(url)).toBe(false);
  });

  it("reports the log a write created as up to date", async () => {
    const url = freshDatabase(admin, "doctorlog");
    const root = await tempDir();
    const w = await cli([
      "write",
      "--root",
      root,
      "--owner",
      "dana",
      "--content",
      "x",
      "--db",
      url,
    ]);
    expect(w.code).toBe(0);
    const { out } = await cli(["doctor"], { env: { ENGRAM_DB_URL: url } });
    expect(out).toMatch(/^ok\s+log\s+postgres \S+: opens; up to date/m);
    expect(out).not.toContain(PG_PASSWORD);
    expect(out).not.toContain(PG_PASSWORD_ENCODED);
  });
});

describe("engram doctor, each check red", () => {
  it("log: an unreachable Postgres fails, named by its redacted label, never its password", async () => {
    // Port 1 on loopback: nothing listens, so the connection is refused at once.
    const url = "postgres://engram:hunter2@127.0.0.1:1/engram";
    const viaFlag = await cli(["doctor", "--db", url]);
    expect(viaFlag.out).toMatch(
      /^fail\s+log\s+postgres postgres:\/\/\*\*\*@127\.0\.0\.1:1\/engram: /m,
    );
    expect(viaFlag.out).not.toContain("hunter2");
    expect(viaFlag.code).toBe(1);
    const viaEnv = await cli(["doctor"], { env: { ENGRAM_DB_URL: url } });
    expect(viaEnv.out).toMatch(/^fail\s+log\s+postgres postgres:/m);
    expect(viaEnv.out).not.toContain("hunter2");
  });

  it("policy: a file that does not validate fails, naming the line", async () => {
    const dir = await tempDir();
    const policy = join(dir, "bad.yaml");
    await writeFile(policy, "id: broken\nversion: 1\n");
    const { code, out } = await doctor({}, "--policy", policy);
    expect(out).toMatch(/^fail\s+policy\s+.*bad\.yaml:\d+:\d+/m);
    expect(out).toContain("doctor: 1 check failed");
    expect(code).toBe(1);
  });

  it("store and adapter files: a root that does not exist fails both", async () => {
    const { code, out } = await doctor({}, "--root", join(await tempDir(), "nowhere"));
    expect(out).toMatch(/^fail\s+store\s/m);
    expect(out).toMatch(/^fail\s+adapter files\s/m);
    expect(code).toBe(1);
  });

  it("store and adapter files: skipped when no root is given", async () => {
    const { out } = await doctor();
    expect(out).toMatch(/^skip\s+store\s+no --root given/m);
    expect(out).toMatch(/^skip\s+adapter files\s+no --root given/m);
  });

  it("adapter mem0: fails when the store loses what the plane wrote", async () => {
    const forgetful = (): Promise<Adapter> => {
      const fake = createFakeAdapter({ name: "mem0" });
      return Promise.resolve({ ...fake, list: async () => [], search: async () => [] });
    };
    let n = 0;
    const [status, detail] = await checkMem0Adapter(NOW, () => testId(900 + ++n), forgetful);
    expect(status).toBe("fail");
    expect(detail).toContain("a read did not return it");
  });

  it("adapter mem0: passes on the fake store, so the red case is the store and not the probe", async () => {
    let n = 0;
    const [status] = await checkMem0Adapter(
      NOW,
      () => testId(950 + ++n),
      () => Promise.resolve(createFakeAdapter({ name: "mem0" })),
    );
    expect(status).toBe("ok");
  });

  it("adapter letta: fails when git is not on the path", async () => {
    const saved = process.env.PATH;
    process.env.PATH = "";
    try {
      let n = 0;
      const [status, detail] = await checkLettaAdapter(NOW, () => testId(960 + ++n));
      expect(status).toBe("fail");
      expect(detail).toContain("git executable is not on the path");
    } finally {
      process.env.PATH = saved;
    }
  });

  it("adapter letta: fails when the repository keeps an item it was asked to delete", async () => {
    let n = 0;
    const [status, detail] = await checkLettaAdapter(
      NOW,
      () => testId(970 + ++n),
      async (root) => {
        const letta = await createLettaAdapter({ root });
        return Object.assign(Object.create(letta) as Adapter, { delete: async () => undefined });
      },
    );
    expect(status).toBe("fail");
    expect(detail).toContain("deleted but a read still returns it");
  });

  it("adapter letta: fails when a write leaves no commit behind", async () => {
    let n = 0;
    const [status, detail] = await checkLettaAdapter(
      NOW,
      () => testId(980 + ++n),
      async (root) => {
        const letta = await createLettaAdapter({ root });
        return Object.assign(Object.create(letta) as Adapter, { history: async () => [] });
      },
    );
    expect(status).toBe("fail");
    expect(detail).toContain("0 versions in git");
  });

  it("provider keys: names a set key and its provider, never its value", async () => {
    const secret = "sk-ant-doctor-test-value";
    const { out } = await doctor({ env: { ANTHROPIC_API_KEY: secret } });
    expect(out).toMatch(
      /^ok\s+provider keys\s+set: ANTHROPIC_API_KEY \(anthropic\); values not read/m,
    );
    expect(out).not.toContain(secret);
  });

  it("provider keys: fails when the generated name list is missing", async () => {
    const repo = await repoCopy();
    await rm(join(repo, PROVIDER_KEYS));
    const { code, out } = await doctor({ repo });
    expect(out).toMatch(/^fail\s+provider keys\s+.*provider-keys\.json: missing; run make api/m);
    expect(code).toBe(1);
  });

  it("the repository copy passes, so each red case below is its one edit", async () => {
    const { code, out } = await doctor({ repo: await repoCopy() });
    expect(out).toContain("doctor: all checks passed");
    expect(code).toBe(0);
  });

  it("benchmark pins: fails when PINS.md is missing", async () => {
    const repo = await repoCopy();
    await rm(join(repo, PINS));
    const { out } = await doctor({ repo });
    expect(out).toMatch(/^fail\s+benchmark pins\s+packages\/bench\/PINS\.md is missing/m);
  });

  it("benchmark pins: fails when the pin moves away from the commit the fixture was vendored at", async () => {
    const repo = await repoCopy();
    await edit(join(repo, PINS), "a983828b3bb7565e16e25ac8cdc2fc1982633b0b", "0".repeat(40));
    const { out } = await doctor({ repo });
    expect(out).toMatch(
      /^fail\s+benchmark pins\s+fixtures\/bench\/gatemem was vendored at a983828/m,
    );
  });

  it("benchmark pins: fails when a vendored line no longer matches its manifest hash", async () => {
    const repo = await repoCopy();
    const file = join(repo, BENCH_FIXTURES, "gatemem", "office", "checkpoints.jsonl");
    await edit(file, /"query_text": ?"/, '"query_text":"edited ');
    const { out } = await doctor({ repo });
    expect(out).toMatch(
      /^fail\s+benchmark pins\s+fixtures\/bench\/gatemem\/office\/checkpoints\.jsonl does not match/m,
    );
  });

  it("benchmark pins: only the registered table counts, not a later candidates table", async () => {
    const repo = await repoCopy();
    const file = join(repo, PINS);
    const original = parsePins(readFileSync(file, "utf8"));
    await writeFile(
      file,
      `${readFileSync(file, "utf8")}
## Candidates checked, not registered

| benchmark | paper | repository | pinned commit | checked | status |
|---|---|---|---|---|---|
| MEM-INV-Bench | arXiv 2606.24322 | https://example.org/mem-inv | \`${"a".repeat(40)}\` | 2026-10-30 | released |
| Other | arXiv 0000.00000 | none | none | 2026-10-30 | none |
`,
    );
    expect(parsePins(readFileSync(file, "utf8"))).toEqual(original);
    const { out } = await doctor({ repo });
    const pinned = original.filter((r) => r.commit !== undefined).length;
    expect(out).toMatch(
      new RegExp(
        `^ok\\s+benchmark pins\\s+\\S+: ${original.length} benchmarks, ${pinned} pinned`,
        "m",
      ),
    );
  });

  it("benchmark pins: a released benchmark without a commit does not parse", () => {
    const text = readFileSync(join(REPO, PINS), "utf8").replace(
      "`9e0b455f4ef0e2ab8f2e582289761153549043fc`",
      "unknown",
    );
    expect(() => parsePins(text)).toThrow(
      /LongMemEval is released but has no 40-hex pinned commit/,
    );
  });

  it("benchmark pins: a candidate's fixture is checked against the commit of its check, and is not a pin", async () => {
    const { out } = await doctor({ repo: REPO });
    expect(out).toMatch(
      /^ok\s+benchmark pins\s+.*6 benchmarks, 5 pinned; .*mem-inv-bench \d+ lines at cf3c9a4 \(candidate, not registered\)/m,
    );
  });

  it("benchmark pins: fails when a candidate fixture's line no longer matches its manifest hash", async () => {
    const repo = await repoCopy();
    await edit(
      join(repo, BENCH_FIXTURES, "mem-inv-bench", "cases.jsonl"),
      /"task": "/,
      '"task": "x',
    );
    const { out } = await doctor({ repo });
    expect(out).toMatch(
      /^fail\s+benchmark pins\s+fixtures\/bench\/mem-inv-bench\/cases\.jsonl does not match/m,
    );
  });

  it("benchmark pins: fails when the scripts or the goldens of the candidate fixture change", async () => {
    for (const name of ["script.json", "probe-script.json", "upstream-golden.json"]) {
      const repo = await repoCopy();
      await edit(join(repo, BENCH_FIXTURES, "mem-inv-bench", name), /"/, '"x');
      const { out } = await doctor({ repo });
      expect(out, name).toMatch(
        new RegExp(
          `^fail\\s+benchmark pins\\s+fixtures/bench/mem-inv-bench/${name.replace(".", "\\.")} does not match`,
          "m",
        ),
      );
    }
  });

  it("benchmark pins: a manifest with both `files` and `selection` has both checked", async () => {
    const repo = await repoCopy();
    const manifest = join(repo, BENCH_FIXTURES, "gatemem", "manifest.json");
    const value = JSON.parse(readFileSync(manifest, "utf8")) as Record<string, unknown>;
    await writeFile(manifest, JSON.stringify({ ...value, files: {} }, null, 2));
    const file = join(repo, BENCH_FIXTURES, "gatemem", "office", "checkpoints.jsonl");
    await edit(file, /"query_text": ?"/, '"query_text":"edited ');
    const { out } = await doctor({ repo });
    expect(out).toMatch(
      /^fail\s+benchmark pins\s+fixtures\/bench\/gatemem\/office\/checkpoints\.jsonl does not match/m,
    );
  });

  it("benchmark pins: fails when the candidate's recorded commit moves away from the fixture's", async () => {
    const repo = await repoCopy();
    await edit(
      join(repo, PINS),
      "`cf3c9a4ca9f0478000d6aa26eb268b875232d34b`",
      `\`${"b".repeat(40)}\``,
    );
    const { out } = await doctor({ repo });
    expect(out).toMatch(
      /^fail\s+benchmark pins\s+fixtures\/bench\/mem-inv-bench was vendored at cf3c9a4\S*, \S+ records for the candidate b{40}/m,
    );
  });

  it("pi pin: fails when docs/deps.md records another version", async () => {
    const repo = await repoCopy();
    await edit(
      join(repo, DEPS),
      "| @earendil-works/pi-ai | 1.3.0 |",
      "| @earendil-works/pi-ai | 1.2.9 |",
    );
    const { out } = await doctor({ repo });
    expect(out).toMatch(
      /^fail\s+pi pin\s+packages\/\S+ pins @earendil-works\/pi-ai 1\.3\.0; docs\/deps\.md records 1\.2\.9/m,
    );
  });

  it("pi pin: fails when the installed copy is another version", async () => {
    const repo = await repoCopy();
    const installed = join(
      repo,
      "packages",
      "runner",
      "node_modules",
      "@earendil-works",
      "pi-coding-agent",
      "package.json",
    );
    await edit(installed, /"version": ?"1\.3\.0"/, '"version": "1.4.0"');
    const { out } = await doctor({ repo });
    expect(out).toMatch(
      /^fail\s+pi pin\s+packages\/runner has @earendil-works\/pi-coding-agent 1\.4\.0 installed/m,
    );
  });

  it("pi pin: fails when a package's pi is not installed", async () => {
    const repo = await repoCopy();
    await rm(join(repo, "packages", "runner", "node_modules"), { recursive: true });
    const { out } = await doctor({ repo });
    expect(out).toMatch(
      /^fail\s+pi pin\s+.* is not installed for packages\/runner; run pnpm install/m,
    );
  });

  it("node: fails below Node 24", async () => {
    const { code, out } = await doctor({ nodeVersion: "22.13.0" });
    expect(out).toMatch(/^fail\s+node\s+Node 22\.13\.0; Engram needs 24 or later/m);
    expect(code).toBe(1);
  });

  it("the repository checks skip outside a checkout", async () => {
    // `cli` fills in the real checkout when repo is undefined, so this calls run itself.
    const dir = await tempDir();
    let out = "";
    await run(["doctor", "--db", join(dir, "e.db")], {
      out: (s) => {
        out += s;
      },
      err: () => {},
      cwd: dir,
      home: dir,
      now: () => NOW,
      newId: () => testId(990),
      env: {},
      nodeVersion: "24.0.0",
      repo: undefined,
    });
    for (const name of ["provider keys", "benchmark pins", "pi pin"])
      expect(out).toMatch(
        new RegExp(`^skip\\s+${name}\\s+not run from a repository checkout`, "m"),
      );
  });
});

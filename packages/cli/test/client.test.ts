// Card E8.2 on the client (ADR 0027 decision 3): every command but doctor,
// serve, mcp and hook is exactly one client call, in process unless a server
// is named; --server and ENGRAM_SERVER_URL send the same call to `engram
// serve`; `engram serve` listens on loopback only; `engram retain` sweeps a
// shared scope as a user-sourced member (closing the backlog's retain item).
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadPreset } from "@engram/core";
import { type Listening, listen, openWorkspace } from "@engram/server";
import { afterAll, describe, expect, it } from "vitest";
import type { Fetch } from "../src/connect.ts";
import { cli, HOME, NOW, readArgs, tempDir, testId } from "./helpers.ts";

/** A transport that counts the calls going through it and records their paths. */
function counting() {
  const paths: string[] = [];
  const transport =
    (next: Fetch): Fetch =>
    async (request) => {
      paths.push(`${request.method} ${new URL(request.url).pathname}`);
      return next(request);
    };
  return { paths, transport };
}

describe("one client call per command, in process", () => {
  it("read, write, promote, explain, retain, lint and simulate each make exactly one request", async () => {
    const root = await tempDir();
    const db = join(await tempDir(), "engram.db");
    const store = ["--root", root, "--owner", "dana", "--db", db];
    const calls: [string, string[], string][] = [];
    const run = async (args: string[]) => {
      const c = counting();
      const r = await cli(args, { transport: c.transport });
      calls.push([args[0] as string, c.paths, r.err]);
      return r;
    };
    const id = "01920000-0000-7000-8000-00000000c001";
    await run(["write", ...store, "--id", id, "--content", "Dana deploys on Tuesdays."]);
    const read = JSON.parse((await run(["read", ...store, "--json"])).out);
    await run(["explain", read.read_id, "--db", db, "--owner", "dana"]);
    await run(["promote", id, "--to", "person:dana", ...store]);
    await run(["retain", "--scope", "person:dana", "--owner", "dana", "--db", db]);
    await run(["lint", "--scope", "person:dana", "--owner", "dana", "--db", db]);
    await run(["simulate", "--db", db]);
    expect(calls.map(([c, paths]) => [c, paths])).toEqual([
      ["write", ["POST /api/v1/items"]],
      ["read", ["POST /api/v1/read"]],
      ["explain", [`POST /api/v1/explain/${read.read_id}`]],
      ["promote", ["POST /api/v1/promote"]],
      ["retain", ["POST /api/v1/retain"]],
      ["lint", ["POST /api/v1/lint"]],
      ["simulate", ["POST /api/v1/simulate"]],
    ]);
  });

  it("simulate opens no log: its scratch replay touches none", async () => {
    const home = await tempDir();
    const s = await cli(["simulate"], { home });
    expect(s.code).toBe(0);
    const { readdir } = await import("node:fs/promises");
    expect(await readdir(home)).toEqual([]);
  });
});

describe("engram lint", () => {
  it("prints each finding with its reason as a member, and refuses a non-member", async () => {
    const dir = await tempDir();
    const root = await tempDir();
    const db = join(dir, "engram.db");
    const written = await cli([
      "write",
      ...["--root", root, "--owner", "dana", "--db", db],
      ...["--content", "Dana is on call this week.", "--valid-to", "2026-10-02T00:00:00.000Z"],
      ...["--at", "2026-10-01T00:00:00.000Z"],
    ]);
    expect(written.code).toBe(0);
    const linted = await cli(["lint", "--scope", "person:dana", "--owner", "dana", "--db", db]);
    expect(linted.code).toBe(1);
    expect(linted.out).toContain(`lint person:dana at ${NOW} as person:dana: allow, 1 finding`);
    expect(linted.out).toMatch(
      /lint allow \S+: expired-validity \(warn\): .*evidence: valid_to 2026-10-02T00:00:00.000Z.*\(preset\.medium\/lint\/expired-validity\)/,
    );
    const refused = await cli(["lint", "--scope", "person:dana", "--db", db, "--as", "person:eve"]);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain("person:eve is not a member of person:dana");
  });

  it("needs a scope", async () => {
    const r = await cli(["lint", "--owner", "dana"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--scope");
  });
});

describe("engram retain", () => {
  it("retires expired items in a shared scope as a user-sourced member, and refuses a non-member", async () => {
    const dir = await tempDir();
    const root = await tempDir();
    const db = join(dir, "engram.db");
    const medium = loadPreset("medium");
    const policy = join(dir, "team-ttl.yaml");
    await writeFile(
      policy,
      JSON.stringify({
        ...medium,
        retention: medium.retention.map((r) => (r.scope === "team" ? { ...r, ttl: 86_400 } : r)),
      }),
    );
    const as = ["--as", "person:dana", "--member", "team:platform", "--member", "person:dana"];
    const written = await cli([
      "write",
      ...["--root", root, "--owner", "dana", "--db", db, "--policy", policy, ...as],
      ...["--scope", "team:platform", "--content", "The freeze starts Friday."],
      ...["--at", "2026-10-01T00:00:00.000Z"],
    ]);
    expect(written.code).toBe(0);
    const swept = await cli([
      "retain",
      "--scope",
      "team:platform",
      "--db",
      db,
      "--policy",
      policy,
      ...as,
    ]);
    expect(swept.code).toBe(0);
    expect(swept.out).toContain(
      `retain team:platform at ${NOW} as person:dana: allow, 1 expired, 0 evicted`,
    );
    expect(swept.out).toMatch(/retire allow \S+: .*\(preset\.medium\/retention\/team/);
    const refused = await cli([
      "retain",
      "--scope",
      "team:platform",
      "--db",
      db,
      "--as",
      "person:eve",
    ]);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain("person:eve is not a member of team:platform");
  });

  it("needs a scope", async () => {
    const r = await cli(["retain", "--owner", "dana"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--scope");
  });
});

describe("--server and ENGRAM_SERVER_URL", () => {
  let server: Listening | undefined;
  let root = "";
  afterAll(async () => server?.close());

  const start = async () => {
    if (server) return server;
    root = await tempDir();
    let n = 0;
    const workspace = openWorkspace({
      root,
      owner: "dana",
      db: ":memory:",
      cwd: root,
      home: HOME,
      env: {},
      newId: () => testId(800_000 + ++n),
    });
    workspace.open();
    server = await listen(workspace, { port: 0, now: () => NOW });
    return server;
  };

  it("sends the same one call to a running server", async () => {
    const { url } = await start();
    const c = counting();
    const w = await cli(["write", "--server", url, "--owner", "dana", "--content", "Over HTTP."], {
      transport: c.transport,
    });
    expect(w.err).toBe("");
    expect(w.code).toBe(0);
    expect(w.out).toContain(`log of the server at ${url}`);
    const r = await cli(["read", "HTTP", "--owner", "dana"], {
      env: { ENGRAM_SERVER_URL: url },
      transport: c.transport,
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain("Over HTTP.");
    expect(r.out).toContain(`store files at ${root}`);
    expect(c.paths).toEqual(["POST /api/v1/items", "POST /api/v1/read"]);
  });

  it("refuses the workspace flags, which name the server's own workspace", async () => {
    const { url } = await start();
    const r = await cli(["read", "--server", url, "--owner", "dana", "--db", "x.db"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--db name the workspace");
  });

  it("reports a server that does not answer as an error, exit 1", async () => {
    const r = await cli(["read", "--server", "http://127.0.0.1:9", "--owner", "dana"]);
    expect(r.code).toBe(1);
  });
});

describe("engram serve", () => {
  it("listens on loopback, answers, and stops when told to", async () => {
    const stop = new AbortController();
    const db = join(await tempDir(), "engram.db");
    const running = cli(["serve", "--port", "0", "--db", db, "--as", "person:dana"], {
      stop: stop.signal,
    });
    // A stop that comes before or after the server is up ends it the same way.
    await new Promise((done) => setTimeout(done, 100));
    stop.abort();
    const r = await running;
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^engram serve: listening on http:\/\/127\.0\.0\.1:\d+ \(log /);
    expect(r.out).toContain("viewer person:dana");
    expect(r.out).toContain("engram serve: stopped");
  });

  it("answers its viewer over HTTP", async () => {
    const stop = new AbortController();
    const lines: string[] = [];
    const db = join(await tempDir(), "engram.db");
    const { run } = await import("../src/run.ts");
    const running = run(["serve", "--port", "0", "--db", db, "--as", "person:dana"], {
      out: (s) => lines.push(s),
      err: (s) => lines.push(s),
      cwd: HOME,
      home: HOME,
      now: () => NOW,
      newId: () => testId(900_001),
      env: {},
      nodeVersion: process.versions.node,
      repo: undefined,
      stop: stop.signal,
    });
    let url: string | undefined;
    for (let i = 0; i < 200 && url === undefined; i++) {
      await new Promise((done) => setTimeout(done, 25));
      url = /listening on (\S+)/.exec(lines.join(""))?.[1];
    }
    expect(url).toBeDefined();
    const viewer = await (await fetch(`${url}/api/v1/viewer`)).json();
    stop.abort();
    expect(await running).toBe(0);
    expect(viewer).toEqual({
      viewer: { id: "person:dana", level: "person", memberships: ["person:dana"] },
    });
  });

  it("refuses a host that is not loopback, exit 2", async () => {
    const r = await cli(["serve", "--host", "0.0.0.0", "--db", ":memory:"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("not a loopback address");
  });
});

describe("read through the client keeps its Gate A output", () => {
  it("prints the adoption and retention lines from the server's sync", async () => {
    const db = join(await tempDir(), "engram.db");
    const r = await cli(readArgs(db));
    expect(r.out).toContain("imported 4 of 4 memories: 4 allowed, 0 denied, 0 already in the log");
    expect(r.out).toContain("retention: 0 expired, 0 evicted");
  });
});

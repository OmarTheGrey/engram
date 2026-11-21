// The CLI's decision export (card E8.13, ADR 0043): off unless --otlp,
// --export-jsonl or their ENGRAM_ variables name a sink; OTEL_* alone never
// turns it on; a bad URL and an export flag with --server are usage errors;
// `engram serve` exports what its calls decide. The OTLP receiver runs in
// the test on a loopback port, so nothing reaches the network.
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { DecisionSpanShape } from "@engram/core";
import { describe, expect, it } from "vitest";
import { run } from "../src/run.ts";
import { cli, fixtureCopy, HOME, NOW, tempDir, testId } from "./helpers.ts";

const SECRET = "zebra-quartz-7731";

const writeArgs = (root: string, db: string, ...more: string[]) => [
  "write",
  "--store",
  "files",
  "--root",
  root,
  "--owner",
  "dana",
  "--db",
  db,
  "--content",
  `the vault phrase is ${SECRET}`,
  ...more,
];

async function receiver() {
  const bodies: string[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c: Buffer) => {
      body += c.toString("utf8");
    });
    req.on("end", () => {
      bodies.push(body);
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/v1/traces`,
    bodies,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

const spansIn = (file: string) =>
  readFileSync(file, "utf8")
    .trimEnd()
    .split("\n")
    .map((l) => DecisionSpanShape.parse(JSON.parse(l)));

describe("engram write with a decision export", () => {
  it("--export-jsonl appends the write's span, without its content", async () => {
    const dir = await tempDir();
    const file = join(dir, "spans.jsonl");
    const r = await cli(
      writeArgs(await fixtureCopy(), join(dir, "engram.db"), "--export-jsonl", file),
    );
    expect(r.code).toBe(0);
    expect(readFileSync(file, "utf8")).not.toContain(SECRET);
    const spans = spansIn(file);
    expect(spans.map((s) => [s.name, s.attributes["engram.decision"]])).toContainEqual([
      "upsert_memory",
      "allow",
    ]);
  });

  it("--otlp posts the span before the command returns", async () => {
    const rx = await receiver();
    try {
      const dir = await tempDir();
      const r = await cli(writeArgs(await fixtureCopy(), join(dir, "engram.db"), "--otlp", rx.url));
      expect(r.code).toBe(0);
      expect(r.err).toBe("");
      expect(rx.bodies.length).toBeGreaterThan(0);
      expect(rx.bodies.join("")).toContain('"upsert_memory"');
      expect(rx.bodies.join("")).not.toContain(SECRET);
    } finally {
      await rx.close();
    }
  });

  it("ENGRAM_EXPORT_JSONL turns it on; OTEL_EXPORTER_OTLP_ENDPOINT alone never does", async () => {
    const rx = await receiver();
    try {
      const dir = await tempDir();
      const file = join(dir, "env.jsonl");
      const off = await cli(writeArgs(await fixtureCopy(), join(dir, "a.db")), {
        env: { OTEL_EXPORTER_OTLP_ENDPOINT: rx.url.replace("/v1/traces", "") },
      });
      expect(off.code).toBe(0);
      expect(rx.bodies).toEqual([]);
      const on = await cli(writeArgs(await fixtureCopy(), join(dir, "b.db")), {
        env: { ENGRAM_EXPORT_JSONL: file },
      });
      expect(on.code).toBe(0);
      expect(spansIn(file).length).toBeGreaterThan(0);
    } finally {
      await rx.close();
    }
  });

  it("without a flag or variable, nothing is exported", async () => {
    const dir = await tempDir();
    const r = await cli(writeArgs(await fixtureCopy(), join(dir, "engram.db")), { cwd: dir });
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, "spans.jsonl"))).toBe(false);
  });

  it("refuses a URL that is not http or https, and an export flag with --server, exit 2", async () => {
    const bad = await cli(["read", "--owner", "dana", "--db", ":memory:", "--otlp", "ftp://x"]);
    expect(bad.code).toBe(2);
    expect(bad.err).toContain("http or https");
    const remote = await cli([
      "read",
      "--as",
      "person:dana",
      "--server",
      "http://127.0.0.1:7313",
      "--export-jsonl",
      "x.jsonl",
    ]);
    expect(remote.code).toBe(2);
    expect(remote.err).toContain("--export-jsonl");
  });
});

describe("engram serve with a decision export", () => {
  it("exports each call's decisions to the JSONL file it names", async () => {
    const dir = await tempDir();
    const file = join(dir, "serve.jsonl");
    const stop = new AbortController();
    const lines: string[] = [];
    const running = run(
      ["serve", "--port", "0", "--db", join(dir, "engram.db"), "--export-jsonl", file],
      {
        out: (s) => lines.push(s),
        err: (s) => lines.push(s),
        cwd: HOME,
        home: HOME,
        now: () => NOW,
        newId: () => testId(910_001),
        env: {},
        nodeVersion: process.versions.node,
        repo: undefined,
        stop: stop.signal,
      },
    );
    let url: string | undefined;
    for (let i = 0; i < 200 && url === undefined; i++) {
      await new Promise((done) => setTimeout(done, 25));
      url = /listening on (\S+)/.exec(lines.join(""))?.[1];
    }
    expect(url).toBeDefined();
    const answer = await fetch(`${url}/api/v1/read`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actor: { id: "person:dana", level: "person", memberships: ["person:dana"] },
        text: SECRET,
      }),
    });
    expect(answer.status).toBe(200);
    stop.abort();
    expect(await running).toBe(0);
    expect(lines.join("")).toContain(`exporting decisions to jsonl ${file}`);
    const spans = spansIn(file);
    expect(spans.map((s) => s.name)).toEqual(["search_memory"]);
    expect(readFileSync(file, "utf8")).not.toContain(SECRET);
  });
});

// The decision export's sinks (card E8.13, ADR 0043): off unless configured;
// the JSONL sink writes one span a line to a temp file; the OTLP sink posts
// to a receiver this test runs on a loopback port (no network). Every call
// through the app flushes what the log gained, and no span written or sent
// holds the memory's content.
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import { DecisionSpanShape, decisionSpan, loadPreset, migrate, openSqlite } from "@engram/core";
import { createEngramClient } from "@engram/sdk";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import {
  EXPORT_JSONL_ENV,
  exportConfig,
  exportsAnything,
  jsonlSink,
  OTLP_URL_ENV,
  openSinks,
  otlpSink,
  startExport,
} from "../src/export.ts";
import { UsageError, workspaceOf } from "../src/workspace.ts";
import { BASE, dana, id, itemFor, NOW, PORT } from "./helpers.ts";

const SECRET = "zebra-quartz-7731";
const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});
async function temp() {
  const d = await mkdtemp(join(tmpdir(), "engram-export-"));
  dirs.push(d);
  return d;
}

/** An app over an in-memory log and the fake store, exporting to `sinks`. */
function exportingApp(sinks: Parameters<typeof startExport>[1]) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const workspace = workspaceOf(
    { db, adapter: createFakeAdapter(), policy: loadPreset("medium"), newId: () => id(++n) },
    { store: null },
  );
  const errors: unknown[] = [];
  const decisions = startExport(db, sinks, (e) => errors.push(e));
  const app = createApp(workspace, {
    port: PORT,
    now: () => NOW,
    onError: (e) => errors.push(e),
    decisions,
  });
  const client = createEngramClient({ baseUrl: BASE, fetch: async (r) => app.fetch(r) });
  return { db, client, decisions, errors };
}

/** A call that writes a secret and one that reads for it. */
async function writeAndRead(client: ReturnType<typeof exportingApp>["client"]) {
  await client.POST("/api/v1/items", {
    body: {
      actor: { ...dana, source: "user" },
      item: itemFor(1, { content: `the vault phrase is ${SECRET}` }),
    },
  });
  await client.POST("/api/v1/read", { body: { actor: dana, text: SECRET } });
}

/** A loopback OTLP receiver: records each request's path, content type and JSON body. */
async function receiver(status = 200) {
  const got: { path: string; type: string | undefined; body: unknown }[] = [];
  const server: Server = createServer((req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      got.push({
        path: req.url ?? "",
        type: req.headers["content-type"],
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      });
      res.writeHead(status, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/v1/traces`,
    got,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

describe("configuration: off unless named", () => {
  it("no flag and no variable names no sink, whatever OTEL_* says", () => {
    const env = {
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
      OTEL_TRACES_EXPORTER: "otlp",
    };
    const config = exportConfig({}, env, "/work");
    expect(config).toEqual({});
    expect(exportsAnything(config)).toBe(false);
    expect(openSinks(config)).toEqual([]);
  });

  it("the flags name the sinks, else the ENGRAM_ variables; a relative file is under cwd", () => {
    const cwd = join(tmpdir(), "w");
    expect(
      exportConfig(
        { otlp: "http://127.0.0.1:4318/v1/traces", "export-jsonl": "out/spans.jsonl" },
        {},
        cwd,
      ),
    ).toEqual({ otlp: "http://127.0.0.1:4318/v1/traces", jsonl: join(cwd, "out/spans.jsonl") });
    const env = { [OTLP_URL_ENV]: "https://collector.example/v1/traces", [EXPORT_JSONL_ENV]: "" };
    expect(exportConfig({}, env, cwd)).toEqual({ otlp: "https://collector.example/v1/traces" });
  });

  it("refuses a URL that is not http or https", () => {
    expect(() => exportConfig({ otlp: "not a url" }, {}, "/")).toThrow(UsageError);
    expect(() => exportConfig({ otlp: "file:///tmp/x" }, {}, "/")).toThrow(/http or https/);
  });
});

describe("the JSONL sink", () => {
  it("writes one span a line for each event the app's calls appended, none with content", async () => {
    const file = join(await temp(), "spans.jsonl");
    const { db, client, errors } = exportingApp([jsonlSink(file)]);
    await writeAndRead(client);
    const text = readFileSync(file, "utf8");
    expect(text).not.toContain(SECRET);
    const spans = text
      .trimEnd()
      .split("\n")
      .map((l) => DecisionSpanShape.parse(JSON.parse(l)));
    expect(spans.map((s) => s.name)).toEqual(["upsert_memory", "search_memory"]);
    // The line is the mapping's span, byte for byte.
    const log = db.prepare("SELECT body FROM events ORDER BY seq").all();
    expect(spans).toEqual(log.map((r) => decisionSpan(JSON.parse(String(r.body)))));
    expect(errors).toEqual([]);
  });

  it("starts at the log's head: events appended before the export are not sent", async () => {
    const file = join(await temp(), "spans.jsonl");
    const first = exportingApp([]);
    await writeAndRead(first.client);
    const decisions = startExport(first.db, [jsonlSink(file)]);
    decisions.flush();
    expect(() => readFileSync(file, "utf8")).toThrow();
  });

  it("a sink that cannot write is reported, and the call still answers", async () => {
    const dir = await temp();
    const { client, errors } = exportingApp([jsonlSink(dir)]);
    const { response } = await client.POST("/api/v1/read", { body: { actor: dana } });
    expect(response.status).toBe(200);
    expect(errors.length).toBe(1);
  });
});

describe("the OTLP/HTTP sink, against a receiver in the test", () => {
  it("posts each decision as a span: GenAI name, event ids, service engram, no content", async () => {
    const rx = await receiver();
    try {
      const sink = otlpSink(rx.url);
      const { client, decisions, errors } = exportingApp([sink]);
      await writeAndRead(client);
      await decisions.close();
      expect(errors).toEqual([]);
      expect(rx.got.length).toBeGreaterThan(0);
      expect(rx.got.every((g) => g.path === "/v1/traces" && g.type === "application/json")).toBe(
        true,
      );
      const raw = JSON.stringify(rx.got.map((g) => g.body));
      expect(raw).not.toContain(SECRET);
      type Kv = { key: string; value: Record<string, unknown> };
      type Body = {
        resourceSpans: {
          resource: { attributes: Kv[] };
          scopeSpans: {
            scope: { name: string };
            spans: { traceId: string; spanId: string; name: string; attributes: Kv[] }[];
          }[];
        }[];
      };
      const bodies = rx.got.map((g) => g.body as Body);
      const resource = bodies[0]?.resourceSpans[0]?.resource.attributes ?? [];
      expect(resource).toEqual([{ key: "service.name", value: { stringValue: "engram" } }]);
      const spans = bodies.flatMap((b) =>
        b.resourceSpans.flatMap((r) => r.scopeSpans.flatMap((s) => s.spans)),
      );
      expect(spans.map((s) => s.name)).toEqual(["upsert_memory", "search_memory"]);
      expect(spans[0]?.traceId).toBe(id(1).replaceAll("-", ""));
      expect(spans[0]?.spanId).toBe(id(1).replaceAll("-", "").slice(16));
      const op = spans[0]?.attributes.find((a) => a.key === "gen_ai.operation.name");
      expect(op?.value).toEqual({ stringValue: "upsert_memory" });
    } finally {
      await rx.close();
    }
  });

  it("a refused export is reported to onError, never thrown at the caller", async () => {
    const rx = await receiver(400);
    try {
      const errors: unknown[] = [];
      const sink = otlpSink(rx.url, (e) => errors.push(e));
      const { client, decisions } = exportingApp([sink]);
      await writeAndRead(client);
      await decisions.close();
      expect(rx.got.length).toBeGreaterThan(0);
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      await rx.close();
    }
  });
});

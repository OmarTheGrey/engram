// ADR 0027 decision 4: with no authentication the server answers only its own
// loopback origin. Each rule has a test here that fails when the rule is
// removed: the Host check (DNS rebinding), the Origin check, the JSON-only
// body rule (a cross-site form or text/plain POST), no CORS headers, the body
// cap, and the loopback-only listener, also over a real socket.
import { request as httpRequest } from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import { MAX_BODY_BYTES } from "../src/app.ts";
import { isLoopbackHost, type Listening, listen } from "../src/listen.ts";
import { BASE, dana, NOW, PORT, testWorkspace } from "./helpers.ts";

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

const bypassBody = { actor: dana, bypass: { command: "mem0 add x", store: "mem0" }, at: NOW };

async function send(path: string, init: RequestInit, base = BASE) {
  const { app, workspace } = testWorkspace();
  const response = await app.fetch(new Request(`${base}${path}`, init));
  return { response, events: workspace.plane.events() };
}

describe("the Host rule", () => {
  it("answers each loopback name with the server's port", async () => {
    for (const host of [`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]) {
      const { response } = await send("/api/v1/health", { headers: { host } }, `http://${host}`);
      expect(response.status).toBe(200);
    }
  });

  it("refuses a rebound DNS name, and records nothing", async () => {
    const { response, events } = await send(
      "/api/v1/bypass",
      json(bypassBody, { host: `evil.example:${PORT}` }),
      `http://evil.example:${PORT}`,
    );
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "forbidden_host",
    );
    expect(events).toEqual([]);
  });

  it("refuses a loopback name on another port", async () => {
    const { response } = await send("/api/v1/health", {}, "http://127.0.0.1:9");
    expect(response.status).toBe(403);
  });
});

describe("the Origin rule", () => {
  it("answers a request without an Origin, and one from the server's own origin", async () => {
    expect((await send("/api/v1/bypass", json(bypassBody))).response.status).toBe(200);
    const own = await send("/api/v1/bypass", json(bypassBody, { origin: BASE }));
    expect(own.response.status).toBe(200);
  });

  it("refuses a cross-origin request, and records nothing", async () => {
    for (const origin of ["http://evil.example", "null", `https://127.0.0.1:${PORT}`]) {
      const { response, events } = await send("/api/v1/bypass", json(bypassBody, { origin }));
      expect(response.status).toBe(403);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
        "forbidden_origin",
      );
      expect(events).toEqual([]);
    }
  });
});

describe("the JSON-only body rule", () => {
  it("refuses the bodies a cross-site page can send without a preflight", async () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
      const { response, events } = await send("/api/v1/bypass", {
        method: "POST",
        headers: { "content-type": type },
        body: JSON.stringify(bypassBody),
      });
      expect(response.status).toBe(415);
      expect(events).toEqual([]);
    }
  });

  it("refuses a body with no content type", async () => {
    const { response } = await send("/api/v1/bypass", {
      method: "POST",
      body: new Blob([JSON.stringify(bypassBody)]),
    });
    expect(response.status).toBe(415);
  });

  it("accepts application/json with a charset", async () => {
    const { response } = await send(
      "/api/v1/bypass",
      json(bypassBody, { "content-type": "application/json; charset=utf-8" }),
    );
    expect(response.status).toBe(200);
  });
});

describe("no CORS", () => {
  it("sends no Access-Control header, on a preflight or a request", async () => {
    const preflight = await send("/api/v1/bypass", {
      method: "OPTIONS",
      headers: {
        origin: BASE,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    const answered = await send("/api/v1/bypass", json(bypassBody, { origin: BASE }));
    for (const { response } of [preflight, answered])
      for (const name of response.headers.keys()) expect(name).not.toMatch(/^access-control-/);
    expect(preflight.response.status).not.toBe(200);
  });
});

describe("the body cap", () => {
  it("refuses a body over the limit", async () => {
    const big = {
      ...bypassBody,
      bypass: { ...bypassBody.bypass, command: "x".repeat(MAX_BODY_BYTES) },
    };
    const { response, events } = await send("/api/v1/bypass", json(big));
    expect(response.status).toBe(413);
    expect(events).toEqual([]);
  });
});

describe("the loopback listener", () => {
  it("reads 127.0.0.1, ::1 and localhost as loopback, nothing else", () => {
    for (const host of ["127.0.0.1", "::1", "localhost", "LOCALHOST"])
      expect(isLoopbackHost(host)).toBe(true);
    for (const host of [
      "0.0.0.0",
      "::",
      "192.168.1.10",
      "10.0.0.1",
      "example.com",
      "127.0.0.1.nip.io",
    ])
      expect(isLoopbackHost(host)).toBe(false);
  });

  it("refuses to listen on any other host", () => {
    const { workspace } = testWorkspace();
    for (const host of ["0.0.0.0", "::", "192.168.1.10"])
      expect(() => listen(workspace, { host, port: 0, now: () => NOW })).toThrow(
        /not a loopback address/,
      );
  });

  describe("over a real socket", () => {
    let server: Listening | undefined;
    afterAll(async () => server?.close());

    /** A raw request, so the Host header is the test's to choose. */
    const raw = (port: number, host: string, path: string) =>
      new Promise<number>((done, fail) => {
        const req = httpRequest({ host: "127.0.0.1", port, path, headers: { host } }, (res) => {
          res.resume();
          done(res.statusCode ?? 0);
        });
        req.on("error", fail);
        req.end();
      });

    it("serves its loopback origin and refuses a rebound Host", async () => {
      const { workspace } = testWorkspace();
      server = await listen(workspace, { host: "127.0.0.1", port: 0, now: () => NOW });
      expect(server.url).toBe(`http://127.0.0.1:${server.port}`);
      const health = await fetch(`${server.url}/api/v1/health`);
      expect(health.status).toBe(200);
      expect(await raw(server.port, `localhost:${server.port}`, "/api/v1/health")).toBe(200);
      expect(await raw(server.port, `attacker.example:${server.port}`, "/api/v1/health")).toBe(403);
    });
  });
});

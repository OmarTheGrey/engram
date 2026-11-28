// The offline guard (card E0.7): under ENGRAM_OFFLINE=1 a test that opens a
// socket, resolves a name or calls fetch for a host off this machine fails at
// once with the guard's message; the loopback still works; every project's
// config carries the setup file; and a test that lifts the guard to fetch
// pinned data is a listed one.
import dns from "node:dns";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { timeouts } from "../../vitest.shared.ts";
import {
  allowPinnedDataFetch,
  createOfflineGuard,
  installForRun,
  isLoopback,
  type OfflineGuard,
  PINNED_DATA_FETCH_TESTS,
  runGuard,
} from "./offline-guard.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));
const REFUSED = /ENGRAM_OFFLINE=1: network access refused in a test/;
// A name reserved never to resolve (RFC 6761), so even an unguarded call reaches no host.
const OFF = "engram-offline-guard.invalid";

describe("the guard, installed", () => {
  let guard: OfflineGuard;
  beforeEach(() => {
    guard = createOfflineGuard();
  });
  afterEach(() => guard.restore());

  test("a socket opened to a host off this machine fails at once with the guard's error", () => {
    expect(() => net.connect({ host: OFF, port: 80 })).toThrow(REFUSED);
    expect(() => net.connect(443, OFF)).toThrow(REFUSED);
    expect(() => new net.Socket().connect({ host: "192.0.2.1", port: 5432 })).toThrow(REFUSED);
    expect(guard.attempts).toEqual([
      `socket connect ${OFF}:80`,
      `socket connect ${OFF}:443`,
      "socket connect 192.0.2.1:5432",
    ]);
  });

  test("http and https requests are refused before any connection", () => {
    expect(() => http.get(`http://${OFF}/`)).toThrow(REFUSED);
    expect(() => https.get(`https://${OFF}/`)).toThrow(REFUSED);
    expect(guard.attempts).toHaveLength(2);
  });

  test("fetch rejects with the guard's error, for a string, a URL and a Request", async () => {
    await expect(fetch(`https://${OFF}/data.json`)).rejects.toThrow(REFUSED);
    await expect(fetch(new URL(`http://${OFF}/`))).rejects.toThrow(REFUSED);
    await expect(fetch(new Request(`https://${OFF}/x`))).rejects.toThrow(REFUSED);
    expect(guard.attempts).toEqual([
      `fetch https://${OFF}/data.json`,
      `fetch http://${OFF}/`,
      `fetch https://${OFF}/x`,
    ]);
  });

  test("DNS lookups and resolutions are refused, callback and promise forms", async () => {
    expect(() => dns.lookup(OFF, () => {})).toThrow(REFUSED);
    expect(() => dns.resolve4(OFF, () => {})).toThrow(REFUSED);
    await expect(dns.promises.lookup(OFF)).rejects.toThrow(REFUSED);
    await expect(dns.promises.resolveTxt(OFF)).rejects.toThrow(REFUSED);
    expect(guard.attempts).toEqual([
      `dns lookup ${OFF}`,
      `dns resolve4 ${OFF}`,
      `dns lookup ${OFF}`,
      `dns resolveTxt ${OFF}`,
    ]);
  });

  test("the loopback still works: a socket, an http request and fetch to 127.0.0.1", async () => {
    const server = http.createServer((_req, res) => res.end("ok"));
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const { port } = server.address() as net.AddressInfo;
    try {
      const socket = net.connect({ host: "127.0.0.1", port });
      await new Promise<void>((done, fail) => {
        socket.once("connect", done);
        socket.once("error", fail);
      });
      socket.destroy();
      expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe("ok");
      expect(await (await fetch(`http://localhost:${port}/`)).text()).toBe("ok");
      const address = await dns.promises.lookup("localhost");
      expect(isLoopback(address.address)).toBe(true);
    } finally {
      await new Promise((done) => server.close(done));
    }
    expect(guard.attempts).toEqual([]);
  });

  test("a Resolver instance's queries are refused, callback and promise forms", async () => {
    expect(() => new dns.Resolver().resolve4(OFF, () => {})).toThrow(REFUSED);
    expect(() => new dns.Resolver().reverse("192.0.2.1", () => {})).toThrow(REFUSED);
    await expect(new dns.promises.Resolver().resolve4(OFF)).rejects.toThrow(REFUSED);
    await expect(new dns.promises.Resolver().resolveTxt(OFF)).rejects.toThrow(REFUSED);
    expect(guard.attempts).toEqual([
      `dns resolve4 ${OFF}`,
      "dns reverse 192.0.2.1",
      `dns resolve4 ${OFF}`,
      `dns resolveTxt ${OFF}`,
    ]);
  });

  test("a name under .localhost is refused: only localhost itself is this machine", async () => {
    expect(() => net.connect({ host: "db.localhost", port: 80 })).toThrow(REFUSED);
    await expect(dns.promises.lookup("db.localhost")).rejects.toThrow(REFUSED);
  });

  test("a connection with its own lookup function is refused, whatever host it names", () => {
    const lookup = (_h: string, _o: unknown, cb: (e: null, a: string, f: number) => void) =>
      cb(null, "192.0.2.1", 4);
    expect(() =>
      net.connect({ host: "localhost", port: 80, lookup } as net.NetConnectOpts),
    ).toThrow(REFUSED);
    expect(guard.attempts).toEqual(["socket connect localhost:80 with its own lookup"]);
  });

  // Windows reads a path that starts with two slashes as UNC, which reaches the named host over SMB.
  test.runIf(process.platform === "win32")("a UNC path to a host is remote", () => {
    expect(() => net.connect({ path: String.raw`\\fileserver\pipe\engram` })).toThrow(REFUSED);
    expect(() => net.connect("//fileserver/pipe/engram")).toThrow(REFUSED);
    expect(guard.attempts).toEqual([
      String.raw`socket connect \\fileserver\pipe\engram`,
      "socket connect //fileserver/pipe/engram",
    ]);
  });

  test("a local pipe or a Unix socket path is left alone", () => {
    const paths =
      process.platform === "win32"
        ? [String.raw`\\.\pipe\engram-guard-none`, String.raw`\\?\pipe\engram-guard-none`]
        : ["/tmp/engram-guard-none.sock"];
    for (const path of paths) {
      const socket = net.connect({ path });
      socket.on("error", () => {});
      socket.destroy();
    }
    expect(guard.attempts).toEqual([]);
  });

  test("a lookup of an IP literal makes no query and passes, so a server can bind a wildcard", async () => {
    expect((await dns.promises.lookup("192.0.2.1")).address).toBe("192.0.2.1");
    await new Promise<void>((done, fail) =>
      dns.lookup("10.0.0.1", (e, address) => {
        if (e) fail(e);
        else {
          expect(address).toBe("10.0.0.1");
          done();
        }
      }),
    );
    const server = net.createServer();
    await new Promise<void>((done) => server.listen(0, "0.0.0.0", done));
    await new Promise((done) => server.close(done));
    expect(guard.attempts).toEqual([]);
    // The connect check still guards the address itself.
    expect(() => net.connect({ host: "192.0.2.1", port: 80 })).toThrow(REFUSED);
  });

  test("a fetch that reaches no network (a data: URL) is left alone", async () => {
    expect(await (await fetch("data:text/plain,engram")).text()).toBe("engram");
    expect(guard.attempts).toEqual([]);
  });

  test("restore puts every replaced function back", () => {
    guard.restore();
    const inner = createOfflineGuard();
    inner.restore();
    guard = createOfflineGuard();
    expect(() => net.connect({ host: OFF, port: 1 })).toThrow(REFUSED);
  });
});

test("restore leaves fetch, connect and lookup as they were", () => {
  const before = [globalThis.fetch, net.Socket.prototype.connect, dns.lookup, dns.promises.lookup];
  const guard = createOfflineGuard();
  expect(globalThis.fetch).not.toBe(before[0]);
  expect(net.Socket.prototype.connect).not.toBe(before[1]);
  guard.restore();
  expect([globalThis.fetch, net.Socket.prototype.connect, dns.lookup, dns.promises.lookup]).toEqual(
    before,
  );
});

test("the loopback, and only the loopback, is this machine", () => {
  for (const host of [
    "localhost",
    "LOCALHOST",
    "127.0.0.1",
    "127.8.9.10",
    "::1",
    "[::1]",
    "::ffff:127.0.0.1",
    "",
    undefined,
  ])
    expect(isLoopback(host), String(host)).toBe(true);
  for (const host of [
    "example.com",
    "10.0.0.1",
    "192.168.1.1",
    "0.0.0.0",
    "128.0.0.1",
    "localhost.example.com",
    "db.localhost",
    "::2",
    OFF,
  ])
    expect(isLoopback(host), host).toBe(false);
});

describe("the run's guard", () => {
  test("is installed only when ENGRAM_OFFLINE=1, and once", () => {
    expect(installForRun({})).toBeUndefined();
    if (process.env.ENGRAM_OFFLINE === "1") {
      expect(runGuard()).toBeDefined();
      expect(installForRun({ ENGRAM_OFFLINE: "1" })).toBe(runGuard());
    }
  });

  test.runIf(process.env.ENGRAM_OFFLINE === "1")(
    "under ENGRAM_OFFLINE=1 the setup file already refuses a socket in this test",
    () => {
      expect(() => net.connect({ host: OFF, port: 80 })).toThrow(REFUSED);
    },
  );

  test.runIf(process.env.ENGRAM_OFFLINE === "1")(
    "allowPinnedDataFetch lifts it until the returned function puts it back",
    () => {
      const back = allowPinnedDataFetch("the guard's own test");
      expect(runGuard()).toBeUndefined();
      back();
      expect(runGuard()).toBeDefined();
      expect(() => net.connect({ host: OFF, port: 80 })).toThrow(REFUSED);
    },
  );

  test("allowPinnedDataFetch asks what is fetched", () => {
    expect(() => allowPinnedDataFetch(" ")).toThrow(/name the pinned data/);
  });
});

/** Every file under `dir`, node_modules and dot folders skipped. */
const walk = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((name) => {
        if (name === "node_modules" || name.startsWith(".")) return [];
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
const rel = (path: string) => relative(root, path).split("\\").join("/");

describe("wiring", () => {
  test("the shared settings name the setup file, and it exists", () => {
    expect(timeouts.setupFiles).toHaveLength(1);
    expect(existsSync(timeouts.setupFiles[0] as string)).toBe(true);
    expect(rel(timeouts.setupFiles[0] as string)).toBe("scripts/test/offline-guard.setup.ts");
  });

  test("every test project's config spreads the shared settings and sets no setup files of its own", () => {
    const configs = [
      ...readdirSync(join(root, "packages")).map((p) =>
        join(root, "packages", p, "vitest.config.ts"),
      ),
      join(root, "scripts", "vitest.config.ts"),
      join(root, "test", "e2e", "vitest.config.ts"),
    ].filter(existsSync);
    expect(configs.length).toBeGreaterThan(10);
    for (const file of configs) {
      const text = readFileSync(file, "utf8");
      expect(text, rel(file)).toMatch(/from "(\.\.\/)+vitest\.shared\.ts"/);
      expect(text, rel(file)).toMatch(/test: timeouts\b|\.\.\.timeouts\b/);
      expect(text, rel(file)).not.toMatch(/setupFiles/);
    }
  });

  test("a test that lifts the guard is listed, and every listed test lifts it", () => {
    const tests = [
      ...walk(join(root, "packages")),
      ...walk(join(root, "scripts")),
      ...walk(join(root, "test")),
    ]
      .filter((f) => /\.test\.ts$/.test(f))
      .map(rel)
      .filter((f) => f !== "scripts/test/offline-guard.test.ts");
    const callers = tests.filter((f) =>
      /\ballowPinnedDataFetch\s*\(/.test(readFileSync(join(root, f), "utf8")),
    );
    expect(callers.sort()).toEqual([...PINNED_DATA_FETCH_TESTS].sort());
    const convention = readFileSync(join(root, "docs", "conventions", "testing.md"), "utf8");
    for (const file of PINNED_DATA_FETCH_TESTS) expect(convention).toContain(file);
  });
});

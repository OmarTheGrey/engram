// The CLI side of verified actors (card E8.12, ADR 0042): engram key,
// engram serve and engram mcp --http refusing to start without a credential
// flag or the waiver, doctor's serve check, and ENGRAM_TOKEN over --server.
import { join } from "node:path";
import { listen, openCredentials, openWorkspace } from "@engram/server";
import { afterAll, describe, expect, it } from "vitest";
import { cli, HOME, NOW, tempDir, testId } from "./helpers.ts";

const PROBES = {
  "adapter mem0": async () => ["skip", "probe"] as ["skip", string],
  "adapter letta": async () => ["skip", "probe"] as ["skip", string],
};
const EXPIRES = "2026-12-25T12:00:00.000Z";

async function keyFor(as: string, member: string) {
  const dir = await tempDir();
  const keys = join(dir, "keys.json");
  const r = await cli([
    "key",
    "create",
    "--keys",
    keys,
    "--as",
    as,
    "--member",
    member,
    "--source",
    "user",
    "--expires",
    EXPIRES,
  ]);
  expect(r.code).toBe(0);
  const key = r.out.split("\n")[0] ?? "";
  return { keys, key, out: r.out };
}

describe("engram key", () => {
  it("creates a key shown once, lists it masked, and revokes it", async () => {
    const { keys, key, out } = await keyFor("person:dana", "person:dana");
    expect(key).toMatch(/^egk_[0-9a-f]{12}_[A-Za-z0-9_-]{32}$/);
    expect(out).toContain("source user), expires 2026-12-25T12:00:00.000Z");
    const id = key.slice(4, 16);
    const list = await cli(["key", "list", "--keys", keys]);
    expect(list.out).toContain(`egk_${id}_****${key.slice(-4)}  active `);
    expect(list.out).not.toContain(key);
    const revoked = await cli(["key", "revoke", id, "--keys", keys]);
    expect(revoked.code).toBe(0);
    expect((await cli(["key", "list", "--keys", keys])).out).toContain("revoked");
  });

  it("refuses a key with no source, no expiry, or an expiry already past (exit 2)", async () => {
    const keys = join(await tempDir(), "keys.json");
    const base = ["key", "create", "--keys", keys, "--as", "person:dana"];
    expect((await cli([...base, "--expires", EXPIRES])).code).toBe(2);
    expect((await cli([...base, "--source", "user"])).code).toBe(2);
    const past = await cli([...base, "--source", "user", "--expires", "2026-01-01T00:00:00Z"]);
    expect(past.code).toBe(2);
    expect(past.err).toContain("is not after now");
  });
});

describe("a served surface needs a credential flag or the waiver", () => {
  it("engram serve refuses to start with neither, with both, or beyond loopback without https", async () => {
    const { keys } = await keyFor("person:dana", "person:dana");
    const none = await cli(["serve", "--db", ":memory:"]);
    expect(none.code).toBe(2);
    expect(none.err).toContain("the server needs authentication");
    const both = await cli(["serve", "--db", ":memory:", "--keys", keys, "--insecure-loopback"]);
    expect(both.code).toBe(2);
    expect(both.err).toContain("exclude each other");
    const wide = await cli(["serve", "--db", ":memory:", "--keys", keys, "--host", "0.0.0.0"]);
    expect(wide.code).toBe(2);
    expect(wide.err).toContain("needs an https --resource");
    const stray = await cli(["serve", "--db", ":memory:", "--keys", keys, "--jwks", "x.json"]);
    expect(stray.code).toBe(2);
    expect(stray.err).toContain("need --issuer");
  });

  it("engram mcp: --http with credentials takes no --as; stdio takes no credential flag", async () => {
    const { keys } = await keyFor("person:dana", "person:dana");
    const asserted = await cli(["mcp", "--http", "0", "--keys", keys, "--as", "person:dana"]);
    expect(asserted.code).toBe(2);
    expect(asserted.err).toContain("each session is the actor its credential names");
    const stdio = await cli(["mcp", "--as", "person:dana", "--keys", keys]);
    expect(stdio.code).toBe(2);
    expect(stdio.err).toContain("apply to --http");
    const neither = await cli(["mcp", "--http", "0", "--as", "person:dana"]);
    expect(neither.code).toBe(2);
    expect(neither.err).toContain("the server needs authentication");
  });
});

describe("engram doctor's serve check", () => {
  const serveCheck = async (...flags: string[]) => {
    const r = await cli(["doctor", "--json", ...flags], { doctorProbes: PROBES });
    const report = JSON.parse(r.out) as {
      checks: { name: string; status: string; detail: string }[];
    };
    return { code: r.code, check: report.checks.find((c) => c.name === "serve") };
  };

  it("skips with no serve flag, fails a non-loopback bind without authentication", async () => {
    expect((await serveCheck()).check?.status).toBe("skip");
    const open = await serveCheck("--host", "0.0.0.0");
    expect(open.code).toBe(1);
    expect(open.check?.status).toBe("fail");
    expect(open.check?.detail).toContain("needs authentication");
    const waived = await serveCheck("--host", "0.0.0.0", "--insecure-loopback");
    expect(waived.check?.status).toBe("fail");
    expect(waived.check?.detail).toContain(
      "--insecure-loopback serves 127.0.0.1, ::1, localhost only",
    );
  });

  it("passes a loopback bind with a key file, and counts its active keys", async () => {
    const { keys } = await keyFor("person:dana", "person:dana");
    const ok = await serveCheck("--keys", keys);
    expect(ok.check).toEqual({
      name: "serve",
      status: "ok",
      detail: `127.0.0.1: authenticated, 1 active key in ${keys}`,
    });
  });
});

describe("ENGRAM_TOKEN over --server", () => {
  let close: (() => Promise<void>) | undefined;
  afterAll(async () => close?.());

  it("is sent as the bearer credential; without it the server answers 401", async () => {
    const { keys, key } = await keyFor("person:dana", "person:dana");
    const root = await tempDir();
    let n = 0;
    const workspace = openWorkspace({
      root,
      owner: "dana",
      db: ":memory:",
      cwd: root,
      home: HOME,
      env: {},
      newId: () => testId(850_000 + ++n),
    });
    workspace.open();
    const credentials = openCredentials({ keys }, (p) => p);
    if (credentials === undefined) throw new Error("no credentials");
    const server = await listen(workspace, { port: 0, now: () => NOW, auth: { credentials } });
    close = async () => {
      await server.close();
      workspace.close();
    };
    const args = [
      "write",
      "--server",
      server.url,
      "--owner",
      "dana",
      "--content",
      "Authenticated.",
    ];
    const without = await cli(args);
    expect(without.code).toBe(1);
    expect(without.err).toContain("needs a bearer credential");
    const withToken = await cli(args, { env: { ENGRAM_TOKEN: key } });
    expect(withToken.err).toBe("");
    expect(withToken.code).toBe(0);
  });
});

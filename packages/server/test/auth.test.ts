// Verified actors on the HTTP API (card E8.12, ADR 0042): a bearer API key
// or JWT is required, the request's actor is bound to the credential's, a
// sent source is ignored, claims never widen a membership, and every event
// the served app appends is attested. Each test fails without the rule it
// names. The app is called in process (app.fetch), with the auth a served
// app carries; the socket is attestation.test.ts's.

import { readFileSync } from "node:fs";
import { allEvents, type MemoryEvent, type MemoryItem } from "@engram/core";
import { SignJWT, UnsecuredJWT } from "jose";
import { describe, expect, it } from "vitest";
import { type AppAuth, createApp } from "../src/app.ts";
import { attestations } from "../src/attest.ts";
import { bindActor, metadataPath, wwwAuthenticate } from "../src/auth.ts";
import { bindRefusal } from "../src/listen.ts";
import {
  AGENT,
  attestedWorkspace,
  credentials,
  DANA,
  EVE,
  ISSUER,
  KID,
  NOW_S,
  tempDir,
} from "./auth-helpers.ts";
import { BASE, itemFor, NOW, PORT } from "./helpers.ts";

async function server() {
  const dir = await tempDir();
  const { creds, keys, iss } = await credentials(dir);
  const { db, workspace } = attestedWorkspace();
  const auth: AppAuth = { mode: "credentials", credentials: creds, resource: BASE };
  const app = createApp(workspace, { port: PORT, now: () => NOW, auth });
  const call = (
    path: string,
    init: { token?: string; authorization?: string; body?: unknown; method?: string } = {},
  ) =>
    app.fetch(
      new Request(`${BASE}${path}`, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers: {
          ...(init.body === undefined ? {} : { "content-type": "application/json" }),
          ...(init.token === undefined ? {} : { authorization: `Bearer ${init.token}` }),
          ...(init.authorization === undefined ? {} : { authorization: init.authorization }),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      }),
    );
  const write = (token: string, actor: object, n = 1, over: Record<string, unknown> = {}) =>
    call("/api/v1/items", { token, body: { actor, item: itemFor(n, over) } });
  return { db, call, write, keys, iss };
}

const asDana = { id: "person:dana", level: "person", memberships: ["person:dana"] };

describe("a request without a valid credential is refused, and the refusal says where to look", () => {
  it("401 with WWW-Authenticate naming the protected-resource metadata", async () => {
    const s = await server();
    const r = await s.write("", asDana);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("unauthorized");
    expect(r.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource", error="invalid_token"`,
    );
    const none = await s.call("/api/v1/policy");
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource"`,
    );
    expect(allEvents(s.db)).toHaveLength(0);
  });

  it("GET /health and the metadata (RFC 9728) answer without one", async () => {
    const s = await server();
    expect((await s.call("/api/v1/health")).status).toBe(200);
    const meta = await s.call("/.well-known/oauth-protected-resource");
    expect(meta.status).toBe(200);
    expect(await meta.json()).toEqual({
      resource: BASE,
      authorization_servers: [ISSUER],
      bearer_methods_supported: ["header"],
      resource_name: "Engram",
    });
  });

  it("the metadata path is suffixed with the resource's path (RFC 9728 section 3.1)", () => {
    expect(metadataPath("http://127.0.0.1:7313")).toBe("/.well-known/oauth-protected-resource");
    expect(metadataPath("http://127.0.0.1:7313/mcp")).toBe(
      "/.well-known/oauth-protected-resource/mcp",
    );
    expect(wwwAuthenticate("https://m.example/mcp", false)).toBe(
      'Bearer resource_metadata="https://m.example/.well-known/oauth-protected-resource/mcp"',
    );
  });

  it("refuses an unknown key and a header that is not Bearer", async () => {
    const s = await server();
    const forged = `${s.keys.dana.slice(0, -1)}${s.keys.dana.endsWith("A") ? "B" : "A"}`;
    expect((await s.write(forged, asDana)).status).toBe(401);
    expect((await s.call("/api/v1/policy", { token: "" })).status).toBe(401);
    const basic = await s.call("/api/v1/policy", { authorization: "Basic ZGFuYTpwdw==" });
    expect(basic.status).toBe(401);
    expect(allEvents(s.db)).toHaveLength(0);
  });

  it("no spelling of an API path reaches a route without a credential (E8.12-1, -3)", async () => {
    const s = await server();
    const body = { actor: asDana, item: itemFor(9) };
    for (const path of [
      "/api/v1/%69tems",
      "/%61pi/v1/items",
      "/API/v1/items",
      "/api/v1/items/",
      "/api//v1/items",
      "/api/v1/%2Fitems",
      "/api/v1/./items",
    ]) {
      const r = await s.call(path, { body });
      expect([401, 404], `${path}: ${r.status}`).toContain(r.status);
    }
    expect(allEvents(s.db)).toHaveLength(0);
  });
});

describe("an API key acts as the actor its key file entry names", () => {
  it("allows the key's own actor, and attests the event with the key's id", async () => {
    const s = await server();
    const r = await s.write(s.keys.dana, asDana);
    expect(r.status).toBe(200);
    const { event } = (await r.json()) as { event: MemoryEvent };
    expect(event.decision).toBe("allow");
    const [row] = attestations(s.db);
    expect(row).toMatchObject({
      seq: event.seq,
      event_id: event.id,
      surface: "http",
      method: "api_key",
      actor: "person:dana",
      issuer: null,
    });
    expect(s.keys.dana).toContain(`_${row?.subject}_`);
  });

  it("refuses another id, another level, a membership the key does not hold; appends nothing", async () => {
    const s = await server();
    for (const actor of [
      { ...asDana, id: "person:eve", memberships: ["person:eve"] },
      { ...asDana, level: "team" },
      { ...asDana, memberships: ["person:dana", "team:secret"] },
    ]) {
      const r = await s.write(s.keys.dana, actor);
      expect(r.status).toBe(403);
      expect(((await r.json()) as { error: { code: string } }).error.code).toBe("forbidden_actor");
    }
    expect(allEvents(s.db)).toHaveLength(0);
  });

  it("allows memberships narrowed to a subset of the key's", async () => {
    const s = await server();
    // DANA holds person:dana and team:platform; the request names one.
    const r = await s.write(s.keys.dana, asDana);
    expect(r.status).toBe(200);
  });
});

describe("a source sent on an authenticated call is ignored (closes ADR 0040's limit)", () => {
  it("a model-sourced key that claims source user writes as model", async () => {
    const s = await server();
    const actor = {
      id: AGENT.id,
      level: AGENT.level,
      memberships: AGENT.memberships,
      source: "user",
    };
    const r = await s.write(s.keys.agent, actor, 2, {
      scope: "team:platform",
      owner: AGENT.id,
      provenance: { kind: "user", ref: "t", hash: `sha256:${"0".repeat(64)}`, actor: AGENT.id },
    });
    const { item, event } = (await r.json()) as { item: MemoryItem | null; event: MemoryEvent };
    expect(event.actor).toBe(AGENT.id);
    // Medium's team rule allows user and denies model: the plane saw model.
    expect(item).toBeNull();
    expect(event.decision).toBe("deny");
    expect(event.reason).toContain("source model is not allowed in team scope");
  });

  it("control: the same request under the waiver is believed and allowed", async () => {
    const { workspace } = attestedWorkspace();
    const app = createApp(workspace, {
      port: PORT,
      now: () => NOW,
      auth: { mode: "insecure-loopback" },
    });
    const actor = {
      id: AGENT.id,
      level: AGENT.level,
      memberships: AGENT.memberships,
      source: "user",
    };
    const r = await app.fetch(
      new Request(`${BASE}/api/v1/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor,
          item: itemFor(2, {
            scope: "team:platform",
            owner: AGENT.id,
            provenance: {
              kind: "user",
              ref: "t",
              hash: `sha256:${"0".repeat(64)}`,
              actor: AGENT.id,
            },
          }),
        }),
      }),
    );
    const { event } = (await r.json()) as { event: MemoryEvent };
    expect(event.decision).toBe("allow");
  });

  it("a user-sourced key that claims source external still writes as user", async () => {
    const s = await server();
    const r = await s.write(s.keys.dana, { ...asDana, source: "external" });
    const { item } = (await r.json()) as { item: MemoryItem | null };
    expect(item?.provenance.kind).toBe("user");
  });

  it("bindActor replaces a sent source with the held one, and keeps the narrowed memberships", () => {
    const bound = bindActor(DANA, { ...asDana, level: "person", source: "external" });
    expect(bound).toEqual({
      ok: true,
      actor: { id: DANA.id, level: "person", memberships: ["person:dana"], source: "user" },
    });
  });
});

describe("a JWT of the configured issuer acts as its mapped subject's actor", () => {
  it("allows a valid token and attests the issuer and subject", async () => {
    const s = await server();
    const token = await s.iss.token("sub-dana", BASE);
    const r = await s.write(token, asDana);
    expect(r.status).toBe(200);
    expect(attestations(s.db)[0]).toMatchObject({
      method: "jwt",
      actor: DANA.id,
      issuer: ISSUER,
      subject: "sub-dana",
    });
  });

  it("refuses another audience, another issuer, an expired token, one not yet valid", async () => {
    const s = await server();
    const bad = [
      await s.iss.token("sub-dana", "http://127.0.0.1:9999"),
      await s.iss.token("sub-dana", BASE, { iss: "https://other.example" }),
      // Expired a minute past the 30-second tolerance, at the server's clock.
      await s.iss.token("sub-dana", BASE, { exp: NOW_S - 90 }),
      await s.iss.token("sub-dana", BASE, { nbf: NOW_S + 90 }),
    ];
    for (const token of bad) {
      const r = await s.write(token, asDana);
      expect(r.status).toBe(401);
      expect(r.headers.get("www-authenticate")).toContain('error="invalid_token"');
    }
    expect(allEvents(s.db)).toHaveLength(0);
  });

  it("refuses a shared-secret token and an unsigned one", async () => {
    const s = await server();
    const hs = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER)
      .setSubject("sub-dana")
      .setAudience(BASE)
      .setExpirationTime(NOW_S + 3600)
      .sign(new TextEncoder().encode("a shared secret of thirty-two bytes!"));
    const none = new UnsecuredJWT({})
      .setIssuer(ISSUER)
      .setSubject("sub-dana")
      .setAudience(BASE)
      .setExpirationTime(NOW_S + 3600)
      .encode();
    for (const token of [hs, none]) expect((await s.write(token, asDana)).status).toBe(401);
  });

  it("refuses a valid token whose subject is not mapped (403), and guesses no actor", async () => {
    const s = await server();
    const token = await s.iss.token("sub-mallory", BASE);
    const r = await s.write(token, { id: "person:sub-mallory", level: "person", memberships: [] });
    expect(r.status).toBe(403);
    expect(allEvents(s.db)).toHaveLength(0);
  });

  it("a groups, roles or scope claim never adds a membership (ADR 0042 decision 3)", async () => {
    const s = await server();
    const token = await s.iss.token("sub-eve", BASE, {
      claims: { groups: ["team:platform"], roles: ["admin"], scope: "team:platform org" },
    });
    const r = await s.write(token, { ...EVE, memberships: ["person:eve", "team:platform"] });
    expect(r.status).toBe(403);
    const ok = await s.write(
      token,
      { id: EVE.id, level: EVE.level, memberships: EVE.memberships },
      3,
      {
        scope: "person:eve",
        owner: "person:eve",
      },
    );
    expect(ok.status).toBe(200);
  });
});

describe("the waiver and the in-process client", () => {
  it("under --insecure-loopback the body's actor is believed, and its events attested as waived", async () => {
    const { db, workspace } = attestedWorkspace();
    const app = createApp(workspace, {
      port: PORT,
      now: () => NOW,
      auth: { mode: "insecure-loopback" },
    });
    const r = await app.fetch(
      new Request(`${BASE}/api/v1/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: { ...asDana, source: "user" }, item: itemFor(4) }),
      }),
    );
    expect(r.status).toBe(200);
    expect(attestations(db)).toEqual([
      expect.objectContaining({
        method: "insecure_loopback",
        actor: "person:dana",
        issuer: null,
        subject: null,
      }),
    ]);
  });

  it("in process (no auth) nothing is attested", async () => {
    const { db, workspace } = attestedWorkspace();
    const app = createApp(workspace, { port: PORT, now: () => NOW });
    const r = await app.fetch(
      new Request(`${BASE}/api/v1/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor: { ...asDana, source: "user" }, item: itemFor(5) }),
      }),
    );
    expect(r.status).toBe(200);
    expect(allEvents(db)).toHaveLength(1);
    expect(attestations(db)).toEqual([]);
  });
});

describe("review finding E8.12-8: a resource URL beyond loopback is https, whatever the bind", () => {
  it("refuses an http --resource with a public name even on a loopback bind", () => {
    const on = (resource: string) =>
      bindRefusal({ host: "127.0.0.1", insecureLoopback: false, credentials: true, resource });
    expect(on("http://memory.example")).toContain("must be https");
    expect(on("http://10.0.0.5:7313")).toContain("must be https");
    expect(on("https://memory.example")).toBeUndefined();
    expect(on("http://127.0.0.1:7313")).toBeUndefined();
    expect(on("http://localhost:7313/mcp")).toBeUndefined();
    expect(on("http://[::1]:7313")).toBeUndefined();
  });
});

describe("review finding E8.12-9: algorithm confusion", () => {
  it("refuses an HS256 token whose secret is the issuer's public JWK", async () => {
    const s = await server();
    const jwks = JSON.parse(readFileSync(s.iss.jwks, "utf8")) as {
      keys: Record<string, unknown>[];
    };
    const publicJwk = jwks.keys[0] ?? {};
    // The classic confusion: a verifier that took the key's bytes as an HMAC
    // secret would accept this; jose refuses HS256 for an EC key, and the
    // algorithm list admits no HS* at all.
    for (const secret of [JSON.stringify(publicJwk), String(publicJwk.x), JSON.stringify(jwks)]) {
      const forged = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256", kid: KID })
        .setIssuer(ISSUER)
        .setSubject("sub-dana")
        .setAudience(BASE)
        .setExpirationTime(NOW_S + 3600)
        .sign(new TextEncoder().encode(secret.padEnd(32, "#")));
      const r = await s.write(forged, asDana);
      expect(r.status).toBe(401);
      expect(r.headers.get("www-authenticate")).toContain('error="invalid_token"');
    }
    expect(allEvents(s.db)).toHaveLength(0);
  });
});

describe("the by-id read and the scope list on a server with credentials (card E8.14)", () => {
  it("need a credential, and act as the credential's actor, attested", async () => {
    const s = await server();
    for (const path of [
      `/api/v1/read/${"01930000-0000-7000-8000-000000000501"}`,
      "/api/v1/scopes",
    ]) {
      const none = await s.call(path, { body: { actor: asDana } });
      expect(none.status, path).toBe(401);
      const r = await s.call(path, { token: s.keys.dana, body: { actor: asDana } });
      expect(r.status, path).toBe(200);
      const { event } = (await r.json()) as { event: MemoryEvent };
      expect(event).toMatchObject({ op: "read", actor: "person:dana" });
      expect(attestations(s.db).find((a) => a.seq === event.seq)).toMatchObject({
        method: "api_key",
        actor: "person:dana",
      });
    }
  });

  it("refuse a body naming another actor or a membership the key does not hold, appending nothing", async () => {
    const s = await server();
    const before = allEvents(s.db).length;
    for (const path of [`/api/v1/read/${"01930000-0000-7000-8000-000000000501"}`, "/api/v1/scopes"])
      for (const actor of [
        { ...asDana, id: "person:eve", memberships: ["person:eve"] },
        { ...asDana, memberships: ["person:dana", "team:secret"] },
      ]) {
        const r = await s.call(path, { token: s.keys.dana, body: { actor } });
        expect(r.status, path).toBe(403);
      }
    expect(allEvents(s.db)).toHaveLength(before);
  });

  it("list only the scopes the credential's memberships allow, narrowed as the request names", async () => {
    const s = await server();
    const full = await s.call("/api/v1/scopes", {
      token: s.keys.dana,
      body: { actor: { ...asDana, memberships: ["person:dana", "team:platform"] } },
    });
    const listed = ((await full.json()) as { scopes: { scope: string }[] }).scopes.map(
      (x) => x.scope,
    );
    expect(listed).toEqual(["person:dana", "team:platform"]);
    const narrow = await s.call("/api/v1/scopes", { token: s.keys.dana, body: { actor: asDana } });
    const narrowed = ((await narrow.json()) as { scopes: { scope: string }[] }).scopes.map(
      (x) => x.scope,
    );
    expect(narrowed).toEqual(["person:dana"]);
  });
});

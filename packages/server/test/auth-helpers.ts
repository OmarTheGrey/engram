// What the verified-actor tests share (card E8.12, ADR 0042): a token issuer
// with an ES256 key pair made for the test run (no key is committed), its
// JWKS and subjects files, a key file with one key per actor, and a
// workspace whose log attests (attestingDb) over the fake store.
import { writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import { loadPreset, migrate, openSqlite } from "@engram/core";
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from "jose";
import { afterAll } from "vitest";
import { attestingDb } from "../src/attest.ts";
import { type Credentials, openCredentials } from "../src/auth.ts";
import { createKey, type HeldActor } from "../src/keys.ts";
import { type Store, workspaceOf } from "../src/workspace.ts";
import { id, NOW } from "./helpers.ts";

export const ISSUER = "https://issuer.example";
export const KID = "test-key-1";
/** Seconds since the epoch of NOW, the server's clock in these tests. */
export const NOW_S = Math.floor(Date.parse(NOW) / 1000);

export const DANA: HeldActor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "team:platform"],
  source: "user",
};
export const EVE: HeldActor = {
  id: "person:eve",
  level: "person",
  memberships: ["person:eve"],
  source: "user",
};
export const AGENT: HeldActor = {
  id: "agent:ci",
  level: "team",
  memberships: ["team:platform"],
  source: "model",
};

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

export async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "engram-auth-"));
  dirs.push(dir);
  return dir;
}

/** An issuer whose subjects `sub-dana` and `sub-eve` are mapped to DANA and EVE. */
export async function issuer(dir: string) {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid: KID, alg: "ES256", use: "sig" };
  const jwks = join(dir, "jwks.json");
  writeFileSync(jwks, JSON.stringify({ keys: [jwk] }));
  const subjects = join(dir, "subjects.json");
  writeFileSync(
    subjects,
    JSON.stringify({
      version: 1,
      subjects: [
        { issuer: ISSUER, subject: "sub-dana", actor: DANA },
        { issuer: ISSUER, subject: "sub-eve", actor: EVE },
      ],
    }),
  );
  /** A token for `sub`, valid for an hour around NOW, for `aud`, with extra claims. */
  const token = (
    sub: string,
    aud: string,
    over: { iss?: string; exp?: number; nbf?: number; claims?: JWTPayload } = {},
  ) =>
    new SignJWT({ ...over.claims })
      .setProtectedHeader({ alg: "ES256", kid: KID })
      .setIssuer(over.iss ?? ISSUER)
      .setSubject(sub)
      .setAudience(aud)
      .setIssuedAt(NOW_S - 60)
      .setNotBefore(over.nbf ?? NOW_S - 60)
      .setExpirationTime(over.exp ?? NOW_S + 3600)
      .sign(privateKey);
  return { jwks, subjects, token };
}

/** A key file with one key each for DANA and AGENT, valid a month after NOW. */
export function keyFile(dir: string) {
  const path = join(dir, "keys.json");
  const expires = "2026-12-29T12:00:00.000Z";
  const dana = createKey(path, { actor: DANA, expires, now: NOW }).key;
  const agent = createKey(path, { actor: AGENT, expires, now: NOW }).key;
  return { path, dana, agent };
}

/** The credentials of a server with both the key file and the issuer. */
export async function credentials(dir: string) {
  const iss = await issuer(dir);
  const keys = keyFile(dir);
  const creds: Credentials | undefined = openCredentials(
    { keys: keys.path, issuer: ISSUER, jwks: iss.jwks, subjects: iss.subjects },
    (p) => p,
  );
  if (creds === undefined) throw new Error("no credentials");
  return { creds, keys, iss };
}

/** A workspace over the fake store whose log attests; dana owns the store. */
export function attestedWorkspace() {
  const raw = openSqlite(":memory:");
  migrate(raw);
  const db = attestingDb(raw);
  const adapter = createFakeAdapter();
  let n = 0;
  const store: Store = {
    name: "fake",
    root: "(memory)",
    adapter,
    owner: "dana",
    scope: "person:dana",
  };
  const workspace = workspaceOf(
    { db, adapter, policy: loadPreset("medium"), newId: () => id(++n) },
    { store },
  );
  return { db, raw, workspace };
}

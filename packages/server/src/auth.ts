// Verified actors (card E8.12, ADR 0042): how a served HTTP surface turns a
// bearer credential into the actor the operator configured for it.
//
//   - A JWT access token from the one configured issuer, verified with jose
//     against the issuer's keys: an asymmetric signature, `iss`, an `aud`
//     holding this server's audience, `exp` and `nbf` at the server's own
//     clock, and `sub`. The subjects file maps the exact (iss, sub) to an
//     actor; an unmapped subject is refused however valid (decision 2).
//   - A local API key (keys.ts), whose key-file entry carries its actor.
//
// No claim but iss, sub, aud, exp, nbf and iat is read, so no claim sets a
// level, a membership, a grant or a source (decision 3). The request's
// actor must name the credential's id and level and may only narrow its
// memberships; the source it sends is ignored and the credential's used
// (decision 4). The binding is identity, not policy: the Plane still makes
// every decision with the actor it is given (AGENTS.md rule 1).
import { readFileSync } from "node:fs";
import type { Actor } from "@engram/core";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  errors,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
  jwtVerify,
} from "jose";
import { z } from "zod";
import { HeldActor, KEY_PREFIX, type KeyStore, openKeyStore } from "./keys.ts";
import { UsageError } from "./workspace.ts";

/** Asymmetric signatures only: never `none`, never a secret shared with the issuer. */
export const JWT_ALGORITHMS = [
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
  "Ed25519",
];

/** The clock skew allowed on exp and nbf, in seconds. */
export const CLOCK_TOLERANCE_S = 30;

export const SubjectEntry = z.strictObject({
  issuer: z.string().min(1),
  subject: z.string().min(1),
  actor: HeldActor,
});
export const SubjectsFile = z.strictObject({
  version: z.literal(1),
  subjects: z.array(SubjectEntry),
});

/** A token issuer and how its subjects map to actors. */
export interface JwtSetup {
  issuer: string;
  /** The audience a token must carry; the server's resource URL when unset. */
  audience?: string;
  keys: JWTVerifyGetKey;
  /** Each subject of the issuer the operator mapped, and the actor it acts as. */
  subjects: ReadonlyMap<string, HeldActor>;
}

/** The credentials a served surface accepts; at least one is set. */
export interface Credentials {
  keys?: KeyStore;
  jwt?: JwtSetup;
}

/** Who a request was authenticated as. */
export interface Principal {
  method: "jwt" | "api_key";
  /** The actor the operator configured for the credential. */
  actor: HeldActor;
  /** The token's issuer; null for an API key. */
  issuer: string | null;
  /** The token's subject, or the API key's id. */
  subject: string;
}

export type AuthOutcome =
  | { ok: true; principal: Principal }
  | { ok: false; status: 401 | 403; invalidToken: boolean; message: string };

const unauthorized = (message: string, invalidToken: boolean): AuthOutcome => ({
  ok: false,
  status: 401,
  invalidToken,
  message,
});

/** The subjects file at `path`, for `issuer`: each subject once, each actor id once. */
export function loadSubjects(path: string, issuer: string): Map<string, HeldActor> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new UsageError(`--subjects ${path}: not a readable JSON file (${(e as Error).message})`);
  }
  const parsed = SubjectsFile.safeParse(raw);
  if (!parsed.success)
    throw new UsageError(
      `--subjects ${path}: not a subjects file: ${parsed.error.issues.map((i) => `${i.path.join(".") || "file"}: ${i.message}`).join("; ")}`,
    );
  const subjects = new Map<string, HeldActor>();
  const ids = new Set<string>();
  for (const entry of parsed.data.subjects) {
    if (entry.issuer !== issuer)
      throw new UsageError(
        `--subjects ${path}: subject ${entry.subject} names issuer ${entry.issuer}, not --issuer ${issuer}`,
      );
    if (subjects.has(entry.subject))
      throw new UsageError(`--subjects ${path}: subject ${entry.subject} appears twice`);
    if (ids.has(entry.actor.id))
      throw new UsageError(
        `--subjects ${path}: actor ${entry.actor.id} is mapped from two subjects; one actor is one subject`,
      );
    subjects.set(entry.subject, entry.actor);
    ids.add(entry.actor.id);
  }
  return subjects;
}

const LOOPBACK_URL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The issuer's keys: a JWKS URL (https, or http on loopback), fetched and
 * cached by jose when a token needs them, or a local JWKS file read now.
 */
export function openJwks(spec: string, resolvePath: (p: string) => string): JWTVerifyGetKey {
  if (/^https?:\/\//i.test(spec)) {
    const url = new URL(spec);
    if (url.protocol !== "https:" && !LOOPBACK_URL_HOSTS.has(url.hostname.toLowerCase()))
      throw new UsageError(`--jwks ${spec}: an issuer's keys are fetched over https only`);
    return createRemoteJWKSet(url);
  }
  const path = resolvePath(spec);
  let jwks: JSONWebKeySet;
  try {
    jwks = JSON.parse(readFileSync(path, "utf8")) as JSONWebKeySet;
    return createLocalJWKSet(jwks);
  } catch (e) {
    throw new UsageError(`--jwks ${spec}: not a JWKS file (${(e as Error).message})`);
  }
}

/** The credential flags `engram serve`, `engram mcp --http` and `engram doctor` take. */
export interface CredentialFlags {
  keys?: string;
  issuer?: string;
  jwks?: string;
  subjects?: string;
  audience?: string;
}

/** Whether any credential flag is given. */
export const hasCredentialFlags = (flags: CredentialFlags) =>
  flags.keys !== undefined || flags.issuer !== undefined;

/**
 * The credentials the flags name, opened now, so a bad file is reported at
 * start; undefined when none is given. `--issuer` needs `--jwks` and
 * `--subjects`; those and `--audience` mean nothing without it.
 */
export function openCredentials(
  flags: CredentialFlags,
  resolvePath: (p: string) => string,
): Credentials | undefined {
  if (flags.issuer === undefined) {
    const stray = (["jwks", "subjects", "audience"] as const).filter((f) => flags[f] !== undefined);
    if (stray.length > 0)
      throw new UsageError(`${stray.map((f) => `--${f}`).join(", ")} need --issuer`);
  }
  if (!hasCredentialFlags(flags)) return undefined;
  const credentials: Credentials = {};
  if (flags.keys !== undefined) {
    try {
      credentials.keys = openKeyStore(resolvePath(flags.keys));
    } catch (e) {
      throw new UsageError(`--keys: ${(e as Error).message}`);
    }
  }
  if (flags.issuer !== undefined) {
    if (flags.jwks === undefined || flags.subjects === undefined)
      throw new UsageError(
        "--issuer needs --jwks (the issuer's keys) and --subjects (who its subjects act as)",
      );
    credentials.jwt = {
      issuer: flags.issuer,
      ...(flags.audience === undefined ? {} : { audience: flags.audience }),
      keys: openJwks(flags.jwks, resolvePath),
      subjects: loadSubjects(resolvePath(flags.subjects), flags.issuer),
    };
  }
  return credentials;
}

/** Why jose refused a token, in words that name no key material. */
function tokenRefusal(e: unknown): string {
  if (e instanceof errors.JWTExpired) return "the token has expired";
  if (e instanceof errors.JWTClaimValidationFailed)
    return `the token's ${e.claim} claim does not hold for this server`;
  if (e instanceof errors.JOSEAlgNotAllowed) return "the token's signing algorithm is not accepted";
  if (e instanceof errors.JWKSNoMatchingKey) return "no key of the issuer verifies the token";
  return "the token is not a valid signed JWT of the issuer";
}

/**
 * Authenticates an Authorization header: a bearer API key or JWT. `audience`
 * is the server's own when the setup names none; `now` is the server's clock.
 */
export async function authenticate(
  credentials: Credentials,
  header: string | undefined,
  context: { now: string; audience: string },
): Promise<AuthOutcome> {
  if (header === undefined || header.trim() === "")
    return unauthorized("this server needs a bearer credential (ADR 0042)", false);
  const m = /^Bearer[ ]+([^ ]+)[ ]*$/i.exec(header);
  if (m === null) return unauthorized("the Authorization header must be Bearer <credential>", true);
  const credential = m[1] ?? "";
  if (credential.startsWith(KEY_PREFIX)) {
    if (credentials.keys === undefined)
      return unauthorized("this server accepts no API keys", true);
    const check = await credentials.keys.verify(credential, context.now);
    if (!check.ok) return unauthorized(check.reason, true);
    return {
      ok: true,
      principal: {
        method: "api_key",
        actor: check.record.actor,
        issuer: null,
        subject: check.record.id,
      },
    };
  }
  const jwt = credentials.jwt;
  if (jwt === undefined) return unauthorized("this server accepts no tokens", true);
  let sub: unknown;
  try {
    const { payload } = await jwtVerify(credential, jwt.keys, {
      issuer: jwt.issuer,
      audience: jwt.audience ?? context.audience,
      algorithms: JWT_ALGORITHMS,
      currentDate: new Date(context.now),
      clockTolerance: CLOCK_TOLERANCE_S,
      requiredClaims: ["exp", "sub"],
    });
    sub = payload.sub;
  } catch (e) {
    return unauthorized(tokenRefusal(e), true);
  }
  if (typeof sub !== "string" || sub === "") return unauthorized("the token has no subject", true);
  const actor = jwt.subjects.get(sub);
  if (actor === undefined)
    return {
      ok: false,
      status: 403,
      invalidToken: false,
      message: `no actor is configured for subject ${sub} of ${jwt.issuer}`,
    };
  return { ok: true, principal: { method: "jwt", actor, issuer: jwt.issuer, subject: sub } };
}

/**
 * The actor an authenticated request acts as (ADR 0042 decisions 3 and 4):
 * the credential's id, level and source, with the memberships the request
 * names when they are a subset of the credential's. Another id, another
 * level or a membership the credential does not hold is refused.
 */
export function bindActor(
  held: HeldActor,
  claimed: Actor,
): { ok: true; actor: Actor } | { ok: false; message: string } {
  if (claimed.id !== held.id)
    return {
      ok: false,
      message: `the request acts as ${claimed.id}, but its credential is ${held.id}'s`,
    };
  if (claimed.level !== held.level)
    return {
      ok: false,
      message: `the request reads as ${claimed.level}, but ${held.id}'s credential reads as ${held.level}`,
    };
  const extra = claimed.memberships.filter((m) => !held.memberships.includes(m));
  if (extra.length > 0)
    return {
      ok: false,
      message: `${held.id}'s credential does not hold membership of ${extra.join(", ")}`,
    };
  return {
    ok: true,
    actor: {
      id: held.id,
      level: held.level,
      memberships: claimed.memberships,
      source: held.source,
    },
  };
}

/** The well-known path of a resource's protected-resource metadata (RFC 9728 section 3.1). */
export function metadataPath(resource: string): string {
  const { pathname } = new URL(resource);
  return `/.well-known/oauth-protected-resource${pathname === "/" ? "" : pathname.replace(/\/$/, "")}`;
}

/** The metadata document (RFC 9728 section 2). */
export function protectedResourceMetadata(resource: string, credentials: Credentials) {
  return {
    resource,
    ...(credentials.jwt ? { authorization_servers: [credentials.jwt.issuer] } : {}),
    bearer_methods_supported: ["header"],
    resource_name: "Engram",
  };
}

/** The WWW-Authenticate value of a 401 (RFC 6750 section 3, RFC 9728 section 5.1). */
export function wwwAuthenticate(resource: string, invalidToken: boolean): string {
  const url = `${new URL(resource).origin}${metadataPath(resource)}`;
  return `Bearer resource_metadata="${url}"${invalidToken ? ', error="invalid_token"' : ""}`;
}

// How the Engram pi package finds its workspace (card PX3). A pi package
// takes no flags, so the same names the engram CLI reads are environment
// variables here; every default keeps the store inside the project and the
// log where the CLI keeps it.
import { join, resolve } from "node:path";
import { type Actor, Scope } from "@engram/core";

export interface PackageConfig {
  /** Store root, resolved against the project (ENGRAM_ROOT; default .engram/memory). */
  root: string;
  /** Store kind for the workspace opener (ENGRAM_STORE; files when unset). */
  store?: string;
  /** Policy preset or file (ENGRAM_POLICY; the opener's default when unset). */
  policy?: string;
  /** The owner a files store is adopted as. */
  owner: string;
  /** Who the session acts as; the extension adds `source: "model"`. */
  actor: Actor;
}

/** A principal-safe owner id from a login name: characters a scope refuses become "-". */
export function ownerFromLogin(login: string): string {
  const safe = login.replace(/[^A-Za-z0-9._-]/g, "-");
  return safe === "" ? "local" : safe;
}

/**
 * Reads ENGRAM_ROOT, ENGRAM_STORE, ENGRAM_POLICY, ENGRAM_OWNER, ENGRAM_AS and
 * ENGRAM_MEMBER (comma separated scopes). Throws on a member that is not a
 * scope, so a bad setting fails the extension load instead of a later write.
 */
export function packageConfig(
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
  login: string,
): PackageConfig {
  const owner = env.ENGRAM_OWNER || ownerFromLogin(login);
  const id = env.ENGRAM_AS || `person:${owner}`;
  const ownScope = Scope.safeParse(id).success ? id : undefined;
  const members = (env.ENGRAM_MEMBER ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m !== "");
  for (const m of members)
    if (!Scope.safeParse(m).success) throw new Error(`ENGRAM_MEMBER: ${m} is not a scope`);
  const memberships = members.length > 0 ? members : ownScope ? [ownScope] : [];
  // An actor reads at its own scope's level, as the CLI's buildActor does.
  const level = (
    ownScope ? (ownScope === "org" ? "org" : ownScope.split(":")[0]) : "person"
  ) as Actor["level"];
  return {
    root: resolve(cwd, env.ENGRAM_ROOT || join(".engram", "memory")),
    ...(env.ENGRAM_STORE ? { store: env.ENGRAM_STORE } : {}),
    ...(env.ENGRAM_POLICY ? { policy: env.ENGRAM_POLICY } : {}),
    owner,
    actor: { id, level, memberships },
  };
}

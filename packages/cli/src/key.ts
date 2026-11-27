// `engram key` (card E8.12, ADR 0042 decision 1): the local API keys
// `engram serve --keys` and `engram mcp --http --keys` accept.
//   create  a key for one actor (--as, --level, --member, --source), with an
//           expiry; the key is printed once, its scrypt hash stored
//   list    every key, masked, with its actor, expiry and status
//   revoke  a key by id; it stays listed, never accepted again
// The key file is --keys; the server rereads it when it changes, so a revoke
// takes effect at the next request. The key handling is packages/server's
// (keys.ts); this file parses flags and prints.
import { resolve } from "node:path";
import { ProvenanceKind } from "@engram/core";
import { createKey, KeyFileError, listKeys, revokeKey } from "@engram/server";
import { parse } from "./commands.ts";
import { OPTIONS } from "./registry.ts";
import type { Io } from "./run.ts";
import { buildActor, checkTime, UsageError } from "./setup.ts";

const SUBCOMMANDS = ["create", "list", "revoke"] as const;

/** Runs `fn`, reporting a bad key file or flag as usage (exit 2). */
function usage<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof KeyFileError) throw new UsageError(e.message);
    throw e;
  }
}

export async function keyCommand(args: string[], io: Io): Promise<number> {
  const { values, positionals } = parse(args, OPTIONS.key, true);
  const [sub, ...rest] = positionals;
  if (sub === undefined || !(SUBCOMMANDS as readonly string[]).includes(sub))
    throw new UsageError(
      `give one of ${SUBCOMMANDS.join(", ")}: engram key <subcommand> --keys <file>`,
    );
  if (values.keys === undefined) throw new UsageError("give --keys <file>, the key file");
  const path = resolve(io.cwd, values.keys);
  const now = io.now();

  if (sub === "create") {
    if (rest.length > 0) throw new UsageError(`unexpected argument ${rest[0]}`);
    if (values.as === undefined) throw new UsageError("give --as <principal>, the key's actor");
    if (values.source === undefined)
      throw new UsageError(
        `give --source <kind>, the provenance of what the key writes: ${ProvenanceKind.options.join(", ")}`,
      );
    const source = ProvenanceKind.safeParse(values.source);
    if (!source.success)
      throw new UsageError(
        `--source ${values.source} is not one of ${ProvenanceKind.options.join(", ")}`,
      );
    const expires = checkTime("--expires", values.expires);
    if (expires === undefined)
      throw new UsageError("give --expires <iso time>; every key carries an expiry");
    const actor = buildActor(
      { as: values.as, level: values.level, member: values.member },
      undefined,
      source.data,
    );
    const { key, record } = usage(() =>
      createKey(path, {
        actor: { ...actor, source: source.data },
        expires,
        now,
      }),
    );
    if (values.json)
      io.out(`${JSON.stringify({ key, id: record.id, actor: record.actor, expires }, null, 2)}\n`);
    else
      io.out(
        `${key}\nkey ${record.id} for ${record.actor.id} (level ${record.actor.level}, member of ${record.actor.memberships.join(", ") || "nothing"}, source ${record.actor.source}), expires ${expires}\nthe key is shown once; ${path} holds its hash only\n`,
      );
    return 0;
  }

  if (sub === "list") {
    if (rest.length > 0) throw new UsageError(`unexpected argument ${rest[0]}`);
    const keys = usage(() => listKeys(path, now));
    if (values.json) io.out(`${JSON.stringify({ keys }, null, 2)}\n`);
    else if (keys.length === 0) io.out(`no keys in ${path}\n`);
    else
      io.out(
        `${keys
          .map(
            (k) =>
              `${k.key}  ${k.status.padEnd(7)}  ${k.actor.id} (${k.actor.level}, source ${k.actor.source})  expires ${k.expires}`,
          )
          .join("\n")}\n`,
      );
    return 0;
  }

  const [id, ...more] = rest;
  if (id === undefined) throw new UsageError("give the id of the key to revoke");
  if (more.length > 0) throw new UsageError(`unexpected argument ${more[0]}`);
  const revoked = usage(() => revokeKey(path, id, now));
  io.out(`key ${revoked.id} of ${revoked.actor.id} revoked at ${revoked.revoked}\n`);
  return 0;
}

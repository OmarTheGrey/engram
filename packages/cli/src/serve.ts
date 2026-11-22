// `engram serve` (card E8.2, ADR 0027): the HTTP server over the workspace
// its flags open, until the process is stopped (io.stop). Card E8.12 (ADR
// 0042): it accepts credentials, an API key file (--keys) or a token issuer
// (--issuer, --jwks, --subjects), or the waiver --insecure-loopback, under
// which actors are self-asserted as before; with neither it refuses to
// start. --as and --member name the viewer the inspector shows (plan
// decision 5). Card E8.13 (ADR 0043): --otlp or --export-jsonl exports the
// decisions its calls append, off unless named.
import { resolve } from "node:path";
import {
  bindRefusal,
  DEFAULT_PORT,
  exportConfig,
  exportsAnything,
  hasCredentialFlags,
  listen,
  openCredentials,
  openSinks,
  openWorkspace,
  type ServeAuth,
  startExport,
} from "@engram/server";
import { parse, STORE_OPTIONS } from "./commands.ts";
import type { Io } from "./run.ts";
import { buildActor, checkTime, UsageError } from "./setup.ts";

/** The credential flags of a served surface (ADR 0042), shared by serve, mcp and doctor. */
export const AUTH_OPTIONS = {
  "insecure-loopback": { type: "boolean" },
  keys: { type: "string" },
  issuer: { type: "string" },
  jwks: { type: "string" },
  subjects: { type: "string" },
  audience: { type: "string" },
  resource: { type: "string" },
} as const;

export interface AuthFlags {
  "insecure-loopback"?: boolean | undefined;
  keys?: string | undefined;
  issuer?: string | undefined;
  jwks?: string | undefined;
  subjects?: string | undefined;
  audience?: string | undefined;
  resource?: string | undefined;
}

/** The credential flags as the server reads them. */
export const credentialFlags = (values: AuthFlags) => ({
  ...(values.keys === undefined ? {} : { keys: values.keys }),
  ...(values.issuer === undefined ? {} : { issuer: values.issuer }),
  ...(values.jwks === undefined ? {} : { jwks: values.jwks }),
  ...(values.subjects === undefined ? {} : { subjects: values.subjects }),
  ...(values.audience === undefined ? {} : { audience: values.audience }),
});

/**
 * The ServeAuth the flags name, checked against the host first (bindRefusal),
 * then with its files opened, so a bad one is usage before anything binds.
 */
export function serveAuth(values: AuthFlags, host: string, io: Pick<Io, "cwd">): ServeAuth {
  const flags = credentialFlags(values);
  const refusal = bindRefusal({
    host,
    insecureLoopback: values["insecure-loopback"] === true,
    credentials: hasCredentialFlags(flags),
    resource: values.resource,
  });
  if (refusal !== undefined) throw new UsageError(refusal);
  if (values["insecure-loopback"] === true) {
    if (values.resource !== undefined)
      throw new UsageError(
        "--resource names an authenticated server; --insecure-loopback has none",
      );
    return { insecureLoopback: true };
  }
  const credentials = openCredentials(flags, (p) => resolve(io.cwd, p));
  if (credentials === undefined) throw new UsageError("no credential flag given");
  return values.resource === undefined
    ? { credentials }
    : { credentials, resource: values.resource };
}

const SERVE_OPTIONS = {
  ...STORE_OPTIONS,
  ...AUTH_OPTIONS,
  host: { type: "string" },
  port: { type: "string" },
  as: { type: "string" },
  level: { type: "string" },
  member: { type: "string", multiple: true },
} as const;

export async function serveCommand(args: string[], io: Io): Promise<number> {
  const { values } = parse(args, SERVE_OPTIONS, false);
  let port = DEFAULT_PORT;
  if (values.port !== undefined) {
    port = Number(values.port);
    if (!/^\d+$/.test(values.port) || port > 65_535)
      throw new UsageError(`--port ${values.port} is not a port number`);
  }
  const auth = serveAuth(values, values.host ?? "127.0.0.1", io);
  const viewer =
    values.as === undefined && values.member === undefined
      ? null
      : buildActor({ as: values.as, level: values.level, member: values.member }, values.owner);
  const exporting = exportConfig(values, io.env, io.cwd);
  const workspace = openWorkspace({
    store: values.store,
    root: values.root,
    owner: values.owner,
    importValidFrom: checkTime("--import-valid-from", values["import-valid-from"]),
    policy: values.policy,
    db: values.db,
    viewer,
    cwd: io.cwd,
    home: io.home,
    env: io.env,
    newId: io.newId,
  });
  try {
    workspace.open();
    // The decision export (card E8.13, ADR 0043): off unless --otlp or --export-jsonl names a sink.
    const failed = (e: unknown) =>
      io.err(
        `engram serve: decision export failed: ${e instanceof Error ? e.message : String(e)}\n`,
      );
    const decisions = exportsAnything(exporting)
      ? startExport(workspace.deps.db, openSinks(exporting, failed), failed)
      : undefined;
    const server = await listen(workspace, {
      ...(decisions ? { decisions } : {}),
      host: values.host,
      port,
      now: io.now,
      auth,
      onError: (e) =>
        io.err(`engram serve: internal error: ${e instanceof Error ? e.message : String(e)}\n`),
    });
    const store = workspace.store
      ? `store ${workspace.store.name} at ${workspace.store.root}`
      : "no store";
    const access =
      server.resource === undefined
        ? "insecure loopback: actors are self-asserted"
        : `authenticated, resource ${server.resource}`;
    io.out(
      `engram serve: listening on ${server.url} (log ${workspace.target.label}, ${workspace.policyLabel}, ${store}, viewer ${viewer?.id ?? "none"}, ${access})\n`,
    );
    if (decisions)
      io.out(
        `engram serve: exporting decisions to ${decisions.sinks.map((s) => s.label).join(", ")}\n`,
      );
    await new Promise<void>((done) => {
      if (io.stop === undefined) return;
      if (io.stop.aborted) done();
      else io.stop.addEventListener("abort", () => done(), { once: true });
    });
    await server.close();
    await decisions?.close();
    io.out("engram serve: stopped\n");
    return 0;
  } finally {
    workspace.close();
  }
}

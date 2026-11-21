// `engram serve` (card E8.2, ADR 0027): the HTTP server over the workspace
// its flags open, on a loopback port only, until the process is stopped
// (io.stop). --as and --member name the viewer the inspector shows (plan
// decision 5); like the CLI's --as they are self-asserted, since no
// authentication exists in v0.
import {
  DEFAULT_PORT,
  exportConfig,
  exportsAnything,
  listen,
  openSinks,
  openWorkspace,
  startExport,
} from "@engram/server";
import { parse, STORE_OPTIONS } from "./commands.ts";
import type { Io } from "./run.ts";
import { buildActor, checkTime, UsageError } from "./setup.ts";

const SERVE_OPTIONS = {
  ...STORE_OPTIONS,
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
      onError: (e) =>
        io.err(`engram serve: internal error: ${e instanceof Error ? e.message : String(e)}\n`),
    });
    const store = workspace.store
      ? `store ${workspace.store.name} at ${workspace.store.root}`
      : "no store";
    io.out(
      `engram serve: listening on ${server.url} (log ${workspace.target.label}, ${workspace.policyLabel}, ${store}, viewer ${viewer?.id ?? "none"})\n`,
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

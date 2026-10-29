#!/usr/bin/env node
// The `engram` binary. Node 24 runs this file directly (type stripping).
// Sets process.exitCode rather than calling process.exit, so output is
// flushed before the process ends.
//
// The event log is on node:sqlite, which warns that it is experimental on
// every start; that one warning is dropped so stderr carries only the CLI's
// own messages. Every other warning passes through. The command table is
// imported after the filter is in place, since loading core loads node:sqlite.
const emitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const text = typeof warning === "string" ? warning : warning.message;
  const type = typeof rest[0] === "string" ? rest[0] : (warning as Error).name;
  if (type === "ExperimentalWarning" && text.includes("SQLite")) return;
  (emitWarning as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

const { existsSync } = await import("node:fs");
const { homedir } = await import("node:os");
const { join } = await import("node:path");
const { fileURLToPath } = await import("node:url");
const { run } = await import("./run.ts");
const { uuidv7 } = await import("./uuid.ts");

// The checkout this file runs from, for doctor's pin checks: packages/cli/src is three levels down.
const repo = fileURLToPath(new URL("../../..", import.meta.url));

process.exitCode = await run(process.argv.slice(2), {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
  cwd: process.cwd(),
  home: homedir(),
  now: () => new Date().toISOString(),
  newId: () => uuidv7(),
  env: process.env,
  nodeVersion: process.versions.node,
  repo: existsSync(join(repo, "pnpm-workspace.yaml")) ? repo : undefined,
});

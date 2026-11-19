// The twin dogfood's violation report (card E9.5, docs/dogfood.md), run by a
// member on their own machine over their own event log:
//
//   node packages/core/scripts/dogfood-report.ts --as person:<you> [--member <scope>]... [--level <level>]
//     [--db <log.db>] [--policy <file|preset>] [--detail]
//   make dogfood-report ARGS="--as person:<you>"
//
// It opens the SQLite log read only in effect (it runs SELECTs, never a
// migration or a write), replays it through the invariants' oracle
// (src/dogfood.ts) and prints aggregate counts as JSON on stdout: safe to
// send to the team (AGENTS.md rule 12). --detail also prints each violation
// with its event and item ids on stderr, for the member alone. Exit 0 with
// no violation, 1 with one or more, 2 on a usage error or a log it cannot
// read. --as, --level and --member declare the member's actor as
// `engram serve` and `engram mcp` were given it; --db defaults as the CLI's
// does ($ENGRAM_DB_URL, else <home>/.engram/engram.db), --policy to the twin
// profile.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Actor } from "../src/actor.ts";
import { openSqlite } from "../src/db/sqlite.ts";
import { defaultActor, dogfoodReport, formatReport } from "../src/dogfood.ts";
import { allEvents } from "../src/events.ts";
import { loadPreset, PRESETS, type PresetName, parsePolicy } from "../src/policy/load.ts";
import { Scope, ScopeLevel } from "../src/schema.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TWIN = join(REPO, "packages/pi-package/profiles/twin.yaml");

class Usage extends Error {}

function main(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      db: { type: "string" },
      policy: { type: "string" },
      as: { type: "string" },
      level: { type: "string" },
      member: { type: "string", multiple: true },
      detail: { type: "boolean" },
    },
    strict: true,
  });
  if (values.as === undefined)
    throw new Usage("give --as <principal>, the id you ran engram serve as");
  const base = defaultActor(values.as);
  let level = base.level;
  if (values.level !== undefined) {
    const parsed = ScopeLevel.safeParse(values.level);
    if (!parsed.success)
      throw new Usage(`--level ${values.level} is not one of ${ScopeLevel.options.join(", ")}`);
    level = parsed.data;
  }
  for (const m of values.member ?? [])
    if (!Scope.safeParse(m).success) throw new Usage(`--member ${m} is not a scope`);
  const actor: Actor = { id: values.as, level, memberships: values.member ?? base.memberships };

  const spec = values.policy ?? TWIN;
  const policy = (PRESETS as readonly string[]).includes(spec)
    ? loadPreset(spec as PresetName)
    : parsePolicy(readFile(resolve(spec), "--policy"), spec);

  const given = values.db ?? (process.env.ENGRAM_DB_URL || undefined);
  if (given !== undefined && /^[a-z][a-z0-9+.-]*:\/\//i.test(given))
    throw new Usage("the report reads a SQLite log only; give --db <path to the .db file>");
  const path = resolve(given ?? join(homedir(), ".engram", "engram.db"));
  if (given === ":memory:" || !existsSync(path)) throw new Usage(`no event log at ${path}`);
  const db = openSqlite(path);
  let events: ReturnType<typeof allEvents>;
  try {
    const n = db
      .prepare(
        "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
      )
      .get()?.n;
    if (Number(n) === 0) throw new Usage(`no event log at ${path} (not an Engram log)`);
    events = allEvents(db);
  } finally {
    db.close();
  }

  const { report, details } = dogfoodReport(events, policy, [actor]);
  process.stdout.write(`${formatReport(report)}\n`);
  if (values.detail) for (const line of details) process.stderr.write(`${line}\n`);
  return report.violations.total === 0 ? 0 : 1;
}

function readFile(path: string, flag: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Usage(
      `${flag} ${path} is neither a preset (${PRESETS.join(", ")}) nor a readable file`,
    );
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  // A usage error, a flag parseArgs refuses, or a log or policy it cannot read.
  process.stderr.write(`dogfood-report: ${(e as Error).message}\n`);
  process.exitCode = 2;
}

// The twin dogfood's violation report (card E9.5, docs/dogfood.md), run by a
// member on their own machine over their own event log:
//
//   node packages/core/scripts/dogfood-report.ts --as person:<you> [--member <scope>]... [--level <level>]
//     [--db <log.db>] [--policy <file|preset>] [--detail]
//   make dogfood-report ARGS="--as person:<you>"
//
// It opens the SQLite log read only (review finding E95-10: never a
// migration, a write, or a switch to WAL), checks every stored event against
// the MemoryEvent schema (E95-8), replays the log through the invariants'
// oracle (src/dogfood.ts) and prints aggregate counts as JSON on stdout: safe
// to send to the team (AGENTS.md rule 12). --detail also prints each
// violation with its event and item ids on stderr, for the member alone.
// Exit 0 with no violation, 1 with one or more, 2 on a usage error, a log it
// cannot read, or an event that does not parse. No error message repeats a
// flag's value, a path or a stored row (E95-11). --as, --level and --member
// declare the member's actor as `engram serve` and `engram mcp` were given
// it; --db defaults as the CLI's does ($ENGRAM_DB_URL, else
// <home>/.engram/engram.db), --policy to the twin profile.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Actor } from "../src/actor.ts";
import { defaultActor, dogfoodReport, formatReport, parseEventRows } from "../src/dogfood.ts";
import { loadPreset, PRESETS, type PresetName, parsePolicy } from "../src/policy/load.ts";
import { Scope, ScopeLevel } from "../src/schema.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TWIN = join(REPO, "packages/pi-package/profiles/twin.yaml");

/** A refusal whose message names no value the member gave. */
class Refusal extends Error {}

function main(argv: string[]): number {
  let values: ReturnType<typeof parse>;
  try {
    values = parse(argv);
  } catch {
    throw new Refusal(
      "unknown flag or missing value; flags: --as --member --level --db --policy --detail",
    );
  }
  if (values.as === undefined)
    throw new Refusal("give --as <principal>, the id engram serve ran as");
  const base = defaultActor(values.as);
  let level = base.level;
  if (values.level !== undefined) {
    const parsed = ScopeLevel.safeParse(values.level);
    if (!parsed.success)
      throw new Refusal(`the --level value is not one of ${ScopeLevel.options.join(", ")}`);
    level = parsed.data;
  }
  for (const m of values.member ?? [])
    if (!Scope.safeParse(m).success) throw new Refusal("a --member value is not a scope");
  const actor: Actor = { id: values.as, level, memberships: values.member ?? base.memberships };

  const spec = values.policy ?? TWIN;
  let policy: ReturnType<typeof parsePolicy>;
  try {
    policy = (PRESETS as readonly string[]).includes(spec)
      ? loadPreset(spec as PresetName)
      : parsePolicy(readFileSync(resolve(spec), "utf8"), "policy");
  } catch {
    throw new Refusal(
      `the --policy value is neither a preset (${PRESETS.join(", ")}) nor a readable policy file`,
    );
  }

  const given = values.db ?? (process.env.ENGRAM_DB_URL || undefined);
  if (given !== undefined && /^[a-z][a-z0-9+.-]*:\/\//i.test(given))
    throw new Refusal("the report reads a SQLite log only; give --db <path to the .db file>");
  const path = resolve(given ?? join(homedir(), ".engram", "engram.db"));
  if (given === ":memory:" || !existsSync(path))
    throw new Refusal("no event log at the path given");
  let rows: { seq: unknown; body: unknown }[];
  try {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      const n = db
        .prepare(
          "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('schema_migrations', 'events')",
        )
        .get()?.n;
      if (Number(n) !== 2) throw new Refusal("the file given is not an Engram event log");
      rows = db.prepare("SELECT seq, body FROM events ORDER BY seq").all() as typeof rows;
    } finally {
      db.close();
    }
  } catch (e) {
    if (e instanceof Refusal) throw e;
    throw new Refusal("the file given could not be read as a SQLite event log");
  }

  const { events, bad } = parseEventRows(rows);
  if (bad.length > 0) {
    for (const seq of bad) process.stderr.write(`dogfood-report: event ${seq} does not parse\n`);
    throw new Refusal(`${bad.length} stored event(s) do not parse; the report is not printed`);
  }
  const { report, details } = dogfoodReport(events, policy, [actor]);
  process.stdout.write(`${formatReport(report)}\n`);
  if (values.detail) for (const line of details) process.stderr.write(`${line}\n`);
  return report.violations.total === 0 ? 0 : 1;
}

function parse(argv: string[]) {
  return parseArgs({
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
  }).values;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  // Only a Refusal's own words; any other error is named by its kind alone.
  const text = e instanceof Refusal ? e.message : `internal error (${(e as Error).name})`;
  process.stderr.write(`dogfood-report: ${text}\n`);
  process.exitCode = 2;
}

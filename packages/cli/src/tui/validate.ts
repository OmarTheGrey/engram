// The CLI's own checks over an argument vector, without the call (card
// E8.15b's form validation, moved here by card E8.15e so line mode checks
// what the full screen's forms check; docs/design/tui.md 9.4): the
// command's parse, then for a plane command its `prepare` (./commands.ts),
// the actor it builds and the workspace as `connect` would open it, else
// the CLI's checkTime and checkNumber over its time and number flags. What
// the CLI does not check is not checked here; the plane's answer is the
// answer. Pure, no pi-tui.
import { openWorkspace } from "@engram/server";
import {
  CHECK,
  EVENTS,
  EXPLAIN,
  EXPORT,
  GRANTS,
  LINT,
  POLICY,
  PROMOTE,
  type Prepared,
  parse,
  READ,
  RETAIN,
  SCOPES,
  SIMULATE,
  SUPERSEDE,
  WHO_CAN_READ,
  WRITE,
} from "../commands.ts";
import { serverOf } from "../connect.ts";
import { type CommandSpec, type OptionSpec, parseOptions } from "../registry.ts";
import type { Io } from "../run.ts";
import { checkNumber, checkTime } from "../setup.ts";

/** What a check needs of a plane command: its parse config and its prepare. */
interface Preparing {
  options: Readonly<Record<string, OptionSpec>>;
  allowPositionals: boolean;
  prepare(values: never, positionals: string[], io: Io): Prepared;
}

/** The plane commands whose own checks validate a command line, by the command's first word. */
const PLANE: Readonly<Record<string, Preparing>> = {
  read: READ,
  write: WRITE,
  check: CHECK,
  promote: PROMOTE,
  supersede: SUPERSEDE,
  grants: GRANTS,
  explain: EXPLAIN,
  events: EVENTS,
  retain: RETAIN,
  lint: LINT,
  simulate: SIMULATE,
  policy: POLICY,
  scopes: SCOPES,
  "who-can-read": WHO_CAN_READ,
  export: EXPORT,
};

/** The id a check hands prepare in place of a fresh one: a valid UUIDv7 no run uses. */
const CHECKING_ID = "00000000-0000-7000-8000-000000000000";

/**
 * The CLI's message for what is wrong with `argv` (the words after
 * `engram`), without its `engram <command>: ` prefix; undefined when the
 * CLI's checks pass. Checking draws no id from `given`: the ids are the
 * run's, as the plain command draws them (parity, card E8.15c).
 */
export function checkArgv(
  spec: CommandSpec,
  argv: readonly string[],
  given: Io,
): string | undefined {
  const words = spec.name.split(" ").filter((w) => !w.startsWith("--"));
  // The handler gets the words after the first, as run hands them on. A command whose
  // handler takes no positionals (log verify) is handed the words after its name (card E8.15d).
  const args = spec.allowPositionals ? argv.slice(1) : argv.slice(words.length);
  const io: Io = { ...given, newId: () => CHECKING_ID };
  try {
    const plane = PLANE[words[0] as string];
    if (plane !== undefined) {
      const { values, positionals } = parse([...args], plane.options, plane.allowPositionals);
      const p = plane.prepare(values as never, positionals, io);
      if (p.session !== null) {
        p.actor();
        // The workspace's own checks too (a store a write needs, review M13), as
        // connect would open it, with no log opened and the store read only.
        if (serverOf(io, p.flags) === undefined) {
          const opened = openWorkspace({
            store: p.flags.store,
            root: p.flags.root,
            owner: p.flags.owner,
            importValidFrom: checkTime("--import-valid-from", p.flags["import-valid-from"]),
            policy: p.flags.policy,
            db: p.flags.db,
            requireStore: p.session.requireStore,
            readOnlyStore: true,
            cwd: io.cwd,
            home: io.home,
            env: io.env,
            newId: io.newId,
          });
          opened.close();
        }
      }
    } else {
      const { values } = parse([...args], parseOptions(spec), spec.allowPositionals);
      for (const [name, o] of Object.entries(spec.options)) {
        const v = (values as Record<string, unknown>)[name];
        if (typeof v !== "string") continue;
        if (o.control === "time") checkTime(`--${name}`, v);
        if (o.control === "number") checkNumber(`--${name}`, v);
      }
    }
  } catch (e) {
    return (e as Error).message;
  }
  return undefined;
}

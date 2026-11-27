// What a command asks before it runs (card E8.15b, moved here by card
// E8.15e so line mode asks in the same words; docs/design/tui.md 9.5): the
// registry's commands the TUI offers, the entry a command line names, and
// the confirmation its entry's `writes` calls for, judged from the command
// line being run. Pure, no pi-tui: the full screen (./app.ts) shows it as a
// dialog, line mode (./line.ts) as sentences and a yes or no question.
// Nothing here decides anything (AGENTS.md rule 1): `writes` is the
// registry's account of what kind of change a command makes; the plane
// decides every call.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type CommandSpec, REGISTRY, type Values, type Writes } from "../registry.ts";
import type { Io } from "../run.ts";
import type { ConfirmRequest } from "./screen.ts";
import { shortPath } from "./workspace.ts";

/** Every registry command the TUI offers: all but `tui` itself. */
export const offered = () => REGISTRY.filter((s) => s.name !== "tui");

/** The entry a command line names: the longest registry name its words start with. */
export function specOfWords(words: readonly string[]): CommandSpec | undefined {
  let best: CommandSpec | undefined;
  for (const s of offered()) {
    const n = s.name.split(" ");
    if (
      n.every((w, i) => words[i] === w) &&
      (best === undefined || n.length > best.name.split(" ").length)
    )
      best = s;
  }
  return best;
}

/** A read, by its route: read, read --item and scopes run the store's sweep and adoption first. */
export const isRead = (spec: Pick<CommandSpec, "name">) =>
  spec.name.startsWith("read") || spec.name === "scopes";

/** What makes two reads the same workspace for "asked once a session" (9.5). */
export const readKey = (f: Values) =>
  JSON.stringify(
    ["server", "db", "store", "root", "owner", "as", "level", "member"].map((k) => f[k] ?? null),
  );

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** The action button of a confirmation, by command. */
const ACTION_WORD: Readonly<Record<string, string>> = {
  write: "Write",
  promote: "Promote",
  grants: "Change grants",
  import: "Import",
  supersede: "Apply",
  "key create": "Create",
  "key revoke": "Revoke",
  "log checkpoint": "Record",
  retain: "Sweep",
  export: "Export",
};

/**
 * The confirmation a command needs before it runs, or undefined (9.5): for
 * a read with a store folder the dialog of 8.5 (asked once a session; the
 * caller keeps which), for a change of state, a retirement, an erasure or a
 * file the dialog of 8.29. `flags` are the command line's own, parsed;
 * `actor` the workspace's actor as the title bar names it.
 */
export function confirmationFor(
  spec: CommandSpec,
  argv: readonly string[],
  writes: Writes,
  flags: Values,
  actor: string,
  io: Pick<Io, "home" | "cwd">,
): ConfirmRequest | undefined {
  if (isRead(spec)) {
    if (writes !== "state") return undefined;
    // The folder and the workspace are the ones the command line being run names (finding C1).
    const where =
      flags.root !== undefined
        ? shortPath(String(flags.root), io)
        : flags.server !== undefined
          ? `the store of the server at ${hostOf(String(flags.server))}`
          : "the store";
    return {
      // A long path keeps its last part in the title, the whole of it in the text.
      title: `Read with ${where.length > 40 ? `.../${where.split("/").at(-1)}` : where}?`,
      lines: [
        `This read also changes the log, as engram ${spec.name.split(" ")[0]} always does:`,
        `1. as the store's owner, sweeps the owner's retention: any item past its ttl is retired for good, items over budget evicted.`,
        `2. adopts the memories in ${where} into the log as ${flags.as ?? (flags.owner === undefined ? "the actor" : `person:${flags.owner}`)}; the files are not changed.`,
        "3. reads through the plane and explains every item returned. Asked once a session.",
      ],
      argv,
      action: "Read",
    };
  }
  const word = ACTION_WORD[spec.name] ?? "Run";
  const base = { title: `${spec.title}?`, argv, action: word };
  switch (writes) {
    case "state":
      return {
        ...base,
        lines: [
          `Runs engram ${spec.name} as ${actor}: the plane decides it and records the decision as an event.`,
          spec.name === "grants"
            ? "A grant change is undone only by another grant change, itself decided by the plane."
            : "It cannot be undone; a later change is a new version or a new event.",
        ],
      };
    case "retire":
      return {
        ...base,
        lines: [
          `Sweeps the scope's retention as ${actor}: every item past its ttl is retired, budgets enforced.`,
          "Retiring cannot be undone. Retired items stay in the log; reads no longer return them.",
        ],
      };
    case "erase": {
      const typed = argv[2] ?? "erase";
      return {
        ...base,
        lines: ["This cannot be undone: a revoked key is never accepted again."],
        typed,
      };
    }
    case "file": {
      const out = argv[argv.indexOf("--out") + 1] ?? "";
      return {
        ...base,
        lines: [
          `Writes the bundle to ${out}.`,
          existsSync(resolve(io.cwd, out))
            ? `${out} exists: it will be overwritten.`
            : `${out} does not exist yet: it will be created.`,
        ],
      };
    }
    default:
      return undefined;
  }
}

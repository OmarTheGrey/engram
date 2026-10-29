// The Engram CLI is a store command too (review finding P5-2): `engram`
// takes `--as` and `--member` as given, so a model that could run it through
// bash could write as anyone, confirm its own content under several names and
// approve a promotion as a reviewer. Inside a real pi SDK session the
// extension blocks it in the model's bash tool and in user_bash like mem0 and
// letta, each attempt one bypass_blocked event, and nothing runs.
import type { ToolCall } from "@earendil-works/pi-ai";
import { allEvents, loadPreset } from "@engram/core";
import { afterEach, describe, expect, test } from "vitest";
import {
  blockedStoreCommand,
  createEngramExtension,
  NO_BYPASS_ID,
  STORE_COMMANDS,
} from "../src/index.ts";
import {
  AT,
  freshLog,
  type HarnessRun,
  hostUserBash,
  OMAR,
  startSession,
  toolResults,
} from "./harness.ts";

const COMMANDS = [
  "engram promote 01920000-0000-7000-8000-000000000001 --to team:platform --review --as person:sam",
  "engram write --as person:a --scope person:omar --content x",
  "npx engram read --owner omar --root .",
  "node packages/cli/src/main.ts promote x --to org && engram read",
  "make engram ARGS=read",
  // The CLI's other routes (review finding P5-18): the package spec, the
  // workspace filter, and its entry script by path.
  "npx @engram/cli promote x --to team:platform --review --as person:sam",
  "npx -y @engram/cli@latest write --content x",
  "pnpm dlx @engram/cli read --owner omar",
  "pnpm --filter @engram/cli exec node src/main.ts promote x --to org",
  "pnpm --filter ./packages/cli exec node src/main.ts read",
  "node packages/cli/src/main.ts promote x --to org",
  "node ./packages/cli/src/main.ts read",
  "node C:\\repo\\packages\\cli\\src\\main.ts read",
  "cd packages/cli && node src/main.ts promote x --to org",
];

/** Commands that touch neither a store nor the CLI stay allowed. */
const ALLOWED = ["ls packages", "pnpm --filter @engram/core test", "cat clinic/notes.md"];

const call = (id: string, name: string, args: ToolCall["arguments"]) => ({
  toolCall: { id, name, arguments: args },
});

const textOf = (m: { content: unknown }) => {
  const c = m.content;
  if (typeof c === "string") return c;
  return (c as { type: string; text?: string }[])[0]?.text ?? "";
};

let run: HarnessRun | undefined;
afterEach(() => run?.session.dispose());

describe("P5-2: the engram CLI is blocked in a pi session", () => {
  test("engram is on the store command list", () => {
    expect(STORE_COMMANDS).toContain("engram");
  });

  test("every route is matched by the text check, and unrelated commands are not", () => {
    for (const c of COMMANDS) expect(blockedStoreCommand(c, STORE_COMMANDS), c).toBe("engram");
    for (const c of ALLOWED) expect(blockedStoreCommand(c, STORE_COMMANDS), c).toBeUndefined();
  });

  test("the model's bash calls to engram are blocked, each one event", async () => {
    const log = freshLog();
    const ext = createEngramExtension({
      ...log,
      policy: loadPreset("medium"),
      actor: OMAR,
      now: () => AT,
    });
    const steps = [
      ...COMMANDS.map((c, i) => call(`e${i}`, "bash", { command: c })),
      { text: "ok" },
    ];
    run = await startSession(ext, steps, ["bash"]);
    await run.session.prompt("promote my note");
    const results = toolResults(run.sessionManager);
    expect(results).toHaveLength(COMMANDS.length);
    for (const r of results) {
      expect(r.isError, textOf(r)).toBe(true);
      expect(textOf(r)).toContain(NO_BYPASS_ID);
    }
    const blocked = allEvents(log.db).filter((e) => e.op === "bypass_blocked");
    // The reason keeps each attempt (long hex runs such as an item id are redacted).
    expect(blocked).toHaveLength(COMMANDS.length);
    for (const e of blocked)
      expect(e.reason).toMatch(/^engram is a memory store command; .*attempted: ./);
  });

  test("and user_bash, with exit code 126", async () => {
    const log = freshLog();
    const ext = createEngramExtension({
      ...log,
      policy: loadPreset("medium"),
      actor: OMAR,
      now: () => AT,
    });
    run = await startSession(ext, [], ["bash"]);
    for (const command of COMMANDS)
      expect((await hostUserBash(run.session, command)).exitCode, command).toBe(126);
  });
});

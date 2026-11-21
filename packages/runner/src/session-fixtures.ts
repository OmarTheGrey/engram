// Card D1's fixture sessions: fifty synthetic pi sessions, each with a task
// id, written from one seed. `make fixtures` runs
// packages/runner/scripts/session-fixtures.ts, which writes them into
// fixtures/sessions/d1/ with an index; nothing else writes them (AGENTS.md,
// docs/conventions/testing.md "Fixtures").
//
// Every entry is typed with pi's own entry and message types
// (@earendil-works/pi-coding-agent 1.3.0, dist/core/session-manager.d.ts,
// and @earendil-works/pi-ai's message types), so the compiler holds the
// files to the format pi writes; packages/runner/test/session-fixtures.test.ts
// loads each one into pi's SessionManager and checks its branch and leaves
// against the core parser. Ids and times come from the seed, not from pi's
// generateId and clock, so the files are byte-stable. The tree is built the
// way pi's SessionManager builds it: an abandoned attempt is written first,
// then either `branchWithSummary` (a branch_summary child of the entry the
// new branch continues from, its fromId the abandoned leaf) or a plain
// `branch` (the next entry is another child of an earlier one).
// Some sessions also hold pi's recovery from a length cut: the cut
// response, then a `context_edit` that omits it from the model's context.
//
// The content is synthetic: invented tasks over an invented repository, no
// real person, secret or session (AGENTS.md rule 12).
import { createHash } from "node:crypto";
import type { AssistantMessage, Tool, ToolCall, Usage } from "@earendil-works/pi-ai";
import type {
  BranchSummaryEntry,
  CompactionEntry,
  ContextEditEntry,
  CustomEntry,
  FileEntry,
  ModelChangeEntry,
  SessionHeader,
  SessionMessageEntry,
  ThinkingLevelChangeEntry,
} from "@earendil-works/pi-coding-agent";

/** The seed `make fixtures` writes the fixtures from. */
export const SESSION_FIXTURE_SEED = 1;
/** How many sessions the card asks for. */
export const SESSION_FIXTURE_COUNT = 50;
/** Where `make fixtures` writes them, from the repository root. */
export const SESSION_FIXTURE_DIR = "fixtures/sessions/d1";

/** One line of the index the generator writes beside the sessions. */
export interface SessionFixture {
  file: string;
  session_id: string;
  task_id: string;
  verdict: "success" | "failure";
  /** How many abandoned branches the session has. */
  abandoned: number;
  /** `summary` when the abandoned branch was left with pi's branch summary, `plain` without one, null when none. */
  branch: "summary" | "plain" | null;
  compacted: boolean;
  /** Whether an attempt cut at its length limit was then omitted by a context edit, as pi's recovery does. */
  recovered: boolean;
}

export interface SessionFixtureSet {
  /** File name to its JSONL text. */
  files: Record<string, string>;
  index: { seed: number; count: number; sessions: SessionFixture[] };
}

/** mulberry32 seeded by sha256 of the seed and the session's number. */
function stream(seed: number, n: number): () => number {
  let a = createHash("sha256").update(`d1-sessions:${seed}:${n}`).digest().readUInt32BE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TASKS: { slug: string; prompt: string; files: string[] }[] = [
  {
    slug: "rename-symbol",
    prompt: "Rename parseRow to parseRecord everywhere.",
    files: ["src/rows.ts", "src/load.ts"],
  },
  {
    slug: "fix-failing-test",
    prompt: "The test for totals fails; make it pass.",
    files: ["src/totals.ts", "test/totals.test.ts"],
  },
  {
    slug: "add-flag",
    prompt: "Add a --dry-run flag to the export command.",
    files: ["src/cli.ts", "src/export.ts"],
  },
  {
    slug: "update-docs",
    prompt: "Document the retry option in the README.",
    files: ["README.md", "src/retry.ts"],
  },
  {
    slug: "remove-dead-code",
    prompt: "Remove the unused legacyFormat helper.",
    files: ["src/format.ts", "src/index.ts"],
  },
  {
    slug: "bump-timeout",
    prompt: "Raise the fetch timeout from 5 to 10 seconds.",
    files: ["src/fetch.ts", "src/config.ts"],
  },
  {
    slug: "type-error",
    prompt: "Fix the type error in the report builder.",
    files: ["src/report.ts", "src/types.ts"],
  },
  {
    slug: "add-test",
    prompt: "Add a test for an empty input to the splitter.",
    files: ["src/split.ts", "test/split.test.ts"],
  },
  {
    slug: "log-level",
    prompt: "Log retries at debug level, not info.",
    files: ["src/retry.ts", "src/log.ts"],
  },
  {
    slug: "sort-output",
    prompt: "Sort the listing by name before printing.",
    files: ["src/list.ts", "src/print.ts"],
  },
];

const ZERO: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const TOOLS: Tool[] = ["read", "bash", "edit"].map((name) => ({
  name,
  description: `The ${name} tool.`,
  parameters: { type: "object", properties: {} } as unknown as Tool["parameters"],
}));

const hex = (rand: () => number, n: number) =>
  Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");

/** One session's file entries, from its own stream. */
function session(
  seed: number,
  n: number,
): { entries: FileEntry[]; fixture: Omit<SessionFixture, "file"> } {
  const rand = stream(seed, n);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const task = TASKS[n % TASKS.length] as (typeof TASKS)[number];
  const taskId = `synthetic/${task.slug}-${String(n + 1).padStart(2, "0")}`;
  const sessionId = `${hex(rand, 8)}-${hex(rand, 4)}-4${hex(rand, 3)}-${"89ab"[Math.floor(rand() * 4)]}${hex(rand, 3)}-${hex(rand, 12)}`;
  const start = Date.UTC(2026, 9, 1, 9) + n * 3_600_000;
  let tick = 0;
  const time = () => start + 1000 * tick++;
  const used = new Set<string>();
  const newId = () => {
    for (;;) {
      const id = hex(rand, 8);
      if (!used.has(id)) {
        used.add(id);
        return id;
      }
    }
  };
  let callNo = 0;

  const header: SessionHeader = {
    type: "session",
    version: 3,
    id: sessionId,
    timestamp: new Date(start).toISOString(),
    cwd: "/synthetic/repo",
  };
  const entries: FileEntry[] = [header];
  let leaf: string | null = null;
  const append = <E extends { id: string; parentId: string | null; timestamp: string }>(
    make: (base: { id: string; parentId: string | null; timestamp: string }, ms: number) => E,
  ): E => {
    const ms = time();
    const e = make({ id: newId(), parentId: leaf, timestamp: new Date(ms).toISOString() }, ms);
    entries.push(e as unknown as FileEntry);
    leaf = e.id;
    return e;
  };
  const assistant = (
    content: AssistantMessage["content"],
    stopReason: AssistantMessage["stopReason"],
  ) =>
    append(
      (base, ms): SessionMessageEntry => ({
        type: "message",
        ...base,
        message: {
          role: "assistant",
          content,
          api: "scripted",
          provider: "scripted",
          model: "scripted-1",
          usage: ZERO,
          stopReason,
          timestamp: ms,
        },
      }),
    );
  const toolRound = (fail: boolean) => {
    const file = pick(task.files);
    const calls: ToolCall[] = [];
    calls.push({
      type: "toolCall",
      id: `call_${String(++callNo).padStart(3, "0")}`,
      name: fail ? "bash" : pick(["read", "bash", "edit"]),
      arguments: fail ? { command: `sed -i -e 's/old/new/' ${file}` } : { path: file },
    });
    if (!fail && rand() < 0.4)
      calls.push({
        type: "toolCall",
        id: `call_${String(++callNo).padStart(3, "0")}`,
        name: "read",
        arguments: { path: pick(task.files) },
      });
    assistant(
      [
        { type: "text", text: fail ? `Trying a quick edit of ${file}.` : `Looking at ${file}.` },
        ...calls,
      ],
      "toolUse",
    );
    for (const c of calls)
      append(
        (base, ms): SessionMessageEntry => ({
          type: "message",
          ...base,
          message: {
            role: "toolResult",
            toolCallId: c.id,
            toolName: c.name,
            content: [
              {
                type: "text",
                text: fail
                  ? "sed: -e expression #1: unterminated `s' command"
                  : `${String(c.arguments.path ?? c.arguments.command)}: 42 lines`,
              },
            ],
            isError: fail,
            timestamp: ms,
          },
        }),
      );
  };
  const outcome = (verdict: "success" | "failure") =>
    append(
      (base): CustomEntry => ({
        type: "custom",
        ...base,
        customType: "engram.outcome",
        data: { verdict, reward: verdict === "success" ? 1 : 0 },
      }),
    );

  append(
    (base): ModelChangeEntry => ({
      type: "model_change",
      ...base,
      provider: "scripted",
      modelId: "scripted-1",
    }),
  );
  append(
    (base): ThinkingLevelChangeEntry => ({
      type: "thinking_level_change",
      ...base,
      thinkingLevel: "off",
    }),
  );
  append(
    (base): CustomEntry => ({
      type: "custom",
      ...base,
      customType: "engram.task",
      data: { task_id: taskId },
    }),
  );
  append(
    (base, ms): SessionMessageEntry => ({
      type: "message",
      ...base,
      message: {
        role: "system",
        content: "",
        sections: {
          preamble: "<preamble>You are a synthetic coding agent in Engram's fixtures.</preamble>",
        },
        toolsAdded: TOOLS,
        timestamp: ms,
      },
    }),
  );
  const prompt = append(
    (base, ms): SessionMessageEntry => ({
      type: "message",
      ...base,
      message: { role: "user", content: task.prompt, timestamp: ms },
    }),
  );

  const r = rand();
  const branch: SessionFixture["branch"] = r < 0.3 ? "summary" : r < 0.45 ? "plain" : null;
  if (branch !== null) {
    // The abandoned attempt, from the prompt: a failing edit and a give-up.
    toolRound(true);
    assistant([{ type: "text", text: "That edit did not apply." }], "stop");
    const abandonedLeaf = outcome("failure").id;
    leaf = prompt.id;
    if (branch === "summary")
      append(
        (base): BranchSummaryEntry => ({
          type: "branch_summary",
          ...base,
          fromId: abandonedLeaf,
          summary: "A sed edit failed with an unterminated s command; the attempt was abandoned.",
        }),
      );
  }
  const rounds = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < rounds; i++) toolRound(false);
  // pi's recovery after a length cut (agent-session.js `_omitRecoveryAttempt`,
  // docs/compaction.md): the cut response stays in the file and a context
  // edit omits it from the model's context before the retry.
  const recovered = rand() < 0.15;
  if (recovered) {
    const cut = assistant(
      [{ type: "text", text: "Reading every file of the repository at once" }],
      "length",
    );
    append(
      (base): ContextEditEntry => ({
        type: "context_edit",
        ...base,
        targetId: cut.id,
        replacement: null,
      }),
    );
  }
  const compacted = rand() < 0.15;
  if (compacted) {
    const kept = leaf as string;
    append(
      (base): CompactionEntry => ({
        type: "compaction",
        ...base,
        summary: `The agent read ${task.files.join(" and ")} while working on: ${task.prompt}`,
        firstKeptEntryId: kept,
        tokensBefore: 1000 + Math.floor(rand() * 9000),
      }),
    );
  }
  const verdict = rand() < 0.75 ? "success" : "failure";
  assistant(
    [
      {
        type: "text",
        text: verdict === "success" ? "Done; the change is in place." : "I could not finish this.",
      },
    ],
    "stop",
  );
  outcome(verdict);
  return {
    entries,
    fixture: {
      session_id: sessionId,
      task_id: taskId,
      verdict,
      abandoned: branch === null ? 0 : 1,
      branch,
      compacted,
      recovered,
    },
  };
}

/** The fixture set for a seed: the same files for the same seed, byte for byte. */
export function sessionFixtures(
  seed = SESSION_FIXTURE_SEED,
  count = SESSION_FIXTURE_COUNT,
): SessionFixtureSet {
  const files: Record<string, string> = {};
  const sessions: SessionFixture[] = [];
  for (let n = 0; n < count; n++) {
    const file = `d1-${String(n + 1).padStart(2, "0")}.jsonl`;
    const { entries, fixture } = session(seed, n);
    files[file] = `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;
    sessions.push({ file, ...fixture });
  }
  return { files, index: { seed, count, sessions } };
}

/** The index file's text. */
export function sessionFixtureIndex(set: SessionFixtureSet): string {
  return `${JSON.stringify(set.index, null, 2)}\n`;
}

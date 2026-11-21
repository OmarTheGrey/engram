// The session parser (card D1, ADR 0001 point 5, ADR 0012): a pi session's
// JSONL text to an episode, the episodic record Distill learns from. Pure:
// text in, plain data out; the recorder (packages/runner/src/recorder.ts)
// reads the files and writes each episode through Plane.write.
//
// The format is pi's own, version 3, as @earendil-works/pi-coding-agent 1.3.0
// writes and reads it: docs/session-format.md, docs/message-types.md and
// docs/compaction.md of that package, and dist/core/session-manager.d.ts for
// the entry types. Core imports nothing from pi (AGENTS.md rule 4), so the
// shapes are read here as plain data and only the fields named below are
// used. What this module copies from pi's behaviour, and where pi does it in
// dist/core/session-manager.js:
//
// - Lines are parsed one by one and a malformed line is skipped
//   (`parseSessionEntries`); the count of skipped lines is kept. A version of
//   3 or more is current (`migrateToCurrentVersion` migrates only below 3).
// - The current leaf of a loaded file is its last entry (`_buildIndex` sets
//   `leafId` to each entry in file order), and the current branch is the
//   path from that leaf to its root by `parentId` (`buildSessionPath`).
// - A `branch_summary` entry is appended by `branchWithSummary` as a child of
//   the entry the new branch continues from, with `fromId` the abandoned
//   leaf; a plain `branch` appends nothing, the next entry is simply another
//   child of an earlier one; `resetLeaf` lets a later entry start a new root.
// - A `context_edit` entry (`appendContextEdit`) names an earlier entry on
//   its own branch (`targetId`) and either omits it from the model's context
//   (`replacement: null`) or replaces its content (`replacement.content`);
//   the latest edit of a target on a branch wins (`buildSessionProjection`).
//   pi omits a failed attempt this way on two paths (agent-session.js
//   `_omitRecoveryAttempt`): after a context overflow or a length cut it
//   omits the attempt and its tool results, appends a compaction and
//   retries (docs/compaction.md "Overflow and Length Recovery Ordering");
//   after a retryable error (`_prepareRetry`) it omits that one response
//   and retries, once per failed attempt.
//
// An episode keeps the raw record, not the model's context: a compaction is
// a step and the entries it summarised stay, and an edited entry stays as it
// happened, marked `omitted` or `replaced` (with what replaced it). Steps a
// recovery omitted are listed again as `omitted` attempts, negative evidence
// beside the abandoned branches. Each entry off the final branch belongs to
// one abandoned branch only: the first, in file order of the leaves, whose
// path reaches it; a later branch that forks inside it is left at its fork
// and names the branch it left (`left_from`).
//
// The step names follow the span vocabulary of the OpenAI Agents SDK traces
// (MIT, idea only, card D1's "Absorbs"): a model turn is a `generation`, a
// tool call with its result a `function`, an extension's message a
// `custom`; `user` and `summary` are pi's own.
import type { z } from "zod";
import type { SessionEntry } from "../distill.ts";
import type { JsonValue } from "../schema.ts";

/** Any JSON value (the schema's JsonValue), so an episode is item content as it stands. */
export type EpisodeJson = z.infer<typeof JsonValue>;

/** The `format` field of every episode this module writes. */
export const EPISODE_FORMAT = "engram.episode/1";
/** The pi `custom` entry naming the session's task: `data: { task_id: string }`. */
export const TASK_ENTRY = "engram.task";
/** The pi `custom` entry giving a branch's verdict: `data: { verdict: "success" | "failure", reward?: number }`. */
export const OUTCOME_ENTRY = "engram.outcome";
/** The oldest session version this parser reads; pi migrates older files to 3 when it loads them. */
export const SESSION_VERSION = 3;

/** A session file that has no episode: no header, an older version, or a broken tree. */
export class InvalidSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSessionError";
  }
}

/** A session file's header and entries, in file order. */
export interface ParsedSession {
  /** The header's `id` (pi's default is a UUID; callers may supply their own). */
  id: string;
  /** The header's `timestamp`, when the session was created. */
  timestamp: string;
  entries: SessionEntry[];
  /** Lines that were not JSON, skipped as pi skips them. */
  skipped_lines: number;
}

/**
 * How a later `context_edit` on the same branch changed a step's entry in the
 * model's context; absent when no edit names it. `replacement` is the text
 * that stood in the context from then on.
 */
export type ContextMark = { context?: "omitted" | "replaced"; replacement?: string };

export type Step = (
  | { entry_id: string; kind: "user"; text: string }
  | {
      entry_id: string;
      kind: "generation";
      text: string;
      /** `provider/model` of the assistant message. */
      model: string;
      stop_reason: string;
      tool_calls: number;
    }
  | {
      /** The assistant entry that made the call, or the entry that holds an unmatched result. */
      entry_id: string;
      kind: "function";
      /** `model` for a tool call, `user` for a shell command the user ran (pi's bashExecution). */
      caller: "model" | "user";
      tool: string;
      /** Null when only the result is on this branch. */
      arguments: EpisodeJson;
      /** Null when no result is on this branch. */
      result: string | null;
      is_error: boolean | null;
      result_entry_id: string | null;
    }
  | {
      entry_id: string;
      kind: "summary";
      /** `compaction` or pi's `branch_summary`; both are model-written. */
      source: "compaction" | "branch";
      text: string;
      /** A branch summary's abandoned leaf (pi's `fromId`); null for a compaction. */
      from_id: string | null;
    }
  | { entry_id: string; kind: "custom"; custom_type: string; text: string }
) &
  ContextMark;

export type Outcome = {
  /** From the branch's last `engram.outcome` entry; null when it has none. */
  verdict: "success" | "failure" | null;
  reward: number | null;
  /** The `stopReason` of the branch's last assistant message; null when it has none. */
  stop_reason: string | null;
  leaf_id: string | null;
};

/** A branch the session left: negative evidence for induction (ADR 0012). */
export type AbandonedBranch = {
  /** The entry it forked from: on the final branch or on an earlier abandoned branch; null when it has a root of its own. */
  left_at: string | null;
  /** The index in `abandoned` of the branch holding `left_at`; null when it is on the final branch or null. */
  left_from: number | null;
  leaf_id: string;
  /** The `branch_summary` pi wrote when it was left (its `fromId` is this leaf); null when none. */
  summary: string | null;
  outcome: Outcome;
  /** Its own steps after `left_at`, in order; no other branch repeats them. */
  steps: Step[];
};

/** One attempt pi withdrew on the final branch: an omitted generation and the omitted steps after it (its tool results). */
export type OmittedAttempt = {
  /** The entries of the run, in order, tool results included. */
  entry_ids: string[];
  /** The stop reason of the run's last generation (pi omits after `length` or an overflow `error`); null when it has none. */
  stop_reason: string | null;
};

export type Episode = {
  format: typeof EPISODE_FORMAT;
  session_id: string;
  /** From the session's first `engram.task` entry; null when it has none. */
  task_id: string | null;
  /** The header's timestamp, when the session started; null when it has none or it is not an ISO 8601 time. */
  started_at: string | null;
  /** The timestamp of the session's last entry; null when it has none or it is not an ISO 8601 time. */
  ended_at: string | null;
  /** `provider/model` of the final branch's last assistant message; null when it has none. */
  model: string | null;
  /** The final branch's steps, root first. */
  steps: Step[];
  outcome: Outcome;
  /** In file order of their leaves. */
  abandoned: AbandonedBranch[];
  /** Runs of final-branch steps a context edit omitted, in order; negative evidence as abandoned branches are. */
  omitted: OmittedAttempt[];
  /** Whether a model-written summary (a compaction or a branch summary) is anywhere in the episode. */
  summarised: boolean;
  skipped_lines: number;
};

/** The tree of a session: the final branch, and each other leaf's own branch. */
export interface SessionTree {
  /** Entry ids from the root to the final leaf. */
  final: string[];
  /**
   * One per leaf other than the final one, in file order: the entry it forked
   * from (`left_at`), the earlier branch holding that entry (`parent`, an
   * index here; null for the final branch or no entry), and its own entries.
   * A branch whose entries hold no step claims none of them, so a later
   * branch through them takes them.
   */
  branches: { leaf_id: string; left_at: string | null; parent: number | null; segment: string[] }[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The header and entries of a session's JSONL text. */
export function parseSessionJsonl(text: string): ParsedSession {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  const values: unknown[] = [];
  let skipped = 0;
  for (const line of lines) {
    try {
      values.push(JSON.parse(line));
    } catch {
      skipped++;
    }
  }
  const [head, ...rest] = values;
  if (!isObject(head) || head.type !== "session")
    throw new InvalidSessionError("the file has no session header on its first line");
  const version = head.version ?? 1;
  if (typeof version !== "number" || !(version >= SESSION_VERSION))
    throw new InvalidSessionError(
      `the session is version ${String(version)}; this parser reads version ${SESSION_VERSION} and later, which pi migrates a file to when it opens it`,
    );
  if (typeof head.id !== "string" || head.id === "")
    throw new InvalidSessionError("the session header has no id");
  const seen = new Set<string>();
  const entries: SessionEntry[] = [];
  for (const [i, value] of rest.entries()) {
    if (!isObject(value) || typeof value.type !== "string")
      throw new InvalidSessionError(`entry ${i + 1} has no type`);
    if (typeof value.id !== "string" || value.id === "")
      throw new InvalidSessionError(`entry ${i + 1} (${value.type}) has no id`);
    if (seen.has(value.id)) throw new InvalidSessionError(`entry id ${value.id} appears twice`);
    seen.add(value.id);
    const parentId = typeof value.parentId === "string" ? value.parentId : null;
    entries.push({ ...value, parentId, timestamp: String(value.timestamp ?? "") } as SessionEntry);
  }
  return {
    id: head.id,
    timestamp: typeof head.timestamp === "string" ? head.timestamp : "",
    entries,
    skipped_lines: skipped,
  };
}

/** The path from the root to `leaf`, by parentId; a parent that is not in the file ends it. */
function pathTo(leaf: SessionEntry, byId: Map<string, SessionEntry>): SessionEntry[] {
  const path: SessionEntry[] = [];
  const seen = new Set<string>();
  let current: SessionEntry | undefined = leaf;
  while (current) {
    if (seen.has(current.id))
      throw new InvalidSessionError(`entry ${current.id} is its own ancestor`);
    seen.add(current.id);
    path.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path.reverse();
}

const message = (e: SessionEntry): Record<string, unknown> | null =>
  e.type === "message" && isObject(e.message) ? e.message : null;

/** Whether an entry gives at least one step (stepsOf below); the rest are bookkeeping. */
function givesStep(e: SessionEntry): boolean {
  const role = message(e)?.role;
  if (role !== undefined)
    return (
      role === "user" || role === "assistant" || role === "toolResult" || role === "bashExecution"
    );
  return e.type === "compaction" || e.type === "branch_summary" || e.type === "custom_message";
}

/** The final branch and every other leaf's own branch, as pi's SessionManager would see the tree. */
export function sessionTree(session: ParsedSession): SessionTree {
  const byId = new Map(session.entries.map((e) => [e.id, e]));
  const last = session.entries.at(-1);
  if (!last) return { final: [], branches: [] };
  const final = pathTo(last, byId).map((e) => e.id);
  // Which branch holds each claimed entry: -1 for the final branch.
  const owner = new Map<string, number>(final.map((id) => [id, -1]));
  const parents = new Set(session.entries.flatMap((e) => (e.parentId ? [e.parentId] : [])));
  const branches: SessionTree["branches"] = [];
  for (const leaf of session.entries) {
    if (parents.has(leaf.id) || leaf.id === last.id) continue;
    const path = pathTo(leaf, byId);
    let fork = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      if (owner.has((path[i] as SessionEntry).id)) {
        fork = i;
        break;
      }
    }
    const segment = path.slice(fork + 1);
    const leftAt = fork < 0 ? null : (path[fork] as SessionEntry).id;
    const held = leftAt === null ? -1 : (owner.get(leftAt) as number);
    const index = branches.length;
    branches.push({
      leaf_id: leaf.id,
      left_at: leftAt,
      parent: held < 0 ? null : held,
      segment: segment.map((e) => e.id),
    });
    if (segment.some(givesStep)) for (const e of segment) owner.set(e.id, index);
  }
  return { final, branches };
}

/** Text of a message's content: text blocks joined by newlines, an image as `[image]`, thinking dropped. */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!isObject(block)) continue;
    if (block.type === "text" && typeof block.text === "string") parts.push(block.text);
    else if (block.type === "image") parts.push("[image]");
  }
  return parts.join("\n");
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/** A JSON copy of a tool call's arguments; anything that is not JSON becomes null. */
function json(value: unknown): EpisodeJson {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as EpisodeJson;
  } catch {
    return null;
  }
}

/** The latest context edit of each target on a path: null to omit, else the replacing text. */
function editsOn(path: readonly SessionEntry[]): Map<string, string | null> {
  const edits = new Map<string, string | null>();
  for (const e of path) {
    if (e.type !== "context_edit" || typeof e.targetId !== "string") continue;
    edits.set(
      e.targetId,
      isObject(e.replacement) ? textOf((e.replacement as Record<string, unknown>).content) : null,
    );
  }
  return edits;
}

/** The mark an edit of `id` gives a step; `withText` false for a function step under an edited call. */
function markOf(
  edits: Map<string, string | null>,
  id: string | null,
  withText = true,
): ContextMark {
  if (id === null || !edits.has(id)) return {};
  const replacement = edits.get(id);
  if (replacement === null || replacement === undefined) return { context: "omitted" };
  return withText ? { context: "replaced", replacement } : { context: "replaced" };
}

/** The steps of `entries`, a contiguous run of one root-to-leaf path, under that path's edits. */
function stepsOf(entries: readonly SessionEntry[], edits: Map<string, string | null>): Step[] {
  // Each tool call is joined to the first result for its id that follows it
  // on the same run (pi's ToolResultMessage.toolCallId).
  const results = new Map<string, SessionEntry>();
  for (const e of entries) {
    const m = message(e);
    if (m?.role === "toolResult" && typeof m.toolCallId === "string" && !results.has(m.toolCallId))
      results.set(m.toolCallId, e);
  }
  const joined = new Set<string>();
  const steps: Step[] = [];
  for (const e of entries) {
    const m = message(e);
    const mark = markOf(edits, e.id);
    if (m) {
      if (m.role === "user")
        steps.push({ entry_id: e.id, kind: "user", text: textOf(m.content), ...mark });
      else if (m.role === "assistant") {
        const blocks = Array.isArray(m.content) ? m.content.filter(isObject) : [];
        const calls = blocks.filter((b) => b.type === "toolCall");
        steps.push({
          entry_id: e.id,
          kind: "generation",
          text: textOf(m.content),
          model: `${str(m.provider)}/${str(m.model)}`,
          stop_reason: str(m.stopReason),
          tool_calls: calls.length,
          ...mark,
        });
        for (const c of calls) {
          const r = typeof c.id === "string" ? results.get(c.id) : undefined;
          const rm = r ? message(r) : null;
          if (r) joined.add(r.id);
          // An edit of the result marks the step with its text; else an edit of the call marks it.
          const fnMark = r && edits.has(r.id) ? markOf(edits, r.id) : markOf(edits, e.id, false);
          steps.push({
            entry_id: e.id,
            kind: "function",
            caller: "model",
            tool: str(c.name),
            arguments: json(c.arguments),
            result: rm ? textOf(rm.content) : null,
            is_error: rm ? rm.isError === true : null,
            result_entry_id: r ? r.id : null,
            ...fnMark,
          });
        }
      } else if (m.role === "toolResult" && !joined.has(e.id))
        steps.push({
          entry_id: e.id,
          kind: "function",
          caller: "model",
          tool: str(m.toolName),
          arguments: null,
          result: textOf(m.content),
          is_error: m.isError === true,
          result_entry_id: e.id,
          ...mark,
        });
      else if (m.role === "bashExecution")
        steps.push({
          entry_id: e.id,
          kind: "function",
          caller: "user",
          tool: "bash",
          arguments: { command: str(m.command) },
          result: str(m.output),
          is_error: !(m.exitCode === 0 && m.cancelled !== true),
          result_entry_id: e.id,
          ...mark,
        });
      // system messages (prompt and tool loadout) and other roles are not steps.
    } else if (e.type === "compaction" || e.type === "branch_summary")
      steps.push({
        entry_id: e.id,
        kind: "summary",
        source: e.type === "compaction" ? "compaction" : "branch",
        text: str(e.summary),
        from_id: e.type === "branch_summary" ? str(e.fromId) || null : null,
      });
    else if (e.type === "custom_message")
      steps.push({
        entry_id: e.id,
        kind: "custom",
        custom_type: str(e.customType),
        text: textOf(e.content),
        ...mark,
      });
    // model_change, thinking_level_change, usage, custom, label, session_info
    // and context_edit entries are bookkeeping, not steps.
  }
  return steps;
}

/** The attempts context edits withdrew: one per omitted generation with the steps after it, or a run of other omitted steps. */
function omittedRuns(steps: readonly Step[]): OmittedAttempt[] {
  const runs: OmittedAttempt[] = [];
  let current: OmittedAttempt | null = null;
  for (const s of steps) {
    if (s.context !== "omitted") {
      current = null;
      continue;
    }
    // Each omitted generation starts an attempt of its own: pi omits every
    // failed retry separately (agent-session.js `_prepareRetry`), so two
    // omitted generations in a row are two attempts, not one.
    if (current === null || s.kind === "generation") {
      current = { entry_ids: [], stop_reason: null };
      runs.push(current);
    }
    for (const id of [s.entry_id, s.kind === "function" ? s.result_entry_id : null])
      if (id !== null && !current.entry_ids.includes(id)) current.entry_ids.push(id);
    if (s.kind === "generation") current.stop_reason = s.stop_reason;
  }
  return runs;
}

const custom = (e: SessionEntry, type: string): Record<string, unknown> | null =>
  e.type === "custom" && e.customType === type && isObject(e.data) ? e.data : null;

function outcomeOf(entries: readonly SessionEntry[], leafId: string | null): Outcome {
  let verdict: Outcome["verdict"] = null;
  let reward: number | null = null;
  let stop: string | null = null;
  for (const e of entries) {
    const data = custom(e, OUTCOME_ENTRY);
    if (data && (data.verdict === "success" || data.verdict === "failure")) {
      verdict = data.verdict;
      reward = typeof data.reward === "number" && Number.isFinite(data.reward) ? data.reward : null;
    }
    const m = message(e);
    if (m?.role === "assistant") stop = str(m.stopReason);
  }
  return { verdict, reward, stop_reason: stop, leaf_id: leafId };
}

/** pi writes ISO 8601 times (`new Date().toISOString()`); anything else is not kept, so a time field carries nothing else. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const isoTime = (t: string | undefined): string | null =>
  t !== undefined && ISO_TIME.test(t) ? t : null;

/** The episode of a parsed session. */
export function episodeOf(session: ParsedSession): Episode {
  const byId = new Map(session.entries.map((e) => [e.id, e]));
  const at = (ids: readonly string[]) => ids.map((id) => byId.get(id) as SessionEntry);
  const tree = sessionTree(session);
  const final = at(tree.final);
  const steps = stepsOf(final, editsOn(final));
  const summaries = new Map<string, string>();
  for (const e of session.entries)
    if (e.type === "branch_summary" && typeof e.fromId === "string")
      summaries.set(e.fromId, str(e.summary));
  const abandoned: AbandonedBranch[] = [];
  // A tree branch's index to its index in `abandoned`; a branch with no step
  // is dropped, and claims nothing, so no kept branch is left from one.
  const kept = new Map<number, number>();
  for (const [i, b] of tree.branches.entries()) {
    const segment = at(b.segment);
    const leaf = byId.get(b.leaf_id) as SessionEntry;
    const branchSteps = stepsOf(segment, editsOn(pathTo(leaf, byId)));
    if (branchSteps.length === 0) continue;
    kept.set(i, abandoned.length);
    abandoned.push({
      left_at: b.left_at,
      left_from: b.parent === null ? null : (kept.get(b.parent) ?? null),
      leaf_id: b.leaf_id,
      summary: summaries.get(b.leaf_id) ?? null,
      outcome: outcomeOf(segment, b.leaf_id),
      steps: branchSteps,
    });
  }
  let taskId: string | null = null;
  for (const e of session.entries) {
    const data = custom(e, TASK_ENTRY);
    if (data && typeof data.task_id === "string" && data.task_id !== "") {
      taskId = data.task_id;
      break;
    }
  }
  const generations = steps.filter((s) => s.kind === "generation");
  const lastEntry = session.entries.at(-1);
  return {
    format: EPISODE_FORMAT,
    session_id: session.id,
    task_id: taskId,
    started_at: isoTime(session.timestamp),
    ended_at: isoTime(lastEntry?.timestamp),
    model: generations.at(-1)?.model ?? null,
    steps,
    outcome: outcomeOf(final, tree.final.at(-1) ?? null),
    abandoned,
    omitted: omittedRuns(steps),
    summarised:
      [steps, ...abandoned.map((b) => b.steps)].some((run) =>
        run.some((s) => s.kind === "summary"),
      ) || abandoned.some((b) => b.summary !== null),
    skipped_lines: session.skipped_lines,
  };
}

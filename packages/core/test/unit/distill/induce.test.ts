// Card D2: the induction. Sessions are built here in pi's version 3 format,
// as in episode.test.ts; the model is a scripted ModelCall that answers from
// a table keyed on the request's hash and fails loudly on any other request
// (docs/conventions/testing.md, "Models are scripted, not mocked").
import { describe, expect, test } from "vitest";
import {
  AWM_INSTRUCTION,
  AWM_ONE_SHOT,
  AWM_SETTINGS,
  awmRequest,
  CANDIDATE_CONFIDENCE,
  type CandidateFrame,
  createAwmDistiller,
  distillRef,
  formatExample,
  induceAwm,
  induceByRule,
  parseDistillRef,
  parseWorkflows,
  prepareSessions,
} from "../../../src/distill/induce.ts";
import { parseSkillMd, toSkillMd, validateSkillMd } from "../../../src/distill/skill.ts";
import type { Session, SessionEntry } from "../../../src/distill.ts";
import { type ModelCall, type ModelRequest, requestHash } from "../../../src/model.ts";

const T = "2026-11-01T09:00:00.000Z";
const AT = "2026-11-21T12:00:00.000Z";
type Call = { name: string; args: Record<string, unknown>; error?: boolean };
type Round = { text: string; calls: Call[]; stop?: string };

/** Builds one session's entries, each a child of the one before unless told otherwise. */
class Builder {
  entries: SessionEntry[] = [];
  private n = 0;
  private callN = 0;
  constructor(private readonly prefix: string) {}
  private id() {
    this.n++;
    return `${this.prefix}${this.n.toString(16).padStart(8 - this.prefix.length, "0")}`;
  }
  last(): string | null {
    return this.entries.at(-1)?.id ?? null;
  }
  add(type: string, rest: Record<string, unknown>, parentId = this.last()): string {
    const id = this.id();
    this.entries.push({ type, id, parentId, timestamp: T, ...rest });
    return id;
  }
  message(message: Record<string, unknown>, parentId = this.last()) {
    return this.add("message", { message: { timestamp: 1, ...message } }, parentId);
  }
  round(r: Round, parentId = this.last()): string {
    const calls = r.calls.map((c) => ({ ...c, id: `call_${this.prefix}_${++this.callN}` }));
    const turn = this.message(
      {
        role: "assistant",
        content: [
          { type: "text", text: r.text },
          ...calls.map((c) => ({ type: "toolCall", id: c.id, name: c.name, arguments: c.args })),
        ],
        api: "scripted",
        provider: "scripted",
        model: "scripted-1",
        stopReason: r.stop ?? (calls.length > 0 ? "toolUse" : "stop"),
      },
      parentId,
    );
    for (const c of calls)
      this.message({
        role: "toolResult",
        toolCallId: c.id,
        toolName: c.name,
        content: [{ type: "text", text: c.error ? "failed" : "ok" }],
        isError: c.error === true,
      });
    return turn;
  }
}

interface Spec {
  id: string;
  task: string;
  query: string;
  rounds: Round[];
  verdict?: "success" | "failure" | null;
  /** An abandoned branch off the user message, and its summary (null: a plain branch). */
  abandoned?: { rounds: Round[]; summary: string | null };
  /** A withdrawn attempt before the rounds: a length cut, omitted by a context edit. */
  withdrawn?: Round;
}

function session(spec: Spec): Session {
  const b = new Builder(spec.id.slice(0, 2));
  b.add("custom", { customType: "engram.task", data: { task_id: spec.task } }, null);
  const userId = b.message({ role: "user", content: spec.query });
  let from = userId;
  if (spec.abandoned) {
    for (const r of spec.abandoned.rounds) b.round(r);
    const leaf = b.last() as string;
    if (spec.abandoned.summary !== null)
      from = b.add("branch_summary", { fromId: leaf, summary: spec.abandoned.summary }, userId);
  }
  let parent: string | null = from;
  if (spec.withdrawn) {
    const turn = b.round(spec.withdrawn, parent);
    b.add("context_edit", { targetId: turn, replacement: null });
    parent = b.last();
  }
  for (const r of spec.rounds) {
    b.round(r, parent);
    parent = b.last();
  }
  if (spec.verdict !== null)
    b.add("custom", { customType: "engram.outcome", data: { verdict: spec.verdict ?? "success" } });
  return { id: spec.id, task_id: spec.task, entries: b.entries };
}

const read = (path: string): Call => ({ name: "read", args: { path } });
const edit = (path: string): Call => ({ name: "edit", args: { path } });
const bash = (command: string, error = false): Call => ({ name: "bash", args: { command }, error });

const S1 = session({
  id: "s1aaaaaa",
  task: "synthetic/rename-1",
  query: "Rename parseRow to parseRecord.",
  rounds: [
    { text: "Looking at src/load.ts.", calls: [read("src/load.ts")] },
    { text: "Renaming.", calls: [edit("src/load.ts"), bash("grep -rn parseRow", true)] },
    { text: "Checking.", calls: [read("src/load.ts")] },
    { text: "Done.", calls: [] },
  ],
  abandoned: {
    rounds: [
      { text: "Trying sed.", calls: [bash("sed -i s/parseRow/parseRecord/ src/load.ts", true)] },
    ],
    summary: "A sed edit failed; the attempt was abandoned.",
  },
});
const S2 = session({
  id: "s2bbbbbb",
  task: "synthetic/fix-1",
  query: "Fix the type error in report.ts.",
  rounds: [
    { text: "Reading the file.", calls: [read("src/report.ts")] },
    { text: "Fixing.", calls: [edit("src/report.ts")] },
    { text: "Rereading.", calls: [read("src/report.ts")] },
  ],
  withdrawn: { text: "A very long answer", calls: [bash("cat src/report.ts")], stop: "length" },
});
const S3 = session({
  id: "s3cccccc",
  task: "synthetic/docs-1",
  query: "Document the retry option.",
  rounds: [{ text: "Reading.", calls: [read("README.md"), edit("README.md")] }],
});
const FAILED = session({
  id: "s4dddddd",
  task: "synthetic/fix-2",
  query: "Fix it.",
  rounds: [{ text: "Editing.", calls: [edit("src/x.ts")] }],
  verdict: "failure",
});
const UNJUDGED = session({
  id: "s5eeeeee",
  task: "synthetic/fix-3",
  query: "Fix it.",
  rounds: [{ text: "Editing.", calls: [edit("src/x.ts")] }],
  verdict: null,
});
/** A planted key as a tool name, which the scrub cannot rewrite and so holds. */
const HELD = session({
  id: "s6ffffff",
  task: "synthetic/held-1",
  query: "Run it.",
  rounds: [{ text: "Running.", calls: [{ name: "sk-synthetic0planted0for0d2test", args: {} }] }],
});

const frame = (): CandidateFrame => {
  let n = 0;
  return {
    scope: "person:fixture",
    owner: "person:fixture",
    actor: "person:fixture",
    at: AT,
    newId: () => `01960000-0000-7000-8000-${(++n).toString(16).padStart(12, "0")}`,
  };
};
const METHOD = { id: "awm" as const, model: "scripted/induce-1", seed: 7 };

/** A ModelCall answering each request it holds, and failing loudly on any other. */
function scripted(table: [ModelRequest, string][]): ModelCall & { calls: number } {
  const replies = new Map(table.map(([r, text]) => [requestHash(r), text]));
  const fn = (async (request: ModelRequest) => {
    fn.calls++;
    const text = replies.get(requestHash(request));
    if (text === undefined) throw new Error(`scripted: no reply for ${requestHash(request)}`);
    return { text, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  }) as ModelCall & { calls: number };
  fn.calls = 0;
  return fn;
}

const REPLY = `Workflow 1: Inspect, change and recheck a source file
Use when: a task changes one source file.
<think>
I will read {source-file} first.
</think>
<action>
read({"path":"{source-file}"})
</action>

<think>
I will make the change.
</think>
<action>
edit({"path":"{source-file}"})
</action>

<think>
I will read it again to check.
</think>
<action>
read({"path":"{source-file}"})
</action>

Workflow 2: Read a file
Use when: always.
<action>
read({"path":"{file}"})
</action>

Workflow 3: Write a new file
<action>
write({"path":"{file}"})
</action>
<action>
read({"path":"{file}"})
</action>

Workflow 4: Describe the change
<action>
read({"path":"{file}"})
explain the change to the user
</action>

**Workflow 5: Inspect, change and recheck a source file.**
<action>
read({"path":"{a}"})
edit({"path":"{a}"})
</action>`;

describe("prepareSessions", () => {
  test("keeps judged successes as examples and names why the others are not", () => {
    const { examples, skipped } = prepareSessions([S1, FAILED, UNJUDGED, HELD, S2]);
    expect(examples.map((e) => e.session_id)).toEqual(["s1aaaaaa", "s2bbbbbb"]);
    expect(skipped.map((s) => [s.session_id, s.reason.split(":")[0]])).toEqual([
      ["s4dddddd", "verdict failure"],
      ["s5eeeeee", "no verdict"],
      ["s6ffffff", "held"],
    ]);
  });

  test("leaves failed and withdrawn calls out of the trajectory and lists them as negative evidence", () => {
    const [e1, e2] = prepareSessions([S1, S2]).examples;
    expect(e1?.trajectory.map((s) => s.tools)).toEqual([["read"], ["edit"], ["read"]]);
    expect(e1?.negatives).toEqual([
      {
        kind: "abandoned-branch",
        note: "A sed edit failed; the attempt was abandoned.",
        steps: [
          {
            think: "Trying sed.",
            actions: ['bash({"command":"sed -i s/parseRow/parseRecord/ src/load.ts"})'],
            tools: ["bash"],
          },
        ],
      },
    ]);
    expect(e1?.summarised).toBe(true);
    expect(e2?.trajectory.map((s) => s.tools)).toEqual([["read"], ["edit"], ["read"]]);
    expect(e2?.negatives.map((n) => [n.kind, n.note, n.steps[0]?.actions])).toEqual([
      ["withdrawn-attempt", "length", ['bash({"command":"cat src/report.ts"})']],
    ]);
  });
});

describe("the AWM prompt", () => {
  test("is AWM's assembly: instruction, one-shot, the examples between its two headers", () => {
    const { examples } = prepareSessions([S1, S2]);
    const request = awmRequest(examples, METHOD);
    expect(request).toMatchObject({
      model: METHOD.model,
      seed: METHOD.seed,
      temperature: AWM_SETTINGS.temperature,
      maxTokens: AWM_SETTINGS.maxTokens,
    });
    expect(request.system).toBeUndefined();
    expect(request.messages).toHaveLength(1);
    const prompt = request.messages[0]?.content as string;
    expect(prompt).toBe(
      [
        AWM_INSTRUCTION,
        AWM_ONE_SHOT,
        ["## Concrete Examples", ...examples.map(formatExample), "## Summary Workflows"].join(
          "\n\n",
        ),
      ].join("\n\n"),
    );
  });

  test("writes an example's actions, then its abandoned attempts after them", () => {
    const [e1] = prepareSessions([S1]).examples;
    expect(formatExample(e1 as never)).toBe(
      [
        "Query: Rename parseRow to parseRecord.",
        "Actions:",
        '<think>\nLooking at src/load.ts.\n</think>\n<action>\nread({"path":"src/load.ts"})\n</action>',
        "",
        '<think>\nRenaming.\n</think>\n<action>\nedit({"path":"src/load.ts"})\n</action>',
        "",
        '<think>\nChecking.\n</think>\n<action>\nread({"path":"src/load.ts"})\n</action>',
        "Abandoned attempts:",
        "Attempt 1 (an abandoned branch; its summary: A sed edit failed; the attempt was abandoned.):",
        '<think>\nTrying sed.\n</think>\n<action>\nbash({"command":"sed -i s/parseRow/parseRecord/ src/load.ts"})\n</action>',
      ].join("\n"),
    );
  });
});

describe("induceAwm", () => {
  test("makes one seeded call and turns the reply's valid workflows into procedural candidates", async () => {
    const sessions = [S1, S2, FAILED];
    const { examples } = prepareSessions(sessions);
    const call = scripted([[awmRequest(examples, METHOD), REPLY]]);
    const report = await induceAwm(sessions, METHOD, call, frame());
    expect(call.calls).toBe(1);
    expect(report.workflows.map((w) => [w.title, w.status])).toEqual([
      ["Inspect, change and recheck a source file", "candidate"],
      ["Read a file", "rejected"],
      ["Write a new file", "rejected"],
      ["Describe the change", "rejected"],
      ["Inspect, change and recheck a source file.", "rejected"],
    ]);
    const reasons = report.workflows.flatMap((w) => (w.status === "rejected" ? [w.reason] : []));
    expect(reasons[0]).toMatch(/1 actions; a workflow has at least 2/);
    expect(reasons[1]).toMatch(/calls write, which no example's final branch called/);
    expect(reasons[2]).toMatch(/is not a tool call/);
    expect(reasons[3]).toMatch(/taken by an earlier workflow/);

    expect(report.items).toHaveLength(1);
    const item = report.items[0];
    expect(item).toMatchObject({
      id: "01960000-0000-7000-8000-000000000001",
      class: "procedural",
      status: "candidate",
      scope: "person:fixture",
      owner: "person:fixture",
      confidence: CANDIDATE_CONFIDENCE,
      valid_from: AT,
      valid_to: null,
      ttl: null,
      grants: [],
      version: 1,
      lineage: [],
      store_ref: null,
      content: { tools: ["read", "edit"] },
      provenance: {
        // S1 holds a branch summary, so the least trusted source is compaction.
        kind: "compaction",
        ref: "distill:awm:s1aaaaaa,s2bbbbbb",
        actor: "person:fixture",
        model: METHOD.model,
      },
    });
    expect(parseDistillRef(item?.provenance.ref as string)?.sessions).toEqual([
      "s1aaaaaa",
      "s2bbbbbb",
    ]);
  });

  test("writes each candidate as a SKILL.md the specification accepts", async () => {
    const { examples } = prepareSessions([S1, S2]);
    const report = await induceAwm(
      [S1, S2],
      METHOD,
      scripted([[awmRequest(examples, METHOD), REPLY]]),
      frame(),
    );
    for (const item of report.items) {
      const text = toSkillMd(item);
      const skill = parseSkillMd(text);
      expect(validateSkillMd(text, skill.name)).toEqual([]);
      expect(skill.name).toBe("inspect-change-and-recheck-a-source-file");
      expect(skill.description).toBe(
        "Inspect, change and recheck a source file. Use when a task changes one source file.",
      );
      expect(skill.allowedTools).toEqual(["read", "edit"]);
    }
  });

  test("a different seed is a different request, which an unscripted model refuses", async () => {
    const { examples } = prepareSessions([S1]);
    const call = scripted([[awmRequest(examples, METHOD), REPLY]]);
    await expect(induceAwm([S1], { ...METHOD, seed: 8 }, call, frame())).rejects.toThrow(
      /no reply/,
    );
  });

  test("calls no model when no session is an example", async () => {
    const call = scripted([]);
    const report = await induceAwm([FAILED, HELD], METHOD, call, frame());
    expect(call.calls).toBe(0);
    expect(report.items).toEqual([]);
    expect(report.skipped).toHaveLength(2);
  });

  test("the Distiller returns the candidates and refuses another method", async () => {
    const { examples } = prepareSessions([S1]);
    const distiller = createAwmDistiller({
      call: scripted([[awmRequest(examples, METHOD), REPLY]]),
      frame: frame(),
    });
    const items = await distiller.distill([S1], METHOD);
    expect(items.map((i) => i.status)).toEqual(["candidate"]);
    await expect(distiller.distill([S1], { ...METHOD, id: "other" as "awm" })).rejects.toThrow(
      /not awm/,
    );
  });
});

describe("parseWorkflows", () => {
  test("splits on Workflow lines, with or without markdown, and reads Use when", () => {
    const flows = parseWorkflows(REPLY);
    expect(flows.map((w) => w.title)).toEqual([
      "Inspect, change and recheck a source file",
      "Read a file",
      "Write a new file",
      "Describe the change",
      "Inspect, change and recheck a source file.",
    ]);
    expect(flows[0]?.when).toBe("a task changes one source file.");
    expect(flows[0]?.steps.map((s) => s.think)).toEqual([
      "I will read {source-file} first.",
      "I will make the change.",
      "I will read it again to check.",
    ]);
    expect(flows[2]?.when).toBeNull();
  });
});

describe("induceByRule, the control", () => {
  test("takes the run of tool calls most examples share, calling no model", () => {
    const report = induceByRule([S1, S2, S3, FAILED], frame());
    // read,edit is on all three; read,edit,read on two; ties go to support first.
    expect(report.sequence).toEqual({ tools: ["read", "edit"], support: 3 });
    expect(report.items).toHaveLength(1);
    const item = report.items[0];
    expect(item?.content).toMatchObject({ tools: ["read", "edit"] });
    expect(item?.provenance.ref).toBe("distill:rule:s1aaaaaa,s2bbbbbb,s3cccccc");
    expect(item?.provenance.model).toBeUndefined();
    const text = toSkillMd(item as never);
    expect(validateSkillMd(text, parseSkillMd(text).name)).toEqual([]);
    expect(parseSkillMd(text).name).toBe("call-read-then-edit");
  });

  test("prefers the longer run when support ties", () => {
    const report = induceByRule([S1, S2], frame());
    expect(report.sequence).toEqual({ tools: ["read", "edit", "read"], support: 2 });
  });

  test("induces nothing when no run of two calls is shared by two examples", () => {
    const report = induceByRule([S3], frame());
    expect(report.sequence).toBeNull();
    expect(report.items).toEqual([]);
  });
});

describe("distillRef", () => {
  test("round-trips, and parseDistillRef refuses a ref it did not write", () => {
    expect(parseDistillRef(distillRef("rule", ["a", "b"]))).toEqual({
      method: "rule",
      sessions: ["a", "b"],
    });
    expect(parseDistillRef("pi-session:a")).toBeNull();
    expect(() => distillRef("awm", [])).toThrow();
    expect(() => distillRef("awm", ["a,b"])).toThrow();
  });
});

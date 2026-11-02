// Each condition builds the session it should (card RN1): the Engram
// extension is loaded only for C5, the policy text is in the system prompt
// only for C3, and every condition offers the same two memory tools, with the
// same descriptions, parameters and result wording (decision D13).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import { allEvents, loadPreset, migrate, openSqlite, parsePolicy, presetUrl } from "@engram/core";
import { NO_BYPASS_ID } from "@engram/pi-extension";
import { afterEach, describe, expect, test } from "vitest";
import { userBash } from "../src/bash.ts";
import {
  conditionSession,
  metadataInstruction,
  POLICY_LEGEND,
  policyInstruction,
  type ReadMetadata,
} from "../src/conditions.ts";
import { CONDITION_TABLE, type Condition } from "../src/config.ts";
import { personOf, sequentialIds } from "../src/gatemem-probe.ts";
import { scriptedPiModel } from "../src/model/scripted.ts";

const AT = "2026-03-14T11:24:00.000Z";
const SAM = personOf("billing_sam");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function build(
  condition: Condition,
  steps: Parameters<typeof scriptedPiModel>[0] = [],
  metadata?: ReadMetadata,
) {
  const cwd = mkdtempSync(join(tmpdir(), "engram-rn1-test-"));
  dirs.push(cwd);
  const db = openSqlite(":memory:");
  migrate(db);
  const store = { adapter: createFakeAdapter(), scopes: new Set<string>() };
  const scripted = scriptedPiModel(steps);
  const built = await conditionSession({
    condition,
    cwd,
    model: scripted,
    systemPrompt: "You are the benchmark's assistant.",
    actor: SAM,
    preset: "medium",
    policy: loadPreset("medium"),
    store,
    db,
    newId: sequentialIds(),
    now: () => AT,
    ...(metadata === undefined ? {} : { metadata }),
  });
  return { ...built, db, store, scripted };
}

const POLICY_MARK = "<memory-policy>";

describe("condition sessions", () => {
  test.each([
    ["C2", false, false],
    ["C3", false, true],
    ["C5", true, false],
  ] as const)(
    "%s: Engram extension loaded %s, policy text %s",
    async (condition, engram, policy) => {
      const { session } = await build(condition);
      const registered = session.extensionRunner
        .getAllRegisteredTools()
        .map((t) => t.definition.name);
      expect(session.extensionRunner.hasHandlers("tool_call")).toBe(engram);
      expect(registered.includes("memory_explain")).toBe(engram);
      expect(session.systemPrompt.includes(POLICY_MARK)).toBe(policy);
      expect(session.systemPrompt).toContain("You are the benchmark's assistant.");
      expect(session.getActiveToolNames().sort()).toEqual(["memory_read", "memory_write"]);
      session.dispose();
    },
  );

  test("C2, C3 and C5 declare byte-identical tools to the model (decision D13)", async () => {
    const declared: string[] = [];
    for (const condition of ["C2", "C3", "C5"] as const) {
      const { session, scripted } = await build(condition, [{ text: "ok" }]);
      await session.prompt("hello");
      const system = scripted.seen[0]?.messages.find((m) => m.role === "system");
      declared.push(JSON.stringify((system as { toolsAdded?: unknown }).toolsAdded));
      session.dispose();
    }
    expect(
      JSON.parse(declared[0] as string)
        .map((t: { name: string }) => t.name)
        .sort(),
    ).toEqual(["memory_read", "memory_write"]);
    expect(declared[1]).toBe(declared[0]);
    expect(declared[2]).toBe(declared[0]);
  });

  test("an allowed write reads the same in every condition (decision D13)", async () => {
    const texts: string[] = [];
    for (const condition of ["C2", "C3", "C5"] as const) {
      const { session } = await build(condition, [
        {
          toolCall: {
            id: "w1",
            name: "memory_write",
            arguments: { scope: SAM.id, content: "I handle the invoices" },
          },
        },
        { text: "done" },
      ]);
      await session.prompt("remember this");
      const result = session.messages.find((m) => m.role === "toolResult");
      const first = result && "content" in result ? result.content[0] : undefined;
      texts.push(first && "text" in first ? first.text.replace(/\S+(?= in )/, "<id>") : "");
      session.dispose();
    }
    expect(texts).toEqual([
      `stored <id> in ${SAM.id} as active`,
      `stored <id> in ${SAM.id} as active`,
      `stored <id> in ${SAM.id} as active`,
    ]);
  });

  test("a read reaches the model in one tag shape; only C5's carries the read id and rules (ADR 0015)", async () => {
    const shown: string[] = [];
    for (const condition of ["C2", "C3", "C5"] as const) {
      const { session, scripted } = await build(condition, [
        {
          toolCalls: [
            {
              id: "w1",
              name: "memory_write",
              arguments: { scope: SAM.id, content: "I handle the <invoices> & refunds" },
            },
            {
              id: "w2",
              name: "memory_write",
              arguments: { scope: SAM.id, content: "the invoices are due on Fridays" },
            },
          ],
        },
        { toolCall: { id: "r1", name: "memory_read", arguments: { query: "invoices" } } },
        { text: "done" },
      ]);
      await session.prompt("remember, then recall");
      // What the model was sent for the read, after every handler ran.
      const sent = scripted.seen[2]?.messages.find(
        (m) => m.role === "toolResult" && m.toolCallId === "r1",
      );
      const first =
        sent && "content" in sent && Array.isArray(sent.content) ? sent.content[0] : undefined;
      shown.push(first && "text" in first ? first.text : "");
      session.dispose();
    }
    // Item ids are minted from one sequence that C5's plane also draws event
    // ids from, so the same item has another id there; ids are numbered by
    // first appearance, which compares everything else byte for byte.
    const numbered = (text: string) => {
      const ids: string[] = [];
      return text.replaceAll(/ item_id="([^"]*)"/g, (_m, id: string) => {
        if (!ids.includes(id)) ids.push(id);
        return ` item_id="#${ids.indexOf(id) + 1}"`;
      });
    };
    const [c2, c3, c5] = (shown as [string, string, string]).map(numbered) as [
      string,
      string,
      string,
    ];
    expect(c2).toMatch(
      /^<engram:memory filtered="0">\n<engram:item item_id="[^"]+" scope="person:billing_sam" rank="1">\n/,
    );
    expect(c2.match(/<engram:item /g)).toHaveLength(2);
    expect(c2).toContain("I handle the &lt;invoices&gt; &amp; refunds");
    expect(c3).toBe(c2);
    expect(c5).toMatch(/^<engram:memory read_id="[^"]+" policy_id="[^"]+" filtered="0">/);
    expect(c5.match(/ policy_id="/g)).toHaveLength(3);
    expect(c5.replaceAll(/ (?:read_id|policy_id)="[^"]*"/g, "")).toBe(c2);
  });

  test("C3's policy text is the loaded policy's content and the requester's memberships", () => {
    const text = policyInstruction(loadPreset("medium"), "medium", SAM);
    expect(text).toContain('"id": "preset.medium"');
    expect(text).toContain("person:billing_sam");
    // Comments are not policy: none of the preset's comment text reaches the prompt.
    expect(text).not.toContain("Stance:");
    // The units the YAML stated only in comments are one fixed legend line (P6-8).
    expect(text).toContain(POLICY_LEGEND);
    expect(text).toContain("ttl is in seconds");
    expect(text).toContain("between 0 and 1");
    expect(text).toContain("budget is a number of active items");
    expect(text).not.toContain("#");
  });

  test("a preset differing only in comments gives a byte-identical C3 prompt", () => {
    const yaml = readFileSync(presetUrl("medium"), "utf8");
    const recommented = yaml
      .split("\n")
      .map((line) => (line.trimStart().startsWith("#") ? "# a reworded comment" : line))
      .join("\n")
      .concat("\n# a comment added at the end\n");
    expect(recommented).not.toBe(yaml);
    const original = policyInstruction(parsePolicy(yaml, "medium.yaml"), "medium", SAM);
    const edited = policyInstruction(parsePolicy(recommented, "edited.yaml"), "medium", SAM);
    expect(edited).toBe(original);
  });

  test("C3's prompt orders keys stably, so key order in the file does not matter", () => {
    const policy = loadPreset("medium");
    const reordered = Object.fromEntries(Object.entries(policy).reverse()) as typeof policy;
    expect(policyInstruction(reordered, "medium", SAM)).toBe(
      policyInstruction(policy, "medium", SAM),
    );
  });

  test("a change to the policy's content changes C3's prompt", () => {
    const policy = loadPreset("medium");
    expect(policyInstruction({ ...policy, version: policy.version + 1 }, "medium", SAM)).not.toBe(
      policyInstruction(policy, "medium", SAM),
    );
  });

  test("C2's memory_write lands wherever it asks: there is no gate", async () => {
    const { session, store } = await build("C2", [
      {
        toolCall: {
          id: "w1",
          name: "memory_write",
          arguments: { scope: "org", content: "lab values are public" },
        },
      },
      { text: "done" },
    ]);
    await session.prompt("remember this");
    const org = await store.adapter.list("org");
    expect(org.map((i) => i.content)).toEqual(["lab values are public"]);
    session.dispose();
  });

  test("C5's memory_write to org from the model is blocked by the Plane", async () => {
    const { session, store, db } = await build("C5", [
      {
        toolCall: {
          id: "w1",
          name: "memory_write",
          arguments: { scope: "org", content: "lab values are public" },
        },
      },
      { text: "done" },
    ]);
    await session.prompt("remember this");
    expect(await store.adapter.list("org")).toEqual([]);
    expect(allEvents(db).map((e) => [e.op, e.decision])).toEqual([["write", "deny"]]);
    session.dispose();
  });

  test("the runner emits user_bash, so C5 blocks a store command typed by the user", async () => {
    const { session, db } = await build("C5");
    const result = await userBash(session, "mem0 add 'lab values'");
    expect(result.exitCode).toBe(126);
    expect(allEvents(db).map((e) => [e.op, e.policy_id])).toEqual([
      ["bypass_blocked", NO_BYPASS_ID],
    ]);
    session.dispose();
  });
});

describe("C1 and C4 (card X1, ADR 0031)", () => {
  const LEGEND = "- note: a test attribute.";
  const metadata = {
    attributes: (item: { content: unknown }) =>
      [["note", String(item.content).startsWith("I") ? "first" : "second"]] as const,
    legend: LEGEND,
  };

  test("the condition table is the pre-registration's: neighbours differ in one mechanism each", () => {
    expect(CONDITION_TABLE).toEqual({
      C1: { name: "no memory", memory: "context", policyText: false, metadata: false },
      C2: { name: "ungoverned", memory: "store", policyText: false, metadata: false },
      C3: { name: "instruction", memory: "store", policyText: true, metadata: false },
      C4: { name: "instruction with metadata", memory: "store", policyText: true, metadata: true },
      C5: { name: "enforced", memory: "plane", policyText: false, metadata: false },
    });
    const differ = (a: Condition, b: Condition) =>
      (["memory", "policyText", "metadata"] as const).filter(
        (k) => CONDITION_TABLE[a][k] !== CONDITION_TABLE[b][k],
      );
    expect(differ("C1", "C2")).toEqual(["memory"]);
    expect(differ("C2", "C3")).toEqual(["policyText"]);
    expect(differ("C3", "C4")).toEqual(["metadata"]);
  });

  test("C1 offers no tool and states no policy", async () => {
    const { session } = await build("C1");
    expect(session.getActiveToolNames()).toEqual([]);
    expect(session.extensionRunner.hasHandlers("tool_call")).toBe(false);
    expect(session.systemPrompt.includes(POLICY_MARK)).toBe(false);
    expect(session.systemPrompt).toContain("You are the benchmark's assistant.");
    session.dispose();
  });

  test("C4 is C3's session plus the metadata legend; it refuses to run without metadata", async () => {
    await expect(build("C4")).rejects.toThrow(/metadata/);
    const c3 = await build("C3");
    const c4 = await build("C4", [], metadata);
    expect(c4.session.getActiveToolNames().sort()).toEqual(["memory_read", "memory_write"]);
    expect(c4.session.systemPrompt).toContain(POLICY_MARK);
    expect(c4.session.systemPrompt).toContain(metadataInstruction(LEGEND));
    // Each session has its own temporary working directory.
    const noCwd = (s: string) => s.replace(/<cwd>[\s\S]*<\/cwd>/, "<cwd/>");
    expect(noCwd(c4.session.systemPrompt).replace(`\n\n${metadataInstruction(LEGEND)}`, "")).toBe(
      noCwd(c3.session.systemPrompt),
    );
    c3.session.dispose();
    c4.session.dispose();
  });

  test("C4's read is C3's with each item's metadata as attributes", async () => {
    const shown: string[] = [];
    for (const condition of ["C3", "C4"] as const) {
      const { session, scripted } = await build(
        condition,
        [
          {
            toolCalls: [
              {
                id: "w1",
                name: "memory_write",
                arguments: { scope: SAM.id, content: "I handle the invoices" },
              },
              {
                id: "w2",
                name: "memory_write",
                arguments: { scope: SAM.id, content: "the invoices are due on Fridays" },
              },
            ],
          },
          { toolCall: { id: "r1", name: "memory_read", arguments: { query: "invoices" } } },
          { text: "done" },
        ],
        metadata,
      );
      await session.prompt("remember, then recall");
      const sent = scripted.seen[2]?.messages.find(
        (m) => m.role === "toolResult" && m.toolCallId === "r1",
      );
      const first =
        sent && "content" in sent && Array.isArray(sent.content) ? sent.content[0] : undefined;
      shown.push(first && "text" in first ? first.text : "");
      session.dispose();
    }
    const [c3, c4] = shown as [string, string];
    expect(c4).toContain(' rank="1" note="first">');
    expect(c4).toContain(' rank="2" note="second">');
    expect(c4.replaceAll(/ note="[^"]*"/g, "")).toBe(c3);
  });

  test("a read with no query terms returns every item, as the plane's does, even where the store's search returns none", async () => {
    const adapter = createFakeAdapter();
    const empty = { ...adapter, search: async () => [] };
    const store = { adapter: empty, scopes: new Set<string>() };
    const cwd = mkdtempSync(join(tmpdir(), "engram-x1-test-"));
    dirs.push(cwd);
    const db = openSqlite(":memory:");
    migrate(db);
    const scripted = scriptedPiModel([
      {
        toolCall: {
          id: "w1",
          name: "memory_write",
          arguments: { scope: SAM.id, content: "I handle the invoices" },
        },
      },
      { toolCall: { id: "r1", name: "memory_read", arguments: { query: " " } } },
      { text: "done" },
    ]);
    const { session } = await conditionSession({
      condition: "C2",
      cwd,
      model: scripted,
      systemPrompt: "s",
      actor: SAM,
      preset: "medium",
      policy: loadPreset("medium"),
      store,
      db,
      newId: sequentialIds(),
      now: () => AT,
    });
    await session.prompt("go");
    const read = session.messages.find((m) => m.role === "toolResult" && m.toolCallId === "r1");
    expect(JSON.stringify(read)).toContain("I handle the invoices");
    session.dispose();
  });
});

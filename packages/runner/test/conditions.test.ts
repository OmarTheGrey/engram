// Each condition builds the session it should (card RN1): the Engram
// extension is loaded only for C5, the policy text is in the system prompt
// only for C3, and every condition offers the same two memory tools.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import { allEvents, loadPreset, migrate, openSqlite } from "@engram/core";
import { NO_BYPASS_ID } from "@engram/pi-extension";
import { afterEach, describe, expect, test } from "vitest";
import { userBash } from "../src/bash.ts";
import { conditionSession, policyInstruction } from "../src/conditions.ts";
import type { Condition } from "../src/config.ts";
import { personOf, sequentialIds } from "../src/gatemem-probe.ts";
import { scriptedPiModel } from "../src/model/scripted.ts";

const AT = "2026-03-14T11:24:00.000Z";
const SAM = personOf("billing_sam");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function build(condition: Condition, steps: Parameters<typeof scriptedPiModel>[0] = []) {
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

  test("C3's policy text is the preset as written and the requester's memberships", () => {
    const text = policyInstruction("medium", SAM);
    expect(text).toContain("id: preset.medium");
    expect(text).toContain("person:billing_sam");
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

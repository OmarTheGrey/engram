// Finding P4-1 of the PR 4 review, through a pi session: when a write takes a
// utility-budgeted scope over, the item it just stored is not the victim, and
// the memory_write result's text and details.status agree with the Engram
// projection.
import type { ToolCall } from "@earendil-works/pi-ai";
import { currentItems, loadPreset, type Policy } from "@engram/core";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createEngramExtension, type WriteDetails } from "../src/index.ts";
import { AT, freshLog, type HarnessRun, OMAR, startSession, toolResults } from "./harness.ts";

const call = (id: string, name: string, args: ToolCall["arguments"]) => ({
  toolCall: { id, name, arguments: args },
});

function oneSlotUtility(): Policy {
  const medium = loadPreset("medium");
  return {
    ...medium,
    retention: medium.retention.map((r) =>
      r.scope === "person" && r.class === "semantic" ? { ...r, budget: 1, eviction: "utility" } : r,
    ),
  };
}

let run: HarnessRun;
let log: ReturnType<typeof freshLog>;

beforeAll(async () => {
  log = freshLog();
  const ext = createEngramExtension({
    ...log,
    policy: oneSlotUtility(),
    actor: OMAR,
    now: () => AT,
    recall: false,
  });
  run = await startSession(
    ext,
    [
      call("w1", "memory_write", { scope: "person:omar", content: "lunch is at noon" }),
      call("r1", "memory_read", { query: "lunch" }),
      call("w2", "memory_write", { scope: "person:omar", content: "standup is at ten" }),
      { text: "done" },
    ],
    ["memory_write", "memory_read"],
  );
  await run.session.prompt("remember");
});

afterAll(() => run?.session.dispose());

test("the second write stays active, and its result says what the projection holds", () => {
  const result = toolResults(run.sessionManager, "w2")[0];
  const details = result?.details as unknown as WriteDetails;
  const held = currentItems(log.db).find((i) => i.id === details.item_id);
  expect(held?.status).toBe("active");
  expect(details.status).toBe(held?.status);
  const text = JSON.stringify(result?.content);
  expect(text).toContain(`as ${held?.status}`);
  // The read item 1 was the victim.
  const first = toolResults(run.sessionManager, "w1")[0]?.details as unknown as WriteDetails;
  expect(currentItems(log.db).find((i) => i.id === first.item_id)?.status).toBe("retired");
});

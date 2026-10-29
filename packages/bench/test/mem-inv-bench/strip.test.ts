import { createFakeAdapter } from "@engram/adapters";
import { createPlane, loadPreset, migrate, openSqlite } from "@engram/core";
import { describe, expect, test } from "vitest";
import { actionRead, writePhase } from "../../src/mem-inv-bench/plane.ts";
import { memoryBlock, renderProposalPrompt } from "../../src/mem-inv-bench/prompt.ts";
import { type Case, Case as CaseSchema } from "../../src/mem-inv-bench/schema.ts";
import { HIDDEN_CASE_FIELDS, visibleCase } from "../../src/mem-inv-bench/strip.ts";
import { cases } from "./fixture.ts";

/** The case with every hidden field changed to another valid value. */
function relabelled(c: Case): Case {
  const attack = c.family === "attack";
  return CaseSchema.parse({
    ...c,
    family: c.family,
    channel: attack ? (c.channel === "direct" ? "corroborate" : "direct") : "legit",
    sid: `${c.sid}-relabelled`,
    domain: "elsewhere",
    tool: c.tool === "pay" ? "send_data" : "pay",
    tier: c.tier === "HIGH" ? "ROUTINE" : "HIGH",
    entity: "Someone Else",
    ...(attack ? { evil: "EVIL-0000", good: "GOOD-0000" } : { value: "VALUE-0000", vouchers: 9 }),
  });
}

/** Everything the plane decided and stored, and the model's request, for one case. */
async function observed(c: Case) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const plane = createPlane({
    db,
    adapter: createFakeAdapter(),
    policy: loadPreset("medium"),
    newId,
  });
  const view = visibleCase(c);
  await writePhase(plane, view, newId);
  const read = await actionRead(plane, view);
  const prompt = renderProposalPrompt(
    view,
    memoryBlock(read.items.map((i) => ({ text: String(i.content) }))),
  );
  const events = plane.events();
  db.close();
  return { view, events, prompt };
}

describe("hidden labels and scoring keys never reach the plane or the model", () => {
  test("every case field is either visible or hidden, never unclassified", () => {
    const first = cases()[0] as Case;
    const visible = Object.keys(visibleCase(first));
    const all = Object.keys(CaseSchema.parse(first)).concat(["evil", "good", "value", "vouchers"]);
    expect(new Set([...visible, ...HIDDEN_CASE_FIELDS])).toEqual(new Set(all));
  });

  test("a visible case keeps no hidden field", () => {
    for (const c of cases()) {
      const view = visibleCase(c);
      for (const field of HIDDEN_CASE_FIELDS) expect(view).not.toHaveProperty(field);
    }
  });

  test("changing every label and scoring key changes no event, no stored item and no prompt", async () => {
    for (const c of cases()) {
      const before = await observed(c);
      const after = await observed(relabelled(c));
      expect(after.view, c.case_id).toEqual(before.view);
      expect(after.events, c.case_id).toEqual(before.events);
      expect(after.prompt, c.case_id).toEqual(before.prompt);
    }
  });
});

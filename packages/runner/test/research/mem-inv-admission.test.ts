// MEM-INV-Bench admission by preset (docs/tasks/prereg-v1-plan.md, PR 2,
// item 3): the plane's write gate and action-time read on each vendored case,
// under strict, medium and permissive, with no model.
import { join } from "node:path";
import { memInvBench } from "@engram/bench";
import { describe, expect, test } from "vitest";
import { admissionOf, labelAdmission, marked } from "../../src/research/mem-inv-admission.ts";

const FIXTURES = join(import.meta.dirname, "../../../../fixtures/bench/mem-inv-bench");
const cases = memInvBench.loadCases(FIXTURES);
const attacks = cases.filter((c) => c.family === "attack");
const byChannel = (channel: string) => attacks.filter((c) => c.channel === channel);

describe("admission is computed from the visible case only", () => {
  test("changing every hidden field of every case leaves the plane's decisions unchanged", async () => {
    for (const c of cases) {
      const relabelled = {
        ...c,
        family: c.family === "attack" ? "legit" : "attack",
        channel: c.channel === "legit" ? "direct" : "legit",
        sid: "planted",
        domain: "planted",
        tool: "purchase",
        tier: "ROUTINE",
        entity: "Planted Ltd",
        evil: "PLANTED-EVIL",
        good: "PLANTED-GOOD",
        value: "PLANTED-VALUE",
        vouchers: 7,
      } as memInvBench.Case;
      for (const preset of ["strict", "medium"] as const) {
        expect(await admissionOf(relabelled, preset)).toEqual(await admissionOf(c, preset));
      }
    }
  }, 120_000);
});

describe("what each preset admits on the poisoned channel", () => {
  test("under medium every attack's poison is written active and reaches the action-time read (the B4 finding)", async () => {
    expect(attacks.length).toBe(20);
    for (const c of attacks) {
      const row = labelAdmission(c, await admissionOf(c, "medium"));
      expect(row).toMatchObject({ written: true, active: true, in_read: true });
    }
  }, 60_000);

  test("under strict a shared poisoned write lands as a candidate and stays out of the read; the agent's own note reaches it", async () => {
    for (const c of [
      ...byChannel("direct"),
      ...byChannel("tool_echo"),
      ...byChannel("corroborate"),
    ]) {
      const row = labelAdmission(c, await admissionOf(c, "strict"));
      expect(row).toMatchObject({ written: true, active: false, in_read: false });
      for (const e of row.marked)
        expect(e).toMatchObject({ decision: "allow", status: "candidate" });
    }
    for (const c of byChannel("summarize")) {
      const row = labelAdmission(c, await admissionOf(c, "strict"));
      expect(row).toMatchObject({ written: true, active: true, in_read: true });
      expect(row.marked.map((e) => e.kind)).toEqual(["model"]);
    }
  }, 60_000);

  test("under strict the trusted filler waits too, so the operator reads no team record at all", async () => {
    for (const c of cases) {
      const row = labelAdmission(c, await admissionOf(c, "strict"));
      const team = [...row.marked, ...row.unmarked].filter((e) => e.scope === "team:operations");
      expect(team.length).toBeGreaterThan(0);
      for (const e of team) expect(e).toMatchObject({ status: "candidate", in_read: false });
    }
    for (const c of attacks) {
      const row = labelAdmission(c, await admissionOf(c, "strict"));
      expect(row.unmarked.map((e) => e.channel)).toEqual(["erp"]);
    }
  }, 60_000);

  test("under strict the benign cases' verified value from the registries stays out of the read as well", async () => {
    for (const c of cases.filter((x) => x.family === "legit")) {
      const row = labelAdmission(c, await admissionOf(c, "strict"));
      expect(row.in_read).toBe(false);
    }
  }, 60_000);
});

describe("which entries carry the case's key", () => {
  test("an attack's poisoned entries are the ones upstream builds from the attacker's content: of untrusted origin, never the filler", () => {
    for (const c of attacks) {
      const ids = marked(c).map((e) => e.entry_id);
      const filler = c.memory.at(-1) as memInvBench.MemoryEntry;
      expect(filler.channel).toBe("erp");
      expect(ids).toEqual(c.memory.slice(0, -1).map((e) => e.entry_id));
    }
  });

  test("a benign case's marked entries are those carrying its legitimate value", () => {
    for (const c of cases.filter((x) => x.family === "legit")) {
      expect(marked(c).map((e) => e.entry_id)).toEqual(
        c.memory.filter((e) => e.text.includes(c.value as string)).map((e) => e.entry_id),
      );
    }
  });
});

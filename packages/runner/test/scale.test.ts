// Card RV1, RV-EXP-2: H1's GateMem results at the full set's size. The
// review estimated 26,616 rows at the full set's means (146.8 plane writes
// per C5 checkpoint at about 374 characters an event, about 68 items shown
// per C4 checkpoint) at 539,938,830 characters, past V8's string limit, so
// building results.jsonl as one string threw after every call was paid
// for. Here the same number of rows at those sizes goes through the run's
// journal a line at a time and is read back a line at a time, as `make
// h1-table` reads it, into H1 sessions.
//
// It writes about half a gigabyte, so it is slow by design and runs only
// with ENGRAM_SCALE=1: `make test-scale`.
import { constants } from "node:buffer";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryCache } from "@engram/model";
import { describe, expect, test } from "vitest";
import { type Condition, readRunnerConfig } from "../src/config.ts";
import type { LoggedEvent, ProbeResult } from "../src/gatemem-probe.ts";
import { forEachJsonl, RunJournal } from "../src/journal.ts";
import { gatememRow, readJsonl } from "../src/research/h1-rows.ts";
import { gatememSessions } from "../src/research/h1-sessions.ts";
import { EVENTS_FILE, runConfig, splitRow } from "../src/run.ts";
import { EXAMPLE } from "./paths.ts";

/** The review's figures (RV-EXP-2). */
const ROWS = 26_616;
const TOTAL_CHARS = 539_938_830;
const C5_EVENTS = 147;
const EVENT_CHARS = 374;
const C4_ITEMS = 68;
const CONDITIONS: Condition[] = ["C1", "C2", "C3", "C4", "C5"];

describe.runIf(process.env.ENGRAM_SCALE === "1")(
  "H1's GateMem results at full size (RV-EXP-2)",
  () => {
    test("26,616 rows at the full set's mean sizes are written a line at a time and read back into H1 sessions", async () => {
      // Real rows of the scripted fixture, as templates for every condition.
      const real = await runConfig(readRunnerConfig(EXAMPLE), {
        cache: memoryCache(),
        offline: false,
      });
      const template = (c: Condition): ProbeResult => {
        const r = real.rows.find((x) => x.condition === (c === "C5" ? "C5" : "C2")) as ProbeResult;
        return structuredClone({ ...r, condition: c, store: c === "C1" ? "none" : r.store });
      };
      const event = (seq: number): LoggedEvent => {
        const base: LoggedEvent = {
          seq,
          op: "write",
          decision: "allow",
          policy_id: "preset.medium/write/person",
          actor: "person:p_0001",
          item_id: `01920000-0000-7000-8000-${String(seq).padStart(12, "0")}`,
          scope_to: "person:p_0001",
          reason: "",
        };
        const pad = EVENT_CHARS - JSON.stringify(base).length;
        return { ...base, reason: "r".repeat(Math.max(0, pad)) };
      };
      const shaped = (c: Condition, i: number, pad: string): ProbeResult => {
        const row = template(c);
        row.item = `gatemem/synthetic-${i}`;
        row.checkpoint_id = `synthetic-${i}`;
        if (c === "C5") row.events = Array.from({ length: C5_EVENTS }, (_, k) => event(k + 1));
        if (c === "C4") {
          row.output.retrieved_memory = Array.from({ length: C4_ITEMS }, (_, k) => ({
            text: `item ${k}: ${"m".repeat(120)}`,
          }));
        }
        row.output.prompt_memory_block = pad;
        return row;
      };
      // The padding that brings the rows to the review's total.
      const base = CONDITIONS.map((c) => JSON.stringify(shaped(c, 0, "")).length + 1);
      const perCycle = base.reduce((a, b) => a + b, 0);
      const baseTotal = Array.from({ length: ROWS }, (_, i) => base[i % 5] as number).reduce(
        (a, b) => a + b,
        0,
      );
      expect(perCycle).toBeGreaterThan(0);
      const pad = "p".repeat(Math.ceil((TOTAL_CHARS - baseTotal) / ROWS));

      const dir = mkdtempSync(join(tmpdir(), "engram-rv1-scale-"));
      try {
        const journal = RunJournal.open(dir, {
          identity: { config: "h1-scale", fingerprint: "synthetic" },
          resume: false,
          sidecar: EVENTS_FILE,
        });
        let chars = 0;
        for (let i = 0; i < ROWS; i++) {
          const row = shaped(CONDITIONS[i % 5] as Condition, i, pad);
          chars += JSON.stringify(row).length + 1;
          const parts = splitRow(row);
          journal.append(row, parts.row, parts.sidecar);
        }
        journal.close();
        // As one string, these rows would not fit: the old writer threw here.
        expect(chars).toBeGreaterThanOrEqual(TOTAL_CHARS);
        expect(chars).toBeGreaterThan(constants.MAX_STRING_LENGTH);
        const bytes =
          statSync(join(dir, "results.jsonl")).size + statSync(join(dir, EVENTS_FILE)).size;
        expect(bytes).toBeGreaterThan(constants.MAX_STRING_LENGTH);

        // Read back with h1-sessions.ts's own reader and row cut.
        const rows = readJsonl<ProbeResult>(join(dir, "results.jsonl"), gatememRow);
        expect(rows).toHaveLength(ROWS);
        let events = 0;
        forEachJsonl<{ events: unknown[] }>(join(dir, EVENTS_FILE), (e) => {
          events += e.events.length;
        });
        expect(events).toBe(Math.ceil((ROWS - 4) / 5) * C5_EVENTS);
        const resumed = RunJournal.open(dir, {
          identity: { config: "h1-scale", fingerprint: "synthetic" },
          resume: true,
          sidecar: EVENTS_FILE,
        });
        expect(resumed.resumed).toBe(ROWS);
        resumed.close();
        const conversion = gatememSessions(rows, {
          model: "prereg/M1",
          preset: "medium",
          gateByAction: false,
        });
        expect(
          conversion.sessions.length + Object.values(conversion.skipped).reduce((a, b) => a + b, 0),
        ).toBe(ROWS);

        // One file above the limit (review RV1-5): the same rows with their
        // plane logs left in, as a run without the sidecar would write them,
        // so a reader that took the file as one string would throw here.
        const whole = join(dir, "whole");
        const single = RunJournal.open(whole, {
          identity: { config: "h1-scale", fingerprint: "synthetic" },
          resume: false,
        });
        for (let i = 0; i < ROWS; i++) {
          const row = shaped(CONDITIONS[i % 5] as Condition, i, pad);
          single.append(row, row);
        }
        single.close();
        const file = join(whole, "results.jsonl");
        expect(statSync(file).size).toBeGreaterThan(constants.MAX_STRING_LENGTH);
        expect(() => readFileSync(file, "utf8")).toThrow();
        const back = readJsonl<ProbeResult>(file, gatememRow);
        expect(back).toHaveLength(ROWS);
        expect(back.every((r) => r.events === undefined)).toBe(true);
        expect(back).toEqual(rows);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 900_000);
  },
);

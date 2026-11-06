// Two facts about the dates of LongMemEval's pinned release (card B5), read
// from the full oracle file, that bear on running it through the plane:
//   1. how many questions date a history session after the question itself
//      (the plane reads after the last turn, plane.ts readTime);
//   2. how many have a session older, at that read, than the episodic ttl of
//      a preset's person-scope retention rule (C5 excludes those turns at read).
// Data facts, not results; no model is called.
//
//   node packages/bench/scripts/longmemeval-date-facts.ts [--data .engram/upstream/longmemeval/data/longmemeval_oracle.json] [--preset medium]
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadPreset, type PresetName } from "@engram/core";
import { longMemEvalTime } from "../src/longmemeval/plane.ts";
import type { Question } from "../src/longmemeval/schema.ts";

function main(): number {
  const { values } = parseArgs({
    options: {
      data: {
        type: "string",
        default: ".engram/upstream/longmemeval/data/longmemeval_oracle.json",
      },
      preset: { type: "string", default: "medium" },
    },
  });
  const all = JSON.parse(readFileSync(values.data as string, "utf8")) as Question[];
  const policy = loadPreset(values.preset as PresetName);
  const rule = policy.retention.find((r) => r.scope === "person" && r.class === "episodic");
  const ttl = rule?.ttl ?? null;
  const t = (d: string) => Date.parse(longMemEvalTime(d));
  const late: Record<string, number> = {};
  const old: Record<string, number> = {};
  let lateN = 0;
  let oldN = 0;
  let maxGap = 0;
  for (const q of all) {
    const asked = t(q.question_date);
    const sessions = q.haystack_dates.map(t);
    const after = sessions.filter((s) => s > asked);
    if (after.length > 0) {
      lateN++;
      late[q.question_type] = (late[q.question_type] ?? 0) + 1;
      maxGap = Math.max(maxGap, ...after.map((s) => s - asked));
    }
    const read = Math.max(asked, ...sessions);
    if (ttl !== null && sessions.some((s) => read - s >= ttl * 1000)) {
      oldN++;
      old[q.question_type] = (old[q.question_type] ?? 0) + 1;
    }
  }
  console.log(
    JSON.stringify(
      {
        questions: all.length,
        session_after_question: { count: lateN, by_type: late, max_gap_hours: maxGap / 3_600_000 },
        preset: values.preset,
        person_episodic_ttl_seconds: ttl,
        session_past_ttl_at_read: { count: oldN, by_type: old },
      },
      null,
      2,
    ),
  );
  return 0;
}

process.exitCode = main();

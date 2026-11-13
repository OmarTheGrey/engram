// Card E8.9's acceptance: the fixture workload under two presets prints a
// comparison. `engram simulate --workload <file> --policy <baseline>
// --candidate <policy>` makes one client call, prints the decisions, the
// utility proxy and the evictions of both policies and the steps that
// differ, and opens no log of its own.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cli, REPO, tempDir } from "./helpers.ts";

const WORKLOAD = join(REPO, "fixtures/workloads/e8-9-two-presets.json");

describe("acceptance (card E8.9): engram simulate on the fixture workload under two presets", () => {
  it("prints the comparison of medium and strict", async () => {
    const home = await tempDir();
    const r = await cli(
      ["simulate", "--workload", WORKLOAD, "--policy", "medium", "--candidate", "strict"],
      { home },
    );
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    const lines = r.out.split("\n");
    expect(lines.slice(0, 2)).toEqual([
      "workload e8-9-two-presets: 10 steps, 0 model calls",
      "baseline preset.medium v1, candidate preset.strict v1",
    ]);
    const row = (name: string) =>
      lines
        .find((l) => l.startsWith(`${name}  `))
        ?.slice(name.length)
        .trim()
        .split(/\s+/);
    expect(row("deny")).toEqual(["0", "3"]);
    expect(row("items returned")).toEqual(["5", "1"]);
    expect(row("reads with recall")).toEqual(["2", "1"]);
    expect(row("expired by ttl")).toEqual(["0", "1"]);
    expect(row("evicted over budget")).toEqual(["0", "0"]);
    expect(lines).toContain("6 steps differ");
    expect(r.out).toContain(
      "step 1 write person:dana 01950000-0000-7000-8000-000000000002: allow -> deny",
    );
    expect(r.out).toContain("step 6 read person:sam: returned 2 -> returned 0");
    // The replay ran on scratch logs: no log was created in the home.
    expect(await readdir(home)).toEqual([]);
  });

  it("prints the report as JSON with --json", async () => {
    const r = await cli([
      "simulate",
      "--workload",
      WORKLOAD,
      "--candidate",
      "permissive",
      "--json",
    ]);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.out);
    expect(report.baseline.policy_id).toBe("preset.medium");
    expect(report.candidate.policy_id).toBe("preset.permissive");
    expect(report.model_calls).toBe(0);
  });

  it("refuses a --candidate that is neither a preset nor a file, naming the flag", async () => {
    const r = await cli(["simulate", "--workload", WORKLOAD, "--candidate", "nope"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--candidate nope is neither a preset");
  });
});

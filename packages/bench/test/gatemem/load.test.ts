import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadDomain } from "../../src/gatemem/load.ts";
import { QUERY_PROMPT_TEMPLATE } from "../../src/gatemem/prompt.ts";
import { FIXTURES, fixture, type Manifest, readJson } from "./fixture.ts";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

describe("GateMem loader on the vendored fixture", () => {
  test("parses four domains, one episode each, twenty checkpoints across the three query types", () => {
    const domains = fixture();
    expect(domains.map((d) => d.domain)).toEqual(["education", "household", "medical", "office"]);
    expect(domains.map((d) => d.episodes.length)).toEqual([1, 1, 1, 1]);
    const checkpoints = domains.flatMap((d) => d.checkpoints);
    expect(checkpoints).toHaveLength(20);
    const types = checkpoints.map((c) => c.query_type);
    expect(new Set(types)).toEqual(new Set(["utility", "privacy", "safety"]));
    const actions = new Set(checkpoints.map((c) => c.expected_action));
    expect(actions).toEqual(new Set(["answer", "answer_redacted", "refuse", "no_memory"]));
  });

  test("every vendored line is byte-identical to the upstream line the manifest hashes", () => {
    const manifest = readJson<Manifest>("manifest.json");
    expect(manifest.source.commit).toBe("a983828b3bb7565e16e25ac8cdc2fc1982633b0b");
    for (const s of manifest.selection) {
      const lines = (name: string) =>
        readFileSync(join(FIXTURES, s.domain, name), "utf8")
          .split("\n")
          .filter(Boolean);
      expect(lines("episodes.jsonl").map(sha256)).toEqual([s.episode_line_sha256]);
      expect(lines("checkpoints.jsonl").map(sha256)).toEqual(
        s.checkpoints.map((c) => c.line_sha256),
      );
    }
  });

  test("the vendored query prompt is the upstream file at the pinned commit", () => {
    const manifest = readJson<Manifest>("manifest.json");
    expect(sha256(QUERY_PROMPT_TEMPLATE)).toBe(
      manifest.upstream_sha256["bench/prompts/query_prompt.txt"],
    );
  });

  test("rejects a checkpoint with a field the port does not know", () => {
    const dir = mkdtempSync(join(tmpdir(), "gatemem-load-"));
    const domain = fixture()[2];
    if (!domain) throw new Error("fixture lacks a third domain");
    writeFileSync(join(dir, "episodes.jsonl"), `${JSON.stringify(domain.episodes[0])}\n`);
    const extra = { ...domain.checkpoints[0], gold_answer_v3: "unknown label" };
    writeFileSync(join(dir, "checkpoints.jsonl"), `${JSON.stringify(extra)}\n`);
    expect(() => loadDomain(dir)).toThrow(/gold_answer_v3/);
  });

  test("rejects a checkpoint whose as-of turn is not in its episode", () => {
    const dir = mkdtempSync(join(tmpdir(), "gatemem-load-"));
    const domain = fixture()[0];
    if (!domain) throw new Error("fixture lacks a domain");
    writeFileSync(join(dir, "episodes.jsonl"), `${JSON.stringify(domain.episodes[0])}\n`);
    const bad = { ...domain.checkpoints[0], as_of_turn_id: "t999" };
    writeFileSync(join(dir, "checkpoints.jsonl"), `${JSON.stringify(bad)}\n`);
    expect(() => loadDomain(dir)).toThrow(/unknown turn t999/);
  });
});

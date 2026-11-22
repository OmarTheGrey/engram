// No policy in the TUI (card E8.15c, docs/design/tui.md 4.8, 6.3, 10.1 and
// 13; AGENTS.md rule 1). No file under packages/cli/src/tui names a policy
// rule id, a preset or remedy text, and none reads a reason or a policy id to
// decide anything: every decision on screen is the field the answer carried.
// The forbidden lists come from core itself: its preset names (PRESETS and
// EXTRA_PRESETS) and every rule id its source writes (`engram/<area>/<rule>`),
// with the `preset.` prefix every preset's policy id starts with.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { EXTRA_PRESETS, PRESETS } from "@engram/core";
import { describe, expect, it } from "vitest";
import { REPO } from "../helpers.ts";

const TUI = join(REPO, "packages", "cli", "src", "tui");
const CORE = join(REPO, "packages", "core", "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

const sources = files(TUI).map((p) => ({
  path: relative(REPO, p).split("\\").join("/"),
  text: readFileSync(p, "utf8"),
}));

/** Every rule id core's source writes, `engram/write/membership` and the rest. */
const RULE_IDS = [
  ...new Set(
    files(CORE).flatMap((p) =>
      [...readFileSync(p, "utf8").matchAll(/engram\/[a-z-]+\/[a-z-]+/g)].map((m) => m[0]),
    ),
  ),
].sort();
/** The areas those ids are in: `engram/write/`, `engram/promote/` and the rest. */
const RULE_AREAS = [...new Set(RULE_IDS.map((id) => `${id.split("/").slice(0, 2).join("/")}/`))];

/** Advice a screen must never give from a reason or a rule id (docs/design/tui.md 10.1). */
const REMEDIES = [
  "use this class",
  "ask this person",
  "try semantic",
  "try episodic",
  "you should",
  "instead, use",
  "choose semantic",
  "a reviewer could approve",
];

describe("no policy in the TUI's source", () => {
  it("reads its forbidden lists from core, and they are not empty", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(RULE_IDS.length).toBeGreaterThan(30);
    expect(RULE_AREAS).toEqual(expect.arrayContaining(["engram/write/", "engram/promote/"]));
    expect(sources.length).toBeGreaterThan(20);
  });

  it("names no rule id, no rule area and no preset's policy id", () => {
    for (const { path, text } of sources) {
      for (const area of RULE_AREAS) expect(text.includes(area), `${path}: ${area}`).toBe(false);
      expect(/\bpreset\.[a-z]/.test(text), `${path}: preset.`).toBe(false);
    }
  });

  it("names no preset", () => {
    for (const { path, text } of sources)
      for (const name of [...PRESETS, ...EXTRA_PRESETS])
        expect(new RegExp(`\\b${name}\\b`, "i").test(text), `${path}: ${name}`).toBe(false);
  });

  it("holds no remedy text", () => {
    for (const { path, text } of sources)
      for (const r of REMEDIES) expect(text.toLowerCase().includes(r), `${path}: ${r}`).toBe(false);
  });

  it("never branches on a reason or a policy id", () => {
    // A reason or policy id compared, matched, searched or switched on is a decision derived from it.
    const field = String.raw`\.(reason|policy_id|policyId|admittedBy)`;
    const deciding = [
      new RegExp(`${field}\\s*(===|!==|==|!=)`),
      new RegExp(`(===|!==|==|!=)\\s*[\\w.?]*${field}\\b`),
      new RegExp(
        `${field}(\\?)?\\.(startsWith|endsWith|includes|match|matchAll|search|indexOf)\\(`,
      ),
      new RegExp(`\\.test\\([\\w.?]*${field}\\)`),
      new RegExp(`switch\\s*\\([^)]*${field}`),
    ];
    for (const { path, text } of sources)
      for (const [i, line] of text.split("\n").entries())
        for (const re of deciding)
          expect(re.test(line), `${path}:${i + 1}: ${line.trim()}`).toBe(false);
  });

  it("catches a rule id or a branch on a reason were one added (the checks are not vacuous)", () => {
    const probe =
      'if (e.reason.includes("forbidden")) say("change Class"); const id = "engram/write/membership";';
    expect(RULE_AREAS.some((a) => probe.includes(a))).toBe(true);
    expect(/\.(reason|policy_id)(\?)?\.(includes)\(/.test(probe)).toBe(true);
  });
});

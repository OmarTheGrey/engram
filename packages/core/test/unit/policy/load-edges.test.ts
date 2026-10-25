// Edge cases of the YAML-to-node mapping in parsePolicy (card E2.1): every
// problem still names the line it comes from when the document uses an alias,
// leaves a value empty, is empty itself, or has a complex key.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { PolicyError, type PolicyProblem, parsePolicy } from "../../../src/policy/load.ts";

const VALID =
  readFileSync(new URL("./load.test.ts", import.meta.url), "utf8")
    .split("const VALID = `")[1]
    ?.split("`;")[0] ?? "";

function problemsOf(text: string): PolicyProblem[] {
  try {
    parsePolicy(text, "test.yaml");
  } catch (e) {
    expect(e).toBeInstanceOf(PolicyError);
    return (e as PolicyError).problems;
  }
  throw new Error("expected the policy to be rejected");
}

const lineOf = (text: string, needle: string) =>
  text.split("\n").findIndex((l) => l.includes(needle)) + 1;

describe("parsePolicy positions", () => {
  test("a key with no value is reported on its own line", () => {
    const text = VALID.replace("version: 1", "version:");
    const [p] = problemsOf(text);
    expect(p).toMatchObject({ path: ["version"], line: lineOf(text, "version:") });
  });

  test("an empty document is reported at line 1", () => {
    expect(problemsOf("")).toEqual([expect.objectContaining({ path: [], line: 1, col: 1 })]);
  });

  test("a problem reached through an alias is reported where the anchored node is", () => {
    const text = VALID.replace(
      "  episodic_to_semantic:\n",
      "  episodic_to_semantic: &e2s\n",
    ).replace("  procedural:\n    replay_k: 4\n    replay_n: 5\n", "  procedural: *e2s\n");
    const fromAlias = problemsOf(text).filter((p) => p.path.join(".") === "promotion.procedural");
    expect(fromAlias.map((p) => p.line)).toEqual([
      lineOf(text, "confirmations: 3"),
      lineOf(text, "or_review: true"),
    ]);
  });

  test("an unknown complex key is reported on its own line", () => {
    const text = `${VALID}? [a, b]\n: 1\n`;
    const [p] = problemsOf(text);
    expect(p).toMatchObject({
      message: expect.stringMatching(/unknown field/),
      line: lineOf(text, "? [a, b]"),
    });
  });
});

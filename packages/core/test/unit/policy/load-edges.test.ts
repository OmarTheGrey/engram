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

  test("a second document is reported at its document marker", () => {
    const text = `${VALID}---\n${VALID}`;
    const [p, ...rest] = problemsOf(text);
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: [], line: lineOf(text, "---"), col: 1 });
    expect(p?.message).toMatch(/multiple documents/);
  });

  test("an unterminated quote is reported where the parser notices it, the end of input", () => {
    // A known limit (docs/log/2026-10-25-e2-1-unterminated-quote-line.md): yaml
    // finds a missing closing quote only at the end, so the line is the last
    // one, after the final newline; the message names the missing quote.
    const text = VALID.replace("id: test-policy", 'id: "test-policy');
    const [p] = problemsOf(text);
    expect(p).toMatchObject({ path: [], line: text.split("\n").length, col: 1 });
    expect(p?.message).toMatch(/Missing closing "quote/);
  });

  test("an unresolved tag is reported as a problem at its line, not dropped", () => {
    const text = VALID.replace("version: 1", "version: !foo 1");
    const problems = problemsOf(text);
    expect(problems).toEqual([
      expect.objectContaining({ path: [], line: 2, col: 10, message: "Unresolved tag: !foo" }),
    ]);
  });

  test("too many aliases is a PolicyError at the first alias, not a raw ReferenceError", () => {
    let laughs = "a0: &a0 [lol, lol, lol, lol, lol, lol, lol, lol, lol, lol]\n";
    for (let i = 1; i < 6; i++)
      laughs += `a${i}: &a${i} [${Array(10)
        .fill(`*a${i - 1}`)
        .join(", ")}]\n`;
    const text = `${VALID}${laughs}`;
    const [p, ...rest] = problemsOf(text);
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ path: [], line: lineOf(text, "a1: &a1"), col: 10 });
    expect(p?.message).toMatch(/alias/i);
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

// Documents whose YAML nodes and JSON values differ in shape: an explicit key
// with no value, a null key, and YAML 1.1 tags whose values are objects
// (Buffer, Date) although their nodes are scalars. The problem must still name
// the nearest line; a tagged scalar starts at its value, after the tag.
describe("parsePolicy positions when the YAML node and the value differ in shape", () => {
  test("an explicit key with no value is reported at the key", () => {
    const text = VALID.replace("version: 1", "? version");
    const [p] = problemsOf(text);
    expect(p).toMatchObject({ path: ["version"], line: lineOf(text, "? version"), col: 3 });
  });

  test("a null threshold key is reported at the thresholds mapping", () => {
    const text = VALID.replace("  thresholds: {}", "  thresholds:\n    ~: 1");
    const [p, ...rest] = problemsOf(text);
    expect(rest).toEqual([]);
    expect(p).toMatchObject({
      path: ["lints", "thresholds"],
      message: expect.stringMatching(/^unknown threshold key ""/),
      line: lineOf(text, "~: 1"),
      col: 5,
    });
  });

  test("a binary scalar where a mapping belongs is reported at the scalar, field by field", () => {
    const text = `%YAML 1.1\n---\n${VALID.replace(
      "lints:\n  enabled: [expired-validity]\n  thresholds: {}\n",
      "lints: !!binary aGk=\n",
    )}`;
    const lints = problemsOf(text).filter((p) => p.path[0] === "lints");
    // The bytes of "hi" are the indexed keys "0" and "1" of a Buffer.
    expect(lints.map((p) => p.message)).toEqual(
      expect.arrayContaining(['unknown field "0"', 'unknown field "1"']),
    );
    for (const p of lints) expect(p).toMatchObject({ line: lineOf(text, "lints:"), col: 17 });
  });

  test("a timestamp scalar where a mapping belongs reports its missing fields at the scalar", () => {
    const text = `%YAML 1.1\n---\n${VALID.replace(
      "promotion:\n  episodic_to_semantic:\n    confirmations: 3\n    or_review: true\n  procedural:\n    replay_k: 4\n    replay_n: 5\n",
      "promotion: !!timestamp 2001-01-01\n",
    )}`;
    const promotion = problemsOf(text).filter((p) => p.path[0] === "promotion");
    expect(promotion.map((p) => p.message).sort()).toEqual([
      'missing required field "episodic_to_semantic"',
      'missing required field "procedural"',
    ]);
    for (const p of promotion)
      expect(p).toMatchObject({ line: lineOf(text, "promotion:"), col: 24 });
  });
});

describe("problems come out in document order, whatever order they are found in", () => {
  test("schema problems: the schema checks version before schema_version", () => {
    const text = `schema_version: 1\n${VALID.replace("version: 1", "version: 0").replace("schema_version: 0\n", "")}`;
    expect(problemsOf(text).map((p) => p.path.join("."))).toEqual(["schema_version", "version"]);
  });

  test("checks after the schema: replay_k is checked after the write rules", () => {
    const lines = VALID.split("\n");
    const promotion = lines.splice(25, 7); // lines 26 to 32, the promotion block
    lines.splice(2, 0, ...promotion); // now right after version
    lines.splice(15, 0, lines[15] ?? ""); // repeat the role write rule
    const text = lines.join("\n").replace("replay_k: 4", "replay_k: 6");
    expect(problemsOf(text).map((p) => p.path.join("."))).toEqual([
      "promotion.procedural.replay_k",
      "write.2.scope",
    ]);
  });
});

// Codex's PreToolUse hook schemas (card E8.17), copied unmodified from
// openai/codex at ebd0765aafa2 (codex-rs/hooks/schema/generated/; Apache-2.0,
// NOTICE kept) into fixtures/harness/codex/schema/, compiled with ajv
// (draft-07, strict), and the recorded inputs beside them. Shared by the
// unit tests here, the CLI's and layer 6's Codex case.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";

export const CODEX_FIXTURE = resolve(
  fileURLToPath(import.meta.url),
  "../../../../fixtures/harness/codex",
);
const schema = (name: string) =>
  JSON.parse(readFileSync(join(CODEX_FIXTURE, "schema", name), "utf8")) as object;

const ajv = new Ajv({ strict: false, allErrors: true });
const input = ajv.compile(schema("pre-tool-use.command.input.schema.json"));
const output = ajv.compile(schema("pre-tool-use.command.output.schema.json"));

/** The schema's errors for a PreToolUse input, empty when Codex would send it. */
export const inputErrors = (value: unknown): string[] =>
  input(value) ? [] : (input.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
/** The schema's errors for a hook's stdout JSON, empty when Codex reads it. */
export const outputErrors = (value: unknown): string[] =>
  output(value) ? [] : (output.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);

/** The placeholder the recorded inputs hold for the project folder, a literal (not a template). */
const PROJECT = ["$", "{PROJECT}"].join("");

/** The recorded inputs by name, `${PROJECT}` in cwd replaced by `project`, with what each should get. */
export function codexInputs(
  project: string,
): { name: string; input: Record<string, unknown>; expect: "deny" | "nothing" }[] {
  const dir = join(CODEX_FIXTURE, "inputs");
  const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as Record<
    string,
    "deny" | "nothing"
  >;
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "expected.json")
    .sort()
    .map((f) => {
      const name = f.slice(0, -".json".length);
      const raw = readFileSync(join(dir, f), "utf8").replaceAll(
        PROJECT,
        JSON.stringify(project).slice(1, -1),
      );
      return {
        name,
        input: JSON.parse(raw) as Record<string, unknown>,
        expect: expected[name] as "deny" | "nothing",
      };
    });
}

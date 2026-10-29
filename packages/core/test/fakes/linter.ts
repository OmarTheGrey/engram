// A scripted Linter (testing convention, "Fakes, not mocks"): findings per
// scope from a table, validated against the contract when the fake is built.
import type { Linter } from "../../src/lint.ts";
import { LintFinding } from "../../src/schema.ts";

export function createFakeLinter(findings: Record<string, readonly LintFinding[]> = {}): Linter {
  const table = new Map(
    Object.entries(findings).map(([scope, list]) => [scope, list.map((f) => LintFinding.parse(f))]),
  );
  return {
    async lint(scope) {
      return structuredClone(table.get(scope) ?? []);
    },
  };
}

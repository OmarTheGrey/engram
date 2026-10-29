// Typed loader for the vendored MEM-INV-Bench subset: cases.jsonl in a
// fixture directory (card B4).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Case } from "./schema.ts";

/** Every case of `dir`/cases.jsonl, in file order; throws on a line the schema refuses or a repeated id. */
export function loadCases(dir: string): Case[] {
  const path = join(dir, "cases.jsonl");
  const seen = new Set<string>();
  return readFileSync(path, "utf8")
    .split("\n")
    .flatMap((line, i) => {
      if (line.trim() === "") return [];
      const parsed = Case.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`${path}:${i + 1}: ${parsed.error.message}`);
      if (seen.has(parsed.data.case_id))
        throw new Error(`${path}:${i + 1}: repeated case id ${parsed.data.case_id}`);
      seen.add(parsed.data.case_id);
      return [parsed.data];
    });
}

/** One case by id. */
export function findCase(cases: readonly Case[], caseId: string): Case {
  const found = cases.find((c) => c.case_id === caseId);
  if (!found) throw new Error(`no MEM-INV-Bench case ${caseId}`);
  return found;
}

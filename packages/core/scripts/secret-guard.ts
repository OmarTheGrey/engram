// The content guard's findings over a set of texts, for
// research/scripts/secret_guard.py (card E2.9, ADR 0039). Each input line is
// {"id": string, "text": string}; each output line is {"id", "findings"},
// every finding its kind, guard, tier and length, with both guards on and in
// the order of start (policy/secrets.ts, scan). No text and no value is
// written out, only kinds and lengths, as a decision's reason holds them.
//
//   node packages/core/scripts/secret-guard.ts --in <texts.jsonl> --out <findings.jsonl>
//
// It also writes the table's shape beside the findings, as the first line:
// {"rules": {"hand": n, "gitleaks": n, "gitleaks_left_out": n}}.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { GUARD_RULES, scan } from "../src/policy/secrets.ts";
import { GITLEAKS_LEFT_OUT } from "../src/vendor/gitleaks-rules.ts";

const BOTH = new Set(["secrets", "pii"] as const);

export function findingsOf(lines: string[]): string[] {
  const gitleaks = GUARD_RULES.filter((r) => r.kind.startsWith("secret/gitleaks/")).length;
  const out = [
    JSON.stringify({
      rules: {
        hand: GUARD_RULES.length - gitleaks,
        gitleaks,
        gitleaks_left_out: GITLEAKS_LEFT_OUT.length,
      },
    }),
  ];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const { id, text } = JSON.parse(line) as { id: string; text: string };
    const findings = scan(text, BOTH).map((f) => ({
      kind: f.kind,
      guard: f.guard,
      tier: f.tier,
      length: f.end - f.start,
    }));
    out.push(JSON.stringify({ id, findings }));
  }
  return out;
}

function main(): number {
  const { values } = parseArgs({ options: { in: { type: "string" }, out: { type: "string" } } });
  if (!values.in || !values.out) {
    console.error("usage: secret-guard.ts --in <texts.jsonl> --out <findings.jsonl>");
    return 2;
  }
  const lines = readFileSync(values.in, "utf8").split("\n");
  writeFileSync(values.out, `${findingsOf(lines).join("\n")}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = main();

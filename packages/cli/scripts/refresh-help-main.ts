// Writes packages/cli/test/help-main.txt (card E8.15a, review finding
// E8.15a-8): the HELP text a run.ts holds as a template literal, the form
// main's run.ts had before the registry, under a header saying where it
// came from. The registry test checks that the registry rebuilds it byte for
// byte from main's entries.
//
// Rerun it whenever main is merged into this branch with a run.ts whose
// HELP changed (a card that adds or changes a command on main):
//   git show origin/main:packages/cli/src/run.ts > /tmp/run.ts
//   node packages/cli/scripts/refresh-help-main.ts /tmp/run.ts <commit>
// Once the registry is on main, run.ts holds no literal and the fixture stays.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [source, commit] = process.argv.slice(2);
if (source === undefined || commit === undefined) {
  process.stderr.write("usage: node refresh-help-main.ts <run.ts> <commit it came from>\n");
  process.exitCode = 2;
} else {
  const text = readFileSync(source, "utf8");
  const start = text.indexOf("export const HELP = `");
  const end = start < 0 ? -1 : text.indexOf("`;", start);
  if (start < 0 || end < 0) {
    process.stderr.write(`${source}: no HELP template literal; is this main's run.ts?\n`);
    process.exitCode = 1;
  } else {
    const help = text.slice(start + "export const HELP = `".length, end);
    if (help.includes("${") || help.includes("\\")) {
      process.stderr.write(
        `${source}: HELP holds an interpolation or an escape; not a plain text\n`,
      );
      process.exitCode = 1;
    } else {
      const header = [
        `# HELP as packages/cli/src/run.ts held it at ${commit}, before the registry (card E8.15a).`,
        "# Written by packages/cli/scripts/refresh-help-main.ts; rerun it when main's HELP changes.",
        "# The registry test drops these comment lines and compares the rest byte for byte.",
      ];
      const out = fileURLToPath(new URL("../test/help-main.txt", import.meta.url));
      writeFileSync(out, `${header.join("\n")}\n${help}`, "utf8");
      process.stdout.write(`wrote ${out}\n`);
    }
  }
}

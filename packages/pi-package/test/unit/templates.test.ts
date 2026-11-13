// The /engram prompt template and the engram skill are instructions to the
// model, so their text is the behaviour: each subcommand must find out at run
// time whether its tool exists (so it lights up when the card behind it lands),
// and neither file may send the agent around the gate to a store's CLI.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STORE_COMMANDS } from "@engram/core";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const prompt = readFileSync(join(packageRoot, "prompts", "engram.md"), "utf8");
const skill = readFileSync(join(packageRoot, "skills", "engram", "SKILL.md"), "utf8");

/** The bullet of the prompt template for one subcommand. */
function branch(command: string): string {
  const line = prompt.split("\n").find((l) => l.startsWith(`- \`${command}`));
  if (line === undefined) throw new Error(`no ${command} branch in prompts/engram.md`);
  return line;
}

describe("the /engram prompt template", () => {
  it("decides lint's availability by the memory_lint tool, not by a fixed card", () => {
    const lint = branch("lint");
    expect(lint).toMatch(/memory_lint/);
    expect(lint).not.toMatch(/\bL1\b|until then/i);
  });

  it("passes simulate's candidate preset and reports a not implemented tool as it says", () => {
    const simulate = branch("simulate");
    expect(simulate).toMatch(/memory_simulate/);
    expect(simulate).toMatch(/candidate/);
    expect(simulate).not.toMatch(/\bE8\.9\b/);
  });

  it("has a branch for each of the four subcommands", () => {
    for (const command of ["explain", "lint", "simulate", "policy"])
      expect(branch(command)).toBeTruthy();
  });
});

describe("the prompt and the skill", () => {
  it("never name a store CLI invocation", () => {
    for (const text of [prompt, skill])
      for (const command of STORE_COMMANDS)
        expect(text).not.toMatch(new RegExp(`\`${command}\\s+[a-z-]`));
  });
});

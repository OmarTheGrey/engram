// The inputs a content-guard rule is timed on before it is admitted (card
// E2.9, ADR 0039 decision 6; docs/conventions/absorption.md: a regular
// expression from elsewhere gets a timeout test against catastrophic
// backtracking). JavaScript's engine backtracks where gitleaks' RE2 does
// not, so a rule that is linear upstream can be quadratic or exponential
// here. The inputs are long runs of the characters a secret pattern's
// classes and separators are built from, alone and after each of the rule's
// keywords, which is where a bounded or nested quantifier is driven hardest.
// Pure: this builds the inputs; the timing is done by the unit test
// (test/unit/policy/secrets.test.ts) and by the gitleaks generator
// (scripts/gitleaks-rules.ts), since core reads no clock.

/** The characters a run is made of: letters, digits, separators, quotes and whitespace. */
export const FILLERS: readonly string[] = [
  "a",
  "Z",
  "0",
  "f",
  "-",
  "_",
  ".",
  "/",
  "=",
  " ",
  "\n",
  ":",
  '"',
  "aZ0-",
];

/** How long each timed input is, in UTF-16 code units. */
export const ADVERSARIAL_LENGTH = 16_384;

/** At most this many of a rule's keywords drive inputs of their own. */
const KEYWORDS_USED = 2;

function run(unit: string, length: number): string {
  return unit.repeat(Math.max(0, Math.ceil(length / unit.length))).slice(0, length);
}

/**
 * The inputs a rule is timed on: every filler run alone; and for each of its
 * first keywords, the keyword repeated with each filler, and the keyword
 * followed by one long filler run. Each is `length` units long.
 */
export function adversarialInputs(
  keywords: readonly string[] = [],
  length: number = ADVERSARIAL_LENGTH,
): string[] {
  const inputs = FILLERS.map((f) => run(f, length));
  for (const k of keywords.slice(0, KEYWORDS_USED))
    for (const f of FILLERS) {
      inputs.push(run(`${k}${f}`, length));
      inputs.push(`${k}${run(f, length - k.length)}`);
    }
  return inputs;
}

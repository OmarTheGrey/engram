// Long adversarial inputs for the procedure safety scan's timing test (card
// D5 review, finding 1): every token a rule's pattern names, repeated with
// no separator, with spaces, with newlines, and after each prefix a rule
// starts from, so a lazy or nested run that backtracks over the whole text
// shows up as time. Deterministic: no randomness.

/** The tokens the rules' patterns are made of. */
const ATOMS = [
  "curl ",
  "wget ",
  "-d",
  "-F",
  "-T",
  "--data",
  "=",
  "@",
  "a",
  "a/",
  "/",
  "./",
  "~/",
  "..",
  "|",
  "| ",
  "||",
  "\\\n",
  "|\n",
  "\n",
  " ",
  "\t",
  "'",
  '"',
  "\\",
  "$(",
  "<(",
  "sudo ",
  "sudo -u ",
  "env ",
  "A=b ",
  "-x ",
  "bash ",
  "sh ",
  "python3 ",
  "rm ",
  "-r ",
  "rm -rf ",
  "chmod 777 ",
  "tee ",
  "> ",
  "-o ",
  ".ssh",
  ".env",
  "id_rsa",
  "https://a.",
  "https://",
  "POST ",
  "webhook",
  "send ",
  "the ",
  "all ",
  "ignore ",
  "all the ",
  "previous ",
  "system:",
  "system ",
  "do not ",
  "never tell ",
  "the user",
  "{{",
  "<",
  "</",
  "you are now ",
  "act as ",
  "new ",
  "eval ",
  "eval(",
  "exec(",
  "base64 ",
  ":(",
  "iwr ",
  "| iex",
  "mkfs.",
  "dd if=",
  "#",
  ";",
  "&&",
];

/** The prefixes a rule starts matching from, each followed by a repeated atom. */
const PREFIXES = [
  "",
  "curl ",
  "wget ",
  "cat .ssh ",
  "rm -rf ",
  "chmod 777 ",
  "do not tell ",
  "send ",
  "https://",
];

/** `[name, text]` pairs, each about `n` characters long. */
export function adversarialInputs(n: number): [string, string][] {
  const out: [string, string][] = [];
  for (const prefix of PREFIXES)
    for (const atom of ATOMS) {
      const reps = Math.max(1, Math.floor((n - prefix.length) / atom.length));
      out.push([
        `${JSON.stringify(prefix)} + ${JSON.stringify(atom)} x ${reps}`,
        prefix + atom.repeat(reps),
      ]);
    }
  return out;
}

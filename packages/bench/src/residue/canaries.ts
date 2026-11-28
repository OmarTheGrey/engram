// The canaries of the erasure-residue check (card X19, proposal U7): synthetic
// strings drawn from the config's seed (AGENTS.md rules 6 and 12), never a
// real person's content. A canary is `canary-<adjective>-<noun>-<four digits>`:
// low in entropy, so no secret rule or scrubber mistakes it for a key, and
// unique, with no canary inside another. The draw is sha256 over the seed and
// a counter, so the same seed gives the same canaries on every machine.
import { createHash } from "node:crypto";

const ADJECTIVES = [
  "amber",
  "brisk",
  "civic",
  "dusky",
  "eager",
  "fable",
  "gilded",
  "hazel",
  "ivory",
  "jovial",
  "kindly",
  "lunar",
  "mellow",
  "nimble",
  "olive",
  "placid",
  "quiet",
  "russet",
  "silken",
  "tidal",
  "umber",
  "velvet",
  "wistful",
  "xeric",
  "yonder",
  "zesty",
  "coral",
  "dapper",
  "frosty",
  "gentle",
  "humble",
  "jaunty",
] as const;
const NOUNS = [
  "otter",
  "heron",
  "lynx",
  "wren",
  "badger",
  "falcon",
  "gecko",
  "ibis",
  "jackal",
  "kestrel",
  "lemur",
  "marten",
  "newt",
  "osprey",
  "puffin",
  "quail",
  "raven",
  "stoat",
  "tapir",
  "urchin",
  "vole",
  "walrus",
  "yak",
  "zebu",
  "bison",
  "crane",
  "dingo",
  "egret",
  "ferret",
  "gannet",
  "hare",
  "koala",
] as const;

/**
 * `count` distinct canaries from `seed`, in draw order. The first `exposed`
 * of a run are written; the rest, drawn by the same generator, never are.
 */
export function drawCanaries(seed: number, count: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let counter = 0; out.length < count; counter++) {
    const digest = createHash("sha256").update(`x19/${seed}/${counter}`).digest();
    const adjective = ADJECTIVES[(digest[0] as number) % ADJECTIVES.length];
    const noun = NOUNS[(digest[1] as number) % NOUNS.length];
    const digits = String(digest.readUInt16BE(2) % 10_000).padStart(4, "0");
    const canary = `canary-${adjective}-${noun}-${digits}`;
    if (seen.has(canary)) continue;
    seen.add(canary);
    out.push(canary);
  }
  return out;
}

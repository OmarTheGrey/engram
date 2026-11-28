// Packs the ITF traces Quint wrote into specs/traces/ (card E1.8, `make
// verify-spec`): `node packages/core/test/model/pack-traces.ts <from> <to>`.
// Each trace keeps its states and variables as Quint wrote them; its
// `#meta` loses the two fields that name the time of the run (description,
// timestamp), so a trace is the same bytes whenever its seed is run again,
// and it is gzipped (level 9, no file name, no time in the header), since
// every ITF state repeats the whole log. A random trace's number is padded
// to three digits so the files sort in seed order. Every .itf.json.gz in
// <to> is replaced.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error("usage: pack-traces.ts <from> <to>");
  process.exitCode = 2;
} else {
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(to)) if (f.endsWith(".itf.json.gz")) rmSync(join(to, f));
  let n = 0;
  for (const f of readdirSync(from).sort()) {
    if (!f.endsWith(".itf.json")) continue;
    const doc = JSON.parse(readFileSync(join(from, f), "utf8")) as { "#meta"?: Record<string, unknown> };
    if (doc["#meta"]) {
      delete doc["#meta"].description;
      delete doc["#meta"].timestamp;
    }
    const name = f.replace(/^replay-(\d+)\./, (_m, k: string) => `replay-${k.padStart(3, "0")}.`);
    writeFileSync(join(to, `${name}.gz`), gzipSync(JSON.stringify(doc), { level: 9 }));
    n++;
  }
  console.log(`pack-traces: ${n} traces into ${to}`);
}

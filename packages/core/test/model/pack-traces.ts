// Packs the ITF traces Quint wrote into specs/traces/ (card E1.8, `make
// verify-spec`): `node packages/core/test/model/pack-traces.ts <from> <to>`.
// Each trace keeps its states and variables as Quint wrote them; its
// `#meta` loses the two fields that name the time of the run (description,
// timestamp), so a trace is the same bytes whenever its seed is run again,
// and it is gzipped (level 9, no file name, time 0 and the OS byte 255 in
// the header, so the bytes do not depend on the platform), since
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
    const doc = JSON.parse(readFileSync(join(from, f), "utf8")) as {
      "#meta"?: Record<string, unknown>;
    };
    if (doc["#meta"]) {
      delete doc["#meta"].description;
      delete doc["#meta"].timestamp;
    }
    const name = f.replace(/^replay-(\d+)\./, (_m, k: string) => `replay-${k.padStart(3, "0")}.`);
    const gz = gzipSync(JSON.stringify(doc), { level: 9 });
    // The header's OS byte names the platform that wrote it (0x0a on Windows,
    // 0x03 on Linux and macOS); 255 is "unknown", the same everywhere. Its
    // time field is already 0.
    gz[9] = 255;
    writeFileSync(join(to, `${name}.gz`), gz);
    n++;
  }
  console.log(`pack-traces: ${n} traces into ${to}`);
}

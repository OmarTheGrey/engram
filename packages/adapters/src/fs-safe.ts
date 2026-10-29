// File helpers the file-backed adapters share (files, card A3; Letta, card A2).
import { rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const codeOf = (e: unknown) => (e as NodeJS.ErrnoException).code;
export const isMissing = (e: unknown) => codeOf(e) === "ENOENT";
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Unique within the process; the pid separates processes. */
let tempCounter = 0;

/** Temp file with a unique name, then rename, retried briefly on the transient locks Windows scanners take. */
export async function atomicWrite(path: string, dir: string, base: string, data: string | Buffer) {
  const tmp = join(dir, `.${base}.${process.pid}.${++tempCounter}.engram-tmp`);
  await writeFile(tmp, data);
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, path);
      return;
    } catch (e) {
      const code = codeOf(e);
      if (attempt >= 5 || !(code === "EPERM" || code === "EACCES" || code === "EBUSY")) {
        await rm(tmp, { force: true });
        throw e;
      }
      await sleep(20 * (attempt + 1));
    }
  }
}

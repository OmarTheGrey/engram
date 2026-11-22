// The two public payload sets of card X14, pinned in packages/bench/PINS.md
// (depend mode, ADR 0037): deepset/prompt-injections (Apache-2.0 on its
// card, CC-BY-4.0 inside its dataset_info) and
// Lakera/gandalf_ignore_instructions (MIT), each at an exact Hugging Face
// revision. Their Parquet files are fetched at the pin into
// .engram/upstream/ (data only, never a model; refused under
// ENGRAM_OFFLINE=1), checked against the sha256 below, and read with
// hyparquet. Nothing of them is committed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parquetReadObjects } from "hyparquet";

export interface PayloadFile {
  path: string;
  split: string;
  sha256: string;
}

export interface PayloadPin {
  name: "deepset" | "lakera";
  repository: string;
  revision: string;
  licence: string;
  /** The folder under .engram/upstream the files are fetched into. */
  dir: string;
  rows: number;
  files: PayloadFile[];
}

export const PAYLOAD_PINS: readonly PayloadPin[] = [
  {
    name: "deepset",
    repository: "deepset/prompt-injections",
    revision: "4f61ecb038e9c3fb77e21034b22511b523772cdd",
    licence: "Apache-2.0 (card metadata), CC-BY-4.0 (dataset_info)",
    dir: "deepset_prompt-injections@4f61ecb038e9",
    rows: 662,
    files: [
      {
        path: "data/train-00000-of-00001-9564e8b05b4757ab.parquet",
        split: "train",
        sha256: "2e10bc7ab30f542c97e4e83e2a5683000b5057d25ec10908784c631d44124c04",
      },
      {
        path: "data/test-00000-of-00001-701d16158af87368.parquet",
        split: "test",
        sha256: "39ac797cabc157eeed58435a08593b2952bb6cb16fc394a2d383f447cc7b246e",
      },
    ],
  },
  {
    name: "lakera",
    repository: "Lakera/gandalf_ignore_instructions",
    revision: "04737b65e90a6794ec227012e4a255a7def6344b",
    licence: "MIT",
    dir: "Lakera_gandalf_ignore_instructions@04737b65e90a",
    rows: 1000,
    files: [
      {
        path: "data/train-00000-of-00001-ded53be747ff55cd.parquet",
        split: "train",
        sha256: "5b6acf3e5a5998d21f8e1222bb45bbdec25a14408747b1cd63bebef4a75fa439",
      },
      {
        path: "data/validation-00000-of-00001-94481a2a09ff2fff.parquet",
        split: "validation",
        sha256: "f51ab3e3407a368845b0f57932cc745c09280429416d7507bd178a16326a79f6",
      },
      {
        path: "data/test-00000-of-00001-bc92128b9288a6d1.parquet",
        split: "test",
        sha256: "56b646d133335ebc535266bd55dbe1b5bee7caa4b95bf49d040684b9b5dd9972",
      },
    ],
  },
];

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Where a pinned file lives under `upstream`. */
export const payloadPath = (upstream: string, pin: PayloadPin, file: PayloadFile) =>
  join(upstream, pin.dir, file.path);

/** Fetches every missing file of `pin` at its revision; refuses under ENGRAM_OFFLINE=1. */
export async function fetchPayloads(upstream: string, pin: PayloadPin): Promise<void> {
  for (const file of pin.files) {
    const target = payloadPath(upstream, pin, file);
    if (existsSync(target)) continue;
    if (process.env.ENGRAM_OFFLINE === "1")
      throw new Error(`${target} is missing and ENGRAM_OFFLINE=1 forbids the fetch`);
    const url = `https://huggingface.co/datasets/${pin.repository}/resolve/${pin.revision}/${file.path}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`fetch ${url}: HTTP ${response.status}`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (sha256(body) !== file.sha256) throw new Error(`fetch ${url}: sha256 differs from the pin`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
  }
}

/** One payload row: its split, its index in that split, its text, and deepset's label (1 an injection). */
export interface PayloadRow {
  split: string;
  index: number;
  text: string;
  label: number | null;
}

/** Every row of `pin`'s files, in file order, each file checked against its pinned sha256. */
export async function readPayloads(upstream: string, pin: PayloadPin): Promise<PayloadRow[]> {
  const out: PayloadRow[] = [];
  for (const file of pin.files) {
    const path = payloadPath(upstream, pin, file);
    if (!existsSync(path))
      throw new Error(`${path} is missing; fetch it first (make redteam fetches it)`);
    const buf = readFileSync(path);
    if (sha256(buf) !== file.sha256) throw new Error(`${path}: sha256 differs from the pin`);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const rows = (await parquetReadObjects({ file: ab })) as Record<string, unknown>[];
    for (const [index, r] of rows.entries()) {
      if (typeof r.text !== "string") throw new Error(`${path} row ${index}: no text`);
      const label = r.label === undefined || r.label === null ? null : Number(r.label);
      out.push({ split: file.split, index, text: r.text, label });
    }
  }
  if (out.length !== pin.rows)
    throw new Error(`${pin.repository}@${pin.revision}: ${out.length} rows, pinned ${pin.rows}`);
  return out;
}

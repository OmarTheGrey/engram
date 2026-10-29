// Typed loader for GateMem data directories: one directory per domain with
// episodes.jsonl and checkpoints.jsonl, the upstream layout (bench/data/).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import { Checkpoint, Episode } from "./schema.ts";

function parseJsonl<T extends z.ZodType>(path: string, schema: T): z.infer<T>[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .flatMap((line, i) => {
      if (line.trim() === "") return [];
      const parsed = schema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        throw new Error(`${path}:${i + 1}: ${parsed.error.message}`);
      }
      return [parsed.data];
    });
}

export interface Domain {
  domain: string;
  episodes: Episode[];
  checkpoints: Checkpoint[];
}

/** Load one domain directory and check that every checkpoint points at a turn of its episode. */
export function loadDomain(dir: string, domain = dir.split(/[\\/]/).at(-1) ?? dir): Domain {
  const episodes = parseJsonl(join(dir, "episodes.jsonl"), Episode);
  const checkpoints = parseJsonl(join(dir, "checkpoints.jsonl"), Checkpoint);
  const turns = new Map(
    episodes.map((e) => [e.episode_id, new Set(e.turns.map((t) => t.turn_id))]),
  );
  for (const c of checkpoints) {
    const ids = turns.get(c.episode_id);
    if (!ids) throw new Error(`${dir}: checkpoint ${c.checkpoint_id} names unknown episode`);
    if (!ids.has(c.as_of_turn_id)) {
      throw new Error(
        `${dir}: checkpoint ${c.checkpoint_id} names unknown turn ${c.as_of_turn_id}`,
      );
    }
  }
  return { domain, episodes, checkpoints };
}

/** Every domain directory under `root` (a directory holding an episodes.jsonl), sorted by name. */
export function loadDataset(root: string): Domain[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "episodes.jsonl")))
    .map((d) => d.name)
    .sort()
    .map((name) => loadDomain(join(root, name), name));
}

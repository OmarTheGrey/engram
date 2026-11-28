// A test double of the MCP reference memory server's own load and save, so a
// test can rewrite the memory file the way the server does without running it
// (card A6 of the second absorb plan).
//
// Ported from modelcontextprotocol/servers, src/memory/index.ts
// (KnowledgeGraphManager.loadGraphWithUnreadable, keepExtraFields, saveGraph
// and addObservations, and isLockOwnerDead), version 2.2.1 at
// c799c8552b0f27b7a33a7b9233773da144dddcf5, licence in transition from MIT to
// Apache-2.0: the rules rewritten here, no code copied. What it keeps of the
// server: blank lines dropped; an entity needs a string name and entityType
// and an array of string observations, a relation string from, to and
// relationType; members neither `type` nor modelled are kept and written
// after the modelled ones; every other line is written back unchanged after
// the entities and the relations; the file ends with one newline. It leaves
// out the server's lock, limits and atomic rename, which the adapter's own
// tests cover.
import { readFile, writeFile } from "node:fs/promises";
import { hostname } from "node:os";

interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  extras: Record<string, unknown>;
}
interface Relation {
  from: string;
  to: string;
  relationType: string;
  extras: Record<string, unknown>;
}
export interface ServerGraph {
  entities: Entity[];
  relations: Relation[];
  unreadable: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const extrasOf = (record: Record<string, unknown>, modelled: readonly string[]) =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== "type" && !modelled.includes(k)));

export function parseServerGraph(text: string): ServerGraph {
  const graph: ServerGraph = { entities: [], relations: [], unreadable: [] };
  for (const line of text.split("\n").filter((l) => l.trim() !== "")) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      graph.unreadable.push(line);
      continue;
    }
    if (!isObject(value)) {
      graph.unreadable.push(line);
      continue;
    }
    const { name, entityType, observations, from, to, relationType } = value;
    if (
      value.type === "entity" &&
      typeof name === "string" &&
      typeof entityType === "string" &&
      Array.isArray(observations) &&
      observations.every((o) => typeof o === "string")
    ) {
      graph.entities.push({
        name,
        entityType,
        observations: [...observations],
        extras: extrasOf(value, ["name", "entityType", "observations"]),
      });
    } else if (
      value.type === "relation" &&
      typeof from === "string" &&
      typeof to === "string" &&
      typeof relationType === "string"
    ) {
      graph.relations.push({
        from,
        to,
        relationType,
        extras: extrasOf(value, ["from", "to", "relationType"]),
      });
    } else graph.unreadable.push(line);
  }
  return graph;
}

export function serialiseServerGraph(graph: ServerGraph): string {
  const lines = [
    ...graph.entities.map((e) =>
      JSON.stringify({
        type: "entity",
        name: e.name,
        entityType: e.entityType,
        observations: e.observations,
        ...e.extras,
      }),
    ),
    ...graph.relations.map((r) =>
      JSON.stringify({
        type: "relation",
        from: r.from,
        to: r.to,
        relationType: r.relationType,
        ...r.extras,
      }),
    ),
    ...graph.unreadable,
  ];
  return `${lines.join("\n")}\n`;
}

/** One server write: load the file, change the graph, save it whole. */
export async function serverWrite(file: string, change: (g: ServerGraph) => void): Promise<void> {
  const graph = parseServerGraph(await readFile(file, "utf8"));
  change(graph);
  await writeFile(file, serialiseServerGraph(graph));
}

/** The server's add_observations: each content not yet stored is appended, once. */
export function addObservations(graph: ServerGraph, entity: string, contents: string[]): void {
  const e = graph.entities.find((x) => x.name === entity);
  if (!e) throw new Error(`Entity with name ${entity} not found`);
  for (const c of contents) if (!e.observations.includes(c)) e.observations.push(c);
}

/**
 * The server's isLockOwnerDead: a lock record whose pid is a number and whose
 * `hostname` is this host is dead when that process is gone; any other record
 * is judged by its age instead (false here).
 */
export function serverJudgesOwnerDead(contents: string): boolean {
  let owner: unknown;
  try {
    owner = JSON.parse(contents);
  } catch {
    return false;
  }
  const { pid, hostname: host } = (owner ?? {}) as Record<string, unknown>;
  if (typeof pid !== "number" || host !== hostname()) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

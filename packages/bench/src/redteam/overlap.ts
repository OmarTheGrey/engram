// Where card X14's cells share a write path with MEM-INV-Bench's laundering
// channels (ADR 0029, the poisoning arm this harness extends), so a reader
// counts nothing twice. Computed from the vendored cases, not asserted: a
// MEM-INV-Bench attack channel's attacker entries are those written by an
// untrusted feed (web, inbox) or derived from one (upstream `derived_from`),
// a structural reading that uses no hidden label. Each is written with
// `entryKind` into its channel's scope, and a red-team cell shares a channel
// when its writer writes the same kind at the same scope level. The read
// route shares none: MEM-INV-Bench writes every entry through Plane.write.
// The two arms never pool: MEM-INV-Bench's 38 cases are not in this corpus,
// and its metric is a consequential action, not canary survival.
import { entryKind, OPERATIONS, OPERATOR } from "../mem-inv-bench/plane.ts";
import type { Case } from "../mem-inv-bench/schema.ts";
import { PLANT_KINDS, type PlantKind, ROUTES, type Route, SOURCE_KINDS, writerOf } from "./routes.ts";

const UNTRUSTED = new Set(["web", "inbox"]);
const levelOf = (scope: string) =>
  scope === OPERATOR ? "person" : scope === OPERATIONS ? "team" : scope.split(":")[0];

export interface OverlapRow {
  route: Route;
  kind: PlantKind;
  /** The writer's actor and scope level in MEM-INV-Bench's deployment; null on the read route. */
  writer: { actor: string; scope_level: string } | null;
  /** MEM-INV-Bench attack channels whose attacker entries take this write path, sorted. */
  mem_inv_channels: string[];
  /** How many of MEM-INV-Bench's attack cases those channels hold. */
  mem_inv_cases: number;
}

export function overlap(cases: readonly Case[]): OverlapRow[] {
  const paths = new Map<string, Set<string>>();
  const caseCount = new Map<string, number>();
  for (const c of cases) {
    if (c.family !== "attack") continue;
    caseCount.set(c.channel, (caseCount.get(c.channel) ?? 0) + 1);
    for (const e of c.memory) {
      if (!UNTRUSTED.has(e.channel) && !e.derived_from.some((d) => UNTRUSTED.has(d))) continue;
      const scope = e.channel === "agent" || e.channel === "user" ? OPERATOR : OPERATIONS;
      const key = `${entryKind(e)} ${levelOf(scope)}`;
      const set = paths.get(key) ?? new Set<string>();
      set.add(c.channel);
      paths.set(key, set);
    }
  }
  const out: OverlapRow[] = [];
  for (const route of ROUTES)
    for (const kind of route === "read" ? SOURCE_KINDS : PLANT_KINDS) {
      if (route === "read") {
        out.push({ route, kind, writer: null, mem_inv_channels: [], mem_inv_cases: 0 });
        continue;
      }
      // MEM-INV-Bench's harness attests a source on every write, so an unattested writer shares no channel.
      if (kind === "unattested") {
        out.push({
          route,
          kind,
          writer: { actor: OPERATOR, scope_level: "person" },
          mem_inv_channels: [],
          mem_inv_cases: 0,
        });
        continue;
      }
      const w = writerOf(kind);
      const level = levelOf(w.scope) as string;
      const channels = [...(paths.get(`${kind} ${level}`) ?? [])].sort();
      out.push({
        route,
        kind,
        writer: { actor: w.actor, scope_level: level },
        mem_inv_channels: channels,
        mem_inv_cases: channels.reduce((s, ch) => s + (caseCount.get(ch) ?? 0), 0),
      });
    }
  return out;
}

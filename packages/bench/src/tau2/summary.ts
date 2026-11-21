// What a tau2 run reports (card B11): per condition its tasks' mean reward
// (the database hash check), tau2's own mean reward and mean steps; the calls
// the ledger counted, new and from cassettes, per role; and the cassettes the
// run's calls are keyed to, per role, which is what a deposit of them holds
// (ADR 0036): the user simulator's share is the cost note card B11 asks for.
import type { Role, TaskRow, UsageRow } from "./launcher.ts";

export interface RoleCount {
  calls: number;
  new: number;
  cached: number;
  cassettes: number;
  cassette_bytes: number;
}

export interface Tau2Summary {
  conditions: Record<
    string,
    {
      tasks: number;
      reward: number;
      tau2_reward: number;
      steps: number;
      memory_writes_denied: number;
    }
  >;
  calls: { total: number; new: number; cached: number };
  roles: Record<Role, RoleCount>;
  /** The user simulator's cassettes as a share of all the run's cassette bytes. */
  user_cassette_share: number;
  cost_usd: number;
}

const mean = (xs: readonly number[]) =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
/** Six decimals: the summary is byte-stable across platforms. */
const fixed = (x: number) => Number(x.toFixed(6));

/** `sizeOf(key)` is the size in bytes of the cassette file a key is recorded in. */
export function summarize(
  rows: readonly TaskRow[],
  usage: readonly UsageRow[],
  sizeOf: (key: string) => number,
): Tau2Summary {
  const conditions: Tau2Summary["conditions"] = {};
  for (const condition of [...new Set(rows.map((r) => r.condition))]) {
    const own = rows.filter((r) => r.condition === condition);
    conditions[condition] = {
      tasks: own.length,
      reward: fixed(mean(own.map((r) => r.reward))),
      tau2_reward: fixed(mean(own.map((r) => r.tau2_reward))),
      steps: fixed(mean(own.map((r) => r.steps))),
      memory_writes_denied: own.reduce((a, r) => a + r.memory_writes_denied, 0),
    };
  }
  const roles = {} as Record<Role, RoleCount>;
  for (const role of ["agent", "user"] as const) {
    const own = usage.filter((u) => u.role === role);
    const keys = [...new Set(own.map((u) => u.key))];
    roles[role] = {
      calls: own.length,
      new: own.filter((u) => !u.hit).length,
      cached: own.filter((u) => u.hit).length,
      cassettes: keys.length,
      cassette_bytes: keys.reduce((a, k) => a + sizeOf(k), 0),
    };
  }
  const bytes = roles.agent.cassette_bytes + roles.user.cassette_bytes;
  return {
    conditions,
    calls: {
      total: usage.length,
      new: usage.filter((u) => !u.hit).length,
      cached: usage.filter((u) => u.hit).length,
    },
    roles,
    user_cassette_share: fixed(bytes === 0 ? 0 : roles.user.cassette_bytes / bytes),
    cost_usd: fixed(usage.reduce((a, u) => a + u.cost_usd, 0)),
  };
}

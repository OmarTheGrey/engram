// The settings card X14 runs each attack under (proposal P1 of
// docs/research/preregistration.md, not registered). `store` is the store
// directly, C2's write path with no gate. Every other setting is a
// registered preset, C5's, as it stands, or a variant of it with guards
// switched on: content_guards (cards E2.9 and E2.10) and trust (card E2.11).
// A variant keeps the preset's policy id (P1's rule on variants: a variant is
// known by its name, never by the policy id in its events) and runs under a
// name of its own, never a bare preset name. Each policy is validated by
// core's loader, so a guard core does not enforce yet is refused, never run
// as if it were on. This module builds configuration; every decision is
// core's (AGENTS.md rule 1).
import { loadPreset, type Policy, PRESETS, type PresetName, parsePolicy } from "@engram/core";

export interface SettingSpec {
  name: string;
  /** Absent for the `store` setting (no plane). */
  preset?: PresetName;
  content_guards?: Policy["content_guards"];
  trust?: Policy["trust"];
}

export interface Setting {
  name: string;
  /** Null for the store directly. */
  policy: Policy | null;
}

export function buildSetting(spec: SettingSpec): Setting {
  if (spec.preset === undefined) {
    if (spec.name !== "store" || spec.content_guards || spec.trust)
      throw new Error(
        `setting ${spec.name}: only "store" runs with no preset, and it has no guards`,
      );
    return { name: spec.name, policy: null };
  }
  if (!PRESETS.includes(spec.preset)) throw new Error(`setting ${spec.name}: unknown preset`);
  const variant = spec.content_guards !== undefined || spec.trust !== undefined;
  if (variant === (spec.name === spec.preset))
    throw new Error(
      `setting ${spec.name}: a registered preset runs under its own name and a variant under another`,
    );
  if (variant && !spec.name.startsWith(`${spec.preset}+`))
    throw new Error(
      `setting ${spec.name}: a variant of ${spec.preset} is named ${spec.preset}+<what>`,
    );
  const base = loadPreset(spec.preset);
  const policy: Policy = {
    ...base,
    ...(spec.content_guards ? { content_guards: spec.content_guards } : {}),
    ...(spec.trust ? { trust: spec.trust } : {}),
  };
  // JSON is YAML: the loader's semantic checks refuse an option core does not enforce yet.
  return {
    name: spec.name,
    policy: parsePolicy(JSON.stringify(policy), `redteam setting ${spec.name}`),
  };
}

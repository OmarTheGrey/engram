// The vendored AMSB corpus format (card X14). The data is copied from OWASP
// Agent Memory Guard (https://github.com/OWASP/www-project-agent-memory-guard),
// commit b052787cc3426ff5f5f7e8e0eecb514052a168ba,
// src/agent_memory_guard/bench/scenarios.py, Apache License 2.0, Copyright
// 2026 OWASP Foundation (NOTICE), by packages/bench/scripts/vendor-amsb.py;
// this schema follows upstream's Step and Scenario dataclasses. The schema is
// strict, so a field the port does not know fails the load.
import { z } from "zod";

/**
 * A text as vendored: a string; its parts, when upstream assembles it from
 * named fragments (the fake GitHub token, kept split so its literal is in no
 * file); or a unit repeated, when upstream multiplies a string.
 */
export const Text = z.union([
  z.string(),
  z.strictObject({ parts: z.array(z.string()).min(1) }),
  z.strictObject({ repeat: z.int().positive(), unit: z.string().min(1) }),
]);
export type Text = z.infer<typeof Text>;

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const Severity = z.enum(SEVERITIES);
export type Severity = z.infer<typeof Severity>;

/** Upstream's two source classes: content from a tool (untrusted) or typed by the user. */
export const SourceClass = z.enum(["external_tool", "user_input"]);

export const Step = z.strictObject({
  key: z.string().min(1),
  value: Text,
  source_class: SourceClass,
});

export const Scenario = z
  .strictObject({
    id: z.string().min(1),
    category: z.string().min(1),
    severity: Severity,
    description: z.string().min(1),
    steps: z.array(Step).min(1),
    probe_key: z.string().min(1),
    canary: Text,
    malicious: z.boolean(),
  })
  .refine((s) => s.malicious === (s.canary !== ""), {
    message: "an attack carries a canary, and only an attack does",
  });
export type Scenario = z.infer<typeof Scenario>;

export const AmsbFile = z.strictObject({
  description: z.string(),
  source: z.strictObject({
    repository: z.url(),
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    path: z.string(),
    licence: z.literal("Apache-2.0"),
    copyright: z.string(),
    upstream_sha256: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
  }),
  counts: z.strictObject({ total: z.int(), malicious: z.int(), benign: z.int() }),
  severity_weight: z.strictObject({
    low: z.int().positive(),
    medium: z.int().positive(),
    high: z.int().positive(),
    critical: z.int().positive(),
  }),
  scenarios: z.array(Scenario).min(1),
});
export type AmsbFile = z.infer<typeof AmsbFile>;

/** One benign control of card X14's own set (fixtures/bench/amsb/controls.json): AMSB's benign shape, one write by a key. */
export const Control = z.strictObject({
  id: z.string().min(1),
  group: z.string().min(1),
  description: z.string().min(1),
  key: z.string().min(1),
  value: Text,
});
export const ControlsFile = z.strictObject({
  description: z.string(),
  scenarios: z.array(Control).min(1),
});
export type ControlsFile = z.infer<typeof ControlsFile>;

// The cached, seeded model call (ADR 0017) lives in @engram/model since ADR 0033,
// which bench and runner both import. This path stays as a re-export because
// immutable log entries cite it as evidence; import from @engram/model instead.
export * from "@engram/model";

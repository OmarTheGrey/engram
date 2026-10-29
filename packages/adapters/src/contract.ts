// The Adapter contract is defined in packages/core (the Plane calls it) and
// re-exported here so every adapter imports it from its own package.
export {
  type Adapter,
  type Capabilities,
  ForeignRefError,
  type StoreDiagnostic,
  type StoreRef,
} from "@engram/core";

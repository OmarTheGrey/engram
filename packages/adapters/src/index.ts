// One adapter per store, each implementing the Adapter contract.
// First, before anything can load `mem0ai/oss`: Mem0's telemetry off (R4-7).
import "./mem0/telemetry-off.ts";

export * from "./contract.ts";
export type { Embedder } from "./embedder.ts";
export { createHashingEmbedder } from "./fake/embedder.ts";
export { createFakeAdapter, type FakeAdapterOptions } from "./fake/index.ts";
export {
  createFilesAdapter,
  type FileDiagnostic,
  type FilesAdapter,
  type FilesAdapterOptions,
  importedItemId,
  ReadOnlyItemError,
  UnsafeKeyError,
} from "./files/index.ts";
export { createMem0Adapter, type Mem0AdapterOptions } from "./mem0/index.ts";

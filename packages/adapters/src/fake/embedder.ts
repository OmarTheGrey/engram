// A deterministic, network-free embedding model (testing convention, "Fakes,
// not mocks"). Each lower-cased word is hashed (FNV-1a, 32 bit) into one of
// `dimension` buckets with a hashed sign; the vector is L2-normalised. Texts
// that share words have a positive cosine, texts that share none have zero.
// It is a fake of the embedding model a vector store calls, not of a store.
import type { Embedder } from "../embedder.ts";

const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

export function createHashingEmbedder(dimension = 256): Embedder {
  if (!Number.isInteger(dimension) || dimension < 2) {
    throw new Error(
      `hashing embedder: dimension must be an integer of at least 2, got ${dimension}`,
    );
  }
  const embedOne = (text: string): number[] => {
    const vector = new Array<number>(dimension).fill(0);
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const word of words) {
      const hash = fnv1a(word);
      const bucket = hash % dimension;
      vector[bucket] = (vector[bucket] ?? 0) + ((hash >>> 31) & 1 ? -1 : 1);
    }
    const norm = Math.hypot(...vector);
    // A text with no words still gets a unit vector, so cosine is never NaN.
    if (norm === 0) {
      vector[0] = 1;
      return vector;
    }
    return vector.map((v) => v / norm);
  };
  return {
    dimension,
    embed: async (text) => embedOne(text),
    embedBatch: async (texts) => texts.map(embedOne),
  };
}

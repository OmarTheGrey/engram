// The RFC 6962 Merkle Tree Hash over the chain's leaves (card E1.6, ADR
// 0038): the root a checkpoint carries, in the tree form C2SP's
// tlog-checkpoint names, so a later consistency proof can build on it.
//
// Ported from world-model-mcp (https://github.com/SaravananJaichandar/world-model-mcp,
// commit c46462dbf816f6b5b95b3fd021629d513c4d23e9, world_model_server/merkle.py,
// MIT): the empty root SHA-256(""), a one-leaf tree's root the leaf itself, the
// split at the largest power of two below the size, and an unpaired node
// promoted, never duplicated. Inclusion and consistency proofs are not taken.
import { createHash } from "node:crypto";
import { nodeHash } from "./chain.ts";

/** MTH({}) = SHA-256(""), in hex. */
export const EMPTY_ROOT = createHash("sha256").update("").digest("hex");

function largestPowerOfTwoBelow(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/** The Merkle Tree Hash of already hashed leaves (hex, RFC 6962 section 2.1). */
export function merkleRoot(leaves: readonly string[]): string {
  if (leaves.length === 0) return EMPTY_ROOT;
  if (leaves.length === 1) return leaves[0] as string;
  const k = largestPowerOfTwoBelow(leaves.length);
  return nodeHash(merkleRoot(leaves.slice(0, k)), merkleRoot(leaves.slice(k)));
}

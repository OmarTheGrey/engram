// Optional encryption of a bundle with age (card E9.8, docs/bundle.md), by
// typage, the TypeScript implementation of age (`age-encryption` 0.3.1,
// BSD-3-Clause, a dependency per ADR 0037, pinned exactly in docs/deps.md).
// A bundle is encrypted to one or more recipients (`age1...`) or with a
// passphrase (scrypt, typage's default work factor), and written ASCII
// armored, so an encrypted bundle is still text. Decryption takes identity
// files (`AGE-SECRET-KEY-1...` lines, `#` comments allowed) or a passphrase
// file; a passphrase is never a flag value, which a shell history would keep.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { armor, Decrypter, Encrypter } from "age-encryption";
import { UsageError } from "../setup.ts";

const ARMOR_BEGIN = "-----BEGIN AGE ENCRYPTED FILE-----";
const BINARY_MAGIC = "age-encryption.org/v1";

export interface Keys {
  recipients: string[];
  passphrase: string | undefined;
}

/** Whether `bytes` is an age file, armored or binary. */
export function isEncrypted(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 64)).toString("utf8").trimStart();
  return head.startsWith(ARMOR_BEGIN) || head.startsWith(BINARY_MAGIC);
}

/** The first line of a passphrase file, without its line ending; refused when empty. */
export function readPassphrase(cwd: string, file: string): string {
  let text: string;
  try {
    text = readFileSync(resolve(cwd, file), "utf8");
  } catch (e) {
    throw new UsageError(`--passphrase-file ${file}: ${(e as Error).message}`);
  }
  const first = text.split(/\r?\n/)[0] ?? "";
  if (first === "") throw new UsageError(`--passphrase-file ${file}: its first line is empty`);
  return first;
}

/** The identities an identity file holds. */
export function readIdentities(cwd: string, file: string): string[] {
  let text: string;
  try {
    text = readFileSync(resolve(cwd, file), "utf8");
  } catch (e) {
    throw new UsageError(`--identity ${file}: ${(e as Error).message}`);
  }
  const keys = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));
  if (keys.length === 0 || keys.some((k) => !k.startsWith("AGE-SECRET-KEY-")))
    throw new UsageError(
      `--identity ${file}: expected AGE-SECRET-KEY-... lines (comments start with #)`,
    );
  return keys;
}

/** The bundle text encrypted and armored, or the text itself when no key is given. */
export async function encryptBundle(text: string, keys: Keys): Promise<string> {
  if (keys.recipients.length === 0 && keys.passphrase === undefined) return text;
  if (keys.recipients.length > 0 && keys.passphrase !== undefined)
    throw new UsageError("encrypt to --recipient keys or with --passphrase-file, not both");
  const e = new Encrypter();
  if (keys.passphrase !== undefined) e.setPassphrase(keys.passphrase);
  for (const r of keys.recipients) {
    try {
      e.addRecipient(r);
    } catch (err) {
      throw new UsageError(`--recipient ${r}: ${(err as Error).message}`);
    }
  }
  return armor.encode(await e.encrypt(text));
}

/** The plaintext of an age file, by the identities and passphrase given. */
export async function decryptBundle(
  bytes: Uint8Array,
  identities: readonly string[],
  passphrase: string | undefined,
): Promise<string> {
  if (identities.length === 0 && passphrase === undefined)
    throw new UsageError(
      "the bundle is encrypted with age: give --identity <file> or --passphrase-file <file>",
    );
  const d = new Decrypter();
  for (const id of identities) d.addIdentity(id);
  if (passphrase !== undefined) d.addPassphrase(passphrase);
  const text = Buffer.from(bytes).toString("utf8");
  try {
    const raw = text.trimStart().startsWith(ARMOR_BEGIN) ? armor.decode(text) : bytes;
    return await d.decrypt(raw, "text");
  } catch (e) {
    throw new Error(`the bundle could not be decrypted: ${(e as Error).message}`);
  }
}

// The Engram pi package's extension (card PX3): opens the workspace the
// environment names (config.ts) through the opener the engram CLI and server
// use, and loads the Engram extension of packages/pi-extension over it. The
// tools and every gate are that extension's; this file only wires a
// workspace to it.
import { homedir, userInfo } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createEngramExtension, uuidv7 } from "@engram/pi-extension";
import { openWorkspace } from "@engram/server";
import { packageConfig } from "./config.ts";

export default async function engram(pi: ExtensionAPI): Promise<void> {
  const cwd = process.cwd();
  const config = packageConfig(process.env, cwd, userInfo().username);
  const workspace = openWorkspace({
    cwd,
    home: homedir(),
    env: process.env,
    newId: uuidv7,
    requireStore: true,
    root: config.root,
    owner: config.owner,
    ...(config.store ? { store: config.store } : {}),
    ...(config.policy ? { policy: config.policy } : {}),
  });
  if (!workspace.store) throw new Error("engram: the workspace opened no store");
  await createEngramExtension({
    db: workspace.open().db,
    adapter: workspace.store.adapter,
    policy: workspace.policy,
    actor: config.actor,
    storeRoots: [config.root],
  })(pi);
  // Registered after the Engram extension's own handlers, so the log closes last.
  pi.on("session_shutdown", () => workspace.close());
}

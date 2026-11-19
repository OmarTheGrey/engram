// The Engram pi package's extension (card PX3): opens the workspace the
// environment names (config.ts) through the opener the engram CLI and server
// use, and loads the Engram extension of packages/pi-extension over it. The
// tools and every gate are that extension's; this file only wires a
// workspace to it.
import { homedir, userInfo } from "node:os";
import { CONFIG_DIR_NAME, type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent";
import { createEngramExtension, uuidv7 } from "@engram/pi-extension";
import { MEMORY_DB, openWorkspace } from "@engram/server";
import { packageConfig, protectedPaths } from "./config.ts";

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
  const { target } = workspace;
  // The log and pi's settings are guarded like a store root (card RV5, RV-SRF-3).
  const protect = protectedPaths({
    logPath: target.backend === "sqlite" && target.path !== MEMORY_DB ? target.path : undefined,
    cwd,
    configDir: CONFIG_DIR_NAME,
    agentDir: getAgentDir(),
  });
  await createEngramExtension({
    db: workspace.open().db,
    adapter: workspace.store.adapter,
    policy: workspace.policy,
    actor: config.actor,
    storeRoots: [config.root],
    protect,
    protectBelow: [cwd, homedir()],
  })(pi);
  // Registered after the Engram extension's own handlers, so the log closes last.
  pi.on("session_shutdown", () => workspace.close());
}

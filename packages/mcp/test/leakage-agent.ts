// An MCP client on the Engram MCP server, in memory, for card E8.16's suites:
// this package's leak suite and the CLI's parity suite (which has no MCP SDK
// of its own and imports this file). Every call is the launch actor's, with
// source model, as `engram mcp --as` makes it.
import type { Actor } from "@engram/core";
import type { EngramClient } from "@engram/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/server.ts";

/** A tool caller as `actor` over `client`, every tool listed (memory_supersede included). */
export async function mcpAgent(options: {
  client: EngramClient;
  actor: Actor;
  now: () => string;
  newId: () => string;
}) {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await createMcpServer({ ...options, supersede: true }).connect(serverSide);
  const mcp = new Client({ name: "leakage", version: "0" });
  await mcp.connect(clientSide);
  return async (name: string, args: Record<string, unknown>) => {
    const result = (await mcp.callTool({ name, arguments: args })) as {
      content: { type: string; text: string }[];
    };
    return result.content[0]?.text ?? "";
  };
}

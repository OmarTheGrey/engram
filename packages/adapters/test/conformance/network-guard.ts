// Refuses the network for the conformance run (review finding R4-12). Not only
// `fetch`: every TCP or TLS connection goes through net.Socket's connect
// (http, https, undici and most clients), and DNS lookups would leak host
// names before any connection, so all three are replaced. Each attempt is
// recorded, and the suite requires none. ENGRAM_OFFLINE=1, which CI sets, is
// read by the runner's model cache only; it does not stop an adapter's
// dependency from opening a socket, which is why this guard exists.
import dns from "node:dns";
import net from "node:net";

export interface NetworkGuard {
  /** One line per refused attempt. */
  attempts: string[];
  restore(): void;
}

const REFUSED = "conformance: network access refused";

export function installNetworkGuard(): NetworkGuard {
  const attempts: string[] = [];
  const refuse = (what: string): never => {
    attempts.push(what);
    throw new Error(`${REFUSED} (${what})`);
  };

  const realFetch = globalThis.fetch;
  const realConnect = net.Socket.prototype.connect;
  const realLookup = dns.lookup;
  const realPromisesLookup = dns.promises.lookup;

  globalThis.fetch = (async (input: string | URL | Request) =>
    refuse(`fetch ${String(input instanceof Request ? input.url : input)}`)) as typeof fetch;
  net.Socket.prototype.connect = function connect(...args: unknown[]) {
    return refuse(`socket connect ${JSON.stringify(args[0]) ?? ""}`);
  } as typeof net.Socket.prototype.connect;
  dns.lookup = ((host: string) => refuse(`dns lookup ${host}`)) as unknown as typeof dns.lookup;
  dns.promises.lookup = (async (host: string) =>
    refuse(`dns lookup ${host}`)) as typeof dns.promises.lookup;

  return {
    attempts,
    restore() {
      globalThis.fetch = realFetch;
      net.Socket.prototype.connect = realConnect;
      dns.lookup = realLookup;
      dns.promises.lookup = realPromisesLookup;
    },
  };
}

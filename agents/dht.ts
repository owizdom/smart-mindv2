/**
 * DHT Peer Discovery
 *
 * Uses BitTorrent Mainline DHT (BEP 5) for decentralized peer discovery.
 * Agents announce their HTTP port on a shared infohash derived from the
 * network ID. No central registry — peers find each other through the DHT.
 *
 * Local mode:  set DHT_BOOTSTRAP=127.0.0.1:<dht-port> to form a local mesh.
 * Production:  leave DHT_BOOTSTRAP unset; public BitTorrent bootstrap nodes are used.
 *
 * Flow:
 *   1. Agent starts DHT node on UDP :DHT_PORT
 *   2. Announces its HTTP port under infohash(NETWORK_ID)
 *   3. Looks up the same infohash → receives peer {host, port} events
 *   4. getPeerUrls() returns discovered peers for use in gossip
 */

import crypto from "crypto";

// bittorrent-dht is an ESM-only package; CJS can load it via dynamic import()
// We defer the import to initDHT() so the module loads without issues.

interface DHTNode {
  listen(port: number, cb: () => void): void;
  announce(infoHash: Buffer, port: number, cb?: (err: Error | null) => void): void;
  lookup(infoHash: Buffer): void;
  destroy(cb?: () => void): void;
  on(event: "peer", cb: (peer: { host: string; port: number }, infoHash: Buffer, from: unknown) => void): void;
  on(event: "error", cb: (err: Error) => void): void;
  on(event: "ready", cb: () => void): void;
  on(event: "node",  cb: (node: { host: string; port: number }) => void): void;
}

interface PeerInfo {
  url: string;
  lastSeen: number;
}

const ANNOUNCE_INTERVAL_MS = 30_000;
const EVICT_INTERVAL_MS    = 60_000;
const PEER_TTL_MS          = 120_000;

let dhtNode: DHTNode | null = null;
const discoveredPeers = new Map<string, PeerInfo>();

let ownHttpPort = 0;
let ownHttpHost = "127.0.0.1";

/** sha1("swarm-mind:<networkId>") — 20-byte infohash */
function networkInfohash(networkId: string): Buffer {
  return crypto.createHash("sha1").update(`swarm-mind:${networkId}`).digest();
}

export interface DHTInitOptions {
  httpPort:   number;     // HTTP port we announce to peers
  dhtPort:    number;     // UDP port for the DHT protocol
  networkId:  string;     // all agents on the same swarm must match this
  bootstrap?: string[];   // "host:port" pairs — omit for public DHT
  httpHost?:  string;     // our HTTP host for self-filter (default 127.0.0.1)
}

export async function initDHT(opts: DHTInitOptions): Promise<void> {
  const { httpPort, dhtPort, networkId, bootstrap, httpHost = "127.0.0.1" } = opts;
  ownHttpPort = httpPort;
  ownHttpHost = httpHost;

  const infohash = networkInfohash(networkId);

  // Bootstrap: explicit list for local dev, public BitTorrent nodes for production
  const bootstrapNodes = (bootstrap && bootstrap.length > 0)
    ? bootstrap.map(b => {
        const i = b.lastIndexOf(":");
        return { host: b.slice(0, i), port: parseInt(b.slice(i + 1)) };
      })
    : [
        { host: "router.bittorrent.com",   port: 6881 },
        { host: "dht.transmissionbt.com",  port: 6881 },
        { host: "router.utorrent.com",     port: 6881 },
      ];

  // bittorrent-dht is ESM-only; TypeScript (CommonJS target) rewrites import() to
  // require(), which fails for ESM packages. Using Function() forces a true
  // native import() call that Node.js CJS can use to load ESM modules.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const mod = await (Function('return import("bittorrent-dht")')() as Promise<{default: new (opts?: object) => DHTNode}>);
  const DHTClass = mod.default;
  dhtNode = new DHTClass({ bootstrap: bootstrapNodes });

  await new Promise<void>(resolve => {
    dhtNode!.listen(dhtPort, () => {
      console.log(`[DHT] Listening on UDP :${dhtPort}  network="${networkId}"`);
      resolve();
    });
    dhtNode!.on("error", (err: Error) => {
      console.warn(`[DHT] ${err.message}`);
    });
    // Don't block startup if the DHT port fails to bind
    setTimeout(resolve, 3000);
  });

  dhtNode.on("peer", (peer, _infoHash, _from) => {
    // Filter ourselves out
    if (peer.port === ownHttpPort &&
        (peer.host === ownHttpHost || peer.host === "127.0.0.1" || peer.host === "::1")) {
      return;
    }
    const url = `http://${peer.host}:${peer.port}`;
    if (!discoveredPeers.has(url)) {
      console.log(`[DHT] Discovered peer: ${url}`);
    }
    discoveredPeers.set(url, { url, lastSeen: Date.now() });
  });

  let firstCycleDone = false;

  function cycle(): void {
    firstCycleDone = true;
    dhtNode!.announce(infohash, httpPort, (err) => {
      if (err) console.warn(`[DHT] Announce: ${err.message}`);
      // bittorrent-dht's lookup() emits local peer store on the next tick.
      // Delay so that other nodes' announce_peer messages have time to arrive
      // and populate our local store before lookup() runs.
      setTimeout(() => dhtNode!.lookup(infohash), 2000);
    });
  }

  // Announce as soon as the routing table has at least one actual peer.
  // 'ready' fires when bootstrap completes — even with an empty routing table,
  // so it's not reliable here. 'node' fires each time a real DHT node is added.
  dhtNode.on("node", () => {
    if (!firstCycleDone) {
      console.log(`[DHT] First routing table peer — announcing http :${httpPort}`);
      cycle();
    }
  });

  // Fallback: bootstrap node that starts first with no peers will never
  // get 'ready' until others connect. After 15 s, announce anyway so
  // inbound peers can find us via get_peers once they join.
  setTimeout(() => {
    if (!firstCycleDone) {
      console.log(`[DHT] No bootstrap peers yet — announcing speculatively`);
      cycle();
    }
  }, 15_000);

  // Periodic re-announce to keep entries alive in the DHT
  setInterval(cycle, ANNOUNCE_INTERVAL_MS);

  // Extra lookups in between to catch peers whose announce_peer arrived
  // after our first lookup completed (common in 2-3 node local networks)
  setInterval(() => {
    if (dhtNode) dhtNode.lookup(infohash);
  }, 10_000);

  setInterval(() => {
    const now = Date.now();
    for (const [url, info] of discoveredPeers) {
      if (now - info.lastSeen > PEER_TTL_MS) {
        discoveredPeers.delete(url);
        console.log(`[DHT] Evicted stale peer: ${url}`);
      }
    }
  }, EVICT_INTERVAL_MS);
}

/** HTTP URLs of peers currently known via DHT */
export function getDiscoveredPeers(): string[] {
  return Array.from(discoveredPeers.values()).map(p => p.url);
}

/** Summary for logging / /state endpoint */
export function getDHTStatus(): { dhtPort: number; networkPeers: string[] } {
  return {
    dhtPort:      ownHttpPort ? ownHttpPort + 1000 : 0,
    networkPeers: getDiscoveredPeers(),
  };
}

export async function stopDHT(): Promise<void> {
  return new Promise(resolve => {
    if (dhtNode) {
      dhtNode.destroy(() => resolve());
    } else {
      resolve();
    }
  });
}

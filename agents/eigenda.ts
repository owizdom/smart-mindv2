/**
 * EigenDA Client
 *
 * Talks to an EigenDA Proxy sidecar (REST → gRPC bridge).
 * Each blob dispersed to EigenDA is attested by a quorum of EigenLayer
 * operators who have restaked ETH — making the commitment a real
 * cryptographic attestation, not just a local hash.
 *
 * Infrastructure needed:
 *   docker run -p 4242:4242 ghcr.io/layr-labs/eigenda-proxy:latest \
 *     --memstore.enabled                         ← local dev / no wallet needed
 *
 *   Or against Holesky testnet (needs a funded private key):
 *     --eigenda-disperser-rpc=disperser-holesky.eigenda.xyz:443 \
 *     --eigenda-eth-rpc=https://ethereum-holesky-rpc.publicnode.com \
 *     --eigenda-svc-manager-addr=0xD4A7E1Bd8015057293f0D0A557088c286942e84b \
 *     --eigenda-signer-private-key-hex=<YOUR_KEY>
 *
 * Set EIGENDA_PROXY_URL=http://localhost:4242 to enable.
 * Leave unset to skip DA and fall back to local hash attestation.
 */

const PROXY = process.env.EIGENDA_PROXY_URL;
const TIMEOUT_MS = 30_000;

export interface DAResult {
  commitment: string;   // hex-encoded KZG commitment from EigenDA
  size: number;         // blob bytes dispersed
  attestedAt: number;   // unix ms when commitment returned
}

export function isEnabled(): boolean {
  return !!PROXY;
}

/**
 * Disperse a JSON-serialisable payload to EigenDA.
 * Returns a DAResult whose `commitment` replaces the SHA-256 hash
 * in Pheromone.attestation — it is signed by restaked ETH operators.
 */
export async function disperseBlob(payload: unknown): Promise<DAResult> {
  if (!PROXY) throw new Error("EIGENDA_PROXY_URL not set");

  const body = Buffer.from(JSON.stringify(payload), "utf-8");

  const res = await fetch(`${PROXY}/put/`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/octet-stream" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`EigenDA disperser error ${res.status}: ${text.slice(0, 120)}`);
  }

  const commitment = (await res.text()).trim();
  return { commitment, size: body.length, attestedAt: Date.now() };
}

/**
 * Retrieve a blob from EigenDA by its commitment.
 * Returns the original JSON payload, or null if unavailable.
 */
export async function retrieveBlob<T = unknown>(commitment: string): Promise<T | null> {
  if (!PROXY) return null;

  try {
    const res = await fetch(`${PROXY}/get/${commitment}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return JSON.parse(buf.toString("utf-8")) as T;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget disperse — submits in background, calls onSuccess with
 * the commitment when done. Used so agent steps are not blocked.
 */
export function disperseAsync(
  payload: unknown,
  onSuccess: (result: DAResult) => void,
  label = "blob"
): void {
  if (!PROXY) return;

  disperseBlob(payload)
    .then((result) => {
      console.log(`  [EigenDA] attested ${label}: ${result.commitment.slice(0, 20)}… (${result.size}B)`);
      onSuccess(result);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [EigenDA] disperse failed for ${label}: ${msg.slice(0, 80)}`);
    });
}

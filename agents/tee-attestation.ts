/**
 * EigenCompute TEE Attestation
 *
 * Fetches the Intel TDX quote from EigenCloud's local metadata endpoint.
 * Tries multiple known EigenCloud/EigenCompute attestation endpoints in order.
 *
 * When running locally (no TEE), returns a graceful stub so dev works normally.
 */

import crypto from "crypto";

export interface TEEAttestation {
  instanceId:  string;   // EIGENCLOUD_INSTANCE_ID or "local"
  teeType:     string;   // "tdx" | "local" | "tdx-unavailable"
  quoteB64:    string;   // base64-encoded TDX DCAP quote (empty when local)
  quoteSha256: string;   // sha256(quoteB64) — stable content address of the quote
  fetchedAt:   number;   // unix ms when the quote was fetched
  endpoint?:   string;   // which endpoint succeeded
}

let cached: TEEAttestation | null = null;

// Known EigenCloud/EigenCompute TEE attestation endpoints — tried in order
const CANDIDATE_ENDPOINTS = [
  { url: "http://localhost:29343/attest/tdx",         method: "POST" },
  { url: "http://localhost:29343/attest",              method: "POST" },
  { url: "http://localhost:29343/v1/tdx/attestation", method: "POST" },
  { url: "http://localhost:29343/tdx/attest",         method: "POST" },
  { url: "http://localhost:8080/attest/tdx",          method: "POST" },
  { url: "http://localhost:8080/attest",              method: "GET"  },
  { url: "http://localhost:4050/attest/tdx",          method: "POST" },
];

async function tryEndpoint(
  url: string,
  method: string,
  userData: string,
): Promise<{ quote: string } | null> {
  try {
    const init: RequestInit = {
      method,
      signal: AbortSignal.timeout(5_000),
    };
    if (method === "POST") {
      init.headers = { "Content-Type": "application/json" };
      init.body    = JSON.stringify({ userData, reportData: userData });
    }
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const text = await res.text();
    // Handle both JSON {"quote":"..."} and raw base64 string responses
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const q = (json.quote ?? json.tdx_quote ?? json.attestation ?? "") as string;
      if (q) return { quote: q };
    } catch {
      // raw base64 response
      if (text.length > 32) return { quote: text.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch (and cache) the TDX attestation quote from EigenCloud.
 * Tries multiple endpoints so it works regardless of EigenCloud's exact config.
 */
export async function getTEEAttestation(): Promise<TEEAttestation> {
  if (cached) return cached;

  const instanceId = process.env.EIGENCLOUD_INSTANCE_ID || "local";

  if (instanceId === "local") {
    cached = {
      instanceId,
      teeType:     "local",
      quoteB64:    "",
      quoteSha256: "no-tee-local-dev",
      fetchedAt:   Date.now(),
    };
    console.log("[TEE] Local dev mode — no TDX quote");
    return cached;
  }

  // If a specific URL is configured, try it first before the candidates
  const configured = process.env.EIGENCLOUD_ATTESTATION_URL;
  const endpoints = configured
    ? [{ url: configured, method: "POST" }, ...CANDIDATE_ENDPOINTS]
    : CANDIDATE_ENDPOINTS;

  console.log(`[TEE] Probing ${endpoints.length} attestation endpoints…`);

  for (const ep of endpoints) {
    console.log(`[TEE]   trying ${ep.method} ${ep.url}`);
    const result = await tryEndpoint(ep.url, ep.method, instanceId);
    if (result) {
      const quoteB64 = result.quote;
      cached = {
        instanceId,
        teeType:     "tdx",
        quoteB64,
        quoteSha256: crypto.createHash("sha256").update(quoteB64).digest("hex"),
        fetchedAt:   Date.now(),
        endpoint:    ep.url,
      };
      console.log(`[TEE] TDX quote fetched via ${ep.url}`);
      console.log(`[TEE] quote sha256  ${cached.quoteSha256.slice(0, 16)}…`);
      return cached;
    }
  }

  console.warn("[TEE] All attestation endpoints failed — running without hardware attestation");
  console.warn("[TEE] Tried:", endpoints.map(e => e.url).join(", "));
  cached = {
    instanceId,
    teeType:     "tdx-unavailable",
    quoteB64:    "",
    quoteSha256: "fetch-failed",
    fetchedAt:   Date.now(),
  };

  return cached;
}

/** Returns the cached quote, or null if getTEEAttestation() hasn't been called yet. */
export function getCachedAttestation(): TEEAttestation | null {
  return cached;
}

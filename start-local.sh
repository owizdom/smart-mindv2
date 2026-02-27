#!/bin/bash
# ── Swarm Mind — Local Multi-Process Launch ──
# Starts EigenDA proxy + 3 independent agent processes.
# No Docker, no coordinator — agents derive phase from wall-clock Wasm state machine.

set -e
cd "$(dirname "$0")"

# Kill any stale processes on our ports before starting
for port in 3001 3002 3003 3004 4002 4003 4004; do
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  clearing port $port"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done
sleep 2

# Load base env
export $(grep -v '^#' .env | xargs) 2>/dev/null || true

echo "╔═══════════════════════════════════════════════════╗"
echo "║        SWARM MIND — Trustless Architecture        ║"
echo "║  3 agents · DHT discovery · Wasm phase clock      ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# ── EigenDA Proxy ──────────────────────────────────────
echo "[1/4] Starting EigenDA proxy (memstore)..."
if ! docker ps 2>/dev/null | grep -q eigenda-proxy-local; then
  docker run -d --rm \
    --name eigenda-proxy-local \
    -p 4242:4242 \
    ghcr.io/layr-labs/eigenda-proxy:latest \
    --memstore.enabled --addr=0.0.0.0 --port=4242 \
    2>/dev/null && echo "  → EigenDA proxy running on :4242" \
    || echo "  ⚠ Docker not available — pheromones use SHA-256 fallback"
else
  echo "  → EigenDA proxy already running"
fi

sleep 2

# ── Build ─────────────────────────────────────────────
echo "[2/4] Building TypeScript..."
npx tsc --noEmit 2>&1 | head -20 || true
npx tsc 2>&1 | tail -5

# ── Dashboard (read-only observer — no phase control) ─
echo "[3/4] Starting dashboard..."
AGENT_URLS=http://localhost:3002,http://localhost:3003,http://localhost:3004 \
DASHBOARD_PORT=3001 \
EIGENDA_PROXY_URL=http://localhost:4242 \
EIGENDA_ENABLED=true \
node dist/dashboard/server-multi.js 2>&1 | sed 's/^/\033[32m[Dash]   \033[0m/' &
DASH_PID=$!

sleep 2

# ── Agent Kepler ──────────────────────────────────────
# Kepler starts first and acts as the local DHT bootstrap for the others.
# No PEER_URLS needed — Hubble and Voyager discover Kepler (and each other) via DHT.
echo "[4/4] Starting agents..."
AGENT_INDEX=0 \
AGENT_PORT=3002 \
DHT_PORT=4002 \
NETWORK_ID=swarm-mind-v2 \
DB_PATH=./swarm-kepler.db \
EIGENDA_PROXY_URL=http://localhost:4242 \
EIGENDA_ENABLED=true \
node dist/agents/runner.js 2>&1 | sed 's/^/\033[36m[Kepler] \033[0m/' &
KEPLER_PID=$!

sleep 1

# ── Agent Hubble ──────────────────────────────────────
# Bootstraps from Kepler's DHT node; discovers all peers from there.
AGENT_INDEX=1 \
AGENT_PORT=3003 \
DHT_PORT=4003 \
NETWORK_ID=swarm-mind-v2 \
DHT_BOOTSTRAP=127.0.0.1:4002 \
DB_PATH=./swarm-hubble.db \
EIGENDA_PROXY_URL=http://localhost:4242 \
EIGENDA_ENABLED=true \
node dist/agents/runner.js 2>&1 | sed 's/^/\033[35m[Hubble] \033[0m/' &
HUBBLE_PID=$!

sleep 1

# ── Agent Voyager ─────────────────────────────────────
AGENT_INDEX=2 \
AGENT_PORT=3004 \
DHT_PORT=4004 \
NETWORK_ID=swarm-mind-v2 \
DHT_BOOTSTRAP=127.0.0.1:4002 \
DB_PATH=./swarm-voyager.db \
EIGENDA_PROXY_URL=http://localhost:4242 \
EIGENDA_ENABLED=true \
node dist/agents/runner.js 2>&1 | sed 's/^/\033[33m[Voyager]\033[0m/' &
VOYAGER_PID=$!

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Dashboard  →  http://localhost:3001"
echo "  Kepler     →  http://localhost:3002/attestation"
echo "  Hubble     →  http://localhost:3003/attestation"
echo "  Voyager    →  http://localhost:3004/attestation"
echo "  EigenDA    →  http://localhost:4242"
echo "  Phase      →  wall-clock Wasm state machine (no coordinator)"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop all agents."

# Cleanup on exit
trap "echo 'Shutting down...'; kill $KEPLER_PID $HUBBLE_PID $VOYAGER_PID $DASH_PID 2>/dev/null; docker stop eigenda-proxy-local 2>/dev/null; exit 0" INT TERM

wait

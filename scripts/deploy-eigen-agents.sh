#!/usr/bin/env bash
# ── Swarm Mind — Deploy 3 Separate EigenCloud Instances ──────────────────────
#
# Deploys Kepler, Hubble, and Voyager as independent EigenCloud workloads.
# Each runs inside its own Intel TDX enclave — hardware-enforced isolation.
# Agents discover each other automatically via BitTorrent DHT — no peer URL needed.
#
# Prerequisites:
#   export ECLOUD_PRIVATE_KEY=0x...
#   export IMAGE=docker.io/<you>/swarm-mind-agent:latest
#
# Usage — deploy all 3 at once:
#   bash scripts/deploy-eigen-agents.sh [path-to-env]
#
# Usage — upgrade existing apps:
#   KEPLER_APP_ID=0x... HUBBLE_APP_ID=0x... VOYAGER_APP_ID=0x... \
#   bash scripts/deploy-eigen-agents.sh [path-to-env]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="${1:-.env}"

: "${ECLOUD_PRIVATE_KEY:?Set ECLOUD_PRIVATE_KEY}"
: "${IMAGE:=docker.io/owizdom90/swarm-mind-agent:latest}"

ECLOUD_RPC_URL="${ECLOUD_RPC_URL:-https://ethereum-sepolia.publicnode.com}"
ENVIRONMENT="${ECLOUD_ENVIRONMENT:-sepolia}"
INSTANCE_TYPE="${ECLOUD_INSTANCE_TYPE:-g1-standard-4t}"
NETWORK_ID="${NETWORK_ID:-swarm-mind-v2}"
RUN_ID="$(date +%Y%m%d-%H%M%S)"

command -v docker  >/dev/null || { echo "docker required"; exit 1; }
command -v ecloud  >/dev/null || { echo "ecloud CLI required — install from eigencloud.xyz"; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Env file not found: $ENV_FILE"; exit 1; }

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Swarm Mind — EigenCloud 3-Agent Deploy                  ║"
echo "║  Each agent gets its own TDX enclave + TEE quote         ║"
echo "║  Discovery: BitTorrent DHT (no peer URL needed)          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Build + push agent image ──────────────────────────────────────────
echo "==> Building agent image: $IMAGE"
docker build --platform linux/amd64 -t "$IMAGE" .
echo "==> Pushing image: $IMAGE"
docker push "$IMAGE"

# ── Helper: deploy or upgrade one agent instance ─────────────────────
deploy_agent() {
  local name="$1"
  local index="$2"
  local app_id="${3:-}"   # pass existing app ID to upgrade instead of redeploy

  local app_name="swarm-$(echo "$name" | tr '[:upper:]' '[:lower:]')-${RUN_ID}"

  echo ""
  echo "==> Deploying $name (index=$index)"

  # Merge base env + agent-specific overrides into a temp file
  local tmp_env
  tmp_env="$(mktemp)"
  cp "$ENV_FILE" "$tmp_env"
  {
    echo "AGENT_INDEX=$index"
    echo "AGENT_PORT=80"
    echo "DHT_PORT=4002"
    echo "NETWORK_ID=$NETWORK_ID"
    echo "DB_PATH=/data/swarm-agent.db"
    # No PEER_URLS needed — agents discover each other via public BitTorrent DHT
  } >> "$tmp_env"

  if [[ -n "$app_id" ]]; then
    echo "  → Upgrading existing app $app_id"
    ecloud compute app upgrade \
      --app-id      "$app_id" \
      --image-ref   "$IMAGE" \
      --env-file    "$tmp_env" \
      --private-key "$ECLOUD_PRIVATE_KEY" \
      --rpc-url     "$ECLOUD_RPC_URL"
  else
    ecloud compute app deploy \
      --environment   "$ENVIRONMENT" \
      --name          "$app_name" \
      --image-ref     "$IMAGE" \
      --dockerfile    "Dockerfile" \
      --env-file      "$tmp_env" \
      --instance-type "$INSTANCE_TYPE" \
      --private-key   "$ECLOUD_PRIVATE_KEY" \
      --rpc-url       "$ECLOUD_RPC_URL" \
      --log-visibility public \
      --skip-profile \
      --resource-usage-monitoring disable
  fi

  rm -f "$tmp_env"
  echo "  ✓ $name deployed"
}

# ── Deploy all 3 agents (or upgrade if app IDs are set) ──────────────
deploy_agent "Kepler"  0 "${KEPLER_APP_ID:-}"
deploy_agent "Hubble"  1 "${HUBBLE_APP_ID:-}"
deploy_agent "Voyager" 2 "${VOYAGER_APP_ID:-}"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  All 3 agents submitted to EigenCloud."
echo "  Each runs in its own TDX enclave."
echo ""
echo "  Agents discover each other via BitTorrent DHT — no setup needed."
echo "  Discovery takes ~30s after both instances are Running."
echo ""
echo "  To upgrade later, set the app IDs and re-run:"
echo "    KEPLER_APP_ID=0x...  HUBBLE_APP_ID=0x...  VOYAGER_APP_ID=0x... \\"
echo "    bash scripts/deploy-eigen-agents.sh .env"
echo "══════════════════════════════════════════════════════════════"

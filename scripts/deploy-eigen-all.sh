#!/usr/bin/env bash

set -euo pipefail

# Deploy script for Emergent Swarm Mind on EigenCompute (all-in-one image)
# Usage:
#   bash scripts/deploy-eigen-all.sh [path-to-env]
# Example:
#   export ECLOUD_PRIVATE_KEY=0x... 
#   export ECLOUD_RPC_URL=https://ethereum-sepolia.publicnode.com
#   export IMAGE=docker.io/owizdom90/swarm-mind:latest
#   APP_NAME=swarm-mind-clean bash scripts/deploy-eigen-all.sh .env

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="${1:-.env}"

: "${ECLOUD_PRIVATE_KEY:?Set ECLOUD_PRIVATE_KEY first}"
: "${ECLOUD_RPC_URL:=https://ethereum-sepolia.publicnode.com}"
: "${IMAGE:=docker.io/owizdom90/swarm-mind:latest}"

APP_NAME="${APP_NAME:-swarm-mind-clean-$(date +%Y%m%d-%H%M%S)}"
ENVIRONMENT="${ECLOUD_ENVIRONMENT:-sepolia}"
INSTANCE_TYPE="${ECLOUD_INSTANCE_TYPE:-g1-standard-4t}"
LOG_VISIBILITY="${ECLOUD_LOG_VISIBILITY:-public}"
RESOURCE_MONITORING="${ECLOUD_RESOURCE_USAGE_MONITORING:-disable}"
DOCKERFILE_PATH="${DOCKERFILE_PATH:-Dockerfile}"

echo "==> preflight"
command -v docker >/dev/null || { echo "docker is required"; exit 1; }
command -v ecloud >/dev/null || { echo "ecloud CLI is required"; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Env file not found: $ENV_FILE"; exit 1; }


echo "==> Build image: $IMAGE"
docker build --platform linux/amd64 -t "$IMAGE" .

echo "==> Push image: $IMAGE"
docker push "$IMAGE"

echo "==> Deploy app on EigenCompute ($ENVIRONMENT)"
ecloud compute app deploy \
  --environment "$ENVIRONMENT" \
  --name "$APP_NAME" \
  --image-ref "$IMAGE" \
  --dockerfile "$DOCKERFILE_PATH" \
  --env-file "$ENV_FILE" \
  --instance-type "$INSTANCE_TYPE" \
  --private-key "$ECLOUD_PRIVATE_KEY" \
  --rpc-url "$ECLOUD_RPC_URL" \
  --log-visibility "$LOG_VISIBILITY" \
  --skip-profile \
  --resource-usage-monitoring "$RESOURCE_MONITORING"

#!/usr/bin/env bash
set -euo pipefail

DB_DIR=/data
mkdir -p "$DB_DIR"

export NODE_ENV="${NODE_ENV:-production}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3001}"

pids=()

cleanup() {
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

trap cleanup EXIT INT TERM

start_agent() {
  local index="$1"
  local port="$2"
  local peers="$3"
  AGENT_INDEX="$index" \
    AGENT_PORT="$port" \
    DB_PATH="$DB_DIR/swarm-agent-${index}.db" \
    PEER_URLS="$peers" \
    node dist/agents/runner.js &
  pids+=("$!")
}

start_agent 0 3002 "http://127.0.0.1:3003,http://127.0.0.1:3004"
start_agent 1 3003 "http://127.0.0.1:3002,http://127.0.0.1:3004"
start_agent 2 3004 "http://127.0.0.1:3002,http://127.0.0.1:3003"

AGENT_URLS="http://127.0.0.1:3002,http://127.0.0.1:3003,http://127.0.0.1:3004" \
  DASHBOARD_PORT="$DASHBOARD_PORT" \
  node dist/dashboard/server-multi.js &
pids+=("$!")

wait -n
cleanup
exit $?

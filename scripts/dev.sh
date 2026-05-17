#!/bin/bash
set -Eeuo pipefail


# Default 5001: macOS AirPlay Receiver binds :5000 and cannot be freed reliably.
PORT="${PORT:-5001}"
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"
export PORT DEPLOY_RUN_PORT


cd "${COZE_WORKSPACE_PATH}"

# PIDs listening on DEPLOY_RUN_PORT (Linux: ss; macOS / fallback: lsof)
_listeners_on_deploy_port() {
    local pids=""
    if command -v ss >/dev/null 2>&1; then
      pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    fi
    if [[ -z "${pids}" ]] && command -v lsof >/dev/null 2>&1; then
      pids=$(lsof -tiTCP:"${DEPLOY_RUN_PORT}" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ' | xargs echo -n 2>/dev/null || true)
    fi
    echo "${pids}"
}

kill_port_if_listening() {
    local pids
    pids=$(_listeners_on_deploy_port)
    if [[ -z "${pids}" ]]; then
      echo "Port ${DEPLOY_RUN_PORT} is free."
      return
    fi
    echo "Port ${DEPLOY_RUN_PORT} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs kill -9
    sleep 1
    pids=$(_listeners_on_deploy_port)
    if [[ -n "${pids}" ]]; then
      echo "Warning: port ${DEPLOY_RUN_PORT} still busy after SIGKILL, PIDs: ${pids}"
    else
      echo "Port ${DEPLOY_RUN_PORT} cleared."
    fi
}

echo "Clearing port ${PORT} before start."
kill_port_if_listening
echo "Starting HTTP service on port ${PORT} for dev..."

pnpm tsx watch src/server.ts

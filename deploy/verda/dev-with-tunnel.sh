#!/bin/sh
# Runs the app on this computer with a tunnel to Nemotron on the Verda instance, and keeps the tunnel
# alive for as long as the app runs (it reconnects if the connection drops).
#   sh deploy/verda/dev-with-tunnel.sh <instance-ip> [port]
set -eu
IP="${1:?Give the Verda instance IP address}"
PORT="${2:-3000}"
KEY="${SISU_VERDA_KEY:-$HOME/.ssh/sisu_verda}"

keep_tunnel() {
  while true; do
    ssh -N -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -o ExitOnForwardFailure=yes \
      -o StrictHostKeyChecking=accept-new -L 18000:127.0.0.1:8000 "root@$IP" || true
    sleep 2
  done
}
keep_tunnel &
TUNNEL=$!
trap 'kill $TUNNEL 2>/dev/null; pkill -f "18000:127.0.0.1:8000" 2>/dev/null || true' EXIT INT TERM
npm run dev -- --port "$PORT"

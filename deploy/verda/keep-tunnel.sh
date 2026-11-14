#!/bin/sh
# Keeps the tunnel to Nemotron on the Verda instance open, for as long as this script runs: when the network
# drops (venue Wi-Fi, a closed lid) the tunnel dies, and this opens it again within a few seconds.
# Use it beside any dev server that was not started with dev-with-tunnel.sh (a worktree, `npm run dev`).
#   sh deploy/verda/keep-tunnel.sh <instance-ip> [path-to-ssh-key]
# Without it, a dropped tunnel stays down: the app keeps answering from the NVIDIA backup, but our own GPU is
# out of the demo until someone notices (GET /api/health/ready shows it).
set -eu
IP="${1:?Give the Verda instance IP address}"
KEY="${2:-${SISU_VERDA_KEY:-$HOME/.ssh/sisu_verda}}"
PORT=18000
CHECK_EVERY=3

listening() { nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; }

echo "Keeping the tunnel open: http://127.0.0.1:$PORT/v1 → Nemotron on $IP (Ctrl-C to stop)"
while true; do
  if ! listening; then
    echo "$(date '+%H:%M:%S') tunnel is down, opening it"
    # Runs until the connection drops. A dead connection is noticed within about 30 seconds.
    ssh -N -i "$KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=2 -o ConnectTimeout=8 -o ExitOnForwardFailure=yes \
      -o StrictHostKeyChecking=accept-new -L "$PORT:127.0.0.1:8000" "root@$IP" || true
    echo "$(date '+%H:%M:%S') tunnel closed"
  fi
  sleep "$CHECK_EVERY"
done

#!/bin/sh
# Opens a private, encrypted tunnel from this computer to Nemotron on the Verda instance.
# After this, the app reaches the model at http://127.0.0.1:18000/v1 (VERDA_BASE_URL).
#   sh deploy/verda/tunnel.sh <instance-ip> [path-to-ssh-key]
set -eu
IP="${1:?Give the Verda instance IP address}"
KEY="${2:-$HOME/.ssh/sisu_verda}"
pkill -f "ssh.*18000:127.0.0.1:8000" 2>/dev/null || true
ssh -f -N -i "$KEY" -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=accept-new \
  -L 18000:127.0.0.1:8000 "root@$IP"
echo "Tunnel open: http://127.0.0.1:18000/v1 → Nemotron on $IP"

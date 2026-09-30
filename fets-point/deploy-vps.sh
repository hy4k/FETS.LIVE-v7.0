#!/usr/bin/env bash
# The old fixed-date release script is superseded by the verified working-tree deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
exec bash scripts/deploy-reviewed-vps.sh "$@"

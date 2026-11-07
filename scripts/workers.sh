#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

configs=(samples/*/wrangler.jsonc combos/*/wrangler.jsonc)
config_flags=()
for config in "${configs[@]}"; do
  config_flags+=(-c "$config")
done

case "${1:-}" in
  dev)
    exec wrangler dev --port "${PORT:-8790}" -c apps/dashboard/wrangler.jsonc "${config_flags[@]}"
    ;;
  deploy)
    for config in "${configs[@]}" apps/dashboard/wrangler.jsonc; do
      wrangler deploy -c "$config"
    done
    ;;
  types)
    for config in apps/dashboard/wrangler.jsonc "${configs[@]}"; do
      (cd "$(dirname "$config")" && wrangler types)
    done
    ;;
  *)
    printf '%s\n' "usage: scripts/workers.sh dev|deploy|types" >&2
    exit 2
    ;;
esac

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="/media/babylon-web/tijdreis"

if [[ ! -d /media/babylon-web ]]; then
  echo "Mount or path missing: /media/babylon-web" >&2
  exit 1
fi

mkdir -p "$DEST"

rsync -av --delete \
  --include 'index.html' \
  --include 'app.js' \
  --exclude '*' \
  "${ROOT}/" "${DEST}/"

echo "Deployed to ${DEST}/"
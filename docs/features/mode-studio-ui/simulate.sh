#!/usr/bin/env bash
# WHY: Post-implementation rehearsal for Mode Studio. It reads the real built
# route and PWA output through the node simulation, not hardcoded design facts.
# PACK: mode-studio-ui
# 2026-11-23 opencode: created after the route landed. [pack: mode-studio-ui]
# Run: bash docs/features/mode-studio-ui/simulate.sh
set -euo pipefail

cd "$(dirname "$0")/../../../v1"

if [ ! -f out/index.html ]; then
  echo "FAIL: out/index.html is missing. Run npm run build first." >&2
  exit 1
fi
if [ ! -f out/modes/index.html ]; then
  echo "FAIL: out/modes/index.html is missing. The Learning modes route did not build." >&2
  exit 1
fi

npx vitest run tests/simulate-mode-studio.test.ts --reporter=verbose
printf '\nPASS: mode-studio-ui contract rehearsal green\n'

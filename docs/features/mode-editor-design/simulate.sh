#!/usr/bin/env bash
# WHY: Post-implementation rehearsal for the full-page editor. It checks the
# real built route and the pure behavior behind both tabs.
# PACK: mode-editor-design
# 2026-11-23 opencode: created after the route landed. [pack: mode-editor-design]
# Run: bash docs/features/mode-editor-design/simulate.sh
set -euo pipefail

cd "$(dirname "$0")/../../../v1"

if [ ! -f out/index.html ] || [ ! -f out/modes/editor/index.html ]; then
  echo "FAIL: build first; out/modes/editor/index.html is missing." >&2
  exit 1
fi

npx vitest run tests/mode-editor-utils.test.ts tests/simulate-mode-studio.test.ts --reporter=verbose
printf '\nPASS: mode-editor-design contract rehearsal green\n'

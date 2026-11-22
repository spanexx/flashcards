#!/usr/bin/env bash
# WHY: The post-implementation rehearsal must read the built app, not a stale
# bundle. It refuses to run before a build and prints PASS only after every
# scene in the real helpers, the stylesheet and the built output has passed.
# PACK: study-card-clarity
# 2026-11-22 opencode: created for the study-card-clarity pack. [pack: study-card-clarity]

set -euo pipefail

cd "$(dirname "$0")/../../../v1"

if [[ ! -f out/index.html ]]; then
  echo "No static build found. Run: npm run build" >&2
  exit 1
fi

node node_modules/vitest/vitest.mjs run tests/simulate-study-card-clarity.test.ts --reporter=verbose
echo "PASS: study-card-clarity contract"

#!/usr/bin/env bash
# Canonical rehearsal for course-dictionary.
# The pre-implementation design is kept in archive/simulate-pre.html; this
# script walks the shipped behaviour through the real router and checks the
# built screens.
# It refuses to run before a build so the screen check is real.

set -euo pipefail

cd "$(dirname "$0")/../../../v1"

if [ ! -f out/index.html ]; then
  echo "No static build found. Run: npm run build" >&2
  exit 1
fi

printf '\n== course-dictionary canonical rehearsal ==\n'
npm test -- --run tests/simulate-course-dictionary.test.ts

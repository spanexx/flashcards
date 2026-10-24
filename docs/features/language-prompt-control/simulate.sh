#!/usr/bin/env bash
# Canonical rehearsal for language-prompt-control.
# The pre-implementation script printed fixed facts; this one reads real state
# through the browser router and checks the built client after `npm run build`.
#
# The browser-only interactions (listening reveal, hint race, editor reset) are
# rehearsed separately through the built output with Edge CDP. Their result is
# recorded in simulate-post.md.

set -euo pipefail

cd "$(dirname "$0")/../../../v1"

printf '\n== language-prompt-control canonical rehearsal ==\n'
npm test -- --run tests/simulate-language-prompt-control.test.ts

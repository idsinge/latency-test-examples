#!/usr/bin/env bash
# verify.sh — wire a verification harness into an example app for a manual check session,
# then clean up reversibly on exit (Enter or Ctrl+C).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK="${1:-}"

if [[ -z "$FRAMEWORK" ]]; then
  echo "Usage: $0 <framework>" >&2
  echo "  Valid: vanilla-js react vue svelte angular nextjs" >&2
  exit 1
fi

case "$FRAMEWORK" in
  vanilla-js|react|vue|svelte|angular|nextjs) ;;
  *)
    echo "Unknown framework: '$FRAMEWORK'" >&2
    echo "  Valid: vanilla-js react vue svelte angular nextjs" >&2
    exit 1
    ;;
esac

APP="$SCRIPT_DIR/examples/$FRAMEWORK"
HARNESS="$SCRIPT_DIR/verification/$FRAMEWORK"
COPIED=()
PATCHED=()

cleanup() {
  set +e
  echo ""
  echo "[verify.sh] Cleaning up..."

  if (( ${#COPIED[@]} > 0 )); then
    for f in "${COPIED[@]}"; do
      [[ -f "$f" ]] && { rm -- "$f"; echo "[verify.sh] removed $f"; }
    done
  fi

  if (( ${#PATCHED[@]} > 0 )); then
    for f in "${PATCHED[@]}"; do
      [[ -f "${f}.verify-bak" ]] && { mv -- "${f}.verify-bak" "$f"; echo "[verify.sh] restored $f"; }
    done
  fi

  local residual
  residual=$(git -C "$SCRIPT_DIR" status --porcelain --untracked-files=all -- "examples/$FRAMEWORK/" 2>/dev/null)
  if [[ -z "$residual" ]]; then
    echo "[verify.sh] ✓ examples/$FRAMEWORK/ clean — no permanent changes"
  else
    echo "[verify.sh] WARNING: examples/$FRAMEWORK/ still has changes after cleanup:" >&2
    echo "$residual" >&2
  fi
}

trap cleanup EXIT
trap 'exit 130' INT TERM

copy_harness() {
  local src="$1" dst="$2"
  if [[ -e "$dst" ]]; then
    echo "[verify.sh] ERROR: destination already exists: $dst" >&2
    echo "  A previous run may not have cleaned up. Remove it manually." >&2
    exit 1
  fi
  cp -- "$src" "$dst"
  COPIED+=("$dst")
  echo "[verify.sh] copied $(basename "$src") → $dst"
}

backup() {
  local file="$1"
  local bak="${file}.verify-bak"
  if [[ -e "$bak" || -L "$bak" ]]; then
    echo "[verify.sh] ERROR: backup already exists: $bak" >&2
    echo "  A previous run may not have cleaned up. Remove it manually." >&2
    exit 1
  fi
  cp -- "$file" "$bak"
  PATCHED+=("$file")
}

# Insert $insert before first occurrence of $marker in $file (Python for reliability).
patch_insert_before() {
  local file="$1" marker="$2" insert="$3"
  python3 -c "
import sys
path, marker, insert = sys.argv[1], sys.argv[2], sys.argv[3]
content = open(path).read()
if marker not in content:
    print(f'[verify.sh] ERROR: marker not found in {path}', file=sys.stderr)
    sys.exit(1)
open(path, 'w').write(content.replace(marker, insert + marker, 1))
" "$file" "$marker" "$insert"
  echo "[verify.sh] patched $file"
}

# ── framework wiring ──────────────────────────────────────────────────────────

case "$FRAMEWORK" in

  vanilla-js)
    copy_harness "$HARNESS/verify.js"     "$APP/src/verify.js"
    copy_harness "$HARNESS/cdn-verify.js" "$APP/public/cdn-verify.js"

    backup "$APP/index.html"
    cat > "$APP/index.html" << 'HTMLEOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vanilla JS — latency-test</title>
  </head>
  <body>
    <button id="connect-btn">Connect Audio</button>

    <div id="test-ui" hidden>
      <button id="start-btn">Test Latency</button>
      <p id="result"></p>
      <p id="stats"></p>
    </div>

    <latency-test id="lt" number-of-tests="5"></latency-test>

    <script type="module" src="/src/main.js"></script>
    <!-- verification harness — not part of docs example -->
    <script type="module" src="/src/verify.js"></script>
  </body>
</html>
HTMLEOF

    backup "$APP/public/cdn.html"
    patch_insert_before "$APP/public/cdn.html" \
      "</body>" \
      $'  <!-- verification harness — not part of docs example -->\n  <script type="module" src="cdn-verify.js"></script>\n'

    echo ""
    echo "[verify.sh] vanilla-js wired. Steps:"
    echo "  npm:  cd examples/vanilla-js && npm run dev"
    echo "        open http://localhost:5173"
    echo "        npm run build && npm run preview"
    echo "  CDN:  npx serve -l 3000 examples/vanilla-js/public"
    echo "        open http://localhost:3000/cdn.html"
    ;;

  react)
    copy_harness "$HARNESS/Verify.jsx" "$APP/src/Verify.jsx"

    backup "$APP/src/App.jsx"
    cat > "$APP/src/App.jsx" << 'JSXEOF'
import { LatencyTester } from './LatencyTester.jsx'
import { Verify } from './Verify.jsx'

export default function App() {
  return (
    <>
      <LatencyTester />
      <Verify />
    </>
  )
}
JSXEOF

    echo ""
    echo "[verify.sh] React wired. Steps:"
    echo "  cd examples/react && npm run dev"
    echo "  open http://localhost:5173"
    echo "  npm run build && npm run preview"
    ;;

  vue)
    copy_harness "$HARNESS/Verify.vue" "$APP/src/Verify.vue"

    backup "$APP/src/App.vue"
    cat > "$APP/src/App.vue" << 'VUEEOF'
<script setup>
import LatencyTester from './LatencyTester.vue'
import Verify from './Verify.vue'
</script>

<template>
  <LatencyTester />
  <Verify />
</template>
VUEEOF

    echo ""
    echo "[verify.sh] Vue wired. Steps:"
    echo "  cd examples/vue && npm run dev"
    echo "  open http://localhost:5173"
    echo "  npm run build && npm run preview"
    ;;

  svelte)
    copy_harness "$HARNESS/Verify.svelte" "$APP/src/Verify.svelte"

    backup "$APP/src/App.svelte"
    cat > "$APP/src/App.svelte" << 'SVELTEEOF'
<script>
  import LatencyTester from './LatencyTester.svelte'
  import Verify from './Verify.svelte'
</script>

<LatencyTester />
<Verify />
SVELTEEOF

    echo ""
    echo "[verify.sh] Svelte wired. Steps:"
    echo "  cd examples/svelte && npm run dev"
    echo "  open http://localhost:5173"
    echo "  npm run build && npm run preview"
    ;;

  angular)
    copy_harness "$HARNESS/Verify.component.ts" "$APP/src/app/Verify.component.ts"

    backup "$APP/src/app/app.ts"
    cat > "$APP/src/app/app.ts" << 'TSEOF'
import { Component } from '@angular/core';
import { LatencyTesterComponent } from './latency-tester.component';
import { VerifyComponent } from './Verify.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LatencyTesterComponent, VerifyComponent],
  template: `<app-latency-tester></app-latency-tester><app-verify></app-verify>`
})
export class App {}
TSEOF

    echo ""
    echo "[verify.sh] Angular wired. Steps:"
    echo "  cd examples/angular && ng serve"
    echo "  open http://localhost:4200/latency-test-examples/angular/"
    echo "  ng build (prod preview: see SESSION_STATE for baseHref serve steps)"
    ;;

  nextjs)
    copy_harness "$HARNESS/Verify.tsx" "$APP/components/Verify.tsx"

    backup "$APP/app/page.tsx"
    cat > "$APP/app/page.tsx" << 'TSXEOF'
import { LatencyTester } from '@/components/LatencyTester'
import { Verify } from '@/components/Verify'

export default function Page() {
  return (
    <main>
      <h1>Audio Latency Test</h1>
      <LatencyTester />
      <Verify />
    </main>
  )
}
TSXEOF

    echo ""
    echo "[verify.sh] Next.js wired. Steps:"
    echo "  cd examples/nextjs && npm run dev"
    echo "  open http://localhost:3000/latency-test-examples/nextjs/"
    echo "  npm run build (prod preview: see SESSION_STATE for basePath serve steps)"
    ;;

esac

echo ""
echo "[verify.sh] Press Enter to clean up and exit, or Ctrl+C."
read -r

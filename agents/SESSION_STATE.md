# Session state — resume point

Last session: 2026-06-16. Read this together with `CLAUDE.md` to resume.

## Where we are

Tier 1: **complete** — all 6 apps verified, committed, pushed.
Post-Tier-1: **complete** — all items done or explicitly shelved.
Gate: Tier 2 (`demos/`) blocked until idsinge/latency-test#30 is signed off.

## Structural decisions (all sessions)

- Verification harness lives in `verification/<framework>/` only — never in `examples/`.
- Each `examples/` app is a pure docs-code mirror.
- Future apps follow this pattern from the start.

## Established per-app workflow

1. Read docs page from `/Users/jose/Desktop/rountriplatencytest-webcomponent/docs/examples/<name>.md`
2. Pin docs commit: `git -C /Users/jose/Desktop/rountriplatencytest-webcomponent log --oneline docs/examples/<name>.md`
3. Draft plan: scaffold commands, file layout, content notes, special considerations
4. Write Codex prompt for plan review (user pastes into Codex, no file changes)
5. Update plan with Codex feedback
6. User runs scaffold commands
7. Claude writes all files after user confirms scaffold done
8. User runs `npm run dev`, shares console logs
9. User runs `npm run build && npm run preview`, shares console logs
10. User runs `npm ci && npm ls @adasp/latency-test && grep -E "file:|link:" package-lock.json`
11. Claude updates README matrix row and SESSION_STATE
12. Claude writes Codex sign-off prompt (user pastes into Codex, no file changes)
13. Claude commits + pushes after green light

## Angular — key notes

- Angular 22.0.1 is fully zoneless by default — zone.js must be added manually and
  `provideZoneChangeDetection({ eventCoalescing: true })` added to `app.config.ts`.
- `ChangeDetectorRef.markForCheck()` required after `await getUserMedia()` and CustomEvent
  callbacks — zone.js alone does not trigger CD in these cases.
- Prod-build local preview requires serving under the `baseHref` path:
  ```
  mkdir -p /tmp/ng-preview/latency-test-examples/angular
  cp -r dist/angular/browser/* /tmp/ng-preview/latency-test-examples/angular/
  npx serve -l 3000 /tmp/ng-preview
  ```
  Open `http://localhost:3000/latency-test-examples/angular/`.

## Next.js — key notes

- `basePath` applies in dev too — open `http://localhost:3000/latency-test-examples/nextjs/`.
- Prod preview requires the `/tmp/nextjs-preview` workaround (same as Angular):
  ```
  mkdir -p /tmp/nextjs-preview/latency-test-examples/nextjs
  cp -r out/* /tmp/nextjs-preview/latency-test-examples/nextjs/
  npx serve -l 3000 /tmp/nextjs-preview
  ```
- **Docs finding:** docs claims React 19+ auto-bridges `HTMLElementTagNameMap` to JSX —
  false in Next.js 16 + `@types/react` 19.2.17. Manual declaration required, must use
  `declare module 'react' { namespace JSX { ... } }` not `declare namespace JSX`.
- **Docs bugs:** `connect()` does not reset error state on retry; does not close
  `AudioContext` in catch block.

## Post-Tier-1 progress

**All done:**
- Item 1 — Phase 6 findings issue filed: https://github.com/idsinge/latency-test/issues/30 (awaiting sign-off in component repo)
- Item 2 — `verify.sh` written, Codex-reviewed (two rounds), human-tested all 4 scenarios, documented in README + all verification READMEs (committed 887e2c9)
- Item 3 — UI polish: dropped (violates docs-mirror rule; shelved until component docs patched)
- Item 4 — Root index page + GitHub Pages workflow. `index.html` + `.github/workflows/deploy.yml` deployed; all six URLs verified live on Pages; StackBlitz links added (works fully in Firefox — fast load, mic permission granted; Chrome broken by rolldown/WASM Atomics issue in StackBlitz WebContainers, not our code)
- Item 5 — Scaffold leftovers removed (13 tracked + 3 untracked files); Svelte/Vue favicon references fixed (Codex P2)
- Item 6 — vanilla-js harnesses aligned with stricter triplet event-sequence check (committed dbd9737)

**Pending (external):**
- Phase 6 sign-off: idsinge/latency-test#30 must resolve before Tier 2 opens

**Minor deferred:**
- StackBlitz Firefox note in `index.html` (Chrome incompatibility caveat)

## Environment (established — do not re-derive)

- Node: 22.22.3 (nvm)
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones, built-in mic

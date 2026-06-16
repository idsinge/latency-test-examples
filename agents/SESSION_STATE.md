# Session state — resume point

Last session: 2026-06-16. Read this together with `CLAUDE.md` to resume.

## Where we are

Tier 1, app 1 of 6 (vanilla-js): **complete, committed, pushed.**
Tier 1, app 2 of 6 (React): **complete, committed, pushed.**
Tier 1, app 3 of 6 (Vue): **complete, committed, pushed.**
Tier 1, app 4 of 6 (Svelte): **complete, committed, pushed.**
Tier 1, app 5 of 6 (Angular): **complete, committed, pushed.**
Tier 1, app 6 of 6 (Next.js): **complete, committed, pushed.**

## Structural decisions (all sessions)

- Verification harness lives in `verification/<framework>/` only — never in `examples/`.
- Each `examples/` app is a pure docs-code mirror.
- Future apps follow this pattern from the start.
- Post-Tier-1 deferred items in memory: UI polish, root index, verify.sh script.

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

## Angular — complete

### Docs commit
`208efe9`. No CDN variant.

### What was done
- Scaffold: `npx @angular/cli@latest new angular --minimal --skip-git --routing=false --ssr=false --style=css`
  produced Angular 22.0.1 (fully zoneless by default — no zone.js).
- zone.js 0.16.2 installed: `npm install zone.js --save`.
- `@adasp/latency-test@1.2.0` installed: `npm install @adasp/latency-test@1.2.0 --save-exact`.
- All files written and bug-fixed; all browser checks passed; prod build verified.
- Dev result: 36.92 ms, 29.01 dB (reliable). Prod result: 36.92 ms, 25.94 dB (reliable).
- Registry check: `npm ci` clean, `npm ls` = 1.2.0, no file:/link: refs.
- `examples/angular/README.md` replaced scaffold boilerplate with project-specific content.
- Findings recorded in root README matrix row.

### Key notes for reference
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

## Next.js — complete

### Docs commit
`ffe9bbb`. No CDN variant.

### What was done
- Scaffold: `create-next-app@latest` → Next.js 16.2.9 / React 19.2.4.
- `@adasp/latency-test@1.2.0` installed exact.
- `components/LatencyTester.tsx` — `'use client'` + lazy `import('@adasp/latency-test')` inside `useEffect`.
- `app/page.tsx` — Server Component page importing the client component.
- `next.config.ts` — `output: 'export'`, `basePath: '/latency-test-examples/nextjs'`, `trailingSlash: true`, `images: { unoptimized: true }`.
- `types/custom-elements.d.ts` — JSX type declaration (required despite React 19 — see finding).
- All browser checks passed; prod build clean; registry clean.
- Dev result: ~36.89 ms, ~27 dB (reliable). Prod result: ~36.94 ms, ~27 dB (reliable).

### Key findings
- `basePath` applies in dev too — open `http://localhost:3000/latency-test-examples/nextjs/`.
- Prod preview requires the `/tmp/nextjs-preview` workaround (same as Angular):
  ```
  mkdir -p /tmp/nextjs-preview/latency-test-examples/nextjs
  cp -r out/* /tmp/nextjs-preview/latency-test-examples/nextjs/
  npx serve -l 3000 /tmp/nextjs-preview
  ```
- **Docs finding:** docs claims React 19+ auto-bridges `HTMLElementTagNameMap` to JSX —
  false in Next.js 16 + `@types/react` 19.2.17. Manual declaration required, and it must
  use `declare module 'react' { namespace JSX { ... } }` not `declare namespace JSX`.
- **Docs bug:** `connect()` does not reset error state on retry.
- **Docs bug:** `connect()` does not close `AudioContext` in catch block.

## Tier 1 — complete

All 6 apps verified. Next steps (post-Tier-1, deferred):
- UI polish pass
- Root index page
- verify.sh script
- Sign off Phase 6 in the component repo

## Environment (established — do not re-derive)

- Node: 22.22.3 (nvm)
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones, built-in mic

# Session state — resume point

Last session: 2026-06-16. Read this together with `CLAUDE.md` to resume.

## Where we are

Tier 1, app 1 of 6 (vanilla-js): **complete, committed, pushed.**
Tier 1, app 2 of 6 (React): **complete, committed, pushed.**
Tier 1, app 3 of 6 (Vue): **complete, committed, pushed.**
Tier 1, app 4 of 6 (Svelte): **complete, committed, pushed.**
Tier 1, app 5 of 6 (Angular): **complete, committed, pushed.**
Tier 1, app 6 of 6 (Next.js): pending.

## Structural decisions (all sessions)

- Verification harness lives in `verification/<framework>/` only — never in `examples/`.
- Each `examples/` app is a pure docs-code mirror.
- Future apps follow this pattern from the start.
- Post-Tier-1 deferred items in memory: UI polish, root index, verify.sh script, per-app READMEs for vanilla-js/react/vue/svelte.

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

## Next.js — resume here

Tier 1, app 6 of 6. Follow the established per-app workflow above.

### Docs commit
Pin before starting:
`git -C /Users/jose/Desktop/rountriplatencytest-webcomponent log --oneline docs/examples/nextjs.md`

### Special considerations
- Next.js is the highest SSR risk — custom elements break at build time if imported outside a
  client component.
- Import `@adasp/latency-test` only inside a `'use client'` component, never at the server
  module level.
- Render the element inside `useEffect` or use dynamic import with `{ ssr: false }`.
- `next.config.js` must set: `output: 'export'`, `basePath: '/latency-test-examples/nextjs'`,
  `trailingSlash: true`, `images: { unoptimized: true }`.
- No CDN variant.

## Environment (established — do not re-derive)

- Node: 22.22.3 (nvm)
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones, built-in mic

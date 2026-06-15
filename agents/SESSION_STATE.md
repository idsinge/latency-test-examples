# Session state — resume point

Last session: 2026-06-15. Read this together with `CLAUDE.md` to resume.

## Where we are

Tier 1, app 1 of 6 (vanilla-js): **complete, committed, pushed.**
Tier 1, app 2 of 6 (React): **complete, committed, pushed.**
Tier 1, app 3 of 6 (Vue): **complete, committed, pushed.**
Tier 1, app 4 of 6 (Svelte): **complete, committed, pushed.**
Tier 1, app 5 of 6 (Angular): **in progress — scaffold done, files written, blocked mid-session.**
Tier 1, app 6 of 6 (Next.js): pending.

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

## Angular — current state (resume here)

### Docs commit
`208efe9`. No CDN variant.

### What is done
- Scaffold: `npx @angular/cli@latest new angular --minimal --skip-git --routing=false --ssr=false --style=css`
  produced Angular 22.0.0 (fully zoneless by default — no zone.js).
- zone.js installed: `npm install zone.js --save` (zone.js 0.16.2 now in package.json).
- All files written:
  - `src/index.html` — title updated
  - `src/main.ts` — `import 'zone.js'` + `import '@adasp/latency-test'` first, then bootstrap
  - `src/app/app.config.ts` — `provideZoneChangeDetection({ eventCoalescing: true })` added
  - `src/app/app.ts` — renders `<app-latency-tester></app-latency-tester>`
  - `src/app/latency-tester.component.ts` — docs component verbatim
  - `angular.json` — `baseHref: '/latency-test-examples/angular/'` added
  - `verification/angular/Verify.component.ts` — harness
  - `verification/angular/README.md` — wiring instructions

### Blocker at end of session
`npm install @adasp/latency-test@1.2.0 --save-exact` was run from `examples/` instead of
`examples/angular/` — the package was NEVER installed in the Angular project.

Angular compiler error during `npm start`:
  "Cannot find module or type declarations for side-effect import of '@adasp/latency-test'"
  src/main.ts:2:7

This error is caused by the missing package, NOT a TypeScript resolution issue.

### First action next session
From `examples/angular/`:
  npm install @adasp/latency-test@1.2.0 --save-exact

Then run `npm start` and verify the browser.

### Key docs findings for Angular (record in README matrix when complete)
1. Angular 22 is fully zoneless by default — zone.js must be added manually + configured with
   `provideZoneChangeDetection()` for the docs component (written for zone.js Angular) to work.
   This is a docs compatibility gap: docs page needs a note for Angular 22+ zoneless scaffolds.
2. Docs component includes `stop()` method but no button calls it and the API doesn't document
   `stop()` — verify at runtime whether this causes any error.

### npm audit warning
`npm install zone.js` reported 3 high severity vulnerabilities in other Angular build dependencies.
Not blocking — run `npm audit` for details if needed.

### Production build + preview (Angular specific)
  ng build   (via npm run build)
  → inspect dist/ to confirm output path before serving
  → npx serve dist/angular/browser  (expected path, verify after build)

### Verification harness wiring (when dev passes)
Copy from repo root:
  cp verification/angular/Verify.component.ts examples/angular/src/app/Verify.component.ts

Then update `src/app/app.ts` to import and render `<app-verify></app-verify>` after
`<app-latency-tester>`. Wire instructions also in `verification/angular/README.md`.

## Environment (established — do not re-derive)

- Node: 22.22.3 (nvm)
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones, built-in mic

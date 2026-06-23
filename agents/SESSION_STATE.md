# Session state — resume point

Read together with `CLAUDE.md`. This file tracks only current/active state — past
session narratives live in `agents/archive/SESSION_HISTORY.md` and the git log; read
those only if you need historical context, not by default.

## Where we are

Tier 1: complete (all 6 apps verified, committed, pushed).
Post-Tier-1 polish: complete — no open items right now.
Tier 2 Phase A: complete. `demos/waveform-playlist-legacy` committed and pushed
(`19ea79b`), deployed via GitHub Pages. Full record in
`demos/waveform-playlist-legacy/NOTES.md`.
Tier 2 Phase B (dawcore): complete, committed (`a312863`), pushed, deployed via
GitHub Pages, live URL confirmed working by the user. Full record in
`demos/dawcore/NOTES.md`.
Post-Phase-B consistency audit: complete, committed (`1bf7507`, `a5a11a8`),
pushed — normalized Phase A/B/C numbering repo-wide, cleared stale quarantine-
gate references. Both phases' full narratives are in
`agents/archive/SESSION_HISTORY.md`, not duplicated here.
Upstream `RecordingOptions` issue: complete. Filed as
[naomiaro/waveform-playlist#502](https://github.com/naomiaro/waveform-playlist/issues/502)
(2026-06-23). Full narrative in `agents/archive/SESSION_HISTORY.md`.
Tier 2 Phase C (new React `waveform-playlist`): investigated, concluded as
a negative result — no working compensation formula found (Tone.js's
transport layer forces `<latency-test>` onto a separate `AudioContext` and
introduces a non-acoustic scheduling delay the component can't measure).
Not merged to `main`; full investigation on branch
`phase-c-waveform-playlist-react`, see that branch's
`demos/waveform-playlist-react/NOTES.md`. A related architectural finding
filed as [naomiaro/waveform-playlist#503](https://github.com/naomiaro/waveform-playlist/issues/503)
(2026-06-23).

## Active next steps

**Nothing blocking.** Next: Phase D, the stretch goals (openDAW or WAM Online
Studio, see `CLAUDE.md`'s "Demo targets" section) — explore only if complexity
allows, not promised. No other open items.

## Structural decisions (durable)

- Verification harness lives in `verification/<framework>/` only — never in `examples/`.
- Each `examples/` app is a pure docs-code mirror.
- Future apps follow this pattern from the start.
- Verification record lives in `VERIFICATION.md` (full) + README (slim summary table
  linking to it). All matrix updates go in `VERIFICATION.md`, not README.

## Established per-app workflow

1. Read docs page from `/Users/jose/Desktop/rountriplatencytest-webcomponent/docs/examples/<name>.md`
2. Pin docs commit: `git -C /Users/jose/Desktop/rountriplatencytest-webcomponent log --oneline docs/examples/<name>.md`
3. Draft plan: scaffold commands, file layout, content notes, special considerations
4. Write Codex prompt for plan review (user pastes into Codex, no file changes)
5. Update plan with Codex feedback
6. User runs scaffold commands
7. Claude writes only the approved files after the user explicitly confirms Claude should write them
8. User runs `npm run dev`, shares console logs
9. User runs `npm run build && npm run preview`, shares console logs
10. User runs `npm ci && npm ls @adasp/latency-test && grep -E "file:|link:" package-lock.json`
11. Claude updates `VERIFICATION.md` and SESSION_STATE
12. Claude writes Codex sign-off prompt (user pastes into Codex, no file changes)
13. Claude commits + pushes only after explicit user confirmation

## Framework-specific technical notes

### Angular

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
- StackBlitz works in Chrome for Angular, unlike the other 5 example apps (confirmed
  2026-06-17 — see README.md/index.html StackBlitz note).

### Next.js

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

## Environment (established — do not re-derive)

- Node: 22.22.3 (nvm)
- Browser: Firefox 151.0.4 (aarch64)
- OS: macOS 15.4 (24E248)
- Audio: beyerdynamic DT 770 PRO 80Ω headphones, built-in mic

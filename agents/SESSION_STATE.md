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
Tier 2 Phase B (dawcore): complete, committed (`a312863`), **not yet pushed**.
Full record in `demos/dawcore/NOTES.md`.

## Active next steps

**Push `a312863` to `main`** — only after explicit user confirmation, per the
usual rule. Once pushed, verify the deployed dawcore demo at
`https://idsinge.github.io/latency-test-examples/demos/dawcore/` (not just the
local build/preview), since `CLAUDE.md`'s deployment section requires
verifying deployed URLs.

**After push, in order:**
1. Propose the upstream GitHub **issue** (not PR) to `naomiaro/waveform-playlist`
   for a public `RecordingOptions` field (e.g. `externalLatencySamples`) —
   queued, not started. Use this demo's finished state as the proof-of-concept.
   Also worth citing the two API papercuts already found: `_addRecordedClip`
   unofficial/unexported, and `editor.tracks` not carrying `trackId`
   (`TrackDescriptor` has no such field — must keep the `<daw-track>` element
   reference and check `.isConnected` instead, confirmed via Codex review
   before shipping, not a live bug).
2. Then: Phase B's next target, the new React `waveform-playlist`
   (`@waveform-playlist/*` packages, not dawcore) — same read-the-installed-
   source methodology, but two head starts this time: `src/alignment.js` is
   stack-agnostic (pure functions over `AudioBuffer`s, no DOM/dawcore
   dependency) and should be reusable as-is; and the mute/solo/volume/pan bug
   ([naomiaro/waveform-playlist#501](https://github.com/naomiaro/waveform-playlist/issues/501),
   filed this session) likely reproduces there too via the shared
   `@waveform-playlist/engine`, worth checking for early rather than
   rediscovering.

**Summary of what shipped in `a312863` (2026-06-22):** dawcore demo proving
the latency-compensation A/B concept via `recording-mode="audioworklet"`,
reviewed end-to-end by Codex (plan review, diff review, two completed-block
sign-off rounds). Two real bugs found and fixed/filed: a false-reliable
whole-beat-shift bug in this demo's own `src/alignment.js` click-matching
(fixed by requiring exact onset-count match for `reliable`, not `<= 1`), and
a genuine upstream `@waveform-playlist/engine` bug (mute/solo/volume/pan
silently reset on any new track load, filed as
[naomiaro/waveform-playlist#501](https://github.com/naomiaro/waveform-playlist/issues/501),
worked around via a step-4 delete-instead-of-mute wording change). Sample-domain
alignment proof (Phase B's required proof per `CLAUDE.md`): uncalibrated
residual ~35-41ms, calibrated residual -0.2 to 5.2ms, both `reliable: true`.
Full root-cause detail for both bugs is in `demos/dawcore/NOTES.md`. Commit also
bundled the deployment wiring (`index.html`, `.github/workflows/deploy.yml`,
`README.md`), matching how Phase A shipped — `agents/SESSION_STATE.md` updates
stay as their own follow-up commit, also matching precedent.

Local read-only reference clone for verifying dawcore internals:
`~/Desktop/dawlatencydemos/dawcore` (shallow clone, commit `6971ab6` — note:
confirmed to have *drifted* from the published `0.0.24` package in at least
one place, `editor.duration`; see memory for detail).

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

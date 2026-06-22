# Session history (archive)

Compact log of past sessions. Full detail lives in commit messages, `VERIFICATION.md`
findings, and `git log`. Not loaded by default — read only if you need historical
context on a past decision.

## Tier 1 (2026-06-12 – 2026-06-16) — framework verification

All 6 apps (vanilla-js, react, vue, svelte, angular, nextjs) verified against
`@adasp/latency-test@1.2.0`. See `VERIFICATION.md` for full per-framework results and
findings. Phase 6 findings filed as `idsinge/latency-test#30`.

## 2026-06-16 (post-Tier-1, round 1)

`verify.sh` harness script, root index page + Pages deploy workflow, scaffold
cleanup, vanilla-js harness event-sequence fix. See commits up to and including
`de05019`.

## 2026-06-16 (post-Tier-1, round 2) — bug fixes (`9f97019`)

Fixed `deploy.yml` missing `assets/` copy (logo 404s live on Pages); `cdn.html`
missing charset/title/h1. Codex-reviewed before landing.

## 2026-06-17 — verification record restructure (`b5cb5ba`)

Split full verification detail into `VERIFICATION.md`; slimmed `README.md` to a
pass/date table linking to it; added `verification/README.md` for `verify.sh` usage
docs; updated all `examples/*/README.md` links to point at `VERIFICATION.md`; fixed
`verify.sh`'s internal `SESSION_STATE` references.

## 2026-06-17 — doc/UI polish (`8516084`)

`index.html`: package version, `VERIFICATION.md` link, Hi-Audio logo moved to a
header brand mark, StackBlitz/Chrome caveat corrected (Angular works in Chrome,
unlike the other 5 apps) and restyled as a warning callout. `README.md`: "About"
renamed to "Acknowledgments", duplicate intro sentence removed, acknowledgments
pointer restored. `CLAUDE.md`: fixed stale "README matrix" references (twice) now
that `VERIFICATION.md` is the record. Both rounds independently reviewed by Codex
for cross-file consistency and link/asset integrity.

## 2026-06-17 — agents/ cleanup (`386c1ff`, `8353445`, `fc54720`)

Archived `KICKOFF_PROMPT.md` (Tier 1 mission, now historical) to this folder;
trimmed `SESSION_STATE.md` to active-state-only, moving past narrative here. Two
follow-up Codex-reviewed wording tightenings on the per-app workflow's file-write
confirmation step, settling on "Claude writes only the approved files after the user
explicitly confirms Claude should write them" — closes an ambiguity without changing
`CLAUDE.md`'s binding rules.

## 2026-06-17 — pull_request CI workflow (`30e0d2d`)

Added `.github/workflows/pr-checks.yml`: matrix job builds all 6 apps independently
and verifies registry consumption via `jq` against `package.json`/`package-lock.json`
(exact version pin, lockfile resolves to registry.npmjs.org at 1.2.0, no symlink
marker, no `file:`/`link:`/`workspace:` references). Two rounds of Codex review
(YAML correctness, jq query precision, negative-case dry runs against fabricated bad
lockfile entries). This was the last open item from the post-Tier-1 plan —
`SESSION_STATE.md`'s "Active next steps" is now empty.

## 2026-06-18 — Tier 2 Phase A: waveform-playlist (legacy fork) (`f7fdefb`, `19ea79b`)

Shipped the first Tier 2 demo, proving the latency-compensation A/B concept via
`gilpanal/waveform-playlist`'s already-working MediaRecorder-based compensation
pattern, git-pinned to a fixed commit. Reviewed end-to-end by Codex (plan review,
completed-block review, final sign-off), with fixes for a git-dependency lockfile
SSH/HTTPS portability issue, an `AudioContext` leak on failed connect, an
overlapping-recordings race, and stale-latency reuse after an unreliable
measurement. Full record in `demos/waveform-playlist-legacy/NOTES.md`.

## 2026-06-22 — Tier 2 Phase B: dawcore (`a312863`, `734d4d6`, `1bf7507`, `a5a11a8`)

Shipped the second Tier 2 demo, proving the same concept via dawcore's
AudioWorklet-based recording pipeline (`recording-mode="audioworklet"`). Two real
bugs found: a false-reliable whole-beat-shift bug in this demo's own sample-domain
alignment-proof code (`src/alignment.js`, fixed by requiring an exact onset-count
match for `reliable`, not `<= 1`), and a genuine upstream `@waveform-playlist/engine`
bug (mute/solo/volume/pan silently reset whenever any new track loads, filed as
[naomiaro/waveform-playlist#501](https://github.com/naomiaro/waveform-playlist/issues/501)).
Reviewed end-to-end by Codex (plan review, diff review, two completed-block sign-off
rounds). Sample-domain alignment proof (required for Phase B per `CLAUDE.md`):
uncalibrated residual ~35-41ms, calibrated residual -0.2 to 5.2ms, both
`reliable: true`. Full record in `demos/dawcore/NOTES.md`.

A follow-up post-shipment repo-consistency audit found and fixed: a stale
"not yet pushed" claim in `SESSION_STATE.md`; `CLAUDE.md`'s Tier 2 "hard
quarantine" rule and `VERIFICATION.md`'s quarantine note both still reading as
unresolved despite `idsinge/latency-test#30` having closed 2026-06-17 (before
either Tier 2 demo started); and stale "Phase B not started" references across
`CLAUDE.md`, `VERIFICATION.md`, and both demos' `NOTES.md`. Normalized phase
numbering repo-wide: Phase A = legacy fork (shipped), Phase B = dawcore
(shipped), Phase C = new React `waveform-playlist` (not started). Two rounds of
Codex review.

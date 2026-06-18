# waveform-playlist (legacy fork) — latency compensation demo

Phase A of Tier 2: prove the latency-compensation A/B concept fast by depending directly
on an already-working reference fork, before tackling the newer AudioWorklet-based
libraries (Phase B, not started).

## Dependency

`waveform-playlist` is installed via a git dependency pinned to a commit SHA, not a
branch: `git+https://github.com/gilpanal/waveform-playlist.git#58d6a9a05154a9d3ea66706c6156f627943150dd`
(the `hiaudiodev` branch's HEAD at the time this demo was built, 2026-06-17). The
fork's `build/` and `styles/` output directories are gitignored upstream, so npm
relies on the package's own `prepare` script (`babel compile && sass styles &&
webpack`) running automatically on install — confirmed working locally and expected
to work in CI (no Ruby/Jekyll step, uses dart-`sass` not the abandoned `node-sass`).

## Compensation insertion point (confirmed)

Isolated entirely in one upstream commit: [`6900baa`](https://github.com/gilpanal/waveform-playlist/commit/6900baa2d1220318c917b0e3e60e67e67c6b7477),
`src/Playlist.js`.

- Host calls `ee.emit("record", latencySeconds)` — **seconds**, not the milliseconds
  the `<latency-test>` component reports in `latency-result.detail.latency`. This demo
  converts: `latencySeconds = lastReliableLatencyMs / 1000`.
- `Playlist.js` stores it as `this.latency`. Inside the MediaRecorder `ondataavailable`
  handler (fires every 300ms timeslice), it reloads the *entire* accumulated blob from
  scratch and calls `trimAudioBuffer(audioBuffer, this.latency)`, which destructively
  trims that many seconds off the **start** of the buffer. This becomes both the
  canonical recorded buffer and the live playout buffer — it is **not** a
  `track.setStartTime()` shift.
- A second insertion point in the offline-render/WAV-export path exists but is
  commented out by the same author (`// TODO: check this approach`,
  `// TO LISTEN THE FIX MUST REFRESH BROWSER`) — a known, never-fixed bug. This demo
  does not use the export path at all, so it doesn't hit this, but it's worth knowing
  before anyone reaches for "just export the compensated take as a WAV."

## Pipeline match (confirmed)

`initRecorder(stream)` wraps `new MediaRecorder(stream)` directly on the raw mic
stream — no mixing. This is the same shape of capture as the component's
`recording-mode="mediarecorder-1ch"`, which is what this demo's `<latency-test>`
element is configured with. Because the demo's actual capture pipeline and the
measurement pipeline are the same `MediaRecorder(rawMicStream)` shape, the
"lower-bound caveat" that applies to `audioworklet` mode (component repo Decision
#15 — that mode measures its own minimal graph, not the host's full graph) is less of
a concern here; Phase B's AudioWorklet-based libraries will need to revisit this.

## Borrowed technical debt

The full-blob-reload-and-retrim-every-300ms behavior is real perf/correctness debt
inherited from the fork, not something this demo fixed. It's acceptable at the
recording lengths used here (one playthrough of an ~9-second guide track) but would
not scale to long recordings — re-decoding and re-copying a growing buffer from
scratch on every timeslice gets quadratically worse with length.

## What the library would need to support this natively

- Accept the latency value once (e.g. as an `init()` option) instead of requiring it
  on every `emit("record", ...)` call — easy to forget, easy to pass the wrong units.
- Fix or remove the disabled offline-render trim path so an exported WAV reflects the
  same compensation as the live playout, instead of silently not compensating at all.

## Alignment evidence — decision: visual/audible sufficient for Phase A

CLAUDE.md's Tier 2 "Alignment evidence" rule calls for sample-domain proof
(a number), not just visual/audible comparison. An earlier design pass for
this demo built exactly that — peak-detection on the guide track and each
recording, median sample offset, reviewed and endorsed by Codex — but it
was dropped to keep this first pass minimal.

**Decision (2026-06-18, user call):** for Phase A specifically, visual
(waveform overlay) and audible (playback) comparison is sufficient. Phase
A's purpose is to prove the compensation *pattern* works using an
already-proven fork — a feasibility check, not the project's final
research record. Sample-domain proof is deferred, not skipped: it belongs
in Phase B, where the actual novel investigation (wiring measured latency
into libraries that don't yet support it) needs to be defensible with hard
numbers, not just listening tests.

**Carried forward to Phase B:** re-introduce sample-domain alignment proof
(click-detection + median sample offset, the dropped design from this
session) before considering any Phase B demo's compensation claim
verified.

## Build verification

- `npm install`: confirmed working, including the git dependency's `prepare` build
  (babel + dart-sass + webpack), 2026-06-17.
- `npm run dev`: confirmed working by the user — mic connect, latency test run, and
  triggering a recording all worked with no console errors reported.
- `npm run build` / `npm run preview`: confirmed by Claude — clean build (7 modules,
  no errors), and verified via direct HTTP requests to the preview server that
  `index.html`, the JS/CSS bundles, `metronome.mp3`, and `favicon.svg` all resolve
  with `200` at the real base path
  (`/latency-test-examples/demos/waveform-playlist-legacy/`). Confirms the
  `import.meta.env.BASE_URL`-prefixed asset path (needed because Vite doesn't rewrite
  plain JS string paths the way it rewrites `index.html`/CSS) actually resolves
  correctly, and that the named import `import { init } from 'waveform-playlist'`
  (chosen over a default import to avoid UMD/ESM interop ambiguity in the fork's
  build output) works in both dev and production builds.
- **Full mic-recording flow on the production preview build: confirmed by the user**
  (2026-06-18) — record (uncalibrated) → play back → measure latency → mute the
  uncalibrated track → record (calibrated) all worked end-to-end against
  `npm run build && npm run preview`, re-confirmed again after the instructions/markup
  rewrite below.
- **Two distinct, correctly-labeled tracks ("Uncalibrated" / "Calibrated") confirmed
  by the user** to appear in the playlist after both record actions, resolving the
  open question Codex flagged during plan review about the fork's non-fixed-track
  creation lifecycle in `initRecorder`.

## Presentation changes this session (no logic changes)

- **`index.html` instructions rewritten** to a deliberate recipe order matching how
  the demo is meant to be used, decided by the user: 1) Record (uncalibrated), 2) Play
  it back, 3) Measure latency, 4) Mute the uncalibrated track, 5) Record (calibrated).
  This only reorders/rewords the headings and intro copy in `index.html` — button IDs,
  event handlers, and the `recordCalibratedBtn.disabled` gating in `src/main.js` (only
  enabled once a reliable latency result arrives) are unchanged, and the new recipe
  order is still consistent with that gate (latency must be measured before the
  calibrated take, same as before).
- **Step 4 ("Mute the uncalibrated track") needs no new code.** Confirmed by reading
  `node_modules/waveform-playlist/lib/Track.js` and `lib/app.js`: per-track Mute/Solo
  buttons are plain-text controls rendered by default (`widgets.muteOrSolo: true` in
  the library's default controls config, picked up by this demo's
  `controls: { show: true }`) — the instruction just points at an existing control.
- **Intro copy includes a link explaining "flam"** (a term not everyone knows) to a
  reference video the user provided: https://youtu.be/5ujmfxvr0bQ.
- **FontAwesome dependency, and why:** the playlist UI's collapse-caret and
  remove-track (×) icons (`Track.js`, classes `fa-caret-down`/`fa-caret-up`/`fa-times`
  — confirmed by grep, the only two icon usages in the library; Mute/Solo are plain
  text, not icons) didn't render without a FontAwesome stylesheet loaded. The user's
  first fix was a FontAwesome **Kit** loader script
  (`kit.fontawesome.com/d6bd427cae.js`) — this got icons working but tripped a
  SonarQube finding (Web:S5725, missing Subresource Integrity) and is tied to a
  personal/account-specific kit ID with no version pin. Replaced with a pinned,
  versioned `@fortawesome/fontawesome-free@6.7.2` CSS bundle from jsDelivr with a
  self-computed (not guessed) SHA-384 SRI hash:
  `sha384-nRgPTkuX86pH8yjPJUAFuASXQSSl2/bBUiNV47vSYpKFxHJhbcrGnmlYpYJMeD7a`. This both
  resolves the SonarQube finding with a real integrity check and removes the
  account-tied kit dependency, matching this repo's general pinning conventions.
  Confirmed working (icons render) after the swap.

## Codex completed-block review — findings and fixes

Codex reviewed the completed block (per CLAUDE.md's "Codex reviews each completed
block" rule) and flagged four issues in `src/main.js`, all fixed and verified
(`npm ci` clean install, `npm run build` clean, user-confirmed live mic flow on the
rebuilt preview):

- **Git-dependency lockfile resolved to SSH, not HTTPS.** `package.json` declares
  `git+https://github.com/gilpanal/waveform-playlist.git#...`, but
  `package-lock.json`'s `resolved` field had been written as
  `git+ssh://git@github.com/...` — an environment-dependent artifact of npm's git
  dependency resolution on the machine that generated the lockfile, not a config
  rewrite (no `url.insteadOf` rule found). A CI runner without SSH keys for arbitrary
  GitHub repos could be affected. Fixed by hand-editing the `resolved` field back to
  `git+https://...` (safe: the `integrity` sha512 hash is computed over the packed
  tarball content, identical regardless of which protocol fetched it).
  **Investigation finding worth recording:** tested in this environment with GitHub
  SSH auth deliberately broken (`GIT_SSH_COMMAND=/bin/false`, and confirmed via
  `ssh -T git@github.com` failing with "Permission denied (publickey)" even though
  this dev machine's key exists, it's simply not authorized) as a stand-in for a
  CI runner — and the install *still succeeded* even with the original `git+ssh` URL
  in the lockfile. npm appears to retry HTTPS automatically when SSH fails for git
  dependencies. So the original risk was likely lower than "certain CI breakage,"
  but the HTTPS-pinned lockfile is strictly safer regardless (no reliance on that
  fallback behavior or on port 22 being reachable from a CI runner) and cost nothing
  to fix.
- **`AudioContext` leaked on a failed connect.** `audioCtx` is created before
  `getUserMedia()`; the original catch block only stopped `micStream`, never closed
  `audioCtx`. If mic permission was denied or `playlist.load()` threw, the context
  stayed open. Fixed: catch block now also calls `audioCtx?.close()`, clears
  `audioCtx`, and resets `lt.inputStream` / `lt.audioContext` to `undefined`.
- **Overlapping recordings possible.** `recordTake()` originally disabled only the
  clicked button, leaving the other record button, play/stop, and the latency-test
  button clickable mid-recording — since `playlist.initRecorder()` replaces the
  playlist's single internal recorder, starting a second recording mid-first could
  corrupt both. Fixed: `recordTake()` now disables all lockable action buttons up
  front, wrapped in `try/finally` (also fixes a secondary issue: a thrown error used
  to leave the clicked button stuck disabled).
- **Stale "last reliable" latency usable after a later unreliable/error result.**
  `recordCalibratedBtn` stayed enabled with the previous good latency value even
  after a subsequent unreliable result or `latency-error`. First fix attempt only
  disabled the button in those two handlers, but left `lastReliableLatencyMs` itself
  non-null — Codex caught in the final sign-off pass that `recordTake()`'s `finally`
  block unconditionally re-enables `recordCalibratedBtn` whenever
  `lastReliableLatencyMs !== null`, so running *any* recording afterward (e.g. an
  uncalibrated take) silently re-enabled calibrated recording with the stale value.
  Corrected: both the unreliable branch of `latency-result` and the `latency-error`
  handler now also set `lastReliableLatencyMs = null`, so the stale value can't be
  reused via that re-enable path.

## Interruptible recording (Stop button enabled mid-recording)

User feedback after the above fixes: a full ~8.8s guide-track recording isn't
necessary to prove the A/B concept — a few seconds of metronome clicks is enough to
hear/see the alignment difference, but the Stop button was in the disabled-buttons
list, so there was no way to end a recording early at all.

Two-part fix, reviewed by Codex before implementation:

1. `stopBtn` removed from the lockable-buttons list — stays clickable during
   recording.
2. The `recordDurationMs` wait inside `recordTake()` is now interruptible: a fresh
   `Promise` per call, whose resolver is stored in a shared `stopRecordingResolve`
   variable, raced via `Promise.race([delay(recordDurationMs), manualStop])`.
   `stopBtn`'s click handler always calls `ee.emit('stop')` (so it still stops
   playback when not recording) and optionally calls `stopRecordingResolve?.()` if a
   recording is in progress. The resolver is cleared in `recordTake()`'s `finally`
   block so a Stop click after a recording has already finished naturally, or
   multiple rapid clicks, are inert.

Codex confirmed before implementation: the fork's `Playlist.stop()`
(`node_modules/waveform-playlist/lib/Playlist.js`, ~line 750) is idempotent — it only
calls `mediaRecorder.stop()` if `state === "recording"` — so the second,
already-redundant `ee.emit('stop')` call inside `recordTake()` after the race
resolves is safe. Codex also confirmed `playlist.rewind()` (called at the start of
every take) doesn't depend on the previous take having reached full duration, and
that short takes (Codex estimated ~5-6 clicks in 3s at the guide track's ~110 BPM)
remain consistent with this demo's documented visual/audible Phase-A evidence
standard above.

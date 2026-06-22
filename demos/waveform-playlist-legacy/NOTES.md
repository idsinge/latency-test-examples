# waveform-playlist (legacy fork) — latency compensation demo

Phase A of Tier 2: prove the latency-compensation A/B concept fast by depending directly
on an already-working reference fork, before tackling the newer AudioWorklet-based
libraries — Phase B (`dawcore`), since shipped, see `demos/dawcore/NOTES.md`; Phase C
(the new React `waveform-playlist`), not started.

## Dependency

`waveform-playlist` is installed via a git dependency pinned to a commit SHA, not a
branch: `git+https://github.com/gilpanal/waveform-playlist.git#58d6a9a05154a9d3ea66706c6156f627943150dd`
(the `hiaudiodev` branch's HEAD at the time this demo was built). The fork's `build/`
and `styles/` output directories are gitignored upstream, so npm relies on the
package's own `prepare` script (`babel compile && sass styles && webpack`) running
automatically on install. Use `git+https://`, not `git+ssh://`, in both `package.json`
and `package-lock.json`'s `resolved` field — npm's git dependency resolution can
silently rewrite this to ssh on a machine with GitHub SSH keys configured, which
breaks portability to environments without them (e.g. CI runners).

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
- `Playlist.stop()` is idempotent (only calls `mediaRecorder.stop()` if
  `state === "recording"`) — safe to call more than once, which this demo relies on to
  let the Stop button end a recording early (see "Demo behavior" below).

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
recording lengths used here but would not scale to long recordings — re-decoding and
re-copying a growing buffer from scratch on every timeslice gets quadratically worse
with length.

## What the library would need to support this natively

- Accept the latency value once (e.g. as an `init()` option) instead of requiring it
  on every `emit("record", ...)` call — easy to forget, easy to pass the wrong units.
- Fix or remove the disabled offline-render trim path so an exported WAV reflects the
  same compensation as the live playout, instead of silently not compensating at all.

## Alignment evidence — decision: visual/audible sufficient for Phase A

CLAUDE.md's Tier 2 "Alignment evidence" rule calls for sample-domain proof (a number),
not just visual/audible comparison. **Decision (2026-06-18, user call):** for Phase A
specifically, visual (waveform overlay) and audible (playback) comparison is
sufficient — Phase A's purpose is to prove the compensation *pattern* works using an
already-proven fork, a feasibility check rather than the project's final research
record. **Carried forward to Phase B:** sample-domain alignment proof (click-detection
+ median sample offset) is required before any Phase B demo's compensation claim is
considered verified — do not let this slide a second time.

## Demo behavior notes

- Mute/Solo per-track controls are built into the library by default
  (`widgets.muteOrSolo: true`, picked up by this demo's `controls: { show: true }`) —
  no custom code needed for the "mute the uncalibrated track" step.
- Recording can be ended early via the Stop button (interruptible — doesn't require
  waiting out the full guide-track duration); a few seconds of metronome clicks is
  enough for a meaningful A/B comparison at the guide track's ~110 BPM.
- The library's UI icons (`fa-caret-down`/`fa-caret-up`/`fa-times` — collapse and
  remove-track only; Mute/Solo are plain text) require a FontAwesome stylesheet.
  Loaded via a pinned, SRI-protected `@fortawesome/fontawesome-free@6.7.2` CSS bundle
  from jsDelivr in `index.html`, not the dynamic FontAwesome Kit loader (which can't
  support SRI and is tied to a personal account ID).

## Verified

- `npm ci` / `npm install`: clean, including the git dependency's `prepare` build.
- `npm run build` / `npm run preview`: clean; all assets resolve `200` at the real
  deployed base path.
- User-confirmed on the production preview build: full record (uncalibrated) → play
  back → measure latency → mute uncalibrated track → record (calibrated) flow; two
  distinct, correctly-labeled tracks appear in the playlist; early Stop unlocks the UI
  immediately instead of waiting out the full timer.
- Reviewed end-to-end by Codex across plan review, completed-block review, and final
  sign-off (see git log / commit message for the fixes that came out of that process).

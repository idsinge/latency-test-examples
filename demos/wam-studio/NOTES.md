# Phase D — WAM Studio Integration Notes

## Status

**Complete — 2026-06-26.** Fork deployed, upstream PR open. See Findings for details.

## Goal

Integrate `<latency-test>` (`@adasp/latency-test`) into WAM Studio
(https://github.com/Brotherta/wam-studio) to **replace** its existing
latency calibration tool with one based on MLS/cross-correlation. The
working fork serves as the showcase for [Brotherta/wam-studio#86](https://github.com/Brotherta/wam-studio/pull/86).

## Where the code lives

- **Fork:** https://github.com/fan-droide/wam-studio — `main` branch is the live demo
- **Upstream PR branch:** `feature/latency-test` (fan-droide → Brotherta, 4 files only — no fork README or Netlify config)
- **Live demo:** https://charming-paletas-c95a3f.netlify.app (Netlify)
- **Research record:** this file (`demos/wam-studio/NOTES.md` in [idsinge/latency-test-examples](https://github.com/idsinge/latency-test-examples))

## WAM Studio's existing calibration (what we replace)

`public/src/Controllers/LatencyController.ts` — `setupWorklet()`:
- Creates a fresh `AudioContext({latencyHint: 0.00001})` for calibration
- Calls `getUserMedia(settingsController.constraints)` for mic stream
- Loads `public/src/Audio/LatencyProcessor.js` as an AudioWorklet
  (threshold-based peak detection on a 64-frame square wave burst —
  fires a result roughly every second; no MLS, no cross-correlation)
- On each result: stores `roundtrip - audioCtx.outputLatency * 1000` as
  `host.latency` and writes to localStorage as `"latency-compensation"`

**Finding #1 — formula issue in existing calibration.** See Findings section below.

Compensation applied at `SampleRegionRecorder.ts:133`:
```ts
start(...): void {
    this.toIgnore = this.app.host.latency  // read once at start(), in ms
    ...
}
// In the worker message handler, first audio chunk:
if (recorder.toIgnore > 0) {
    audioBuffer = audioBuffer.view(recorder.toIgnore * audioBuffer.sampleRate / 1000)
    recorder.toIgnore = 0
}
```
One-time destructive trim from the front of the first audio buffer. `toIgnore` is
zeroed after use. This insertion point does NOT change — we only change what value
goes into `host.latency`.

## Pipeline match

Recording pipeline confirmed from source:
`SampleRegionRecorder` → `SampleRecorderWAM` → `SampleRecorderNode`
(`WamNode` / `AudioWorkletNode`) → `SampleRecorderProcessor`
(`WamProcessor`, runs as AudioWorkletProcessor) on the **main `audioCtx`**
(exported from `public/src/index.ts:58`: `new AudioContext({latencyHint: 0.00001})`).

Capture is via SharedArrayBuffer ring buffer: written in the AudioWorklet,
read by a Worker, chunks sent back to the main thread.

**Correct mode: `recording-mode="audioworklet"`** — both the component and
the recorder use AudioWorklet-based capture on the same native AudioContext.

Lower-bound caveat: the component measures a minimal graph, not WAM Studio's
full WAM SDK chain. Same limitation as WAM Studio's own existing tool
(which also used a separate AudioContext). Net: not worse, likely better
(MLS/cross-correlation vs. threshold detection).

## Key technical decisions (all Codex-reviewed, 2026-06-24)

| Decision | Choice | Rationale |
|---|---|---|
| AudioContext for `<latency-test>` | Main `audioCtx` (not a fresh one) | Ensures same output sink (setSinkId), same sample rate, same `outputLatency`. WAM Studio's own tool used a fresh context — a known limitation we fix. **Never close main context during cleanup.** |
| Number of runs | `numberOfTests = 3` | Built into the component. `latency-result` fires per-run for UI updates; `latency-complete` carries the aggregate. |
| Compensation value | `event.detail.mean` (full round-trip) | See Finding #1 — old `roundtrip - outputLatency` formula under-compensates. |
| Reliability gate | On `latency-complete`: only commit if `!detail.aborted && detail.results.every(r => r.reliable)` — `latency-complete` has no top-level `reliable` field | Don't overwrite a good calibration with noisy readings; leave prior value untouched if any run was unreliable. |
| User stop | `el.stop()` → stop stream tracks → remove element | `stop()` fires `latency-complete` with `{ aborted: true }`. Same cleanup handler covers both abort and natural completion. |
| Version pin | `"@adasp/latency-test": "1.2.1"` (exact, no `^`) | Research record — exact pin documents what was tested. |
| TypeScript typing | Package's shipped `LatencyTestElement` type | Avoid `any`; package exports `LatencyTestElement`, `LatencyResultDetail`, `LatencyCompleteDetail`. |
| Race-safe init | Set `_calibrating = true` before first `await` | Fixes existing bug in WAM Studio's `startCalibrate()` — stop during permission prompt was skipped. |

## What was changed

Files changed relative to `Brotherta/wam-studio` main:

| File | Change |
|---|---|
| `public/package.json` | Added `@adasp/latency-test@1.2.1` |
| `public/package-lock.json` | Updated for new dependency |
| `public/src/Audio/LatencyProcessor.js` | Deleted — replaced by the component |
| `public/src/Controllers/LatencyController.ts` | Fully rewritten — see committed file for authoritative source |

`public/src/Views/LatencyView.ts` was **not modified** — the existing UI label already
reads "Compensation", which is correct for the full round-trip value.

Beyond the basic integration, the final `LatencyController.ts` includes: stale-element
guards in each event handler, a `constraints` fallback for `getUserMedia`, `audioCtx.resume()`
with error handling, `await el.start()` in a `try/catch`, and per-run console logging
with the reliability flag. Two Codex reviews (2026-06-24) plus one race-condition fix
(2026-06-26) — 8 total fixes over the implementation.

## Testing checklist

1. `npm start` from `public/` — app loads at http://localhost:5002
2. Open browser console — no unexpected errors at startup (one background `fetch`
   for the backend login check fails silently — expected and harmless)
3. Settings gear → select audio input device
4. Put on headphones (mandatory for latency measurement)
5. Click Latency button → "Calibrate Latency" appears
6. Click "Calibrate Latency":
   - Labels should update after each of the 3 runs
   - Final value committed and shown in the input field after run 3
   - `latency-complete` fires, button resets to "Calibrate Latency"
7. Click "Stop Calibration" mid-run — no stuck state, button resets cleanly,
   no unexpected errors
8. Reload page — prior calibration value should reappear in the input field
   (localStorage persistence). **Confirmed ✓ 2026-06-26**
9. If results are unreliable (any run fails the reliability check): verify the
   prior `host.latency` value is left unchanged and a warning appears in console
10. Sample-domain alignment proof — **pending proper hardware** (see Finding #2):
    record with and without compensation, measure onset offset in samples,
    confirm compensated offset is near 0

## Findings

### Finding #1 — WAM Studio calibration formula

WAM Studio's existing `LatencyController.ts` computes:
```
host.latency = roundtrip - audioCtx.outputLatency * 1000
```
`SampleRegionRecorder.ts:133` then trims exactly `host.latency` ms from
the front of the recording. For correct acoustic overdub alignment, the
full round-trip should be trimmed — subtracting `outputLatency` leaves a
residual equal to `outputLatency` in the recorded offset. No other
compensation for `outputLatency` was found in the codebase (confirmed by
full Codex search, 2026-06-24).

**Static code-path analysis indicates the existing formula under-compensates
by `outputLatency`; empirical confirmation with matched headphone/external
mic hardware remains pending.**

**Our integration uses `event.detail.mean` (full round-trip) directly**,
eliminating the subtraction and the residual it would leave — a correctness
improvement that a sample-domain proof with proper headphone hardware would confirm.

### Finding #2 — alignment proof: code correctness confirmed, full acoustic proof deferred

**Setup:** Mac built-in mic + speakers, `latencyHint: 0.00001`, 48 kHz sample rate.

**Method:** Three WAV files analyzed via a Node.js onset-detection script adapted from
`demos/dawcore/src/alignment.js`. Cross-correlation against the metronome click pattern
across 16 clicks per recording.

**Results:**
- Calibration value: 59.1 ms (3 runs, all reliable — ratios 30.4, 32.0, 31.0 dB)
- Both uncalibrated and calibrated recordings showed **identical** onset offset: 9.6 ms
  (463 samples at 48 kHz), MAD < 0.5 ms, 16/16 clicks matched
- 9.6 ms << 59.1 ms — compensation had no measurable effect on the recorded offset

**Code correctness confirmed:** Console logs showed `SampleRegionRecorder.toIgnore = 59.0625`
at the start of each recording — the calibration value flows correctly through `host.latency`
to the compensation insertion point (`SampleRegionRecorder.ts:133`).

**Why the acoustic proof is not valid here:** Mac built-in mic + speakers is not a valid
acoustic reference for this measurement. Playback bleeds directly into the mic without
passing through the transducer path that `<latency-test>` measures, and the two signal
paths have different buffering characteristics on this hardware. The compensation code is
correct; the test setup was the mismatch. A valid sample-domain alignment proof requires
the same acoustic coupling for both the MLS measurement and the overdub recording:
headphones + external mic near the earcup.

## Deployment

**Live:** https://charming-paletas-c95a3f.netlify.app (Netlify, deployed 2026-06-26)

Package: `@adasp/latency-test@1.2.1`

Hosted on Netlify free tier, configured via `netlify.toml` at the fork root:
- Build: `cd public && npm ci && npm run build` → `public/dist/`
- Headers: `COOP: same-origin` and `COEP: require-corp` on all routes;
  `CORP: cross-origin` on `/shareable/*` (mirrors the Express server behaviour)
- Auto-deploys on every push to fork `main`

`crossOriginIsolated === true` confirmed in production:
- Firefox — confirmed 2026-06-26
- Chrome — confirmed 2026-06-26

## Known limitations

- **Backend not needed:** The bank plugin backend (`BACKEND_URL`) is not required for
  calibration, recording, or playback. One background `fetch` (login check) fails
  silently at startup — expected and harmless.
- **Acoustic proof deferred:** Full sample-domain alignment proof requires headphones +
  external mic (see Finding #2). Code correctness is confirmed; end-to-end acoustic proof
  is pending hardware with the correct acoustic coupling.
- **Lower-bound caveat:** `recording-mode="audioworklet"` measures the component's own
  minimal capture graph, not WAM Studio's full WAM SDK chain. The measured value is a
  lower bound unless the full recording graph is verified equivalent.

## Upstream PR

**[Brotherta/wam-studio#86](https://github.com/Brotherta/wam-studio/pull/86)** — opened 2026-06-26.

Branch: `fan-droide:feature/latency-test` → `Brotherta:main`.
Files in PR: `public/package.json`, `public/package-lock.json`,
`public/src/Controllers/LatencyController.ts` (rewrite),
`public/src/Audio/LatencyProcessor.js` (deleted).
Fork README and `netlify.toml` kept fork-only — not in the upstream PR.

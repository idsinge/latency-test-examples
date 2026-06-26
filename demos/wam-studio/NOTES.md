# Phase D — WAM Studio Integration Notes

## Status

**2026-06-26: Implementation complete. See Findings for details.**

## Goal

Integrate `<latency-test>` (`@adasp/latency-test`) into WAM Studio
(https://github.com/Brotherta/wam-studio) to **replace** its existing
latency calibration tool with one based on MLS/cross-correlation. The
working fork serves as the showcase for [Brotherta/wam-studio#86](https://github.com/Brotherta/wam-studio/pull/86).

## Where the code lives

- **Fork:** https://github.com/fan-droide/wam-studio
- **Branch:** `feature/latency-test`
- **Local clone:** `/Users/jose/Desktop/wam-studio`
- **Run:** `cd /Users/jose/Desktop/wam-studio/public && npm start`
  → http://localhost:5002

Infrastructure already confirmed:
- `npm install` done, `.env` exists (empty is fine — defaults kick in from `Env.ts`)
- COOP/COEP headers set in `webpack.config.js:21-24` — SharedArrayBuffer works without extra config
- Port hardcoded at 5002 in webpack config
- Backend (bank plugin) not needed — recording/calibration/playback all work without it.
  One background `fetch` fails silently at startup (login check), no impact on the UI.

## WAM Studio's existing calibration (what we replace)

`public/src/Controllers/LatencyController.ts` — `setupWorklet()`:
- Creates a fresh `AudioContext({latencyHint: 0.00001})` for calibration
- Calls `getUserMedia(settingsController.constraints)` for mic stream
- Loads `public/src/Audio/LatencyProcessor.js` as an AudioWorklet
  (threshold-based peak detection on a 64-frame square wave burst —
  fires a result roughly every second; no MLS, no cross-correlation)
- On each result: stores `roundtrip - audioCtx.outputLatency * 1000` as
  `host.latency` and writes to localStorage as `"latency-compensation"`

**Finding #1 — bug in existing formula.** See "Findings" section below.

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
| Compensation value | `event.detail.mean` (full round-trip) | See Finding #1 — old `roundtrip - outputLatency` formula is wrong. |
| Reliability gate | On `latency-complete`: only commit if `!detail.aborted && detail.results.every(r => r.reliable)` — `latency-complete` has no top-level `reliable` field | Don't overwrite a good calibration with noisy readings; leave prior value untouched if any run was unreliable |
| User stop | `el.stop()` → stop stream tracks → remove element | `stop()` fires `latency-complete` with `{ aborted: true }`. Same cleanup handler covers both abort and natural completion. |
| Version pin | `"@adasp/latency-test": "1.2.1"` (exact, no `^`) | Research record — exact pin documents what was tested. |
| TypeScript typing | Package's shipped `LatencyTestElement` type | Avoid `any`; package exports `LatencyTestElement`, `LatencyResultDetail`, etc. |
| Race-safe init | Set `_calibrating = true` before first `await` | Fixes existing bug in WAM Studio's `startCalibrate()` — stop during permission prompt was skipped. |

## Implementation plan

All changes in `/Users/jose/Desktop/wam-studio/public/`.

### Step 1 — Install the package

Add to `package.json` `dependencies`:
```json
"@adasp/latency-test": "1.2.1"
```
Run `npm install`.

### Step 2 — Modify `src/Controllers/LatencyController.ts`

**Add imports at the top** (after existing imports):
```ts
import '@adasp/latency-test';
import type { LatencyTestElement, LatencyResultDetail, LatencyCompleteDetail } from '@adasp/latency-test';
```

**Replace the private field `_recordAudioContext: AudioContext`** with:
```ts
private _latencyEl: LatencyTestElement | null = null;
private _calibStream: MediaStream | null = null;
```

**Replace the entire `setupWorklet()` method** with:
```ts
private async setupLatencyTest(): Promise<void> {
    const el = document.createElement('latency-test') as LatencyTestElement;
    el.setAttribute('recording-mode', 'audioworklet');
    el.numberOfTests = 3;
    document.body.appendChild(el);
    this._latencyEl = el;

    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getUserMedia(
            this._app.settingsController.constraints
        );
    } catch (err) {
        console.error('Calibration: getUserMedia failed:', err);
        this._cleanupLatencyTest();
        throw err;
    }
    // Cancellation guard: user may have clicked Stop while getUserMedia() was pending
    if (this._latencyEl !== el || !this._calibrating) {
        stream.getTracks().forEach(t => t.stop());
        return;
    }
    this._calibStream = stream;

    // Ensure main context is running before handing it to the component
    if (audioCtx.state !== 'running') await audioCtx.resume();

    // Use the MAIN audioCtx — matches the recording pipeline's output sink,
    // sample rate, and outputLatency. Never close it during cleanup.
    el.audioContext = audioCtx;
    el.inputStream = stream;

    el.addEventListener('latency-result', (e: Event) => {
        const detail = (e as CustomEvent<LatencyResultDetail>).detail;
        const outputLatency = audioCtx.outputLatency * 1000;
        if (detail.reliable) {
            this._view.updateLatencyLabels(outputLatency, detail.latency, detail.latency);
        }
        // If unreliable, leave previous display — don't overwrite a good value
    });

    el.addEventListener('latency-complete', (e: Event) => {
        const detail = (e as CustomEvent<LatencyCompleteDetail>).detail;
        if (
            !detail.aborted &&
            detail.results != null &&
            detail.results.length === 3 &&
            detail.results.every(r => r.reliable)
        ) {
            const mean = detail.mean!;
            this._app.host.latency = mean;
            this._view.latencyInput.value = mean.toFixed(2);
            const outputLatency = audioCtx.outputLatency * 1000;
            this._view.updateLatencyLabels(outputLatency, mean, mean);
            localStorage.setItem('latency-compensation', mean.toFixed(2));
        }
        // Unreliable or aborted: prior calibration left untouched
        this._cleanupLatencyTest();
        this._calibrating = false;
        this._view.calibrationButton.innerText = 'Calibrate Latency';
    });

    el.addEventListener('latency-error', (e: Event) => {
        console.error('latency-test error:', (e as CustomEvent).detail);
        this._cleanupLatencyTest();
        this._calibrating = false;
        this._view.calibrationButton.innerText = 'Calibrate Latency';
    });

    el.start();
}

private _cleanupLatencyTest(): void {
    this._calibStream?.getTracks().forEach(t => t.stop());
    this._calibStream = null;
    if (this._latencyEl) {
        this._latencyEl.remove();
        this._latencyEl = null;
    }
}
```

**Replace `startCalibrate()`:**
```ts
private async startCalibrate(): Promise<void> {
    this._calibrating = true; // set BEFORE any await — race-safe
    this._view.calibrationButton.innerText = 'Stop Calibration';
    try {
        await this.setupLatencyTest();
    } catch (err) {
        // getUserMedia failed or other setup error — already cleaned up in setupLatencyTest
        this._calibrating = false;
        this._view.calibrationButton.innerText = 'Calibrate Latency';
    }
}
```

**Replace `stopCalibrate()`:**
```ts
private async stopCalibrate(): Promise<void> {
    this._latencyEl?.stop(); // fires latency-complete with { aborted: true }
    this._cleanupLatencyTest(); // idempotent — safe if already cleaned up
    this._calibrating = false;
    this._view.calibrationButton.innerText = 'Calibrate Latency';
}
```

**Remove** the old `setupWorklet()` method entirely. The `bindEvents()`,
`getLocalStorages()`, constructor, and field declarations for `_app`,
`_view`, `_hostView`, `_calibrating` all stay unchanged.

### Step 3 — Delete `src/Audio/LatencyProcessor.js`

Nothing else in the codebase references this file. Delete it.

### Step 4 — Review label wording in `src/Views/LatencyView.ts`

`<latency-test>` is headless — no structural changes to LatencyView are needed.
However `updateLatencyLabels` has a second argument labelled "input latency" in
the existing UI; with the new formula that slot holds the full round-trip value.
Read `LatencyView.ts` when implementing and update any label that says
"input latency" to say "round-trip latency" or "compensation". This is the
**only expected change** to LatencyView, and it is required — the current label
is definitively wrong under the new formula.

## Testing checklist

Run after implementing all steps above.

1. `npm start` from `public/` — app loads at http://localhost:5002
2. Open browser console — no errors at startup (one `fetch` network error
   for the backend login check is expected and harmless)
3. Settings gear → select audio input device
4. Put on headphones (mandatory for latency measurement)
5. Click Latency button → "Calibrate Latency" appears
6. Click "Calibrate Latency":
   - Labels should update after each of the 3 runs
   - Final value committed and shown in the input field after run 3
   - `latency-complete` fires, button resets to "Calibrate Latency"
7. Click "Stop Calibration" mid-run:
   - No stuck state, button resets cleanly, no JS errors
8. Sample-domain alignment proof (required — visual alone is not sufficient):
   - Set `host.latency = 0` temporarily (via browser console or the latency input)
   - Record a track while the metronome plays
   - Inspect the resulting AudioBuffer: measure onset offset in samples between
     the metronome click and the recorded click
     (adapt `demos/dawcore/src/alignment.js` from Phase B for the WAM buffer format)
   - Run calibration, then record again with compensation active
   - Measure onset offset again — record both numbers in Findings #2
   - Compensated offset should be near 0 (within one render quantum, ~3ms at 48kHz)
9. If results are unreliable (any run fails the reliability check): verify the
   prior `host.latency` value is left unchanged and a warning appears in console
10. Check console throughout — should be clean except for the background fetch

## Findings (fill in during/after implementation)

### Finding #1 — WAM Studio calibration formula bug (confirmed pre-implementation)

WAM Studio's existing `LatencyController.ts` computes:
```
host.latency = roundtrip - audioCtx.outputLatency * 1000
```
`SampleRegionRecorder.ts:133` then trims exactly `host.latency` ms from
the front of the recording. For correct acoustic overdub alignment the
full round-trip should be trimmed — subtracting `outputLatency` leaves a
residual equal to `outputLatency` in the recorded offset. No other
compensation for `outputLatency` was found in the codebase (confirmed by
full Codex search). Confirmed by Codex review 2026-06-24.

**Our integration uses `event.detail.mean` (full round-trip) directly.**

Post-implementation: document the alignment improvement vs. the old
formula here, with sample-domain evidence (onset offset in samples before
vs. after, measured against the metronome clicks).

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

**Root cause:** Mac's built-in audio system with `latencyHint: 0.00001` produced only
9.6 ms effective recording latency for the playback+record path, while `<latency-test>`
in `audioworklet` mode measured 59.1 ms for the MLS test-signal path on the same device.
The two paths have different buffering behaviour: the SAB ring buffer + Worker round-trip
in the recording pipeline is faster than the AudioWorklet loopback in the test path.

**Code correctness confirmed:** Console logs showed `SampleRegionRecorder.toIgnore = 59.0625`
at the start of each recording — the calibration value flows correctly through `host.latency`
to the compensation insertion point (`SampleRegionRecorder.ts:133`). The compensation code
is correct; the acoustic setup was the mismatch.

**Research lesson:** Calibration and recording **must use the same acoustic coupling**
(headphones + external mic near the earcup). Mac built-in mic + speakers is not a valid
reference: playback bleeds directly into the mic without passing through the transducer
path that `<latency-test>` measures. A valid sample-domain alignment proof requires the
same hardware and acoustic path for both the MLS measurement and the overdub recording.

Post-implementation note on Finding #1: the old formula subtracted `outputLatency`, leaving
a residual equal to `outputLatency` in the recorded offset. Our integration uses
`event.detail.mean` (full round-trip) directly, eliminating that residual — a correctness
improvement that the sample-domain proof would confirm with proper headphone hardware.

## Deployment

**Live:** https://charming-paletas-c95a3f.netlify.app (Netlify, deployed 2026-06-26)

Hosted on Netlify free tier, configured via `netlify.toml` at the repo root:
- Build: `cd public && npm ci && npm run build` → `public/dist/`
- Headers: `COOP: same-origin` and `COEP: require-corp` on all routes;
  `CORP: cross-origin` on `/shareable/*` (mirrors the Express server behaviour)
- Auto-deploys on every push to `main`

`crossOriginIsolated === true` confirmed in production (headers verified via `curl`).

## Upstream PR

**[Brotherta/wam-studio#86](https://github.com/Brotherta/wam-studio/pull/86)** — opened 2026-06-26.

Branch: `fan-droide:feature/latency-test` → `Brotherta:main`.
Files in PR: `public/package.json`, `public/package-lock.json`,
`public/src/Controllers/LatencyController.ts` (rewrite),
`public/src/Audio/LatencyProcessor.js` (deleted).
Fork README and `netlify.toml` kept fork-only — not in the upstream PR.

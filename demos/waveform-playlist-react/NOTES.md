# waveform-playlist-react — latency compensation demo

Phase C of Tier 2: prove the latency-compensation A/B concept against the new React
`waveform-playlist` (`@waveform-playlist/browser`, the React layer over
`@waveform-playlist/engine` — the same engine backend as Phase B's `dawcore`).
Follows Phase A (`demos/waveform-playlist-legacy/`, MediaRecorder-based fork) and
Phase B (`demos/dawcore/`, Lit-based, shipped with near-perfect alignment).

## Status: INVESTIGATION CLOSED — negative result, not shipped to main

No working compensation formula was found after three rounds of increasingly
specific hypotheses, each correctly diagnosed and each revealing a new genuine
mechanical issue. Code builds cleanly (`tsc --noEmit`, `vite build`) and is kept on
this branch (`phase-c-waveform-playlist-react`) in its final, most-diagnostic
state — deliberately not merged to `main`, since it never reached working
compensation. `main`'s `CLAUDE.md`/`README.md`/`agents/SESSION_STATE.md` point here
with a one-line summary. See "Final conclusion" at the bottom for the headline
result; everything above it is the investigation trail that earned it.

## Architecture

`App.tsx`'s `setTracks` wrapper is the compensation insertion point — intercepts the
calibrated take's clip as it arrives, overrides `offsetSamples`/`durationSamples`
with the externally measured value (replacing, not adding to, the library's own
internal trim), then runs the sample-domain alignment proof
(`src/alignment.ts`, ported as-is from `demos/dawcore/src/alignment.js` per that
file's stack-agnostic design — confirmed to need no changes here).
`RecordingDemo.tsx` drives the UI flow (Connect → record uncalibrated → measure
latency → mute uncalibrated → record calibrated → show proof).

`recording-mode="audioworklet"` is the correct `<latency-test>` setting, confirmed
by reading `@waveform-playlist/recording`'s `useRecording` hook
(`node_modules/@waveform-playlist/recording/dist/index.js`): it captures audio via
`context.createAudioWorkletNode("recording-processor", ...)`, not MediaRecorder.

## Pipeline match — confirmed FORCED separate AudioContext (not a design mistake)

Unlike Phase A and Phase B, `<latency-test>` in this demo **cannot share the
recording pipeline's AudioContext**, and this was confirmed by reading source on
both sides, not assumed:

1. `@waveform-playlist/browser` has a **hard, non-optional peer dependency on
   `tone`** (confirmed in its `package.json`) via its `@waveform-playlist/playout`
   dependency. `getGlobalContext()` returns a Tone.js `Context`, whose `rawContext`
   getter (`node_modules/tone/build/esm/core/context/Context.js:319`) returns
   `this._context` — which was constructed via `createAudioContext()`
   (`node_modules/tone/build/esm/core/context/AudioContext.js`), i.e. `new
   stdAudioContext(options)` from the `standardized-audio-context` **ponyfill**, not
   a genuine native `window.AudioContext`.
2. `@adasp/latency-test`'s actual published dist code
   (`node_modules/@adasp/latency-test/dist/latency-test.esm.js`) constructs its
   worklet node with `new AudioWorkletNode(this.audioContext, "recorder-processor",
   {...})` — the literal global native constructor, called directly, with **no**
   compatibility branching for a ponyfilled context.
3. Tone's own internal worklet-creation helper
   (`createAudioWorkletNode` in the same `AudioContext.js`) *does* have this
   branching — `context instanceof theWindow.BaseAudioContext ? native
   AudioWorkletNode : stdAudioWorkletNode` — which is exactly why the recording
   pipeline itself (driven through `context.createAudioWorkletNode(...)`, a Tone
   Context method) works fine on the same ponyfilled context. `<latency-test>` has
   no equivalent branching since it's a generic package with no Tone-awareness.

Net result: passing Tone's `rawContext` to `<latency-test>` would very likely throw
inside the native `AudioWorkletNode` constructor (ponyfilled objects fail the
browser engine's internal type check — confirmed indirectly by Tone needing its own
`instanceof` branch to avoid exactly this). **A genuinely separate native
`AudioContext` is therefore required for `<latency-test recording-mode="audioworklet">`
to function at all alongside this React stack** — there is no documented escape
hatch in `@waveform-playlist/browser`'s public API (checked its README; no mention
of custom/raw context injection).

This is the direct architectural reason Phase C cannot replicate Phase B's clean
result: **`dawcore` (Phase B) uses a plain native `AudioContext` directly**
(`demos/dawcore/src/main.js:120`, no Tone.js, no `@waveform-playlist/playout`
dependency at all) and could genuinely share one real context between its
recording pipeline and `<latency-test>`. This React package's choice to build on
Tone.js for transport/scheduling — not anything about AudioWorklet-based recording
in general — is what breaks the pipeline-sharing pattern that made Phase B work.

## Round 1 — direct substitution makes alignment WORSE, not better

Two full sessions (sampleRate 48000Hz), both `reliable: true`, 16/16 clicks matched,
formula `applied = measured_latency_test` (replacing the library's own trim):

**Run 1:** uncalibrated applied 4800 samples (100.0ms, library's own internal
estimate), residual 1270 samples (26.5ms) → implied true latency ~6070 samples
(126.5ms). Calibrated applied 2053 samples (42.77ms measured), residual 3767
samples (78.5ms) → implied true latency ~5820 samples (121.3ms). Cross-check
agreement within ~5ms.

**Run 2:** uncalibrated applied 4800 samples (100.0ms), residual 716 samples
(14.9ms) → implied true latency ~5516 samples (114.9ms). Calibrated applied 2746
samples (57.21ms measured — note the measured value itself swung ~14ms between
these two consecutive sessions), residual 3792 samples (79.0ms) → implied true
latency ~6538 samples (136.2ms). Cross-check agreement worse this time, ~21ms.

**Why the "uncalibrated" baseline isn't really a latency measurement either:**
traced (confirmed from source, not assumed) the library's own 4800-sample/100ms
trim to `@waveform-playlist/core`'s `audibleLatencySamples(outputLatency,
lookAhead, sampleRate)` = `Math.floor((outputLatency + lookAhead) * sampleRate)`
(confirmed exact source at `node_modules/@waveform-playlist/core/dist/index.js:697`),
where
`lookAhead` is Tone.js's own `Context.lookAhead` — **confirmed at runtime via
direct logging: exactly `0.1`** (Tone's transport-scheduling lookahead, not
anything acoustic). `outputLatency` read as `undefined` on the Tone-wrapped
context at Connect time (the hook's own code does `?? 0`; the reading itself is
suspect since `outputLatency` is a running estimate only meaningful once audio has
flowed). So the "internal estimate" the library applies by default is really just
Tone's own scheduling delay, coincidentally landing in the same order of magnitude
as the true round-trip-as-recorded latency — not a substitute for a real
measurement.

**Naive additive hypothesis tested and rejected:** `applied = measured_acoustic +
toneLookAhead + outputLatency`. Against run 2: predicted `2746 + 4800 = 7546`
samples (157.2ms) — neither take's own residual-implied true total (5516 or 6538)
is close; the prediction overshoots both. Back-solving the uncalibrated take's
implied "acoustic-only" component (`5516 - 4800 = 716` samples, 14.9ms) doesn't
match the *directly measured* acoustic value from `<latency-test>` in the same
session (2746 samples, 57.2ms) — almost a 4x mismatch.

## Round 2 — Codex review: additive-vs-replace is right, but the missing term is recording-start skew, not outputLatency

Independent Codex review (full prompts/responses not reproduced here, see session
history) confirmed the additive-vs-replace direction but corrected the formula:
`<latency-test>`'s acoustic measurement already includes real output-device
latency, so adding `outputLatency` again double-counts it. The better-formed
hypothesis: `applied ≈ measured + toneLookAhead - skew`, where `skew` is the gap
between when Tone schedules playback and when the recording worklet actually
starts capturing (this demo calls `play(0)` *before* `startRecording()` — since
Tone schedules audible playback `lookAhead` seconds in the future, recording
starts during that pre-roll window, not at the scheduling instant, so part of the
`lookAhead` window is "free" and shouldn't be trimmed).

`baseLatency` logging (added to both the native and Tone-wrapped `AudioContext`
instances) came back `0` for both — uninformative; doesn't explain the gap via a
buffer-size difference between the two contexts.

A timing diagnostic was added (`RecordingDemo.tsx`, around the
`seekTo`/`play`/`startRecording` sequence) logging Tone's `rawContext.currentTime`
before `play(0)`, after `play(0)` resolves, and after `startRecording()` resolves,
plus the pairwise deltas (`skewFromBeforePlayMs`, `skewFromAfterPlayMs`).

**An early cross-check looked supportive but was later shown to be circular by
Codex:** for a calibrated take, `applied = measured` by construction, so
`skew = measured + lookAhead - ideal` algebraically reduces to `skew = lookAhead -
residual` — the measured value cancels out entirely. What looked like "skew stayed
consistent (~21ms) despite different measured values across two sessions" was
really just "the calibrated residual stayed stable (~79ms)," which says nothing
independent about the hypothesis. Recorded here as a methodology lesson, not just a
result: a consistency check that looks clean can still be tautological — check the
algebra, not just the numbers, before treating agreement as confirmation.

## Round 3 — live-measured skew, implemented for real

Wired the corrected formula into the actual compensation calculation (not just
diagnostic logging): `RecordingDemo.tsx`'s auto-start effect now computes
`correctedOffsetSamples = round((measured/1000 + lookAheadSec - skewSec) *
sampleRate)` right after `startRecording()` resolves (using the `beforePlay`
variant of skew, which fit an earlier live test to within 0.5ms) and writes it into
`pendingTakeRef.current.externalOffsetSamples` before `stopRecording()` runs, so
`App.tsx`'s `setTracks` wrapper picks up the corrected value when the clip arrives.

**Live test result: worse than round 1.** For the calibrated take (the *second*
take in the session), all three `currentTime` checkpoints came back **bit-for-bit
identical** (`skewFromBeforePlayMs: 0`, `skewFromAfterPlayMs: 0`,
`playCallToResolveGapMs: 0`) — reproduced across two separate live sessions, not a
one-off glitch. Applying the formula with this degenerate `skew=0` over-trimmed:
applied 142.8ms, residual **-1295 samples (-27.0ms)** — i.e. the true required trim
was only ~115.8ms, ~27ms less than what was applied. The math closes the loop
exactly: `used_skew(0) - true_skew ≈ residual` → `true_skew ≈ 27ms`, matching the
missing amount precisely. So the formula's *concept* wasn't contradicted — the
*live measurement* of its skew term failed specifically on this take.

**Mechanism:** the first (uncalibrated) take's `startRecording()` does real async
work the first time — loading and compiling the AudioWorklet module
(`recording-processor`) — which gives the audio clock visible time to advance
between checkpoint reads (16–27ms gaps observed on first takes). By the second
(calibrated) take, the module is cached, so the whole `play(0)` → `startRecording()`
sequence resolves faster than `rawContext.currentTime`'s own reporting resolution
(one render quantum, ~2.7ms at 48kHz) — the clock genuinely hasn't ticked between
JS-side reads, regardless of what's actually happening on the audio thread.
**Correctly phrased (per Codex): "JS-side `rawContext.currentTime` polling hit its
measurement floor on the cached-worklet path," not "the real skew became zero."**

## Cold-worklet sanity check (2026-06-23) — clarifies and sharpens the conclusion

Tested whether a genuinely cold worklet (first recording of a fresh page load,
calibrated take done *first*, skipping the uncalibrated take entirely — the UI
flow allows this since "Run latency test" doesn't require a prior recording)
would recover a real nonzero skew reading, per Codex's suggested cheap sanity
check.

**Result: skew was nonzero (42.67ms via `beforePlay`) — but this number is itself
an artifact, not the value we were looking for.** It is **bit-identical to ~10
significant figures** with the very first skew reading logged in this whole
investigation, several separate sessions earlier (`42.6666666666673` then,
`42.66666666666907` now) — far too precise to be a coincidental acoustic/scheduling
measurement. Notably, `42.666...ms` is exactly `2048 / 48000` seconds, i.e. 16
render quanta (128 samples each) — a quantized multiple of the audio clock's own
tick size, not an arbitrary acoustic value. The most defensible characterization:
a **cold-worklet setup artifact, quantized by the audio clock**, most likely
related to the AudioWorklet module's one-time load/compile/startup cost — not
asserted more specifically than that (e.g. not claimed to be exactly "dev-server
fetch time"), since the exact mechanism wasn't isolated further. Either way it has
nothing to do with Tone's scheduling or audio-graph timing.

This also explains why the result *looked* plausible (16.5ms residual, applied
99.5ms ≈ the library's own 100ms lookAhead-only default): `corrected = measured
(42.15) + lookAhead(100) - skew(42.67) ≈ 100ms`, i.e. the formula collapsed back to
~`lookAhead` alone purely because `skew` happened to land close to `measured` by
coincidence of both being double-digit-millisecond, dev-environment-dependent
numbers — not because the formula was validated. The resulting 16.5ms residual
sits squarely in the same range as *every* uncalibrated baseline's residual across
every session in this investigation (14.9–26.5ms) — i.e. it merely reproduced the
no-compensation baseline by accident.

## Final conclusion

**Across every variant tried — direct substitution (round 1), additive correction
with live-measured skew on a warm worklet (round 3's actual test), and additive
correction with live-measured skew on a cold worklet (the sanity check) — no
approach ever produced alignment meaningfully better than doing nothing at all**
(the library's own Tone-lookAhead-only default). The one case where the skew term
read as nonzero is best explained as a measurement artifact (worklet module-load
time), not a real audio-timing quantity — meaning the live-measurement methodology
was measuring the wrong thing even in the case where it appeared to "work."

This is a stronger, more specific instance of CLAUDE.md's existing "Lower-bound
caveat" (Decision #15: `<latency-test>`'s `audioworklet` mode measures its own
minimal capture graph, not the host app's full graph) than originally anticipated —
for a Tone.js-based host specifically, the gap isn't just "a minimal graph vs. a
fuller one," it's that Tone's transport layer introduces a non-acoustic scheduling
delay (`lookAhead`, ~100ms by default) that `<latency-test>` structurally cannot
see (it has no Tone awareness, and is forced onto a separate, Tone-free context to
function at all — see "Pipeline match" above), and no JS-side measurement
technique available from outside the AudioWorkletProcessor (i.e. without forking
`@waveform-playlist/worklets`) was able to resolve it.

**Decision (resolved 2026-06-23):** stop here. Getting further would require
sample-accurate timestamps from inside the AudioWorkletProcessor itself (the audio
thread, not JS-side polling), which means forking `@waveform-playlist/worklets`'
`recording-processor` — a meaningfully bigger undertaking than this demo warrants,
closer to "what the library would need to support natively" than something to hack
into a research/proof-of-concept demo. This investigation is the demo's primary
research output. Per Codex's recommendation, the code on this branch keeps the
round-3 experimental formula (the most-informed, best-diagnosed attempt) rather
than reverting to the simpler round-1 naive substitution — this branch is an
archival investigation artifact, not a polished demo, so the most diagnostic state
is the most valuable one. The formula is clearly commented as known-broken in
`RecordingDemo.tsx`. This demo was never merged to `main`; `main`'s docs point here
with a one-line negative-result summary instead.

## Possible future experiment (not attempted, Codex's suggestion)

Reverse the take sequence: start recording first, hold a deliberate pre-roll, then
start Tone playback after recording is already active. The compensation formula
would become "known recording pre-roll + Tone lookAhead + measured acoustic
latency" instead of relying on measuring an unknown skew after the fact. This
changes the demo's recording behavior (recording starts before the guide track,
not synchronized with it as currently implemented) and still depends on accurately
knowing/approximating "recording sample zero," so it's not a guaranteed fix — flagged
as a possible direction for a future session or a different demo, not something
this investigation attempted.

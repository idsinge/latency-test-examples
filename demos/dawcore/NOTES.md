# dawcore — latency compensation demo

Phase B of Tier 2: prove the latency-compensation A/B concept against `dawcore`
(Lit-based Web Components, npm `@dawcore/*`), a modern AudioWorklet-based multitrack
editor — the shared backend behind `naomiaro/waveform-playlist`'s migration. Follows
Phase A (`demos/waveform-playlist-legacy/`), which proved the pattern against an
already-working MediaRecorder-based fork.

## Dependency

Unlike Phase A, no fork or git-pin is needed — `@dawcore/components` and
`@dawcore/transport` are genuinely published to npm. Verified against a local
read-only reference clone (`~/Desktop/dawlatencydemos/dawcore`, shallow clone,
commit `6971ab6`) that this commit matches the published `@dawcore/components@0.0.24`
/ `@dawcore/transport@0.0.13` exactly.

**Peer-dependency chain finding:** `@dawcore/components@0.0.24`'s `package.json`
lists `@waveform-playlist/core` (`>=12.0.0`) and `@waveform-playlist/engine`
(`>=13.3.0`) as **non-optional** peer dependencies — both must be installed
directly. `@waveform-playlist/worklets` and `@dawcore/transport` are marked
`optional: true` in `peerDependenciesMeta`, but `worklets` is required in practice
for any demo that records: `RecordingController.startRecording()` does a runtime
`import('@waveform-playlist/worklets')` and throws an explicit "install it" error
if missing. `@dawcore/transport` is needed directly anyway for `NativePlayoutAdapter`.

**Version pinning (deliberate exception to Phase B's "track latest" policy):**
`@waveform-playlist/core`/`engine`/`worklets` are pinned to exact versions
(`12.2.0`, `13.4.0`, `12.2.0`), not caret ranges. This demo relies on
`_addRecordedClip`, an unofficial/unexported method inside that dependency chain
(see below) — an unnoticed minor/patch bump there could silently change or break
the integration. `@dawcore/components`/`@dawcore/transport` keep caret ranges, but
since both are `0.0.x`, npm's caret semantics collapse those to an exact pin
automatically regardless of the `^`. `@adasp/latency-test` keeps its caret range
per Phase B's general policy — no unofficial-API dependency on that side.

## Compensation insertion point (confirmed)

`packages/dawcore/src/controllers/recording-controller.ts`, `RecordingController`:

- At `startRecording()`, dawcore captures `AudioContext.outputLatency` once — the
  **browser's own self-reported estimate**, not anything externally measured:
  `const outputLatency = rawCtx.outputLatency ?? 0; const latencySamples =
  Math.floor(outputLatency * rawCtx.sampleRate)`.
- At `stopRecording()`, it trims that many samples off the start of the captured
  buffer, then dispatches a **cancelable** `daw-recording-complete` CustomEvent with
  `detail: {trackId, audioBuffer (full, untrimmed), startSample, durationSamples
  (already reflects the internal trim), offsetSamples (the internal trim amount)}`.
  If not prevented, the controller automatically calls `editor._addRecordedClip(...)`
  to create the visible clip with that internal offset.
- `RecordingOptions` (the only public input to `startRecording()`) has no field to
  override this — `{trackId?, bits?, channelCount?, startSample?, overdub?}`.

**Confirmed integration pattern — no fork required:** this demo's `daw-recording-complete`
listener calls `event.preventDefault()` only for the calibrated take (branching on
the in-flight `pendingIsCalibrated` flag set when the recording started — not a
fixed `calibratedTrackId` comparison, since accumulate-mode creates a fresh
`<daw-track>` per Record click), computes its own `appliedOffsetSamples` from
`<latency-test>`'s measured value, and calls `editor._addRecordedClip(trackId,
audioBuffer, startSample, audioBuffer.length - appliedOffsetSamples,
appliedOffsetSamples)` directly. `_addRecordedClip` is not TypeScript-`private`, not
exported from the package's public `index.ts`, underscore-prefixed by convention only
— callable at runtime but unofficial, could change without a semver bump.

## Design decision: asymmetric compensation (internal vs. external comparison)

The uncalibrated take deliberately does **not** force zero compensation — it lets
dawcore's own internal `outputLatency`-based compensation apply untouched (the
listener does not call `preventDefault()` for that take, since `pendingIsCalibrated`
is `false`). Only the calibrated take intercepts the event and substitutes the
`<latency-test>`-measured value.

This was a deliberate choice (confirmed with the user) over the alternative
(force zero on both takes, override only the calibrated one, mirroring Phase A's
"zero vs. measured" pattern exactly). The chosen design tests a more directly
useful question for anyone evaluating dawcore: **does external measurement actually
improve on what the library already does internally?** — rather than just
reproducing Phase A's simpler proof. The tradeoff: if `AudioContext.outputLatency`
happens to be a good estimate on the test machine, the "uncalibrated" take's flam
may be much less dramatic than Phase A's true zero-compensation take. The UI
surfaces both dawcore's internally-applied offset and the externally-applied one
side by side in the alignment-proof panel, so the comparison stays legible rather
than silently relabeling "library default" as "uncalibrated."

## Pipeline match (confirmed)

dawcore records via `AudioWorkletNode(rawCtx, 'recording-processor', ...)` —
confirms `recording-mode="audioworklet"` is the correct `<latency-test>` setting for
this demo (not `mediarecorder-1ch`, Phase A's setting). Per CLAUDE.md Decision #15,
`audioworklet` mode measures the component's own minimal capture graph, not
dawcore's full graph — a **lower-bound caveat**, not a full equivalence proof. This
demo's `<latency-test>` and dawcore share the same `AudioContext` instance
(`editor.audioContext` delegates back to the same object passed to
`NativePlayoutAdapter`), which narrows but doesn't eliminate that gap. Codex's plan
review additionally noted `<latency-test>`'s worklet processor is registered as
`recorder-processor` versus dawcore's `recording-processor` — no name collision on
the shared context — flagged here as Codex-sourced, not independently verified
against the `@adasp/latency-test` package source in this project.

## Borrowed / discovered technical debt

- `_addRecordedClip` (and, if ever needed, `_setSelectedTrackId`) are unofficial,
  unexported API surface — real integration risk for anyone building on this
  pattern (e.g. Hi-Audio), since they could change without notice across versions.
- A hidden internal short-recording gate: `stopRecording()` computes its own
  internal `effectiveDuration` (using the *internal* `outputLatency`-based offset,
  even for takes this demo otherwise overrides) and dispatches `daw-recording-error`
  with "Recording too short to save" if that's `0` — never reaching this demo's
  `daw-recording-complete` handler at all. Practically unreachable at metronome-length
  takes, but a real upstream dependency on dawcore's own estimate that exists
  regardless of which take is in flight.
- `editor.tracks` does not carry `trackId`. It returns `[...this._tracks.values()]`
  from an internal `Map<trackId, TrackDescriptor>` — the values only, and
  `TrackDescriptor` has no `trackId` field. Checking "does track X still exist"
  by scanning `editor.tracks` silently never matches anything. The working
  approach: keep the `<daw-track>` element reference returned by `addTrack()` and
  check its standard DOM `.isConnected` property (confirmed `removeTrack()` calls
  `trackElement.remove()` internally). Caught via Codex review before shipping,
  not from a live bug.

## What dawcore would need to support this natively

A public `RecordingOptions` field to override the latency estimate directly (e.g.
`{externalLatencySamples: N}`), instead of requiring `preventDefault()` plus
reimplementing the trim via an unofficial method. The migration spec already
gestures at "latency compensation" as a goal — this would make external measurement
a first-class, documented use case rather than something achieved by working around
the public API's edges.

## Known issues — fixed (2026-06-19)

Dev-mode testing surfaced two real bugs, both now fixed in `src/main.js`:

1. **Play/Record collision.** Clicking Play, then Record (Calibrated) *without*
   clicking Stop first, caused `recordTake()`'s `editor.seekTo(0)` call to
   silently stop-and-restart **all** playback from sample 0 — `seekTo()` calls a
   global `editor.stop()`/`editor.play()` when already playing (confirmed
   against `packages/dawcore/src/elements/daw-editor.ts`'s `seekTo()`), not
   scoped to one track. Fixed by making Play mutually exclusive with
   Record/Test via the existing `lockableButtons` locking pattern, and
   time-boxing playback with `guideTrackBuffer.duration` + a small safety
   margin rather than polling internal playback state (dawcore exposes no
   public "playback ended naturally" event).
2. **"Overwriting" report, root-caused.** Reproduction: delete the Calibrated
   track via dawcore's own delete-track button, then click Record (Calibrated)
   again — nothing was ever recorded, no error shown. Not actual cross-track
   corruption — `removeClip`/`removeTrack` are correctly keyed to stable
   `trackId`s. Real cause: this demo held one **fixed** `trackId` per side,
   set once at connect time. `startRecording()` doesn't validate the trackId
   still exists, so a session opens and captures real audio against the now-
   deleted ID; at finalize time `recording-clip.ts`'s `addRecordedClip()` looks
   up the track, finds nothing, and **silently discards the clip** (no warning,
   no error event). Fixed by switching to per-click track creation: every
   Record click creates a fresh `<daw-track>` (accumulate mode — prior takes on
   a side stay visible as "take 1", "take 2", ...), so there's never a stale ID
   to record into after a manual deletion. A further edge case (deleting the
   *active* track while a recording is mid-flight) is handled defensively: the
   `daw-recording-complete` handler checks the originating `<daw-track>`
   element's `isConnected` and skips the clip with a console warning rather
   than attempting to attach to a removed track.

**Version-drift finding:** the local reference clone (`~/Desktop/dawlatencydemos/dawcore`,
commit `6971ab6`) has a public `get duration()` on `DawEditorElement` in source,
but the actually-*installed* `@dawcore/components@0.0.24` bundle does not
(confirmed by grepping the compiled `dist/index.mjs` — only the private
`_duration` field exists). That getter postdates whatever commit `0.0.24` was
cut from. Worth rechecking if/when this demo's pin is bumped.

## Codex diff review — 4 findings, fixed (2026-06-22)

A second Codex round, this time reviewing the actual `src/main.js` diff
(rather than the plan) before any dev-mode testing, found 4 more correctness
issues, all confirmed against the file and fixed:

1. **Play didn't actually stop dawcore's internal playback state on natural
   end.** `editor.play(0)` has no end time; when the safety-margin timer won
   the race (playback ended on its own, Stop never clicked), buttons unlocked
   but dawcore's `isPlaying` stayed true — a later Record could still hit the
   `seekTo()`-while-playing collision the whole locking scheme exists to
   prevent. Fixed: `editor.stop()` is now called unconditionally in the Play
   handler's `finally`, even if Stop was already clicked (confirmed safe/
   idempotent).
2. **Lock taken too late for single-flight safety.** `recordNewTake()` only
   locked buttons inside `recordTake()`, which runs after `await
   editor.addTrack()` resolves; since `<daw-track>` connects via a
   `setTimeout(..., 0)`, a fast double-click on Record could create two
   tracks before the first lock took effect, racing to overwrite the single
   `pending*` state. Fixed: lock ownership moved to `recordNewTake()`, held
   across both `addTrack()` and `recordTake()`; `recordTake()` now only owns
   the recording mechanics and pending-state cleanup, not button state.
3. **Deleted-track branch let dawcore's default clip path still run.** The
   `!pendingTrackEl.isConnected` guard in `daw-recording-complete` returned
   without `e.preventDefault()`, so dawcore's default recorded-clip handling
   still executed — generating peaks before discovering the track was gone,
   then leaving `_peaksData` orphaned (only `_clipBuffers` got cleaned up).
   Fixed: added `preventDefault()` to that guard. (The *other* early-return
   guard, for an unexpected `trackId`, correctly does NOT call
   `preventDefault()` — that's not the deletion scenario, so dawcore's
   default handling for that other track is fine to let run.)
4. **Take label source was inferred, not tracked.** `reportAlignment()`
   guessed whether an offset came from `<latency-test>` or from dawcore's own
   internal `outputLatency` compensation by comparing
   `internalOffsetSamples === appliedOffsetSamples` — if a measured latency
   happened to round to the same sample count as dawcore's internal offset,
   a calibrated take would be mislabeled as uncalibrated. Fixed: pass the
   already-known `isCalibrated` boolean through explicitly instead of
   inferring it from the numbers.

Codex separately confirmed the `.isConnected` deletion-detection approach
(bug 2 in the section above) is reliable for this installed dawcore version —
no normal track reorder/render path transiently disconnects a `<daw-track>`.

**Known limitation, deferred:** accumulate-mode (a fresh `<daw-track>` per
Record click) grows unbounded over a long session — fine for this demo's
manual hardware-testing use case, but a "clear all takes" reset affordance
would be needed for extended use. Out of scope for now; noted here in case
this demo's lifetime gets extended later.

## Confirmed dawcore library bug — mute/solo/volume/pan silently reset by any new track load (2026-06-22, refined after Codex review, confirmed in isolation)

Found during the dev-mode manual walkthrough (not in this demo's own code).
Root-caused in two passes: an initial trace through `@dawcore/components`/
`@dawcore/transport` (correct mechanism, wrong layer identified as the
source), then a Codex second-opinion review that pointed at a third package,
`@waveform-playlist/engine`, which has the actual, much narrower defect.
Final analysis below is the corrected, Codex-verified version.

**Independently confirmed outside this repo, 2026-06-22.** Before filing
upstream, reproduced in a brand-new, isolated project with zero relation to
this demo or its recording pipeline — just `@dawcore/components@0.0.24`,
`@dawcore/transport@0.0.13`, `@waveform-playlist/core@12.2.0`,
`@waveform-playlist/engine@13.4.0` (the same exact published versions this
demo pins), one `<daw-editor>`, two empty tracks (no clips, no audio
decode), and a direct read of `editor._engine._adapter._transport._mutedTrackIds`
(an ordinary underscore-prefixed property, not a true private field, so
directly inspectable from the console) before/after adding the second track.
Console output:

    Track A created: 6d7b52db-acd6-4dee-ba8d-51693d1a756f
    After muting A — live muted set: [6d7b52db-acd6-4dee-ba8d-51693d1a756f]
    OK: A is correctly muted at the engine level.
    Track B created: 35161bea-b2f2-4435-82b2-72fdae1ba680
    After adding B — live muted set: []
    REPRODUCED: A silently lost its muted state after adding B.

This rules out anything specific to this demo (recording pipeline,
`<latency-test>` integration, accumulate-mode track creation, or audio
hardware/listening as a source of error) and gives a deterministic,
headless-testable repro that doesn't depend on actually hearing anything —
strong grounds to file upstream.

**Repro:** mute a track via dawcore's built-in `<daw-track-controls>` mute
button (wait for `daw-track-ready` first if the track was just added) →
`Play` correctly stays silent for that track. Then add/record any other
track and wait for it to load → `Play` again — the previously-muted track is
audible again, with no further interaction needed to "unmute" it. The same
reproduces for `soloed`, `volume`, and `pan` — confirmed directly by reading
all four setters (not inferred), see below.

**Root cause — three packages involved, one is the actual source:**

1. **`@waveform-playlist/engine@13.4.0`'s `PlaylistEngine` — the actual
   defect.** Every track-list-mutating method on this class —
   `setTracks()`, `addTrack()`, `removeTrack()`, `updateTrack()` — ends with
   `this._tracksVersion++; this._emitStateChange();` (confirmed at
   `dist/index.mjs:300-302`, `314-320`, `326-335`, `351-357`). But the four
   **per-track mixer setters** — `setTrackVolume()` (`:700`),
   `setTrackMute()` (`:705`), `setTrackSolo()` (`:710`), `setTrackPan()`
   (`:715`) — correctly mutate `PlaylistEngine`'s own internal `_tracks`
   array in place (e.g. `setTrackMute`: `const track = this._tracks.find(t
   => t.id === trackId); if (track) track.muted = muted;`) and correctly
   forward to the adapter (`this._adapter?.setTrackMute(trackId, muted)` —
   this is why an immediate `Play` right after muting works correctly), but
   **do not call `_emitStateChange()` and do not increment
   `_tracksVersion`**, unlike every sibling method in the class.

2. **`@dawcore/components`'s `<daw-editor>` relies entirely on that
   version-gated `statechange` event to resync its own cache.**
   `_buildEngine()` registers `engine.on("statechange", (engineState) => {
   if (engineState.tracksVersion !== lastTracksVersion) { ...rebuild
   this._engineTracks from engineState.tracks... } })`
   (`dist/index.mjs:6796-6809`). Since the four mixer setters above never
   bump `tracksVersion` or emit `statechange`, this resync **never runs**
   for mute/solo/volume/pan changes — `this._engineTracks` (a *separate*
   cache from `PlaylistEngine`'s own `_tracks`) is stuck with whatever
   values existed when each track's `_loadTrack()` last completed
   (`dist/index.mjs:6583`, capturing `descriptor.muted`/`soloed` at
   `:6627` and `:6683`).

3. **The stale cache gets propagated back into the engine and wipes live
   state.** Whenever *any* track finishes `_loadTrack()` — including a
   brand-new, unrelated one — `<daw-editor>` calls
   `engine.setTracks([...this._engineTracks.values()])`
   (`dist/index.mjs:6699`). `PlaylistEngine.setTracks()`
   (`engine/dist/index.mjs:291-302`) replaces its own (correctly-mutated)
   `_tracks` array wholesale with this stale snapshot, then forwards it to
   the adapter. `@dawcore/transport`'s `Transport.setTracks()`
   (`transport/dist/index.mjs:1395-1416`) clears
   `_mutedTrackIds`/`_soloedTrackIds` entirely and re-derives them purely
   from that (now stale) array — live mute/solo state lost. The same
   array carries stale `volume`/`pan` into fresh `TrackNode`s too.

So step 1 (`@waveform-playlist/engine`) is where the actual fix belongs —
steps 2 and 3 are an existing, correctly-designed resync mechanism that
simply never gets triggered for these four methods.

**Confirmed not demo-specific:** the mute control is dawcore's own built-in
widget (this demo writes no custom mute code); `addTrack()` is the standard
public API for adding any track (recording, file drop, MIDI import — not
specific to this demo's per-take recording pattern); there is no public
method that lets a consumer keep `_engineTracks`' cached snapshot in sync
with later mixer changes, so there was no "correct" usage this demo missed.
This demo's accumulate-mode (one new track per Record click) just makes the
bug surface on every single Record — it doesn't cause it. Any dawcore app
that changes a track's mute/solo/volume/pan and *later* adds any other
track will hit this.

**Suggested fix (Codex-reviewed):** add the same
`this._tracksVersion++; this._emitStateChange();` pair that every sibling
method already has to the end of `PlaylistEngine.setTrackVolume()`,
`setTrackMute()`, `setTrackSolo()`, and `setTrackPan()`
(`@waveform-playlist/engine`, `dist/index.mjs:700-718`). A 4-line, one-package
fix that closes the gap at its actual source — no change needed in
`@dawcore/components` or `@dawcore/transport` at all, since the resync
mechanism downstream already exists and works correctly for every other
track-mutating method.

An earlier draft of this analysis (and the issue below) proposed instead
changing `@dawcore/components`'s `_loadTrack()` to call the engine's
incremental `updateTrack()`/`addTrack()` instead of a full `setTracks()`
rebuild. Codex review caught that `Transport.updateTrack()`
(`transport/dist/index.mjs:1447`) only updates an *existing* `TrackNode` and
silently no-ops if one doesn't exist yet — so that fix would need to
correctly branch between `updateTrack()` (existing track) and `addTrack()`
(brand-new track) using actual engine presence, not "is this the first
track" — meaningfully more complex than the one-package, four-line fix
above. Kept here as a discarded alternative, not the recommendation.

**Workaround implemented in this demo (2026-06-22):** step 4's instructions and
`index.html` text changed from "mute the uncalibrated track" to "listen, then
delete the uncalibrated track" — delete is unaffected by this bug (it's not one of
the four broken setters), so it reliably keeps only the calibrated take playing for
step 5's comparison, where mute/volume could not.

**Decision:** documented here and filed upstream as
[naomiaro/waveform-playlist#501](https://github.com/naomiaro/waveform-playlist/issues/501)
rather than worked around in `main.js` — this bug doesn't affect the actual
latency-compensation proof (`computeAlignmentOffset` operates on raw
recorded buffers, not the playback mixer graph), only the demo's own
convenience mute UX, so a demo-side workaround isn't required for Phase B's
research goal. Checked the repo's full issue/PR history (open + closed, plus
the closest-looking candidates read in full: #21, #224, #260, #270, #339,
#452/#468, #499) before filing — confirmed no duplicate existed.

## Alignment evidence — sample-domain proof (required for Phase B)

Algorithm in `src/alignment.js`: a sliding-window max-abs envelope detects click
onsets in both the guide track and each recorded take (adaptive per-buffer
threshold, debounced against a single click's decay); `matchClickSequences` searches
a small range of edge-trims on each onset sequence and pairs them sequentially;
`computeAlignmentOffset` takes the median of the winning pairing and sets
`reliable: false` if the pair count, click-count parity, or spread don't clear a
threshold — mirroring `<latency-test>`'s own `reliable` flag so a noisy reading is
never silently presented as proof.

### Bug found and fixed during first verification run (2026-06-22)

The first several verification attempts produced wildly wrong residual offsets
(hundreds to over a thousand ms) despite excellent MAD (sub-millisecond) and
`reliable: true` — e.g. a calibrated take reporting a 1101.4ms residual. Root-caused
by adding temporary diagnostic output (raw onset timestamps + the winning
`trimGuide`/`trimRecorded`) and checking it against the guide track's actual,
independently-measured click tempo (110 BPM exactly, 545.4545ms/click, confirmed via
`ffprobe`'s `silencedetect` filter on `metronome.mp3` outside the browser entirely):
reported residuals landed within ~1ms of clean whole-beat multiples (one case
-1090.0ms vs. 2×545.4545=1090.9ms; another -545.6ms vs. 1×545.4545=545.4545ms) — far
too precise to be coincidence.

**Root cause:** `matchClickSequences`'s original selection rule picked whichever
edge-trim combination had the single globally-lowest MAD, with no penalty for how
much data that combination discarded. With perfectly evenly-spaced metronome clicks,
trimming away 1-2 edge clicks can shave a fraction of a millisecond off an
already-tiny MAD purely by chance, while silently shifting every remaining pair to
the **wrong** corresponding click (guide click *N* matched to recorded click *N+1* or
*N+2*) — a result that looks just as "tight" as the correct pairing but is wrong by
one or more full beats. Verified directly against captured production data: the
direct, untrimmed (`trimGuide=0, trimRecorded=0`) pairing for both the wrongly-flagged
takes already had excellent MAD (0.09-0.28ms) and sane residuals (~10ms, ~41ms) — the
algorithm just never considered that the untrimmed pairing was already good enough,
because a further-trimmed one scored a few hundredths of a millisecond lower.

**Fix:** `matchClickSequences` now searches trim combinations in order of
*increasing* total trim and stops at the first (least-trimmed) one whose MAD already
clears an acceptable threshold — reusing `computeAlignmentOffset`'s existing
`maxMadMs` reliability bound rather than introducing a new constant — instead of
exhaustively searching for the global minimum MAD regardless of how much data that
costs. Still escalates trimming when the untrimmed pairing genuinely isn't good
enough (a real missed/extra edge click), just no longer over-trims when it doesn't
need to. Verified two ways before considering it fixed: offline against the actual
captured onset arrays from the broken runs (confirmed the fix selects
`trimGuide=0, trimRecorded=0` and recovers the sane ~41ms / ~10ms residuals), then
live in two more full recording sessions with completely fresh data, both landing
within ~1% of the offline-predicted values.

### Reliability-gate tightening — found in Codex sign-off review (2026-06-22)

Codex's completed-block sign-off review identified a second, distinct failure mode
in `matchClickSequences` beyond the over-trimming bug above: when the guide and
recorded onset counts genuinely differ (e.g. a real missed click at the very start
of a take), the untrimmed (`totalTrim=0`) pairing can score an excellent MAD while
being silently shifted by a whole beat — `recordedOnsets[i]` ends up compared
against the wrong guide click for every `i`, but since the metronome is evenly
spaced (110 BPM, 545.4545ms/click) the resulting offsets are still tightly
clustered, so MAD alone cannot tell this apart from a correct, untrimmed pairing.
The previous `reliable` gate (`onsetCountDiff <= 1`) let this case through.

Neither of this session's verified takes were affected — both matched 16/16
clicks exactly (`onsetCountDiff === 0`) — but the algorithm was not safe for a
future run with a genuinely missed edge click. Fix: `reliable` now requires an
exact onset-count match, not `<= 1`. This removes `matchClickSequences`'s
one-missed-click recovery from ever being trusted as `reliable: true` — a
deliberate, conservative trade Codex confirmed appropriate ("[reusing maxMadMs]
is reasonable for equal-count runs... not sufficient when click counts differ").
`matchClickSequences` itself is unchanged and still reports its best-guess offset
on a count mismatch for diagnostic visibility; only the `reliable` flag is
stricter now.

Also fixed: `matchClickSequences`'s `maxAcceptableMad` parameter defaulted to `0`,
which (for any direct caller that omits it) silently reverted to exhaustively
searching for the global-minimum-MAD candidate — exactly the over-trimming bug
this function was rewritten to avoid. `computeAlignmentOffset` always supplies an
explicit threshold so this never fired in this demo's own runs, but the exported
function's default behavior was unsafe. Fixed: default changed to `Infinity`, so
an omitted threshold now means "accept the least-trimmed candidate with any pairs
at all" — consistent with the function's documented least-trimming-wins intent.

### Results (final, 2026-06-22 — Audio MIDI Setup input/output both corrected to 48000 Hz)

Confirmed across two independent full sessions, one in `npm run dev`, one against the
production build via `npm run preview` (minified bundle, base-path-correct, no console
errors beyond the intentional `[alignment-debug]` log):

- **Uncalibrated** (dawcore's own internal `outputLatency`-based guess, ~7.3ms
  applied): residual **40.7-40.9ms** across both runs, 16/16 clicks matched, MAD
  ~0.1-0.2ms, `reliable: true`. Confirms dawcore's built-in compensation alone
  meaningfully undercompensates here.
- **Calibrated** (using `<latency-test>`'s measured ~42.8ms, ratio 24-26 dB):
  residual **-0.1ms** (dev run) and **5.2ms** (preview run), both 16/16 clicks
  matched, MAD ~0.1-0.3ms, `reliable: true`. Run-to-run variation of a few ms is
  expected measurement noise — both results are roughly an order of magnitude
  smaller than the uncalibrated baseline, which is the required Phase B proof that
  an externally-measured latency value correctly compensates a real dawcore
  recording.

## Demo behavior notes

- dawcore's built-in per-track controls (`daw-track-controls`) are used directly —
  no custom widget needed, same spirit as Phase A's library-provided controls. Note:
  mute/solo specifically are affected by the upstream engine bug above (#501), so
  step 4's instructions use the track-delete control instead of mute to clear the
  uncalibrated take before the calibrated A/B comparison.
- `startRecording()`/`stopRecording()` are real `async` methods — cleaner than Phase
  A's emit-based fire-and-forget pattern, no race condition to work around.
- `overdub: true` is required in `startRecording()`'s options for the guide track to
  actually play back during recording (caught in Codex's plan review — the original
  draft omitted this and would have recorded silence). `editor.seekTo(0)` runs first
  each take so overdub playback starts from the guide track's beginning.
- Record/play buttons are locked during the latency test too (not just during
  recording), so the MLS test and dawcore's recording/playback never contend for the
  same mic stream / audio graph (also a Codex plan-review finding).
- No `<daw-transport>`/`<daw-record-button>` prebuilt UI — this demo needs custom
  buttons driving `startRecording()`/`stopRecording()` programmatically so the
  compensation-branching logic above can run, a deliberate bypass of dawcore's
  ready-made transport UI.

## Verified

All verification complete as of 2026-06-22. Environment: Node 22.22.3, Firefox
151.0.4 (aarch64), macOS 15.4, beyerdynamic DT 770 PRO 80Ω headphones + MacBook Pro
built-in mic, both input and output corrected to 48000 Hz in Audio MIDI Setup
(96000 Hz native mismatch was the root cause of an early false-unreliable result,
unrelated to the code — see Alignment evidence section).

- **`npm run dev` manual walkthrough** — all 6 scenarios pass: idle→Play→natural
  end; Play→Record without Stop (no collision); Stop during Play/Record startup
  (unlocks cleanly); delete an idle track then record a fresh take on that side;
  record twice back-to-back including a fast double-click on Record (exactly one
  track per take, no race); delete the *active* track mid-recording (warns and
  skips the clip, confirmed via console: `[dawcore-demo] Recording track was
  deleted before completion — skipping clip`, no throw).
- **`npm run build`** — clean, no errors, across every code change made this
  session (Codex-review fixes, alignment.js bug fix, index.html wording change).
- **`npm run preview`** — production build served correctly at its GitHub
  Pages base path (`/latency-test-examples/demos/dawcore/`), smoke-tested with a
  full record→latency-test→record session against the minified bundle, no console
  errors beyond the intentional `[alignment-debug]` log.
- **Sample-domain alignment proof** — see "Results" under Alignment evidence
  above: uncalibrated ~41ms residual, calibrated -0.1 to 5.2ms residual (run-to-run
  noise), both `reliable: true`, 16/16 clicks matched. This is the required Phase B
  proof and the headline result of this demo.
- **dawcore library bug** (mute/solo/volume/pan reset) — root-caused, independently
  reproduced outside this repo, filed as
  [naomiaro/waveform-playlist#501](https://github.com/naomiaro/waveform-playlist/issues/501),
  worked around in this demo via the step 4 delete-instead-of-mute change.
- **alignment.js click-matching bug** (wrong-trim selection) — root-caused, fixed,
  verified offline against captured production data and live across two further
  full sessions (dev + preview).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import '@adasp/latency-test'
import type { LatencyTestElement, LatencyResultDetail, LatencyErrorDetail } from '@adasp/latency-test'
import { Waveform, usePlaylistControls, usePlaylistData } from '@waveform-playlist/browser'
import { useIntegratedRecording } from '@waveform-playlist/recording'
import { createTrack, type ClipTrack } from '@waveform-playlist/core'
import { getGlobalAudioContext, getGlobalContext, resumeGlobalAudioContext } from '@waveform-playlist/playout'
import type { AlignmentEntry, PendingTake } from './App'

const RECORD_MARGIN_MS = 1500
const ENGINE_READY_TIMEOUT_MS = 5000

interface RecordingDemoProps {
  tracks: ClipTrack[]
  setTracks: (tracks: ClipTrack[]) => void
  selectedTrackId: string | null
  setSelectedTrackId: (id: string | null) => void
  pendingTakeRef: MutableRefObject<PendingTake | null>
  guideTrackBuffer: AudioBuffer | null
  onGuideTrackReady: (buffer: AudioBuffer, name: string) => void
  alignmentResults: AlignmentEntry[]
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function RecordingDemo({
  tracks,
  setTracks,
  selectedTrackId,
  setSelectedTrackId,
  pendingTakeRef,
  guideTrackBuffer,
  onGuideTrackReady,
  alignmentResults,
}: RecordingDemoProps) {
  const latencyTestRef = useRef<LatencyTestElement | null>(null)
  // <latency-test> cannot share the recording pipeline's AudioContext — Tone.js
  // always wraps it via standardized-audio-context, which the native
  // AudioWorkletNode constructor rejects (confirmed by reading both libraries'
  // dist source: see NOTES.md "Pipeline match — confirmed FORCED separate
  // AudioContext"). A separate, genuine native AudioContext is used for it
  // instead, sharing only the MediaStream.
  const nativeAudioContextRef = useRef<AudioContext | null>(null)

  const [connected, setConnected] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastReliableLatencyMs, setLastReliableLatencyMs] = useState<number | null>(null)
  const [uncalibratedCount, setUncalibratedCount] = useState(0)
  const [calibratedCount, setCalibratedCount] = useState(0)
  const [pendingAutoStart, setPendingAutoStart] = useState<{ isCalibrated: boolean; label: string } | null>(null)

  const { sampleRate, isReady } = usePlaylistData()
  const { play, stop, seekTo, setTrackMute } = usePlaylistControls()

  const isReadyRef = useRef(isReady)
  isReadyRef.current = isReady

  // Every completed take forces a full engine rebuild (appending a clip to an
  // existing track breaks isIncrementalAdd's reference-equality check, same
  // condition documented under the #501 finding in NOTES.md) — isReady goes
  // false then true again after each take, not just once after Connect.
  // play()/recording must wait for it rather than assume the engine is ready
  // immediately after a tracks-array update resolves.
  const waitUntilReady = useCallback(async (timeoutMs = ENGINE_READY_TIMEOUT_MS) => {
    const start = Date.now()
    while (!isReadyRef.current) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Engine did not become ready in time')
      }
      await delay(50)
    }
  }, [])

  const {
    isRecording,
    duration,
    recordingPeaks,
    stream,
    hasPermission,
    requestMicAccess,
    startRecording,
    stopRecording,
    error: recordingError,
  } = useIntegratedRecording(tracks, setTracks, selectedTrackId, {
    currentTime: 0,
    channelCount: 1,
    audioConstraints: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
  })

  const handleConnect = useCallback(async () => {
    setConnectError(null)
    try {
      // Create the native context FIRST, before requestMicAccess() — the
      // stream-wiring effect below fires as soon as `stream` updates (which
      // can happen mid-await, before this function reaches later lines), and
      // since it reads nativeAudioContextRef.current at that moment (a ref,
      // not state — its own later assignment can't retrigger the effect),
      // the context must already exist by the time requestMicAccess()
      // resolves, not after.
      nativeAudioContextRef.current = new AudioContext({ sampleRate: 48000, latencyHint: 0 })

      // The shared Tone.js context is already created (WaveformPlaylistProvider
      // does this eagerly on mount, regardless of any gesture). Resuming it
      // still needs to happen inside this gesture, per Firefox's autoplay
      // policy — resume works regardless of when the context was originally
      // created, as long as resume itself runs in direct response to a click.
      await resumeGlobalAudioContext()
      await requestMicAccess()

      const audioCtx = getGlobalAudioContext()
      // outputLatency is a running estimate that's only meaningful once audio
      // has actually been flowing — reading it here, immediately after
      // creation, is unreliable. baseLatency is fixed by the context's buffer
      // size/latencyHint and is meaningful immediately, so it's the more
      // trustworthy signal for comparing the two contexts' underlying buffer
      // configuration (a likely source of acoustic-latency mismatch between
      // the Tone-wrapped global context and the separate native one used for
      // <latency-test>).
      console.log('[wp-react-demo][latency-debug] global context latency components', {
        toneLookAheadSec: getGlobalContext().lookAhead,
        audioContextOutputLatencySec: audioCtx.outputLatency,
        audioContextBaseLatencySec: audioCtx.baseLatency,
        nativeAudioContextOutputLatencySec: nativeAudioContextRef.current?.outputLatency,
        nativeAudioContextBaseLatencySec: nativeAudioContextRef.current?.baseLatency,
      })
      const guideUrl = `${import.meta.env.BASE_URL}metronome.mp3`
      const guideArrayBuffer = await fetch(guideUrl).then((r) => r.arrayBuffer())
      const guideBuffer = await audioCtx.decodeAudioData(guideArrayBuffer)
      onGuideTrackReady(guideBuffer, 'Metronome')

      setConnected(true)
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err))
    }
  }, [requestMicAccess, onGuideTrackReady])

  useEffect(() => {
    return () => {
      nativeAudioContextRef.current?.close()
    }
  }, [])

  // Share the MediaStream with <latency-test>, but not the AudioContext (see
  // the note on nativeAudioContextRef above).
  useEffect(() => {
    const el = latencyTestRef.current
    const ctx = nativeAudioContextRef.current
    console.log('[wp-react-demo][wiring-debug] wiring effect ran', {
      hasEl: !!el,
      hasStream: !!stream,
      streamActive: stream?.active,
      hasCtx: !!ctx,
    })
    if (!el || !stream || !ctx) return
    el.audioContext = ctx
    el.inputStream = stream
    console.log('[wp-react-demo][wiring-debug] assigned to element', {
      elInputStreamSet: !!el.inputStream,
      elAudioContextSet: !!el.audioContext,
    })
  }, [stream])

  useEffect(() => {
    const el = latencyTestRef.current
    if (!el) return
    const onStart = () => setBusy(true)
    const onResult = (e: Event) => {
      const { latency, reliable } = (e as CustomEvent<LatencyResultDetail>).detail
      setLastReliableLatencyMs(reliable ? latency : null)
    }
    const onComplete = () => setBusy(false)
    const onError = (e: Event) => {
      console.warn('[wp-react-demo] latency-error', (e as CustomEvent<LatencyErrorDetail>).detail)
      setLastReliableLatencyMs(null)
      setBusy(false)
    }
    el.addEventListener('latency-start', onStart)
    el.addEventListener('latency-result', onResult)
    el.addEventListener('latency-complete', onComplete)
    el.addEventListener('latency-error', onError)
    return () => {
      el.removeEventListener('latency-start', onStart)
      el.removeEventListener('latency-result', onResult)
      el.removeEventListener('latency-complete', onComplete)
      el.removeEventListener('latency-error', onError)
    }
  }, [])

  const beginTake = useCallback(
    (isCalibrated: boolean) => {
      if (!guideTrackBuffer || busy) return
      setBusy(true)
      const count = isCalibrated ? calibratedCount + 1 : uncalibratedCount + 1
      if (isCalibrated) setCalibratedCount(count)
      else setUncalibratedCount(count)
      const label = `${isCalibrated ? 'Calibrated' : 'Uncalibrated'} take ${count}`

      const newTrack = createTrack({ name: label })
      setTracks([...tracks, newTrack])
      setSelectedTrackId(newTrack.id)
      // Actually starting recording happens in the effect below, once
      // selectedTrackId's ref inside useIntegratedRecording has caught up
      // with this render (it only updates during render, not synchronously
      // here) — same reason upstream's own reference example uses this
      // auto-start-after-create pattern instead of calling startRecording()
      // immediately after setSelectedTrackId.
      setPendingAutoStart({ isCalibrated, label })
    },
    [tracks, setTracks, setSelectedTrackId, guideTrackBuffer, busy, calibratedCount, uncalibratedCount]
  )

  useEffect(() => {
    if (!pendingAutoStart || !selectedTrackId || !guideTrackBuffer) return
    const { isCalibrated, label } = pendingAutoStart
    setPendingAutoStart(null)

    // Real offset is computed after recording starts (see below) — the
    // formula needs the live-measured recording-start skew, which isn't
    // known until startRecording() resolves. null here is a placeholder;
    // setTracks won't see it until stopRecording() runs, well after the
    // corrected value is assigned below.
    pendingTakeRef.current = { label, isCalibrated, externalOffsetSamples: null }

    const recordDurationMs = guideTrackBuffer.duration * 1000 + RECORD_MARGIN_MS

    void (async () => {
      try {
        await waitUntilReady()
        // seekTo/startRecording/stopRecording are typed as returning void
        // upstream even though they're async at runtime (confirmed: their
        // implementations are async functions) — awaiting still correctly
        // waits for the real underlying Promise; only the static type is
        // imprecise.
        await seekTo(0)
        // KNOWN BROKEN — kept for the research record, not as a working
        // formula. See NOTES.md "Final conclusion": this live-measured-skew
        // approach was this investigation's best-formed hypothesis, but the
        // measurement technique itself hits a floor — on any take after the
        // first, the AudioWorklet module is already cached, so play(0) and
        // startRecording() resolve faster than rawContext.currentTime's own
        // reporting resolution (one render quantum, ~2.7ms @ 48kHz), making
        // every skew reading after the first take read as a degenerate 0.
        // The one case where skew read nonzero (a cold-worklet sanity check)
        // turned out to be measuring AudioWorklet module load/compile time,
        // not anything Tone-scheduling-related — confirmed by it being
        // bit-identical across separate sessions days apart. No working
        // compensation formula was found in this investigation; see
        // NOTES.md for the full trail (rounds 1-3 plus the sanity check).
        const toneContextTimeBeforePlay = getGlobalContext().rawContext.currentTime
        await play(0)
        const toneContextTimeAfterPlay = getGlobalContext().rawContext.currentTime
        await startRecording()
        const toneContextTimeAfterStartRecording = getGlobalContext().rawContext.currentTime
        const skewSec = toneContextTimeAfterStartRecording - toneContextTimeBeforePlay
        const lookAheadSec = getGlobalContext().lookAhead
        const naiveOffsetSamples =
          isCalibrated && lastReliableLatencyMs != null
            ? Math.round((lastReliableLatencyMs / 1000) * sampleRate)
            : null
        const correctedOffsetSamples =
          isCalibrated && lastReliableLatencyMs != null
            ? Math.round((lastReliableLatencyMs / 1000 + lookAheadSec - skewSec) * sampleRate)
            : null
        if (pendingTakeRef.current) {
          pendingTakeRef.current = { ...pendingTakeRef.current, externalOffsetSamples: correctedOffsetSamples }
        }
        console.log('[wp-react-demo][skew-debug] recording-start timing', {
          label,
          toneLookAheadSec: lookAheadSec,
          contextTimeBeforePlaySec: toneContextTimeBeforePlay,
          contextTimeAfterPlaySec: toneContextTimeAfterPlay,
          contextTimeAfterStartRecordingSec: toneContextTimeAfterStartRecording,
          skewFromBeforePlayMs: skewSec * 1000,
          skewFromAfterPlayMs: (toneContextTimeAfterStartRecording - toneContextTimeAfterPlay) * 1000,
          playCallToResolveGapMs: (toneContextTimeAfterPlay - toneContextTimeBeforePlay) * 1000,
          naiveOffsetSamples,
          correctedOffsetSamples,
        })
        await delay(recordDurationMs)
        await stopRecording()
      } catch (err) {
        console.warn('[wp-react-demo] Recording failed:', err)
        pendingTakeRef.current = null
      } finally {
        stop()
        setBusy(false)
      }
    })()
    // selectedTrackId/guideTrackBuffer/lastReliableLatencyMs/sampleRate are
    // read once per auto-start, not meant to retrigger this effect mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoStart])

  // Confirmed empirically (see NOTES.md "#501 investigation"): mute survives a
  // full engine rebuild in this consumer, unlike dawcore — safe to use
  // normally here.
  const clearUncalibratedTakes = useCallback(() => {
    tracks.forEach((t, i) => {
      if (t.name.startsWith('Uncalibrated')) setTrackMute(i, true)
    })
  }, [tracks, setTrackMute])

  const handlePlay = useCallback(async () => {
    setBusy(true)
    try {
      await waitUntilReady()
      await play(0)
    } catch (err) {
      console.warn('[wp-react-demo] Play failed:', err)
    } finally {
      setBusy(false)
    }
  }, [play, waitUntilReady])

  const handleStop = useCallback(() => stop(), [stop])

  return (
    <div>
      <latency-test ref={latencyTestRef} recording-mode="audioworklet" number-of-tests={1} hidden />

      {!connected && (
        <button onClick={handleConnect} disabled={busy}>
          Connect Audio
        </button>
      )}
      {connectError && <p style={{ color: 'red' }}>Could not connect: {connectError}</p>}

      {connected && (
        <div>
          <h2>1. Record (uncalibrated)</h2>
          <p>Record the metronome guide track through your mic, using the library's own internal estimate.</p>
          <button onClick={() => beginTake(false)} disabled={busy || !guideTrackBuffer}>
            Record (uncalibrated)
          </button>

          <h2>2. Play it back</h2>
          <button onClick={handlePlay} disabled={busy}>
            Play
          </button>
          <button onClick={handleStop} disabled={busy}>
            Stop
          </button>

          <h2>3. Measure latency</h2>
          <button
            onClick={() => {
              const el = latencyTestRef.current
              console.log('[wp-react-demo][wiring-debug] Run latency test clicked', {
                hasEl: !!el,
                elInputStreamSet: !!el?.inputStream,
                elAudioContextSet: !!el?.audioContext,
                streamFromHook: !!stream,
                streamFromHookActive: stream?.active,
              })
              el?.start()
            }}
            disabled={busy}
          >
            Run latency test
          </button>
          <p>
            {lastReliableLatencyMs != null
              ? `${lastReliableLatencyMs.toFixed(2)} ms`
              : 'No reliable measurement yet'}
          </p>

          <h2>4. Mute the uncalibrated take</h2>
          <p>
            Confirmed safe to mute here (unlike dawcore — see NOTES.md's #501 finding), so only the calibrated take
            is audible for the next comparison.
          </p>
          <button onClick={clearUncalibratedTakes} disabled={busy}>
            Mute uncalibrated take
          </button>

          <h2>5. Record (calibrated)</h2>
          <button onClick={() => beginTake(true)} disabled={busy || !guideTrackBuffer || lastReliableLatencyMs == null}>
            Record (calibrated)
          </button>

          <h2>6. Sample-domain alignment proof</h2>
          {alignmentResults.length === 0 && <p>No takes analyzed yet.</p>}
          {alignmentResults.map((entry) => (
            <p key={entry.label}>
              {entry.result.reliable
                ? `${entry.label}: ${entry.isCalibrated ? 'applied from <latency-test>' : 'library internal estimate'} ` +
                  `${entry.appliedOffsetSamples} samples (${((entry.appliedOffsetSamples / sampleRate) * 1000).toFixed(1)}ms) — ` +
                  `measured residual offset: ${entry.result.offsetSamples} samples (${entry.result.offsetMs.toFixed(1)}ms) ` +
                  `across ${entry.result.pairCount} clicks`
                : `${entry.label}: measurement unreliable (${entry.result.pairCount} matched clicks, MAD ${entry.result.madMs.toFixed(1)}ms) — not used as proof`}
            </p>
          ))}

          {recordingError && <p style={{ color: 'red' }}>{recordingError.message}</p>}
          {!hasPermission && <p>Waiting for microphone permission…</p>}
          {isRecording && <p>Recording… {duration.toFixed(1)}s</p>}

          <Waveform
            recordingState={
              isRecording && selectedTrackId
                ? {
                    isRecording: true,
                    trackId: selectedTrackId,
                    startSample: 0,
                    durationSamples: Math.floor(duration * sampleRate),
                    peaks: recordingPeaks,
                    bits: 16,
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}

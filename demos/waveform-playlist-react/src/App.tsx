import { useCallback, useRef, useState } from 'react'
import { WaveformPlaylistProvider } from '@waveform-playlist/browser'
import { createTrack, createClip, type ClipTrack, type AudioClip } from '@waveform-playlist/core'
import { computeAlignmentOffset, sliceBuffer, type AlignmentResult } from './alignment'
import { RecordingDemo } from './RecordingDemo'

export interface AlignmentEntry {
  label: string
  isCalibrated: boolean
  appliedOffsetSamples: number
  result: AlignmentResult
}

export interface PendingTake {
  label: string
  isCalibrated: boolean
  // null for the uncalibrated take — the library's own internal
  // outputLatency+lookAhead estimate is left untouched in that case.
  externalOffsetSamples: number | null
}

const DEFAULT_SAMPLE_RATE = 48000

export default function App() {
  const [tracks, setTracksState] = useState<ClipTrack[]>([])
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [guideTrackBuffer, setGuideTrackBuffer] = useState<AudioBuffer | null>(null)
  const [sampleRate, setSampleRate] = useState(DEFAULT_SAMPLE_RATE)
  const [alignmentResults, setAlignmentResults] = useState<AlignmentEntry[]>([])

  // Set by RecordingDemo right before each take; read by the setTracks
  // wrapper below when the resulting clip arrives. A ref (not state) because
  // it must be visible synchronously inside the wrapper without waiting for
  // a re-render.
  const pendingTakeRef = useRef<PendingTake | null>(null)
  const selectedTrackIdRef = useRef<string | null>(null)
  selectedTrackIdRef.current = selectedTrackId
  const guideTrackBufferRef = useRef<AudioBuffer | null>(null)
  guideTrackBufferRef.current = guideTrackBuffer

  // The setTracks wrapper: the confirmed interception point for the external
  // latency override (see NOTES.md "Compensation insertion point"). Passed
  // both to useIntegratedRecording (in RecordingDemo) and to
  // WaveformPlaylistProvider's onTracksChange — both must see the same
  // wrapped function so every tracks-array commit goes through this check.
  const setTracks = useCallback((newTracks: ClipTrack[]) => {
    const pending = pendingTakeRef.current
    const trackId = selectedTrackIdRef.current

    if (!pending || !trackId) {
      setTracksState(newTracks)
      return
    }

    const trackIndex = newTracks.findIndex((t) => t.id === trackId)
    const track = trackIndex >= 0 ? newTracks[trackIndex] : null
    const clip = track && track.clips.length > 0 ? track.clips[track.clips.length - 1] : null

    console.log('[wp-react-demo][calibration-debug] setTracks invoked', {
      label: pending.label,
      isCalibrated: pending.isCalibrated,
      externalOffsetSamples: pending.externalOffsetSamples,
      trackId,
      trackIndex,
      foundClip: !!clip,
      hasAudioBuffer: !!clip?.audioBuffer,
      clipOffsetSamplesBefore: clip?.offsetSamples,
      clipDurationSamplesBefore: clip?.durationSamples,
      clipSourceDurationSamples: clip?.sourceDurationSamples,
    })

    if (!clip || !clip.audioBuffer) {
      // Not the take we were waiting for — pass through unmodified.
      setTracksState(newTracks)
      return
    }

    let finalTracks = newTracks
    let appliedOffsetSamples = clip.offsetSamples

    if (pending.isCalibrated && pending.externalOffsetSamples != null) {
      const externalOffsetSamples = Math.min(
        Math.max(pending.externalOffsetSamples, 0),
        clip.sourceDurationSamples - 1
      )
      const durationSamples = clip.sourceDurationSamples - externalOffsetSamples
      if (durationSamples > 0) {
        appliedOffsetSamples = externalOffsetSamples
        const adjustedClip: AudioClip = {
          ...clip,
          offsetSamples: externalOffsetSamples,
          durationSamples,
        }
        const adjustedClips = [...track!.clips.slice(0, -1), adjustedClip]
        finalTracks = newTracks.map((t, i) => (i === trackIndex ? { ...t, clips: adjustedClips } : t))
        console.log('[wp-react-demo][calibration-debug] applied external offset', {
          externalOffsetSamples,
          durationSamples,
        })
      } else {
        console.warn(
          '[wp-react-demo] Measured latency exceeds buffer length — keeping internal estimate for this take'
        )
      }
    }

    setTracksState(finalTracks)

    const guideBuffer = guideTrackBufferRef.current
    if (guideBuffer) {
      const finalClip = finalTracks[trackIndex].clips[finalTracks[trackIndex].clips.length - 1]
      const recordedSlice = sliceBuffer(finalClip.audioBuffer!, appliedOffsetSamples, finalClip.durationSamples)
      try {
        const result = computeAlignmentOffset(guideBuffer, recordedSlice)
        console.log(`[alignment-debug] ${pending.label}`, result)
        setAlignmentResults((prev) => [
          ...prev,
          { label: pending.label, isCalibrated: pending.isCalibrated, appliedOffsetSamples, result },
        ])
      } catch (err) {
        console.warn('[wp-react-demo] Alignment computation failed:', err)
      }
    }

    pendingTakeRef.current = null
  }, [])

  const handleGuideTrackReady = useCallback((buffer: AudioBuffer, name: string) => {
    setGuideTrackBuffer(buffer)
    setSampleRate(buffer.sampleRate)
    const guideTrack = createTrack({
      name,
      clips: [createClip({ audioBuffer: buffer, startSample: 0, name })],
    })
    setTracksState([guideTrack])
  }, [])

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      onTracksChange={setTracks}
      sampleRate={sampleRate}
      samplesPerPixel={1024}
      zoomLevels={[256, 512, 1024, 2048, 4096]}
      waveHeight={100}
      timescale
      barWidth={1}
      barGap={0}
      controls={{ show: true, width: 160 }}
    >
      <RecordingDemo
        tracks={tracks}
        setTracks={setTracks}
        selectedTrackId={selectedTrackId}
        setSelectedTrackId={setSelectedTrackId}
        pendingTakeRef={pendingTakeRef}
        guideTrackBuffer={guideTrackBuffer}
        onGuideTrackReady={handleGuideTrackReady}
        alignmentResults={alignmentResults}
      />
    </WaveformPlaylistProvider>
  )
}

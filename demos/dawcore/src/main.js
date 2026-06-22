import '@adasp/latency-test'
import '@dawcore/components'
import { NativePlayoutAdapter } from '@dawcore/transport'
import { computeAlignmentOffset, sliceBuffer } from './alignment.js'

const RECORD_MARGIN_MS = 1500
const POST_STOP_SETTLE_MS = 1000
const PLAY_SAFETY_MARGIN_MS = 200

const MIC_CONSTRAINTS = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
}

const lt = document.getElementById('lt')
const editor = document.getElementById('editor')
const connectBtn = document.getElementById('connect-btn')
const setupUi = document.getElementById('setup-ui')
const runTestBtn = document.getElementById('run-test-btn')
const latencyResultEl = document.getElementById('latency-result')
const recordUncalibratedBtn = document.getElementById('record-uncalibrated-btn')
const recordCalibratedBtn = document.getElementById('record-calibrated-btn')
const playBtn = document.getElementById('play-btn')
const stopBtn = document.getElementById('stop-btn')
const alignmentProofEl = document.getElementById('alignment-proof')

let audioCtx = null
let micStream = null
let adapter = null
let guideTrackBuffer = null
let recordDurationMs = 0
let lastReliableLatencyMs = null
let uncalibratedTakeCount = 0
let calibratedTakeCount = 0

let pendingTakeLabel = null
let pendingLatencyMs = null
let pendingTrackId = null
let pendingTrackEl = null
let pendingIsCalibrated = false
let activeStopResolve = null

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const lockableButtons = [recordUncalibratedBtn, recordCalibratedBtn, runTestBtn, playBtn]

function unlockButtons() {
  lockableButtons.forEach((b) => (b.disabled = false))
  if (lastReliableLatencyMs === null) recordCalibratedBtn.disabled = true
}

function reportAlignment(label, result, { isCalibrated, appliedOffsetSamples }) {
  const sampleRate = audioCtx.sampleRate
  const line = document.createElement('p')

  if (!result.reliable) {
    line.textContent =
      `${label}: measurement unreliable (${result.pairCount} matched clicks, ` +
      `MAD ${result.madMs.toFixed(1)}ms) — not used as proof`
    alignmentProofEl.appendChild(line)
    return
  }

  const appliedMs = (appliedOffsetSamples / sampleRate) * 1000
  const source = isCalibrated ? 'applied from <latency-test>' : 'dawcore applied internally'
  line.textContent =
    `${label}: ${source} ${appliedOffsetSamples} samples (${appliedMs.toFixed(1)}ms) — ` +
    `measured residual offset: ${result.offsetSamples} samples (${result.offsetMs.toFixed(1)}ms) ` +
    `across ${result.pairCount} clicks`
  alignmentProofEl.appendChild(line)
}

async function recordTake(label, trackEl, latencyMs, isCalibrated) {
  const trackId = trackEl.trackId
  pendingTakeLabel = label
  pendingLatencyMs = latencyMs
  pendingTrackId = trackId
  pendingTrackEl = trackEl
  pendingIsCalibrated = isCalibrated

  try {
    editor.seekTo(0) // rewind so overdub playback starts from the guide track's beginning
    const manualStop = new Promise((resolve) => {
      activeStopResolve = resolve
    })
    await editor.startRecording(micStream, { trackId, channelCount: 1, overdub: true })
    if (!editor.isRecording) {
      throw new Error('Recording failed to start (see daw-recording-error)')
    }

    await Promise.race([delay(recordDurationMs), manualStop])
    await editor.stopRecording() // wasOverdub:true means this also auto-stops playback
    await delay(POST_STOP_SETTLE_MS)
  } finally {
    activeStopResolve = null
    pendingTakeLabel = null
    pendingLatencyMs = null
    pendingTrackId = null
    pendingTrackEl = null
    pendingIsCalibrated = false
  }
}

async function recordNewTake(isCalibrated) {
  lockableButtons.forEach((b) => (b.disabled = true))
  try {
    const count = isCalibrated ? ++calibratedTakeCount : ++uncalibratedTakeCount
    const label = `${isCalibrated ? 'Calibrated' : 'Uncalibrated'} take ${count}`
    const trackEl = await editor.addTrack({ name: label })
    await recordTake(label, trackEl, isCalibrated ? lastReliableLatencyMs : null, isCalibrated)
  } finally {
    unlockButtons()
  }
}

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true
  try {
    audioCtx = new AudioContext({ sampleRate: 48000, latencyHint: 0 })
    micStream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)

    adapter = new NativePlayoutAdapter(audioCtx)
    editor.adapter = adapter

    lt.audioContext = audioCtx
    lt.inputStream = micStream
    editor.recordingStream = micStream

    const guideUrl = `${import.meta.env.BASE_URL}metronome.mp3`
    const guideArrayBuffer = await fetch(guideUrl).then((r) => r.arrayBuffer())
    guideTrackBuffer = await audioCtx.decodeAudioData(guideArrayBuffer)
    recordDurationMs = guideTrackBuffer.duration * 1000 + RECORD_MARGIN_MS

    await editor.addTrack({ name: 'Metronome', clips: [{ src: guideUrl, name: 'Metronome' }] })

    connectBtn.hidden = true
    setupUi.hidden = false
  } catch (e) {
    micStream?.getTracks().forEach((t) => t.stop())
    micStream = null
    audioCtx?.close()
    audioCtx = null
    lt.inputStream = undefined
    lt.audioContext = undefined
    connectBtn.disabled = false
    latencyResultEl.textContent = `Could not connect: ${e.message}`
  }
})

runTestBtn.addEventListener('click', () => lt.start())

lt.addEventListener('latency-start', () => {
  // Lock recording/playback so the MLS test and dawcore's own recording/playback
  // never contend for the same mic stream / audio graph.
  lockableButtons.forEach((b) => (b.disabled = true))
})

lt.addEventListener('latency-result', (e) => {
  const { latency, ratio, reliable } = e.detail
  latencyResultEl.textContent = `${latency.toFixed(2)} ms — ratio: ${ratio.toFixed(2)} dB${reliable ? '' : ' ⚠️ unreliable'}`
  lastReliableLatencyMs = reliable ? latency : null
})

lt.addEventListener('latency-complete', () => unlockButtons())

lt.addEventListener('latency-error', (e) => {
  latencyResultEl.textContent = `Error: ${e.detail.message}`
  lastReliableLatencyMs = null
  unlockButtons()
})

editor.addEventListener('daw-recording-complete', (e) => {
  const { trackId, audioBuffer, startSample, offsetSamples: internalOffsetSamples } = e.detail

  if (trackId !== pendingTrackId) {
    console.warn('[dawcore-demo] daw-recording-complete for unexpected track — ignoring', trackId)
    return
  }
  if (!pendingTrackEl.isConnected) {
    e.preventDefault()
    console.warn('[dawcore-demo] Recording track was deleted before completion — skipping clip', trackId)
    return
  }

  const isCalibrated = pendingIsCalibrated
  let appliedOffsetSamples
  if (isCalibrated) {
    e.preventDefault()
    if (!Number.isFinite(pendingLatencyMs)) {
      console.warn('[dawcore-demo] Calibrated take with no valid latency value — skipping clip')
      return
    }
    const rawOffset = Math.round((pendingLatencyMs / 1000) * audioBuffer.sampleRate)
    appliedOffsetSamples = Math.min(Math.max(rawOffset, 0), audioBuffer.length - 1)
    const durationSamples = audioBuffer.length - appliedOffsetSamples
    if (durationSamples <= 0) {
      console.warn('[dawcore-demo] Measured latency exceeds buffer length — skipping clip')
      return
    }
    editor._addRecordedClip(trackId, audioBuffer, startSample, durationSamples, appliedOffsetSamples)
  } else {
    // Uncalibrated: do NOT preventDefault — let dawcore's own internal
    // outputLatency-based compensation create the clip as it normally would.
    appliedOffsetSamples = internalOffsetSamples
  }

  const durationSamples = audioBuffer.length - appliedOffsetSamples
  const recordedSlice = sliceBuffer(audioBuffer, appliedOffsetSamples, durationSamples)
  const offsetResult = computeAlignmentOffset(guideTrackBuffer, recordedSlice)
  console.log(`[alignment-debug] ${pendingTakeLabel}\n` + JSON.stringify(offsetResult, null, 2))
  reportAlignment(pendingTakeLabel, offsetResult, { isCalibrated, appliedOffsetSamples })
})

editor.addEventListener('daw-recording-error', (e) => {
  console.warn('[dawcore-demo] daw-recording-error', e.detail)
})

recordUncalibratedBtn.addEventListener('click', () => recordNewTake(false))

recordCalibratedBtn.addEventListener('click', () => recordNewTake(true))

playBtn.addEventListener('click', async () => {
  lockableButtons.forEach((b) => (b.disabled = true))
  try {
    const manualStop = new Promise((resolve) => {
      activeStopResolve = resolve
    })
    await editor.play(0)
    await Promise.race([delay(guideTrackBuffer.duration * 1000 + PLAY_SAFETY_MARGIN_MS), manualStop])
  } finally {
    editor.stop()
    activeStopResolve = null
    unlockButtons()
  }
})
stopBtn.addEventListener('click', () => {
  editor.stop()
  activeStopResolve?.()
})

window.addEventListener('beforeunload', () => {
  micStream?.getTracks().forEach((t) => t.stop())
  audioCtx?.close()
})

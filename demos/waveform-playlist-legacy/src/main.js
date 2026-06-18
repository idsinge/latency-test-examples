import '@adasp/latency-test'
import { init as initPlaylist } from 'waveform-playlist'
import 'waveform-playlist/styles/playlist.css'

const RECORD_MARGIN_MS = 1500
const POST_STOP_SETTLE_MS = 1000

const MIC_CONSTRAINTS = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
}

const lt = document.getElementById('lt')
const connectBtn = document.getElementById('connect-btn')
const setupUi = document.getElementById('setup-ui')
const runTestBtn = document.getElementById('run-test-btn')
const latencyResultEl = document.getElementById('latency-result')
const recordUncalibratedBtn = document.getElementById('record-uncalibrated-btn')
const recordCalibratedBtn = document.getElementById('record-calibrated-btn')
const playBtn = document.getElementById('play-btn')
const stopBtn = document.getElementById('stop-btn')
const playlistContainer = document.getElementById('playlist')

let audioCtx = null
let micStream = null
let playlist = null
let ee = null
let recordDurationMs = 0
let lastReliableLatencyMs = null

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const lockableButtons = [recordUncalibratedBtn, recordCalibratedBtn, runTestBtn, playBtn]

let stopRecordingResolve = null

async function recordTake(label, latencySeconds) {
  lockableButtons.forEach((b) => (b.disabled = true))

  try {
    await playlist.rewind()
    playlist.initRecorder(micStream, undefined, label)
    ee.emit('record', latencySeconds)

    const manualStop = new Promise((resolve) => {
      stopRecordingResolve = resolve
    })
    await Promise.race([delay(recordDurationMs), manualStop])
    ee.emit('stop')
    await delay(POST_STOP_SETTLE_MS)
  } finally {
    stopRecordingResolve = null
    lockableButtons.forEach((b) => (b.disabled = false))
    if (lastReliableLatencyMs === null) recordCalibratedBtn.disabled = true
  }
}

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true
  try {
    audioCtx = new AudioContext({ latencyHint: 0 })
    micStream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
    lt.inputStream = micStream
    lt.audioContext = audioCtx

    playlist = initPlaylist({
      container: playlistContainer,
      ac: audioCtx,
      samplesPerPixel: 1024,
      zoomLevels: [512, 1024, 2048],
      controls: { show: true },
    })
    ee = playlist.getEventEmitter()

    await playlist.load([{ src: `${import.meta.env.BASE_URL}metronome.mp3`, name: 'Metronome' }])

    recordDurationMs = playlist.tracks[0].buffer.duration * 1000 + RECORD_MARGIN_MS

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

recordUncalibratedBtn.addEventListener('click', () => recordTake('Uncalibrated', 0))

recordCalibratedBtn.addEventListener('click', () => recordTake('Calibrated', lastReliableLatencyMs / 1000))

playBtn.addEventListener('click', () => ee.emit('play'))
stopBtn.addEventListener('click', () => {
  ee.emit('stop')
  stopRecordingResolve?.()
})

lt.addEventListener('latency-result', (e) => {
  const { latency, ratio, reliable } = e.detail
  latencyResultEl.textContent = `${latency.toFixed(2)} ms — ratio: ${ratio.toFixed(2)} dB${reliable ? '' : ' ⚠️ unreliable'}`
  if (reliable) {
    lastReliableLatencyMs = latency
    recordCalibratedBtn.disabled = false
  } else {
    lastReliableLatencyMs = null
    recordCalibratedBtn.disabled = true
  }
})

lt.addEventListener('latency-error', (e) => {
  latencyResultEl.textContent = `Error: ${e.detail.message}`
  lastReliableLatencyMs = null
  recordCalibratedBtn.disabled = true
})

window.addEventListener('beforeunload', () => {
  micStream?.getTracks().forEach((t) => t.stop())
  audioCtx?.close()
})

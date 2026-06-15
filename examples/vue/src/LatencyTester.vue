<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const MIC_CONSTRAINTS = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
}

const ltRef = ref(null)
const micStream = ref(null)
const audioCtx = ref(null)
const isConnected = ref(false)
const result = ref(null)
const stats = ref(null)
const error = ref(null)

async function connect() {
  try {
    audioCtx.value = new AudioContext({ latencyHint: 0 })
    micStream.value = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
    ltRef.value.inputStream = micStream.value
    ltRef.value.audioContext = audioCtx.value
    isConnected.value = true
  } catch (e) {
    micStream.value?.getTracks().forEach(t => t.stop())
    micStream.value = null
    error.value = `Could not access mic: ${e.message}`
  }
}

function onResult(e) { result.value = e.detail }
function onComplete(e) { stats.value = e.detail }
function onError(e) { error.value = e.detail.message }

onMounted(() => {
  ltRef.value.addEventListener('latency-result', onResult)
  ltRef.value.addEventListener('latency-complete', onComplete)
  ltRef.value.addEventListener('latency-error', onError)
})

onBeforeUnmount(() => {
  ltRef.value.removeEventListener('latency-result', onResult)
  ltRef.value.removeEventListener('latency-complete', onComplete)
  ltRef.value.removeEventListener('latency-error', onError)
  micStream.value?.getTracks().forEach(t => t.stop())
  audioCtx.value?.close()
})
</script>

<template>
  <div>
    <latency-test ref="ltRef" number-of-tests="5" />
    <button v-if="!isConnected" @click="connect">Connect Audio</button>
    <button v-else @click="ltRef.start()">Test Latency</button>
    <p v-if="result">
      {{ result.latency.toFixed(2) }} ms — ratio: {{ result.ratio.toFixed(2) }} dB
      <span v-if="!result.reliable"> ⚠️ unreliable</span>
    </p>
    <p v-if="stats && stats.results?.length > 1">
      Mean: {{ stats.mean.toFixed(2) }} ms | SD: {{ stats.std.toFixed(2) }} |
      Min: {{ stats.min.toFixed(2) }} | Max: {{ stats.max.toFixed(2) }}
    </p>
    <p v-if="error" style="color: red">{{ error }}</p>
  </div>
</template>

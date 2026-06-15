<script>
  import '@adasp/latency-test'
  import { onMount, onDestroy } from 'svelte'

  const MIC_CONSTRAINTS = {
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
  }

  let lt
  let micStream = null
  let audioCtx = null
  let isConnected = false
  let result = null
  let stats = null
  let error = null

  async function connect() {
    try {
      audioCtx = new AudioContext({ latencyHint: 0 })
      micStream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
      lt.inputStream = micStream
      lt.audioContext = audioCtx
      isConnected = true
    } catch (e) {
      micStream?.getTracks().forEach(t => t.stop())
      micStream = null
      error = `Could not access mic: ${e.message}`
    }
  }

  function onResult(e) { result = e.detail }
  function onComplete(e) { stats = e.detail }
  function onError(e) { error = e.detail.message }

  onMount(() => {
    lt.addEventListener('latency-result', onResult)
    lt.addEventListener('latency-complete', onComplete)
    lt.addEventListener('latency-error', onError)
  })

  onDestroy(() => {
    lt.removeEventListener('latency-result', onResult)
    lt.removeEventListener('latency-complete', onComplete)
    lt.removeEventListener('latency-error', onError)
    micStream?.getTracks().forEach(t => t.stop())
    audioCtx?.close()
  })
</script>

<latency-test bind:this={lt} number-of-tests="5" />

{#if !isConnected}
  <button on:click={connect}>Connect Audio</button>
{:else}
  <button on:click={() => lt.start()}>Test Latency</button>
{/if}

{#if result}
  <p>{result.latency.toFixed(2)} ms — ratio: {result.ratio.toFixed(2)} dB{result.reliable ? '' : ' ⚠️ unreliable'}</p>
{/if}

{#if stats && stats.results?.length > 1}
  <p>
    Mean: {stats.mean.toFixed(2)} ms | SD: {stats.std.toFixed(2)} |
    Min: {stats.min.toFixed(2)} | Max: {stats.max.toFixed(2)}
  </p>
{/if}

{#if error}
  <p style="color: red">{error}</p>
{/if}

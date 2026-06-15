<!-- === VERIFICATION HARNESS — not part of docs example === -->
<script>
  import { onMount, onDestroy } from 'svelte'

  const EVENTS = ['latency-start', 'latency-recording', 'latency-processing', 'latency-result', 'latency-complete', 'latency-error']

  let negDisabled = $state(false)
  const sequence = []
  const handlers = {}
  let el = null

  onMount(() => {
    el = document.querySelector('latency-test')
    if (!el) return

    // Upgrade check — fire-and-forget, separate from synchronous listener setup
    customElements.whenDefined('latency-test').then(() => {
      console.log('[verify] upgrade check — customElements.get("latency-test"):', customElements.get('latency-test'))
      console.log('[verify] el.start callable:', typeof el.start === 'function')
    })

    // Event-order logger and sequence verifier — attached synchronously
    EVENTS.forEach(name => {
      handlers[name] = (e) => {
        if (name === 'latency-start') sequence.length = 0
        sequence.push(name)
        console.log(`[verify] event: ${name}`, e.detail ?? '')

        if (name === 'latency-result') {
          const { ratio, reliable } = e.detail
          console.log(`[verify] ratio: ${ratio.toFixed(2)} dB, reliable: ${reliable}`)
        }

        if (name === 'latency-complete') {
          const seq = [...sequence]
          const hasError = seq.includes('latency-error')
          const startsOk = seq[0] === 'latency-start'
          const endsOk = seq[seq.length - 1] === 'latency-complete'
          const middle = seq.slice(1, -1)
          let patternOk = middle.length > 0 && middle.length % 3 === 0
          for (let i = 0; i < middle.length; i += 3) {
            if (middle[i] !== 'latency-recording' || middle[i + 1] !== 'latency-processing' || middle[i + 2] !== 'latency-result') {
              patternOk = false
              break
            }
          }
          if (startsOk && endsOk && patternOk && !hasError) {
            console.log('[verify] success-path sequence ✓', seq)
          } else {
            console.warn('[verify] sequence check FAILED', { startsOk, endsOk, patternOk, hasError, seq })
          }
        }
      }
      el.addEventListener(name, handlers[name])
    })
  })

  onDestroy(() => {
    if (!el) return
    EVENTS.forEach(name => el.removeEventListener(name, handlers[name]))
  })

  function runNegativeTest() {
    negDisabled = true
    const throwaway = document.createElement('latency-test')
    document.body.appendChild(throwaway)

    const timeout = setTimeout(() => {
      console.error('[verify] negative-path FAILED — latency-error did not fire within 5s')
      negDisabled = false
      throwaway.remove()
    }, 5000)

    throwaway.addEventListener('latency-error', (e) => {
      clearTimeout(timeout)
      const msgOk = e.detail.message.includes('inputStream is required')
      if (msgOk) {
        console.log('[verify] negative-path latency-error fired ✓', e.detail.message)
      } else {
        console.warn('[verify] negative-path: wrong message:', e.detail.message)
      }
      negDisabled = false
      throwaway.remove()
    })

    throwaway.start()
  }
</script>

<button disabled={negDisabled} onclick={runNegativeTest} style="margin-top: 1rem; display: block">
  Negative-path test (expect latency-error in console)
</button>

// === VERIFICATION HARNESS — not part of docs example ===

const EVENTS = ['latency-start', 'latency-recording', 'latency-processing', 'latency-result', 'latency-complete', 'latency-error']

// 1. Upgrade check — confirms element registered and exposes start()
await customElements.whenDefined('latency-test')
console.log('[verify] upgrade check — customElements.get("latency-test"):', customElements.get('latency-test'))
console.log('[verify] lt.start callable:', typeof document.getElementById('lt').start === 'function')

// 2. Event-order logger and sequence verifier on the docs element
const lt = document.getElementById('lt')
let eventSequence = []

EVENTS.forEach(name => {
  lt.addEventListener(name, (e) => {
    if (name === 'latency-start') eventSequence = []
    eventSequence.push(name)
    console.log(`[verify] event: ${name}`, e.detail ?? '')

    if (name === 'latency-result') {
      const { ratio, reliable } = e.detail
      console.log(`[verify] ratio: ${ratio.toFixed(2)} dB, reliable: ${reliable}`)
    }

    if (name === 'latency-complete') {
      const seq = eventSequence
      const hasError = seq.includes('latency-error')
      const startsOk = seq[0] === 'latency-start'
      const endsOk = seq.at(-1) === 'latency-complete'
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
  })
})

// 3. Negative-path: start() with no inputStream / audioContext
const negBtn = document.createElement('button')
negBtn.textContent = 'Negative-path test (expect latency-error in console)'
negBtn.style.cssText = 'margin-top:1rem;display:block'
document.body.appendChild(negBtn)

negBtn.addEventListener('click', () => {
  negBtn.disabled = true
  const throwaway = document.createElement('latency-test')
  document.body.appendChild(throwaway)

  const timeout = setTimeout(() => {
    console.error('[verify] negative-path FAILED — latency-error did not fire within 5s')
    negBtn.disabled = false
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
    negBtn.disabled = false
    throwaway.remove()
  })

  throwaway.start()
})

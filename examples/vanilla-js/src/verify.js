// === VERIFICATION HARNESS — not part of docs example ===

const EVENTS = ['latency-start', 'latency-recording', 'latency-processing', 'latency-result', 'latency-complete', 'latency-error']
const SUCCESS_SEQUENCE = ['latency-start', 'latency-recording', 'latency-processing', 'latency-result', 'latency-complete']

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

    if (name === 'latency-complete') {
      const seen = new Set(eventSequence)
      const missing = SUCCESS_SEQUENCE.filter(n => !seen.has(n))
      const hasError = seen.has('latency-error')
      if (missing.length === 0 && !hasError) {
        console.log('[verify] success-path sequence ✓', eventSequence)
      } else {
        console.warn('[verify] sequence check FAILED — missing:', missing, '| unexpected latency-error:', hasError)
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
    console.log('[verify] negative-path latency-error fired ✓', e.detail.message)
    negBtn.disabled = false
    throwaway.remove()
  })

  throwaway.start()
})

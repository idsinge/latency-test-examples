// === VERIFICATION HARNESS — not part of docs example ===

import { useEffect, useRef, useState } from 'react'

const EVENTS = ['latency-start', 'latency-recording', 'latency-processing', 'latency-result', 'latency-complete', 'latency-error']

export function Verify() {
  const sequenceRef = useRef([])
  const [negDisabled, setNegDisabled] = useState(false)

  useEffect(() => {
    const el = document.querySelector('latency-test')
    if (!el) return

    // Upgrade check — fire-and-forget, separate from synchronous listener setup
    customElements.whenDefined('latency-test').then(() => {
      console.log('[verify] upgrade check — customElements.get("latency-test"):', customElements.get('latency-test'))
      console.log('[verify] el.start callable:', typeof el.start === 'function')
    })

    // Event-order logger and sequence verifier — attached synchronously
    const handlers = {}
    EVENTS.forEach(name => {
      handlers[name] = (e) => {
        if (name === 'latency-start') sequenceRef.current = []
        sequenceRef.current.push(name)
        console.log(`[verify] event: ${name}`, e.detail ?? '')

        if (name === 'latency-result') {
          const { ratio, reliable } = e.detail
          console.log(`[verify] ratio: ${ratio.toFixed(2)} dB, reliable: ${reliable}`)
        }

        if (name === 'latency-complete') {
          const seq = sequenceRef.current
          const hasError = seq.includes('latency-error')
          const startsOk = seq[0] === 'latency-start'
          const endsOk = seq[seq.length - 1] === 'latency-complete'
          // Middle should be exact cycles of recording → processing → result
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

    return () => {
      EVENTS.forEach(name => el.removeEventListener(name, handlers[name]))
    }
  }, [])

  function runNegativeTest() {
    setNegDisabled(true)
    const throwaway = document.createElement('latency-test')
    document.body.appendChild(throwaway)

    const timeout = setTimeout(() => {
      console.error('[verify] negative-path FAILED — latency-error did not fire within 5s')
      setNegDisabled(false)
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
      setNegDisabled(false)
      throwaway.remove()
    })

    throwaway.start()
  }

  return (
    <button disabled={negDisabled} onClick={runNegativeTest} style={{ marginTop: '1rem', display: 'block' }}>
      Negative-path test (expect latency-error in console)
    </button>
  )
}

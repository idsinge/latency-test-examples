// === VERIFICATION HARNESS — not part of docs example ===
'use client'

import { useEffect, useRef } from 'react'

const EVENTS = ['latency-start', 'latency-recording', 'latency-processing', 'latency-result', 'latency-complete', 'latency-error']

export function Verify() {
  const sequenceRef = useRef<string[]>([])

  useEffect(() => {
    const el = document.querySelector('latency-test') as HTMLElement | null
    if (!el) return

    customElements.whenDefined('latency-test').then(() => {
      console.log('[verify] upgrade check — customElements.get("latency-test"):', customElements.get('latency-test'))
      console.log('[verify] el.start callable:', typeof (el as any).start === 'function')
    })

    const handlers: Record<string, (e: Event) => void> = {}

    EVENTS.forEach(name => {
      handlers[name] = (e: Event) => {
        if (name === 'latency-start') sequenceRef.current = []
        sequenceRef.current.push(name)
        console.log(`[verify] event: ${name}`, (e as CustomEvent).detail ?? '')

        if (name === 'latency-result') {
          const { ratio, reliable } = (e as CustomEvent).detail
          console.log(`[verify] ratio: ${ratio.toFixed(2)} dB, reliable: ${reliable}`)
        }

        if (name === 'latency-complete') {
          const seq = [...sequenceRef.current]
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

    return () => {
      EVENTS.forEach(name => el.removeEventListener(name, handlers[name]))
    }
  }, [])

  function runNegativeTest() {
    const throwaway = document.createElement('latency-test') as any
    document.body.appendChild(throwaway)

    const timeout = setTimeout(() => {
      console.error('[verify] negative-path FAILED — latency-error did not fire within 5s')
      throwaway.remove()
    }, 5000)

    throwaway.addEventListener('latency-error', (e: Event) => {
      clearTimeout(timeout)
      const msg = (e as CustomEvent).detail.message
      const msgOk = msg.includes('inputStream is required')
      if (msgOk) {
        console.log('[verify] negative-path latency-error fired ✓', msg)
      } else {
        console.warn('[verify] negative-path: wrong message:', msg)
      }
      throwaway.remove()
    })

    throwaway.start()
  }

  return (
    <button onClick={runNegativeTest} style={{ marginTop: '1rem', display: 'block' }}>
      Negative-path test (expect latency-error in console)
    </button>
  )
}

// === VERIFICATION HARNESS — not part of docs example ===
import { Component, AfterViewInit, OnDestroy } from '@angular/core'

const EVENTS = ['latency-start', 'latency-recording', 'latency-processing', 'latency-result', 'latency-complete', 'latency-error']

@Component({
  selector: 'app-verify',
  standalone: true,
  template: `
    <button [disabled]="negDisabled" (click)="runNegativeTest()" style="margin-top:1rem;display:block">
      Negative-path test (expect latency-error in console)
    </button>
  `
})
export class VerifyComponent implements AfterViewInit, OnDestroy {
  negDisabled = false

  private sequence: string[] = []
  private handlers: Record<string, (e: Event) => void> = {}
  private el: HTMLElement | null = null

  ngAfterViewInit() {
    this.el = document.querySelector('latency-test')
    if (!this.el) return

    // Upgrade check — fire-and-forget, separate from synchronous listener setup
    customElements.whenDefined('latency-test').then(() => {
      console.log('[verify] upgrade check — customElements.get("latency-test"):', customElements.get('latency-test'))
      console.log('[verify] el.start callable:', typeof (this.el as any).start === 'function')
    })

    // Event-order logger and sequence verifier — attached synchronously
    EVENTS.forEach(name => {
      this.handlers[name] = (e: Event) => {
        if (name === 'latency-start') this.sequence = []
        this.sequence.push(name)
        console.log(`[verify] event: ${name}`, (e as CustomEvent).detail ?? '')

        if (name === 'latency-result') {
          const { ratio, reliable } = (e as CustomEvent).detail
          console.log(`[verify] ratio: ${ratio.toFixed(2)} dB, reliable: ${reliable}`)
        }

        if (name === 'latency-complete') {
          const seq = [...this.sequence]
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
      this.el!.addEventListener(name, this.handlers[name])
    })
  }

  ngOnDestroy() {
    if (!this.el) return
    EVENTS.forEach(name => this.el!.removeEventListener(name, this.handlers[name]))
  }

  runNegativeTest() {
    this.negDisabled = true
    const throwaway = document.createElement('latency-test')
    document.body.appendChild(throwaway)

    const timeout = setTimeout(() => {
      console.error('[verify] negative-path FAILED — latency-error did not fire within 5s')
      this.negDisabled = false
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
      this.negDisabled = false
      throwaway.remove()
    })

    ;(throwaway as any).start()
  }
}

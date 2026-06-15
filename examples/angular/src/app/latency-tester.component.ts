import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  CUSTOM_ELEMENTS_SCHEMA,
  Input
} from '@angular/core'
import { NgIf, DecimalPipe } from '@angular/common'

const MIC_CONSTRAINTS = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
}

@Component({
  selector: 'app-latency-tester',
  standalone: true,
  imports: [NgIf, DecimalPipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <latency-test #lt [attr.number-of-tests]="numberOfTests"></latency-test>
    <button *ngIf="!isConnected" (click)="connect()">Connect Audio</button>
    <button *ngIf="isConnected" (click)="start()">Test Latency</button>
    <p *ngIf="result">{{ result.latency.toFixed(2) }} ms — ratio: {{ result.ratio | number:'1.2-2' }} dB</p>
    <p *ngIf="stats && stats.results?.length > 1">
      Mean: {{ stats.mean | number:'1.2-2' }} ms | SD: {{ stats.std | number:'1.2-2' }} |
      Min: {{ stats.min | number:'1.2-2' }} | Max: {{ stats.max | number:'1.2-2' }}
    </p>
    <p *ngIf="error" style="color:red">{{ error }}</p>
  `
})
export class LatencyTesterComponent implements AfterViewInit, OnDestroy {
  @Input() numberOfTests = 5
  @ViewChild('lt') ltRef!: ElementRef<HTMLElement>

  isConnected = false
  result: any = null
  stats: any = null
  error: string | null = null

  private micStream: MediaStream | null = null
  private audioCtx: AudioContext | null = null

  private onResult = (e: Event) => { this.result = (e as CustomEvent).detail }
  private onComplete = (e: Event) => { this.stats = (e as CustomEvent).detail }
  private onError = (e: Event) => { this.error = (e as CustomEvent).detail.message }

  ngAfterViewInit() {
    const el = this.ltRef.nativeElement
    el.addEventListener('latency-result', this.onResult)
    el.addEventListener('latency-complete', this.onComplete)
    el.addEventListener('latency-error', this.onError)
  }

  ngOnDestroy() {
    const el = this.ltRef.nativeElement
    el.removeEventListener('latency-result', this.onResult)
    el.removeEventListener('latency-complete', this.onComplete)
    el.removeEventListener('latency-error', this.onError)
    this.micStream?.getTracks().forEach(t => t.stop())
    this.audioCtx?.close()
  }

  async connect() {
    try {
      this.audioCtx = new AudioContext({ latencyHint: 0 })
      this.micStream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
      ;(this.ltRef.nativeElement as any).inputStream = this.micStream
      ;(this.ltRef.nativeElement as any).audioContext = this.audioCtx
      this.isConnected = true
    } catch (e: any) {
      this.micStream?.getTracks().forEach(t => t.stop())
      this.micStream = null
      this.error = `Could not access mic: ${e.message}`
    }
  }

  start() { (this.ltRef.nativeElement as any).start() }
  stop() { (this.ltRef.nativeElement as any).stop() }
}

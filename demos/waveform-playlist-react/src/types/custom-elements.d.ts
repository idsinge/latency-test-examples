import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'latency-test': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'number-of-tests'?: number
        'mls-bits'?: number
        'max-lag-ms'?: number
        'recording-mode'?: 'mediarecorder' | 'mediarecorder-1ch' | 'audioworklet'
        'signal-type'?: 'mls'
        'buffer-size'?: number
      }
    }
  }
}

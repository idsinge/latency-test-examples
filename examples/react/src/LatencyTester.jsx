import { useRef, useEffect, useState } from 'react'

const MIC_CONSTRAINTS = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
}

export function LatencyTester({ numberOfTests = 5 }) {
  const ltRef = useRef(null)
  const micStreamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  const [result, setResult] = useState(null)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  async function connect() {
    try {
      const ac = new AudioContext({ latencyHint: 0 })
      audioCtxRef.current = ac
      const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
      micStreamRef.current = stream
      ltRef.current.inputStream = stream
      ltRef.current.audioContext = ac
      setIsConnected(true)
    } catch (e) {
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
      setError(`Could not access mic: ${e.message}`)
    }
  }

  useEffect(() => {
    const el = ltRef.current
    if (!el) return
    const onResult = (e) => setResult(e.detail)
    const onComplete = (e) => setStats(e.detail)
    const onError = (e) => setError(e.detail.message)
    el.addEventListener('latency-result', onResult)
    el.addEventListener('latency-complete', onComplete)
    el.addEventListener('latency-error', onError)
    return () => {
      el.removeEventListener('latency-result', onResult)
      el.removeEventListener('latency-complete', onComplete)
      el.removeEventListener('latency-error', onError)
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close()
    }
  }, [])

  return (
    <div>
      <latency-test ref={ltRef} number-of-tests={numberOfTests} />
      {!isConnected
        ? <button onClick={connect}>Connect Audio</button>
        : <button onClick={() => ltRef.current?.start()}>Test Latency</button>
      }
      {result && (
        <p>{result.latency.toFixed(2)} ms — ratio: {result.ratio.toFixed(2)} dB{result.reliable ? '' : ' ⚠️'}</p>
      )}
      {stats && stats.results?.length > 1 && (
        <p>Mean: {stats.mean.toFixed(2)} ms | SD: {stats.std.toFixed(2)} | Min: {stats.min.toFixed(2)} | Max: {stats.max.toFixed(2)}</p>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}

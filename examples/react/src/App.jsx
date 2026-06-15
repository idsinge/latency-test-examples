import { LatencyTester } from './LatencyTester.jsx'

// === VERIFICATION HARNESS — not part of docs example ===
import { Verify } from './Verify.jsx'

export default function App() {
  return (
    <>
      <LatencyTester />
      {/* === VERIFICATION HARNESS — not part of docs example === */}
      <Verify />
    </>
  )
}

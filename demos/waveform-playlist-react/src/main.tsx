import { createRoot } from 'react-dom/client'
import App from './App'

// No StrictMode: double-invoking effects in dev would re-run mic-permission
// requests and AudioWorklet module registration, which throws on the
// already-registered name (see @waveform-playlist/recording's own CLAUDE.md,
// "Multi-Instance Worklet Registration Gap") — a dev-only artifact unrelated
// to this demo's actual research question.
createRoot(document.getElementById('root')!).render(<App />)

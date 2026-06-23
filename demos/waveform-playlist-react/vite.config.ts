import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/latency-test-examples/demos/waveform-playlist-react/',
})

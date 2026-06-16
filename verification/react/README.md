# Verification harness — React

> **Automated:** `./verify.sh react` from the repo root wires the harness and cleans up on exit. The manual steps below are the reference if you need to wire without the script.


## Files

- `Verify.jsx` — harness component for `examples/react/`

## How to wire in for a verification session

Copy `Verify.jsx` into `examples/react/src/Verify.jsx`.

In `examples/react/src/App.jsx`, add:

    import { Verify } from './Verify.jsx'

And render it after `<LatencyTester />`:

    export default function App() {
      return (
        <>
          <LatencyTester />
          <Verify />
        </>
      )
    }

Run `npm run dev`, verify, run `npm run build && npm run preview`, verify.

**Before committing:** remove the import and `<Verify />`, delete `src/Verify.jsx`.

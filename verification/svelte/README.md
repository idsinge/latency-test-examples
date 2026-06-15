# Verification harness — Svelte

## Files

- `Verify.svelte` — harness component for `examples/svelte/`

## How to wire in for a verification session

Copy `Verify.svelte` into `examples/svelte/src/Verify.svelte`.

In `examples/svelte/src/App.svelte`, add:

    <script>
      import LatencyTester from './LatencyTester.svelte'
      import Verify from './Verify.svelte'
    </script>

    <LatencyTester />
    <Verify />

Run `npm run dev`, verify, run `npm run build && npm run preview`, verify.

**Before committing:** remove the Verify import and usage, delete `src/Verify.svelte`.

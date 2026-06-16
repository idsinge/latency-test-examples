# Verification harness — Vue

> **Automated:** `./verify.sh vue` from the repo root wires the harness and cleans up on exit. The manual steps below are the reference if you need to wire without the script.


## Files

- `Verify.vue` — harness component for `examples/vue/`

## How to wire in for a verification session

Copy `Verify.vue` into `examples/vue/src/Verify.vue`.

In `examples/vue/src/App.vue`, add:

    import Verify from './Verify.vue'

And render it after `<LatencyTester />`:

    <template>
      <LatencyTester />
      <Verify />
    </template>

Run `npm run dev`, verify, run `npm run build && npm run preview`, verify.

**Before committing:** remove the import and `<Verify />`, delete `src/Verify.vue`.

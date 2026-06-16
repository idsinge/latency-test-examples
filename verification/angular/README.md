# Verification harness — Angular

> **Automated:** `./verify.sh angular` from the repo root wires the harness and cleans up on exit. The manual steps below are the reference if you need to wire without the script.


## Files

- `Verify.component.ts` — harness standalone component for `examples/angular/`

## How to wire in for a verification session

Copy `Verify.component.ts` into `examples/angular/src/app/Verify.component.ts`.

In `examples/angular/src/app/app.ts`, add the import and render it after `<app-latency-tester>`:

    import { Component } from '@angular/core'
    import { LatencyTesterComponent } from './latency-tester.component'
    import { VerifyComponent } from './Verify.component'

    @Component({
      selector: 'app-root',
      standalone: true,
      imports: [LatencyTesterComponent, VerifyComponent],
      template: `
        <app-latency-tester></app-latency-tester>
        <app-verify></app-verify>
      `
    })
    export class App {}

Run `ng serve`, verify, run `ng build` then inspect output directory and serve it, verify.

**Before committing:** remove the VerifyComponent import and usage from app.ts,
delete `src/app/Verify.component.ts`.

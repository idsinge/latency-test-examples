# Next.js verification harness

## Wire (for browser checks)

1. Copy `Verify.tsx` into the app:
   ```
   cp verification/nextjs/Verify.tsx examples/nextjs/components/Verify.tsx
   ```

2. In `examples/nextjs/app/page.tsx`, add the import and render after `<LatencyTester />`:
   ```tsx
   import { LatencyTester } from '@/components/LatencyTester'
   import { Verify } from '@/components/Verify'

   export default function Page() {
     return (
       <main>
         <h1>Audio Latency Test</h1>
         <LatencyTester />
         <Verify />
       </main>
     )
   }
   ```

## Remove (before commit)

```
rm examples/nextjs/components/Verify.tsx
```

Revert `app/page.tsx` to the docs-only version (remove the `Verify` import and `<Verify />`).

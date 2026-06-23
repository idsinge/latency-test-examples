// Sample-domain alignment proof for the metronome guide track vs. each recorded take.
// Pure functions, no DOM/React dependencies (besides AudioBuffer) — ported as-is from
// demos/dawcore/src/alignment.js, see that file's NOTES.md for the algorithm rationale
// and the two bug-fix iterations already folded in here. Only addition: the sample-rate
// guard in computeAlignmentOffset.

export interface AlignmentResult {
  offsetSamples: number
  offsetMs: number
  pairCount: number
  allOffsets: number[]
  madMs: number
  reliable: boolean
  guideOnsetCount: number
  recordedOnsetCount: number
  guideOnsetsMs: number[]
  recordedOnsetsMs: number[]
  trimGuide: number
  trimRecorded: number
}

interface OnsetDetectionOptions {
  windowSize?: number
  peakThresholdRatio?: number
  minInterOnsetMs?: number
}

interface MatchOptions {
  maxTrim?: number
  maxAcceptableMad?: number
}

interface AlignmentOptions {
  minPairs?: number
  maxMadMs?: number
}

interface TrimCandidate {
  offsets: number[]
  trimGuide: number
  trimRecorded: number
  mad: number
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function medianAbsoluteDeviation(values: number[], med: number): number {
  return median(values.map((v) => Math.abs(v - med)))
}

export function detectClickOnsets(buffer: AudioBuffer, options: OnsetDetectionOptions = {}): number[] {
  const { windowSize = 96, peakThresholdRatio = 0.3, minInterOnsetMs = 150 } = options
  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const minInterOnsetSamples = Math.round((minInterOnsetMs / 1000) * sampleRate)

  let globalPeak = 0
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i])
    if (abs > globalPeak) globalPeak = abs
  }
  if (globalPeak === 0) return []

  const threshold = globalPeak * peakThresholdRatio
  const onsets: number[] = []
  let lastOnset = -minInterOnsetSamples

  for (let start = 0; start < data.length; start += windowSize) {
    const end = Math.min(start + windowSize, data.length)
    let windowPeak = 0
    for (let i = start; i < end; i++) {
      const abs = Math.abs(data[i])
      if (abs > windowPeak) windowPeak = abs
    }
    if (windowPeak < threshold || start - lastOnset < minInterOnsetSamples) continue

    // Refine to the precise local maximum within this window
    let peakIndex = start
    let peakValue = 0
    for (let i = start; i < end; i++) {
      const abs = Math.abs(data[i])
      if (abs > peakValue) {
        peakValue = abs
        peakIndex = i
      }
    }
    onsets.push(peakIndex)
    lastOnset = peakIndex
  }
  return onsets
}

// Builds the offset list for one candidate (trimGuide, trimRecorded) pair and
// scores it by MAD. Returns null if there aren't enough onsets left to pair.
function pairAtTrim(
  guideOnsets: number[],
  recordedOnsets: number[],
  trimGuide: number,
  trimRecorded: number
): TrimCandidate | null {
  const guideSlice = guideOnsets.slice(trimGuide, guideOnsets.length - trimGuide)
  const recordedSlice = recordedOnsets.slice(trimRecorded, recordedOnsets.length - trimRecorded)
  const pairCount = Math.min(guideSlice.length, recordedSlice.length)
  if (pairCount < 1) return null

  const offsets: number[] = []
  for (let i = 0; i < pairCount; i++) {
    offsets.push(recordedSlice[i] - guideSlice[i])
  }
  const med = median(offsets)
  const mad = medianAbsoluteDeviation(offsets, med)
  return { offsets, trimGuide, trimRecorded, mad }
}

// Pairs onsets sequentially after searching a small range of edge-trims,
// preferring the LEAST amount of trimming whose resulting MAD is already
// acceptable (<= maxAcceptableMad), only escalating to more trimming when
// the untrimmed (or less-trimmed) pairing isn't good enough. This is
// deliberate, not just simpler: picking the candidate with the single
// globally-lowest MAD (the previous approach) is a real, observed failure
// mode with evenly-spaced clicks — discarding 1-2 edge clicks can shave a
// fraction of a millisecond off an already-tiny MAD purely by chance, while
// silently shifting every remaining pair to the WRONG corresponding click
// (off by a full beat or more). Stopping at the first acceptable, least-
// trimmed candidate avoids that trap while still recovering from a genuine
// single missed/extra click at the edges when the untrimmed pairing is bad.
export function matchClickSequences(
  guideOnsets: number[],
  recordedOnsets: number[],
  options: MatchOptions = {}
): TrimCandidate {
  // maxAcceptableMad defaults to Infinity: with no threshold supplied, the
  // least-trimmed (totalTrim=0) candidate is accepted immediately as long as
  // it has at least one pair. computeAlignmentOffset() always supplies an
  // explicit threshold; this default only matters for direct callers and must
  // NOT silently fall back to an exhaustive global-minimum-MAD search — that
  // mode is the over-trimming bug this function was rewritten to avoid.
  const { maxTrim = 2, maxAcceptableMad = Infinity } = options
  const minLength = Math.min(guideOnsets.length, recordedOnsets.length)
  const cap = Math.max(0, Math.min(maxTrim, Math.floor((minLength - 1) / 2)))

  let best: TrimCandidate | null = null
  for (let totalTrim = 0; totalTrim <= cap * 2; totalTrim++) {
    let bestAtThisLevel: TrimCandidate | null = null
    for (let trimGuide = Math.max(0, totalTrim - cap); trimGuide <= Math.min(cap, totalTrim); trimGuide++) {
      const candidate = pairAtTrim(guideOnsets, recordedOnsets, trimGuide, totalTrim - trimGuide)
      if (candidate && (bestAtThisLevel === null || candidate.mad < bestAtThisLevel.mad)) {
        bestAtThisLevel = candidate
      }
    }
    if (bestAtThisLevel === null) continue
    if (best === null || bestAtThisLevel.mad < best.mad) {
      best = bestAtThisLevel
    }
    if (best.mad <= maxAcceptableMad) break
  }

  return best ?? { offsets: [], trimGuide: 0, trimRecorded: 0, mad: Infinity }
}

export function computeAlignmentOffset(
  guideBuffer: AudioBuffer,
  recordedBuffer: AudioBuffer,
  options: AlignmentOptions = {}
): AlignmentResult {
  // The guide track decode and the recording hooks share one AudioContext by
  // construction (both go through the Tone-wrapped global context). <latency-test>
  // does NOT share that context — it's forced onto a separate native AudioContext
  // (see NOTES.md "Pipeline match") — but both are configured to the same sample
  // rate, so this check still holds; a mismatch here means that sample-rate
  // configuration broke, not something to silently resample around.
  if (guideBuffer.sampleRate !== recordedBuffer.sampleRate) {
    throw new Error(
      `Sample rate mismatch: guide ${guideBuffer.sampleRate}Hz vs recorded ${recordedBuffer.sampleRate}Hz — ` +
        'cannot compare onsets across mismatched rates without resampling'
    )
  }

  const { minPairs = 3, maxMadMs = 15 } = options
  const sampleRate = guideBuffer.sampleRate

  const guideOnsets = detectClickOnsets(guideBuffer)
  const recordedOnsets = detectClickOnsets(recordedBuffer)
  // Reuse the reliability MAD threshold as the "good enough, stop trimming"
  // bar — a pairing already tight enough to pass as reliable shouldn't be
  // discarded in favor of a marginally tighter but more-trimmed candidate.
  const maxAcceptableMad = (maxMadMs / 1000) * sampleRate
  const { offsets, mad, trimGuide, trimRecorded } = matchClickSequences(guideOnsets, recordedOnsets, {
    maxAcceptableMad,
  })

  const pairCount = offsets.length
  const offsetSamples = pairCount > 0 ? Math.round(median(offsets)) : 0
  const offsetMs = (offsetSamples / sampleRate) * 1000
  const madMs = Number.isFinite(mad) ? (mad / sampleRate) * 1000 : Infinity

  const onsetCountDiff = Math.abs(guideOnsets.length - recordedOnsets.length)
  // Exact match required, not <= 1: matchClickSequences cannot distinguish a
  // genuinely correct untrimmed pairing from one whole-beat-shifted by a
  // missing edge click — both can score an excellent MAD on evenly-spaced
  // metronome clicks (false-reliable failure mode, see demos/dawcore/NOTES.md).
  // A count mismatch is therefore disqualifying for the `reliable` proof, even
  // though matchClickSequences still reports its best-guess offset.
  const reliable = pairCount >= minPairs && onsetCountDiff === 0 && madMs <= maxMadMs

  return {
    offsetSamples,
    offsetMs,
    pairCount,
    allOffsets: offsets,
    madMs,
    reliable,
    guideOnsetCount: guideOnsets.length,
    recordedOnsetCount: recordedOnsets.length,
    guideOnsetsMs: guideOnsets.map((s) => (s / sampleRate) * 1000),
    recordedOnsetsMs: recordedOnsets.map((s) => (s / sampleRate) * 1000),
    trimGuide,
    trimRecorded,
  }
}

// Mirrors the trim that ends up applied to the actual clip (internal estimate
// or externally-measured override) so this module always analyzes the same
// audible portion that's on the timeline.
export function sliceBuffer(buffer: AudioBuffer, offsetSamples: number, durationSamples: number): AudioBuffer {
  const sliced = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: durationSamples,
    sampleRate: buffer.sampleRate,
  })
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const source = buffer.getChannelData(ch)
    sliced.copyToChannel(source.subarray(offsetSamples, offsetSamples + durationSamples), ch)
  }
  return sliced
}

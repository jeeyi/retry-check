import { describe, expect, it } from 'vitest'
import { looksReasonable as scenario } from '../scenarios/looksReasonable'
import { retrySpans } from './timeline'

const deployed = scenario.deployed

describe('retrySpans', () => {
  it('lays out attempts with doubling backoff between them', () => {
    expect(retrySpans(deployed)).toEqual([
      { kind: 'attempt', attempt: 1, startMs: 0, endMs: 800 },
      { kind: 'backoff', attempt: 1, startMs: 800, endMs: 900 },
      { kind: 'attempt', attempt: 2, startMs: 900, endMs: 1700 },
      { kind: 'backoff', attempt: 2, startMs: 1700, endMs: 1900 },
      { kind: 'attempt', attempt: 3, startMs: 1900, endMs: 2700 },
    ])
  })

  it('clips at the cutoff and drops what would start after it', () => {
    expect(retrySpans(deployed, 1200)).toEqual([
      { kind: 'attempt', attempt: 1, startMs: 0, endMs: 800 },
      { kind: 'backoff', attempt: 1, startMs: 800, endMs: 900 },
      { kind: 'attempt', attempt: 2, startMs: 900, endMs: 1200 },
    ])
    expect(retrySpans(deployed, 900).map((span) => span.kind)).toEqual(['attempt', 'backoff'])
  })

  it('has no backoff spans when the base is zero or there is one attempt', () => {
    expect(retrySpans({ ...deployed, backoffBaseMs: 0 }).map((span) => span.kind)).toEqual([
      'attempt',
      'attempt',
      'attempt',
    ])
    expect(retrySpans({ ...deployed, attempts: 1 })).toEqual([
      { kind: 'attempt', attempt: 1, startMs: 0, endMs: 800 },
    ])
  })
})

import type { RetryPolicy } from './types'

export interface Span {
  kind: 'attempt' | 'backoff'
  /** 1-based attempt number; a backoff carries the attempt it follows. */
  attempt: number
  startMs: number
  endMs: number
}

/**
 * The attempts and the backoff waits between them when every attempt runs to
 * its timeout. Anything at or after cutoffMs is dropped or clipped.
 */
export function retrySpans(policy: RetryPolicy, cutoffMs = Infinity): Span[] {
  const spans: Span[] = []
  let startMs = 0
  const add = (kind: Span['kind'], attempt: number, durationMs: number) => {
    if (durationMs > 0 && startMs < cutoffMs) {
      spans.push({ kind, attempt, startMs, endMs: Math.min(startMs + durationMs, cutoffMs) })
    }
    startMs += durationMs
  }
  for (let attempt = 1; attempt <= policy.attempts; attempt++) {
    add('attempt', attempt, policy.perAttemptTimeoutMs)
    if (attempt < policy.attempts) add('backoff', attempt, policy.backoffBaseMs * 2 ** (attempt - 1))
  }
  return spans
}

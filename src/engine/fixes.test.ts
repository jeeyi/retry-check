import { describe, expect, it } from 'vitest'
import { looksReasonable as scenario } from '../scenarios/looksReasonable'
import { assess } from './assess'
import {
  ATTEMPTS,
  BACKOFF_BASE_MS,
  OVERALL_TIMEOUT_MS,
  PER_ATTEMPT_TIMEOUT_MS,
  RETRY_BUDGET_PCT,
  type Range,
} from './bounds'
import { applyFixes, proposeFixes } from './fixes'
import type { Config } from './types'

const proposed = scenario.proposed

describe('fixes for the spec cases', () => {
  it('A. as proposed: an overall timeout and a retry budget, which give case B', () => {
    expect(proposeFixes(scenario, proposed)).toEqual([
      { kind: 'deadline', patch: { overallTimeoutMs: 900 } },
      { kind: 'capacity', patch: { retryBudgetPct: 10 } },
    ])
    expect(applyFixes(scenario, proposed)).toEqual({ ...proposed, overallTimeoutMs: 900, retryBudgetPct: 10 })
  })

  it('B. safe: nothing to fix', () => {
    const config = { ...proposed, overallTimeoutMs: 900, retryBudgetPct: 10 }
    expect(proposeFixes(scenario, config)).toEqual([])
    expect(applyFixes(scenario, config)).toBe(config)
  })

  it('C. per-attempt timeout too low: raise it to the slowest dependency', () => {
    const config = { ...proposed, overallTimeoutMs: 900, retryBudgetPct: 10, perAttemptTimeoutMs: 400 }
    expect(proposeFixes(scenario, config)).toEqual([{ kind: 'edge', patch: { perAttemptTimeoutMs: 750 } }])
  })

  it('D. overall timeout too low: raise it, on its 100 ms grid', () => {
    const config = { ...proposed, overallTimeoutMs: 500, retryBudgetPct: 10 }
    expect(proposeFixes(scenario, config)).toEqual([{ kind: 'edge', patch: { overallTimeoutMs: 800 } }])
  })

  it('both timeouts too low: one edge fix raises both', () => {
    const config = { ...proposed, overallTimeoutMs: 500, retryBudgetPct: 10, perAttemptTimeoutMs: 400 }
    expect(proposeFixes(scenario, config)).toEqual([
      { kind: 'edge', patch: { perAttemptTimeoutMs: 750, overallTimeoutMs: 800 } },
    ])
  })

  it('an edge fix can expose a deadline problem, which applying fixes then resolves', () => {
    const config = { ...proposed, attempts: 2, perAttemptTimeoutMs: 400, retryBudgetPct: 10 }
    expect(proposeFixes(scenario, config).map((fix) => fix.kind)).toEqual(['edge'])
    expect(applyFixes(scenario, config)).toEqual({ ...config, perAttemptTimeoutMs: 750, overallTimeoutMs: 900 })
  })
})

describe('every config the controls can produce', () => {
  const grid = ({ min, max, step }: Range) =>
    Array.from({ length: (max - min) / step + 1 }, (_, i) => min + i * step)
  const perAttemptValues = grid(PER_ATTEMPT_TIMEOUT_MS)
  const backoffValues = grid(BACKOFF_BASE_MS)
  const overallValues = [null, ...grid(OVERALL_TIMEOUT_MS)]

  const reachable = (patch: Partial<Config>) =>
    (patch.perAttemptTimeoutMs === undefined || perAttemptValues.includes(patch.perAttemptTimeoutMs)) &&
    (patch.overallTimeoutMs === undefined || overallValues.includes(patch.overallTimeoutMs)) &&
    (patch.retryBudgetPct === undefined || RETRY_BUDGET_PCT.includes(patch.retryBudgetPct))

  it('gets fixes that are reachable, clear their own checks, and together end safe', () => {
    let count = 0
    const broken: Config[] = []

    for (const attempts of ATTEMPTS)
      for (const perAttemptTimeoutMs of perAttemptValues)
        for (const backoffBaseMs of backoffValues)
          for (const overallTimeoutMs of overallValues)
            for (const retryBudgetPct of RETRY_BUDGET_PCT) {
              const config = { attempts, perAttemptTimeoutMs, backoffBaseMs, overallTimeoutMs, retryBudgetPct }
              const fixes = proposeFixes(scenario, config)
              const ok =
                (fixes.length === 0) === assess(scenario, config).safe &&
                fixes.every(
                  (fix) =>
                    reachable(fix.patch) &&
                    assess(scenario, { ...config, ...fix.patch })
                      .checks.filter((c) => c.kind === fix.kind)
                      .every((c) => c.pass),
                ) &&
                assess(scenario, applyFixes(scenario, config)).safe
              count++
              if (!ok) broken.push(config)
            }

    expect(count).toBe(546_975)
    expect(broken).toEqual([])
  })
})

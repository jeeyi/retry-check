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
import type { Config } from './types'

const deployed = scenario.deployed

/** One row per check, in the layout of the spec's expected-results table. */
function rows(config: Config) {
  return assess(scenario, config).checks.map((c) => [`${c.subject} ${c.kind}`, c.value, c.limit, c.pass])
}

function failing(config: Config) {
  return assess(scenario, config)
    .checks.filter((c) => !c.pass)
    .map((c) => `${c.subject} ${c.kind}`)
}

describe('spec expected results for "Looks reasonable"', () => {
  it('A. as deployed: 2 of 7 fail', () => {
    expect(rows(deployed)).toEqual([
      ['Mobile app deadline', 2700, 1000, false],
      ['Web checkout deadline', 2700, 3000, true],
      ['Batch export deadline', 2700, 10000, true],
      ['inventory-svc edge', 750, 800, true],
      ['pricing-svc edge', 650, 800, true],
      ['Inventory DB capacity', 4950, 2000, false],
      ['Pricing cache capacity', 3300, 8000, true],
    ])
    expect(assess(scenario, deployed)).toMatchObject({ failed: 2, safe: false })
  })

  it('B. overall timeout 900 ms and retry budget 10%: 7 of 7 pass', () => {
    const config = { ...deployed, overallTimeoutMs: 900, retryBudgetPct: 10 }
    expect(rows(config)).toEqual([
      ['Mobile app deadline', 900, 1000, true],
      ['Web checkout deadline', 900, 3000, true],
      ['Batch export deadline', 900, 10000, true],
      ['inventory-svc edge', 750, 800, true],
      ['pricing-svc edge', 650, 800, true],
      ['Inventory DB capacity', 1815, 2000, true],
      ['Pricing cache capacity', 1210, 8000, true],
    ])
    expect(assess(scenario, config)).toMatchObject({ failed: 0, safe: true })
  })

  it('C. as B with per-attempt timeout 400 ms: both edges fail', () => {
    const config = { ...deployed, overallTimeoutMs: 900, retryBudgetPct: 10, perAttemptTimeoutMs: 400 }
    expect(failing(config)).toEqual(['inventory-svc edge', 'pricing-svc edge'])
    expect(rows(config)[3]).toEqual(['inventory-svc edge', 750, 400, false])
    expect(rows(config)[4]).toEqual(['pricing-svc edge', 650, 400, false])
  })

  it('D. overall timeout 500 ms below the per-attempt timeout: both edges fail', () => {
    const config = { ...deployed, overallTimeoutMs: 500, retryBudgetPct: 10 }
    expect(failing(config)).toEqual(['inventory-svc edge', 'pricing-svc edge'])
    expect(rows(config)[0]).toEqual(['Mobile app deadline', 500, 1000, true])
    expect(rows(config)[3]).toEqual(['inventory-svc edge', 750, 500, false])
  })
})

describe('retry multiplier', () => {
  const inventoryLoad = (config: Config) => assess(scenario, config).checks[5].value

  it('is capped by attempts when the budget would allow more', () => {
    expect(inventoryLoad({ ...deployed, attempts: 1, retryBudgetPct: 50 })).toBe(550 * 3)
  })

  it('puts the pass/fail boundary between the 20% and 50% presets', () => {
    expect(inventoryLoad({ ...deployed, retryBudgetPct: 20 })).toBe(1980)
    expect(inventoryLoad({ ...deployed, retryBudgetPct: 50 })).toBe(2475)
  })
})

describe('control bounds', () => {
  const onGrid = (value: number, { min, max, step }: Range) =>
    value >= min && value <= max && (value - min) % step === 0

  it('can reach the deployed config', () => {
    expect(ATTEMPTS).toContain(deployed.attempts)
    expect(onGrid(deployed.perAttemptTimeoutMs, PER_ATTEMPT_TIMEOUT_MS)).toBe(true)
    expect(onGrid(deployed.backoffBaseMs, BACKOFF_BASE_MS)).toBe(true)
    expect(deployed.overallTimeoutMs === null || onGrid(deployed.overallTimeoutMs, OVERALL_TIMEOUT_MS)).toBe(true)
    expect(RETRY_BUDGET_PCT).toContain(deployed.retryBudgetPct)
  })
})

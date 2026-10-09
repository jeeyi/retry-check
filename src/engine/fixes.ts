import { assess, rawWorstMs } from './assess'
import { OVERALL_TIMEOUT_MS, PER_ATTEMPT_TIMEOUT_MS, type Range } from './bounds'
import type { CheckKind, Config, Scenario } from './types'

/** One fix per kind of failing check: a change to the config that clears every check of that kind. */
export interface Fix {
  kind: CheckKind
  patch: Partial<Config>
}

const FIX_RETRY_BUDGET_PCT = 10

export function proposeFixes(scenario: Scenario, config: Config): Fix[] {
  const { checks } = assess(scenario, config)
  const fails = (kind: CheckKind) => checks.some((c) => c.kind === kind && !c.pass)
  const fixes: Fix[] = []

  if (fails('deadline')) {
    // Stop retrying at 90% of the shortest client deadline.
    const shortestMs = Math.min(...scenario.clients.map((client) => client.deadlineMs))
    fixes.push({
      kind: 'deadline',
      patch: { overallTimeoutMs: snap((shortestMs * 9) / 10, OVERALL_TIMEOUT_MS, Math.floor) },
    })
  }

  if (fails('edge')) {
    // Wait at least as long as the slowest dependency, raising whichever timeout is below it.
    const slowestMs = Math.max(...scenario.dependencies.map(rawWorstMs))
    const patch: Partial<Config> = {}
    if (config.perAttemptTimeoutMs < slowestMs) {
      patch.perAttemptTimeoutMs = snap(slowestMs, PER_ATTEMPT_TIMEOUT_MS, Math.ceil)
    }
    if (config.overallTimeoutMs !== null && config.overallTimeoutMs < slowestMs) {
      patch.overallTimeoutMs = snap(slowestMs, OVERALL_TIMEOUT_MS, Math.ceil)
    }
    fixes.push({ kind: 'edge', patch })
  }

  if (fails('capacity')) {
    fixes.push({ kind: 'capacity', patch: { retryBudgetPct: FIX_RETRY_BUDGET_PCT } })
  }

  return fixes
}

/**
 * Applies every proposed fix. One fix can expose another problem (a longer
 * per-attempt timeout can overrun a client deadline), so this repeats until
 * nothing is left to fix.
 */
export function applyFixes(scenario: Scenario, config: Config): Config {
  let next = config
  for (let round = 0; round < 3; round++) {
    const fixes = proposeFixes(scenario, next)
    if (fixes.length === 0) break
    next = Object.assign({}, next, ...fixes.map((fix) => fix.patch))
  }
  return next
}

/** Moves a value onto a control's step grid, in the given direction, within its range. */
function snap(value: number, { min, max, step }: Range, round: (n: number) => number): number {
  return Math.min(max, Math.max(min, round(value / step) * step))
}

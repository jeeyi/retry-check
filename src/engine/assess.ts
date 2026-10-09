import type { Assessment, Check, CheckKind, Config, RetryPolicy, Scenario } from './types'

/**
 * Worst-case duration when every attempt runs to its timeout. Backoff doubles
 * from the base, so the waits between n attempts sum to base × (2^(n-1) − 1).
 */
export function rawWorstMs(policy: RetryPolicy): number {
  const backoffMs = policy.backoffBaseMs * (2 ** (policy.attempts - 1) - 1)
  return policy.attempts * policy.perAttemptTimeoutMs + backoffMs
}

/**
 * How many calls the service makes per client request in the worst case, in
 * percent so load stays in integer arithmetic: a 10% budget is 110, not 1.1.
 */
export function retryMultiplierPct(config: Config): number {
  return config.retryBudgetPct === null
    ? config.attempts * 100
    : Math.min(config.attempts * 100, 100 + config.retryBudgetPct)
}

export function totalClientRps(scenario: Scenario): number {
  return scenario.clients.reduce((sum, client) => sum + client.rps, 0)
}

export function assess(scenario: Scenario, config: Config): Assessment {
  const overallMs = config.overallTimeoutMs ?? Infinity
  const serviceWorstMs = Math.min(rawWorstMs(config), overallMs)
  // An overall timeout below the per-attempt timeout cuts each attempt short.
  const attemptLimitMs = Math.min(config.perAttemptTimeoutMs, overallMs)
  const multiplierPct = retryMultiplierPct(config)
  const clientRps = totalClientRps(scenario)

  const checks: Check[] = [
    ...scenario.clients.map((client) => check('deadline', client.name, serviceWorstMs, client.deadlineMs)),
    ...scenario.dependencies.map((dep) => check('edge', dep.name, rawWorstMs(dep), attemptLimitMs)),
    ...scenario.leaves.map((leaf) => {
      const callerAttempts = scenario.dependencies
        .filter((dep) => dep.leaf === leaf.name)
        .reduce((sum, dep) => sum + dep.attempts, 0)
      const loadRps = (clientRps * multiplierPct * callerAttempts) / 100
      return check('capacity', leaf.name, loadRps, leaf.capacityRps)
    }),
  ]

  const failed = checks.filter((c) => !c.pass).length
  return { checks, failed, safe: failed === 0 }
}

function check(kind: CheckKind, subject: string, value: number, limit: number): Check {
  return { kind, subject, value, limit, pass: value <= limit }
}

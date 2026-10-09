export interface RetryPolicy {
  attempts: number
  perAttemptTimeoutMs: number
  backoffBaseMs: number
}

/** The editable retry config of the service under assessment. */
export interface Config extends RetryPolicy {
  overallTimeoutMs: number | null
  retryBudgetPct: number | null
}

export interface Client {
  name: string
  deadlineMs: number
  rps: number
}

export interface Dependency extends RetryPolicy {
  name: string
  /** Name of the leaf service this dependency calls. */
  leaf: string
}

export interface Leaf {
  name: string
  capacityRps: number
}

export interface Scenario {
  name: string
  service: string
  deployed: Config
  clients: Client[]
  dependencies: Dependency[]
  leaves: Leaf[]
}

export type CheckKind = 'deadline' | 'edge' | 'capacity'

export interface Check {
  kind: CheckKind
  /** The client, dependency or leaf the check is about. */
  subject: string
  /** Worst case: milliseconds for deadline and edge checks, RPS for capacity. */
  value: number
  limit: number
  pass: boolean
}

export interface Assessment {
  checks: Check[]
  failed: number
  safe: boolean
}

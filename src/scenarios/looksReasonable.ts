import type { Scenario } from '../engine/types'

export const looksReasonable: Scenario = {
  name: 'Looks reasonable',
  service: 'orders-api',
  deployed: {
    attempts: 3,
    perAttemptTimeoutMs: 800,
    backoffBaseMs: 100,
    overallTimeoutMs: null,
    retryBudgetPct: null,
  },
  clients: [
    { name: 'Mobile app', deadlineMs: 1000, rps: 300 },
    { name: 'Web checkout', deadlineMs: 3000, rps: 200 },
    { name: 'Batch export', deadlineMs: 10000, rps: 50 },
  ],
  dependencies: [
    { name: 'inventory-svc', attempts: 3, perAttemptTimeoutMs: 200, backoffBaseMs: 50, leaf: 'Inventory DB' },
    { name: 'pricing-svc', attempts: 2, perAttemptTimeoutMs: 300, backoffBaseMs: 50, leaf: 'Pricing cache' },
  ],
  leaves: [
    { name: 'Inventory DB', capacityRps: 2000 },
    { name: 'Pricing cache', capacityRps: 8000 },
  ],
}

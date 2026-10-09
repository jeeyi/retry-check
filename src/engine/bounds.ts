// What the config controls can produce. Every value is valid by construction,
// so the UI needs no validation.

export interface Range {
  min: number
  max: number
  step: number
}

export const ATTEMPTS = [1, 2, 3, 4, 5]
export const PER_ATTEMPT_TIMEOUT_MS: Range = { min: 100, max: 2000, step: 50 }
export const BACKOFF_BASE_MS: Range = { min: 0, max: 500, step: 50 }
export const OVERALL_TIMEOUT_MS: Range = { min: 100, max: 5000, step: 100 }
export const RETRY_BUDGET_PCT: (number | null)[] = [null, 5, 10, 20, 50]

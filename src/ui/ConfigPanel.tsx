import type { ReactNode } from 'react'
import { rawWorstMs } from '../engine/assess'
import {
  ATTEMPTS,
  BACKOFF_BASE_MS,
  OVERALL_TIMEOUT_MS,
  PER_ATTEMPT_TIMEOUT_MS,
  RETRY_BUDGET_PCT,
  type Range,
} from '../engine/bounds'
import type { Config } from '../engine/types'
import { formatMs } from '../format'

interface Props {
  config: Config
  /** The config the user started from. Fields that differ from it are marked, and undo returns to it. */
  proposed: Config
  onChange: (config: Config) => void
}

const formatOptionalMs = (ms: number | null) => (ms === null ? 'None' : formatMs(ms))
const formatBudget = (pct: number | null) => (pct === null ? 'None' : `${pct}%`)

export function ConfigPanel({ config, proposed, onChange }: Props) {
  const set = (patch: Partial<Config>) => onChange({ ...config, ...patch })
  const { attempts, perAttemptTimeoutMs, backoffBaseMs, overallTimeoutMs, retryBudgetPct } = config
  const capped = overallTimeoutMs !== null && overallTimeoutMs < perAttemptTimeoutMs

  const changedCount = (Object.keys(proposed) as (keyof Config)[]).filter((key) => config[key] !== proposed[key]).length
  /** The proposed value of a field, formatted, if the current value differs from it. */
  function changedFrom<K extends keyof Config>(key: K, format: (value: Config[K]) => string) {
    return config[key] === proposed[key] ? undefined : format(proposed[key])
  }

  return (
    <aside className="panel config">
      <div>
        <h2>Your retry config</h2>
        {changedCount === 0 ? (
          <p className="muted">Change a value and the verdict updates.</p>
        ) : (
          <p className="changes">
            {changedCount === 1 ? '1 value changed' : `${changedCount} values changed`}.{' '}
            <button type="button" className="reset" onClick={() => onChange(proposed)}>
              Undo changes
            </button>
          </p>
        )}
      </div>

      <Field label="Attempts" changedFrom={changedFrom('attempts', String)}>
        <Segmented
          label="Attempts"
          options={ATTEMPTS}
          value={attempts}
          format={String}
          onChange={(value) => set({ attempts: value })}
        />
      </Field>

      <Field
        label="Per-attempt timeout"
        htmlFor="per-attempt"
        readout={formatMs(perAttemptTimeoutMs)}
        hint={capped ? `Capped at ${formatMs(overallTimeoutMs)} by the overall timeout` : undefined}
        changedFrom={changedFrom('perAttemptTimeoutMs', formatMs)}
      >
        <Slider
          id="per-attempt"
          range={PER_ATTEMPT_TIMEOUT_MS}
          value={perAttemptTimeoutMs}
          onChange={(value) => set({ perAttemptTimeoutMs: value })}
        />
      </Field>

      <Field
        label="Backoff"
        htmlFor="backoff"
        readout={backoffBaseMs === 0 ? 'None' : `${formatMs(backoffBaseMs)}, doubling`}
        hint={backoffHint(config)}
        changedFrom={changedFrom('backoffBaseMs', formatMs)}
      >
        <Slider
          id="backoff"
          range={BACKOFF_BASE_MS}
          value={backoffBaseMs}
          onChange={(value) => set({ backoffBaseMs: value })}
        />
      </Field>

      <Field
        label="Overall timeout"
        htmlFor="overall"
        readout={formatOptionalMs(overallTimeoutMs)}
        changedFrom={changedFrom('overallTimeoutMs', formatOptionalMs)}
      >
        <label className="switch">
          <input
            type="checkbox"
            checked={overallTimeoutMs !== null}
            onChange={(event) =>
              set({ overallTimeoutMs: event.target.checked ? initialOverallTimeoutMs(config) : null })
            }
          />
          Limit total time across all attempts
        </label>
        {overallTimeoutMs !== null && (
          <Slider
            id="overall"
            range={OVERALL_TIMEOUT_MS}
            value={overallTimeoutMs}
            onChange={(value) => set({ overallTimeoutMs: value })}
          />
        )}
      </Field>

      <Field label="Retry budget" changedFrom={changedFrom('retryBudgetPct', formatBudget)}>
        <Segmented
          label="Retry budget"
          options={RETRY_BUDGET_PCT}
          value={retryBudgetPct}
          format={formatBudget}
          onChange={(value) => set({ retryBudgetPct: value })}
        />
      </Field>
    </aside>
  )
}

/** Starts the overall timeout at the current worst case, so switching it on changes nothing. */
function initialOverallTimeoutMs(config: Config): number {
  const { min, max, step } = OVERALL_TIMEOUT_MS
  const onGrid = Math.ceil(rawWorstMs(config) / step) * step
  return Math.min(max, Math.max(min, onGrid))
}

function backoffHint({ attempts, backoffBaseMs }: Config): string | undefined {
  if (backoffBaseMs === 0) return undefined
  if (attempts === 1) return 'Unused with a single attempt'
  const waits = Array.from({ length: attempts - 1 }, (_, i) => formatMs(backoffBaseMs * 2 ** i))
  return `Waits ${waits.join(', then ')}`
}

function Field(props: {
  label: string
  htmlFor?: string
  readout?: string
  hint?: string
  changedFrom?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <div className="field-head">
        {props.htmlFor ? <label htmlFor={props.htmlFor}>{props.label}</label> : <span>{props.label}</span>}
        {props.readout && <output>{props.readout}</output>}
      </div>
      {props.children}
      {props.hint && <div className="hint">{props.hint}</div>}
      {props.changedFrom && <div className="hint changed">Changed from {props.changedFrom}</div>}
    </div>
  )
}

function Slider(props: { id: string; range: Range; value: number; onChange: (value: number) => void }) {
  return (
    <input
      id={props.id}
      type="range"
      min={props.range.min}
      max={props.range.max}
      step={props.range.step}
      value={props.value}
      onChange={(event) => props.onChange(Number(event.target.value))}
    />
  )
}

function Segmented<T>(props: {
  label: string
  options: T[]
  value: T
  format: (option: T) => string
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={props.format(option)}
          type="button"
          aria-pressed={option === props.value}
          onClick={() => props.onChange(option)}
        >
          {props.format(option)}
        </button>
      ))}
    </div>
  )
}

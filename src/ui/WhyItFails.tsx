import type { ReactNode } from 'react'
import { assess, rawWorstMs, retryMultiplierPct, totalClientRps } from '../engine/assess'
import type { Fix } from '../engine/fixes'
import { retrySpans, type Span } from '../engine/timeline'
import type { Assessment, Check, Config, RetryPolicy, Scenario } from '../engine/types'
import { formatMs, formatRps } from '../format'
import { Card, CardSection } from './Cards'
import { OverrunBar, type BarSpan } from './OverrunBar'

interface Props {
  scenario: Scenario
  config: Config
  assessment: Assessment
  fixes: Fix[]
}

interface CardProps {
  scenario: Scenario
  config: Config
  fix: Fix
  /** The failing check that is furthest over its limit. */
  worst: Check
  /** The other failing checks of the same kind. */
  others: Check[]
}

const CARDS = { deadline: DeadlineCard, edge: EdgeCard, capacity: CapacityCard }

/** One card per fix, not per failing check. */
export function WhyItFails({ scenario, config, assessment, fixes }: Props) {
  return (
    <CardSection title="Why it fails">
      {fixes.map((fix, index) => {
        const failing = assessment.checks.filter((c) => c.kind === fix.kind && !c.pass)
        const worst = failing.reduce((a, b) => (b.value / b.limit > a.value / a.limit ? b : a))
        const Body = CARDS[fix.kind]
        return (
          <Card key={fix.kind} tone="fail" eyebrow={`Problem ${index + 1} · ${fix.kind}`}>
            <Body
              scenario={scenario}
              config={config}
              fix={fix}
              worst={worst}
              others={failing.filter((c) => c !== worst)}
            />
          </Card>
        )
      })}
    </CardSection>
  )
}

function DeadlineCard({ scenario, config, fix, worst, others }: CardProps) {
  const rawMs = rawWorstMs(config)
  return (
    <>
      <h3>
        {worst.subject} gives up at {formatMs(worst.limit)}. {scenario.service} can keep retrying until{' '}
        {formatMs(worst.value)}.
      </h3>
      <OverrunBar
        spans={retrySpans(config, worst.value).map(toBarSpan)}
        marker={worst.limit}
        total={worst.value}
        markerLabel={`${worst.subject} gives up · ${formatMs(worst.limit)}`}
        caption={`${formatMs(worst.value - worst.limit)} of work nobody is waiting for`}
      />
      <p>
        {describePolicy(config)} is {formatMs(rawMs)}.
        {worst.value < rawMs && ` The overall timeout stops it at ${formatMs(worst.value)}.`} After {worst.subject}{' '}
        has gone, {scenario.service} and everything below it keep working on a request with no caller.
        {others.length > 0 && ` Also affected: ${others.map((c) => c.subject).join(', ')}.`}
      </p>
      <FixNote>
        {config.overallTimeoutMs === null ? 'set an overall timeout of' : 'lower the overall timeout to'}{' '}
        {formatMs(fix.patch.overallTimeoutMs!)}, so retries stop before the shortest client deadline.
      </FixNote>
    </>
  )
}

function EdgeCard({ scenario, config, fix, worst, others }: CardProps) {
  const dependency = scenario.dependencies.find((dep) => dep.name === worst.subject)!
  const { perAttemptTimeoutMs, overallTimeoutMs } = fix.patch
  const raises = [
    perAttemptTimeoutMs !== undefined && `the per-attempt timeout to ${formatMs(perAttemptTimeoutMs)}`,
    overallTimeoutMs != null && `the overall timeout to ${formatMs(overallTimeoutMs)}`,
  ].filter(Boolean)
  const cappedByOverall = config.overallTimeoutMs !== null && config.overallTimeoutMs < config.perAttemptTimeoutMs

  return (
    <>
      <h3>
        {scenario.service} gives up on {worst.subject} at {formatMs(worst.limit)}. {worst.subject} can keep
        retrying until {formatMs(worst.value)}.
      </h3>
      <OverrunBar
        spans={retrySpans(dependency).map(toBarSpan)}
        marker={worst.limit}
        total={worst.value}
        markerLabel={`${scenario.service} gives up · ${formatMs(worst.limit)}`}
        caption={`${formatMs(worst.value - worst.limit)} of work nobody is waiting for`}
      />
      <p>
        For {worst.subject}, {describePolicy(dependency)} is {formatMs(worst.value)}. {scenario.service} waits only{' '}
        {formatMs(worst.limit)}, its {cappedByOverall ? 'overall' : 'per-attempt'} timeout, so it abandons calls
        that {worst.subject} is still working on.
        {others.length > 0 &&
          ` Also cut off: ${others.map((c) => `${c.subject} (can take ${formatMs(c.value)})`).join(', ')}.`}
      </p>
      <FixNote>
        raise {raises.join(' and ')}, so {scenario.service} waits for its slowest dependency.
      </FixNote>
    </>
  )
}

function CapacityCard({ scenario, config, fix, worst, others }: CardProps) {
  const callers = scenario.dependencies.filter((dep) => dep.leaf === worst.subject)
  const callerAttempts = callers.reduce((sum, dep) => sum + dep.attempts, 0)
  const callerNames = callers.map((dep) => dep.name).join(' + ')
  const multiplier = retryMultiplierPct(config) / 100
  const loadAfterFix = assess(scenario, { ...config, ...fix.patch }).checks.find(
    (c) => c.kind === 'capacity' && c.subject === worst.subject,
  )!.value

  return (
    <>
      <h3>
        {worst.subject} can receive {formatRps(worst.value)}. It handles {formatRps(worst.limit)}.
      </h3>
      <div className="chain">
        <span>{formatRps(totalClientRps(scenario))} in</span>×
        <span className="own">
          {multiplier} {scenario.service}
        </span>
        ×
        <span>
          {callerAttempts} {callerNames}
        </span>
        =<span className="over">{formatRps(worst.value)}</span>
      </div>
      <OverrunBar
        spans={[{ start: 0, end: worst.value }]}
        marker={worst.limit}
        total={worst.value}
        markerLabel={`Capacity · ${formatRps(worst.limit)}`}
        caption={`${formatRps(worst.value - worst.limit)} over capacity`}
      />
      <p>
        When {worst.subject} is failing, each client request becomes up to {multiplier} calls from{' '}
        {scenario.service}, and each of those becomes {callerAttempts} calls from {callerNames}. The retries arrive
        exactly when {worst.subject} is least able to take them.
        {others.length > 0 && ` Also over capacity: ${others.map((c) => c.subject).join(', ')}.`}
      </p>
      <FixNote>
        {config.retryBudgetPct === null ? 'add a retry budget of' : 'lower the retry budget to'}{' '}
        {fix.patch.retryBudgetPct}%. Worst-case load drops to {formatRps(loadAfterFix)}.
      </FixNote>
    </>
  )
}

function FixNote({ children }: { children: ReactNode }) {
  return (
    <div className="fix">
      <b>Fix:</b> {children}
    </div>
  )
}

/** "3 attempts × 800 ms, plus 300 ms of backoff," */
function describePolicy(policy: RetryPolicy): string {
  const { attempts, perAttemptTimeoutMs } = policy
  const backoffMs = rawWorstMs(policy) - attempts * perAttemptTimeoutMs
  const product = `${attempts} ${attempts === 1 ? 'attempt' : 'attempts'} × ${formatMs(perAttemptTimeoutMs)}`
  return backoffMs > 0 ? `${product}, plus ${formatMs(backoffMs)} of backoff,` : product
}

function toBarSpan(span: Span): BarSpan {
  return span.kind === 'attempt'
    ? { start: span.startMs, end: span.endMs, label: `Attempt ${span.attempt}`, shortLabel: String(span.attempt) }
    : { start: span.startMs, end: span.endMs, muted: true }
}

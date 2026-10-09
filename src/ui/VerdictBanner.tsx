import type { Assessment } from '../engine/types'

export function VerdictBanner({ assessment }: { assessment: Assessment }) {
  const { safe, failed, checks } = assessment
  return (
    <section className={`verdict ${safe ? 'pass' : 'fail'}`}>
      <h1>{safe ? 'Safe to deploy' : 'Not safe to deploy'}</h1>
      <p>
        {safe
          ? `${checks.length} of ${checks.length} checks pass.`
          : `${failed} of ${checks.length} checks fail.`}
      </p>
    </section>
  )
}

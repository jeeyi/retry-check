import type { Assessment } from '../engine/types'

interface Props {
  assessment: Assessment
  fixCount: number
  onApplyFixes: () => void
}

export function VerdictBanner({ assessment, fixCount, onApplyFixes }: Props) {
  const { safe, failed, checks } = assessment
  return (
    <section className={`verdict ${safe ? 'pass' : 'fail'}`}>
      <div>
        <h1>{safe ? 'Safe to deploy' : 'Not safe to deploy'}</h1>
        <p>
          {safe
            ? `${checks.length} of ${checks.length} checks pass.`
            : `${failed} of ${checks.length} checks fail.`}
        </p>
      </div>
      {!safe && (
        <button type="button" onClick={onApplyFixes}>
          {fixCount === 1 ? 'Apply fix' : 'Apply fixes'}
        </button>
      )}
    </section>
  )
}

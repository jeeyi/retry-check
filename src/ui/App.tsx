import { useState } from 'react'
import type { CheckKind } from '../engine/types'
import { assess } from '../engine/assess'
import { applyFixes, proposeFixes } from '../engine/fixes'
import { looksReasonable as scenario } from '../scenarios/looksReasonable'
import { ConfigPanel } from './ConfigPanel'
import { CARD_SECTION_ID } from './Cards'
import { KINDS, PassingChecks } from './PassingChecks'
import { RequestPath } from './RequestPath'
import { VerdictBanner } from './VerdictBanner'
import { WhyItFails } from './WhyItFails'

export function App() {
  const [config, setConfig] = useState(scenario.proposed)
  const assessment = assess(scenario, config)
  const fixes = proposeFixes(scenario, config)

  // The cards on offer: one per kind when safe, one per fix when not. The
  // selection falls back to the first card when its kind has no card any more.
  const [selected, setSelected] = useState<CheckKind>('deadline')
  const kinds = assessment.safe ? KINDS : fixes.map((fix) => fix.kind)
  const active = kinds.includes(selected) ? selected : kinds[0]
  const showCard = (kind: CheckKind) => {
    setSelected(kind)
    document.getElementById(CARD_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <>
      <header className="top">
        <strong>Retry Check</strong>
        <span className="muted">
          Assessing <code>{scenario.service}</code>
        </span>
        <span className="muted scenario">Demo scenario: {scenario.name}</span>
      </header>
      <main>
        <VerdictBanner
          assessment={assessment}
          fixCount={fixes.length}
          onApplyFixes={() => setConfig(applyFixes(scenario, config))}
        />
        <div className="columns">
          <div className="main-column">
            <RequestPath scenario={scenario} config={config} assessment={assessment} onSelect={showCard} />
            {assessment.safe ? (
              <PassingChecks scenario={scenario} checks={assessment.checks} active={active} onSelect={setSelected} />
            ) : (
              <WhyItFails
                scenario={scenario}
                config={config}
                assessment={assessment}
                fixes={fixes}
                active={active}
                onSelect={setSelected}
              />
            )}
          </div>
          <ConfigPanel config={config} proposed={scenario.proposed} onChange={setConfig} />
        </div>
      </main>
    </>
  )
}

import { useState } from 'react'
import { assess } from '../engine/assess'
import { applyFixes, proposeFixes } from '../engine/fixes'
import { looksReasonable as scenario } from '../scenarios/looksReasonable'
import { ConfigPanel } from './ConfigPanel'
import { VerdictBanner } from './VerdictBanner'
import { WhyItFails } from './WhyItFails'

export function App() {
  const [config, setConfig] = useState(scenario.deployed)
  const assessment = assess(scenario, config)
  const fixes = proposeFixes(scenario, config)

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
            {!assessment.safe && (
              <WhyItFails scenario={scenario} config={config} assessment={assessment} fixes={fixes} />
            )}
          </div>
          <ConfigPanel config={config} onChange={setConfig} />
        </div>
      </main>
    </>
  )
}

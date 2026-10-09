import { useState } from 'react'
import { assess } from '../engine/assess'
import { looksReasonable as scenario } from '../scenarios/looksReasonable'
import { CheckList } from './CheckList'
import { ConfigPanel } from './ConfigPanel'
import { VerdictBanner } from './VerdictBanner'

export function App() {
  const [config, setConfig] = useState(scenario.deployed)
  const assessment = assess(scenario, config)

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
        <VerdictBanner assessment={assessment} />
        <div className="columns">
          <CheckList checks={assessment.checks} />
          <ConfigPanel config={config} onChange={setConfig} />
        </div>
      </main>
    </>
  )
}

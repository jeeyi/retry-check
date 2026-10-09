import type { CSSProperties, ReactNode } from 'react'
import { serviceWorstMs } from '../engine/assess'
import type { Assessment, CheckKind, Config, Scenario } from '../engine/types'
import { formatMs, formatRps } from '../format'
import { buildRequestPath, COLUMNS, NODE_HEIGHT } from './requestPathModel'

interface Props {
  scenario: Scenario
  config: Config
  assessment: Assessment
  /** Called with the kind of check a clicked node belongs to. */
  onSelect: (kind: CheckKind) => void
}

type Column = keyof typeof COLUMNS

const LABELS: Record<Column, string> = {
  clients: 'Clients',
  service: 'Your service',
  dependencies: 'Dependencies',
  leaves: 'Leaf services',
}

export function RequestPath({ scenario, config, assessment, onSelect }: Props) {
  const path = buildRequestPath(scenario, assessment)
  // A node opens its card if there is one: every kind has a card when safe, only failing checks do otherwise.
  const open = (kind: CheckKind, failing: boolean) => (assessment.safe || failing ? () => onSelect(kind) : undefined)

  return (
    <section className="panel">
      <div className="path-head">
        <h2>Request path</h2>
        <span className={assessment.safe ? 'muted' : 'path-legend'}>
          {assessment.safe
            ? 'No failing checks on any path. Click a node to see its checks.'
            : 'Orange marks a failing check and the path to it. Click an orange node for details.'}
        </span>
      </div>

      <div className="path-scroll">
        <div className="path" style={{ height: path.height }}>
          {/* Stretched to the graph's width: x is a percentage, y is in pixels. */}
          <svg viewBox={`0 0 100 ${path.height}`} preserveAspectRatio="none" aria-hidden="true">
            {path.links.map((link, index) => {
              const midX = (link.x1 + link.x2) / 2
              return (
                <path
                  key={index}
                  className={link.failing ? 'fail' : undefined}
                  d={`M ${link.x1} ${link.y1} H ${midX} V ${link.y2} H ${link.x2}`}
                />
              )
            })}
          </svg>

          {(Object.keys(COLUMNS) as Column[]).map((column) => (
            <div key={column} className="path-label" style={{ left: `${COLUMNS[column].left}%` }}>
              {LABELS[column]}
            </div>
          ))}

          {path.clients.map((client) => (
            <Node
              key={client.name}
              column="clients"
              y={client.y}
              failing={client.failing}
              onClick={open('deadline', client.failing)}
            >
              <b>{client.name}</b>
              <span>
                deadline {formatMs(client.deadlineMs)} · {formatRps(client.rps)}
              </span>
            </Node>
          ))}

          <Node column="service" y={path.serviceY}>
            <b>{scenario.service}</b>
            <span>
              {config.attempts} {config.attempts === 1 ? 'attempt' : 'attempts'} × {formatMs(config.perAttemptTimeoutMs)}
            </span>
            <span>worst case {formatMs(serviceWorstMs(config))}</span>
            {config.retryBudgetPct !== null && <span>{config.retryBudgetPct}% retry budget</span>}
          </Node>

          {path.dependencies.map((dep) => (
            <Node
              key={dep.name}
              column="dependencies"
              y={dep.y}
              failing={dep.failing}
              onClick={open('edge', dep.failing)}
            >
              <b>{dep.name}</b>
              <span>
                {dep.attempts} attempts × {formatMs(dep.perAttemptTimeoutMs)}
              </span>
              {dep.failing && <span>worst case {formatMs(dep.worstMs)}</span>}
            </Node>
          ))}

          {path.leaves.map((leaf) => {
            // The bar spans whichever is larger, so the capacity tick moves left when overloaded.
            const scale = Math.max(leaf.loadRps, leaf.capacityRps)
            return (
              <Node
                key={leaf.name}
                column="leaves"
                y={leaf.y}
                failing={leaf.failing}
                onClick={open('capacity', leaf.failing)}
              >
                <b>{leaf.name}</b>
                <span>
                  {leaf.loadRps.toLocaleString('en-US')} of {formatRps(leaf.capacityRps)}
                </span>
                <span className="load">
                  <span className="load-fill" style={{ width: `${(leaf.loadRps / scale) * 100}%` }} />
                  <span className="load-tick" style={{ left: `${(leaf.capacityRps / scale) * 100}%` }} />
                </span>
              </Node>
            )
          })}
        </div>
      </div>

      <p className="muted">
        The dark tick on each leaf bar is that service's capacity. Loads shown are the worst case, when every call
        fails and every retry is used.
      </p>
    </section>
  )
}

/** A box on the graph. With onClick it is a button that opens the node's card. */
function Node(props: { column: Column; y: number; failing?: boolean; onClick?: () => void; children: ReactNode }) {
  const { left, width } = COLUMNS[props.column]
  const height = NODE_HEIGHT[props.column]
  const style: CSSProperties = { left: `${left}%`, width: `${width}%`, top: props.y - height / 2, height }
  const className = `node ${props.column} ${props.failing ? 'fail' : ''}`
  return props.onClick ? (
    <button type="button" className={className} style={style} onClick={props.onClick}>
      {props.children}
    </button>
  ) : (
    <div className={className} style={style}>
      {props.children}
    </div>
  )
}

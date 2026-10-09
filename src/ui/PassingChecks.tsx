import type { Check, CheckKind, Scenario } from '../engine/types'
import { formatMs, formatRps } from '../format'
import { Card, CardSection } from './Cards'

interface Props {
  scenario: Scenario
  checks: Check[]
}

const KINDS: CheckKind[] = ['deadline', 'edge', 'capacity']

/** The safe state: one card per kind of check, each a table of its passing checks. */
export function PassingChecks({ scenario, checks }: Props) {
  const { service } = scenario
  const cards: Record<CheckKind, { title: string; columns: string[]; cells: (check: Check) => string[] }> = {
    deadline: {
      title: `${service} stops retrying before every client gives up.`,
      columns: ['Client', 'Gives up at', `${service} stops by`, 'Margin'],
      cells: (c) => [formatMs(c.limit), formatMs(c.value), formatMs(c.limit - c.value)],
    },
    edge: {
      title: `${service} waits long enough for every dependency to finish.`,
      columns: ['Dependency', 'Can take', `${service} waits`, 'Margin'],
      cells: (c) => [formatMs(c.value), formatMs(c.limit), formatMs(c.limit - c.value)],
    },
    capacity: {
      title: 'Every leaf service stays within capacity in the worst case.',
      columns: ['Leaf service', 'Worst-case load', 'Capacity', 'Headroom'],
      cells: (c) => [formatRps(c.value), formatRps(c.limit), `${Math.round((1 - c.value / c.limit) * 100)}%`],
    },
  }

  return (
    <CardSection title="Checks">
      {KINDS.map((kind) => {
        const { title, columns, cells } = cards[kind]
        const rows = checks.filter((c) => c.kind === kind)
        return (
          <Card key={kind} tone="pass" eyebrow={`${kind} · ${rows.length} of ${rows.length} pass`}>
            <h3>{title}</h3>
            <table className="checks">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((check) => (
                  <tr key={check.subject}>
                    <th scope="row">{check.subject}</th>
                    {cells(check).map((cell, index) => (
                      <td key={columns[index + 1]}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      })}
    </CardSection>
  )
}

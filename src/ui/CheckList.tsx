import type { Check } from '../engine/types'
import { formatMs, formatRps } from '../format'

export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <section className="panel">
      <h2>Checks</h2>
      <table className="checks">
        <thead>
          <tr>
            <th scope="col">Check</th>
            <th scope="col">Worst case</th>
            <th scope="col">Limit</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => {
            const format = check.kind === 'capacity' ? formatRps : formatMs
            return (
              <tr key={`${check.kind}:${check.subject}`} className={check.pass ? 'pass' : 'fail'}>
                <th scope="row">
                  {check.subject} {check.kind}
                </th>
                <td>{format(check.value)}</td>
                <td>{format(check.limit)}</td>
                <td className="result">{check.pass ? 'Pass' : 'Fail'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

import { describe, expect, it } from 'vitest'
import { assess } from '../engine/assess'
import type { Config } from '../engine/types'
import { looksReasonable as scenario } from '../scenarios/looksReasonable'
import { buildRequestPath, COLUMNS } from './requestPathModel'

const proposed = scenario.proposed
const build = (config: Config) => buildRequestPath(scenario, assess(scenario, config))

/** Names of the failing nodes, and failing links as "column→column@y of the far end". */
function failing(config: Config) {
  const path = build(config)
  const columnAt = (x: number) =>
    Object.entries(COLUMNS).find(([, column]) => x === column.left || x === column.left + column.width)![0]
  return {
    nodes: [...path.clients, ...path.dependencies, ...path.leaves].filter((n) => n.failing).map((n) => n.name),
    links: path.links.filter((l) => l.failing).map((l) => `${columnAt(l.x1)}→${columnAt(l.x2)}`),
  }
}

describe('what the request path marks as failing', () => {
  it('A. as proposed: the mobile client, the inventory database, and the paths to them', () => {
    expect(failing(proposed)).toEqual({
      nodes: ['Mobile app', 'Inventory DB'],
      links: ['clients→service', 'service→dependencies', 'dependencies→leaves'],
    })
    const path = build(proposed)
    const inventorySvc = path.dependencies[0]
    const failingLinks = path.links.filter((l) => l.failing)
    expect(failingLinks[0].y1).toBe(path.clients[0].y)
    expect(failingLinks[1].y2).toBe(inventorySvc.y)
    expect(failingLinks[2]).toMatchObject({ y1: inventorySvc.y, y2: path.leaves[0].y })
  })

  it('B. safe: nothing', () => {
    expect(failing({ ...proposed, overallTimeoutMs: 900, retryBudgetPct: 10 })).toEqual({ nodes: [], links: [] })
  })

  it('C. both edges fail: both dependencies and the links into them, but no leaves', () => {
    const config = { ...proposed, overallTimeoutMs: 900, retryBudgetPct: 10, perAttemptTimeoutMs: 400 }
    expect(failing(config)).toEqual({
      nodes: ['inventory-svc', 'pricing-svc'],
      links: ['service→dependencies', 'service→dependencies'],
    })
  })
})

describe('layout', () => {
  const path = build(proposed)

  it('draws one link per client and two per dependency, passing ones first', () => {
    expect(path.links).toHaveLength(3 + 2 * 2)
    expect(path.links.map((l) => l.failing)).toEqual([false, false, false, false, true, true, true])
  })

  it('centres every column on the same line as the service', () => {
    const middle = (nodes: { y: number }[]) => (nodes[0].y + nodes[nodes.length - 1].y) / 2
    expect(middle(path.clients)).toBe(path.serviceY)
    expect(middle(path.dependencies)).toBe(path.serviceY)
    expect(middle(path.leaves)).toBe(path.serviceY)
  })

  it('is as tall as its tallest column, the three clients, plus the label row', () => {
    expect(path.height).toBe(36 + 3 * 72 + 2 * 24)
  })
})

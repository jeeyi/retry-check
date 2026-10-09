import type { Assessment, CheckKind, Client, Dependency, Leaf, Scenario } from '../engine/types'

// The request path graph as data: where each node sits and what is failing.
// Horizontal positions are percentages of the graph's width, so it stretches
// to fit its panel. Vertical positions are pixels.

export const COLUMNS = {
  clients: { left: 0, width: 22 },
  service: { left: 28, width: 22 },
  dependencies: { left: 56, width: 19 },
  leaves: { left: 80, width: 20 },
}

// Dependencies and leaves share a height so a dependency lines up with its leaf.
export const NODE_HEIGHT = { clients: 72, service: 120, dependencies: 96, leaves: 96 }

/** Space above the nodes for the column labels. */
const TOP = 36
const GAP = 24

interface Placed {
  /** Vertical centre of the node. */
  y: number
  failing: boolean
}

export interface Link {
  x1: number
  y1: number
  x2: number
  y2: number
  failing: boolean
}

export interface RequestPath {
  height: number
  clients: (Client & Placed)[]
  serviceY: number
  dependencies: (Dependency & Placed & { worstMs: number })[]
  leaves: (Leaf & Placed & { loadRps: number })[]
  /** Passing links first, so failing ones are drawn on top. */
  links: Link[]
}

export function buildRequestPath(scenario: Scenario, assessment: Assessment): RequestPath {
  const find = (kind: CheckKind, subject: string) =>
    assessment.checks.find((c) => c.kind === kind && c.subject === subject)!

  const stack = (count: number, nodeHeight: number) => count * nodeHeight + (count - 1) * GAP
  const tallest = Math.max(
    stack(scenario.clients.length, NODE_HEIGHT.clients),
    stack(1, NODE_HEIGHT.service),
    stack(scenario.dependencies.length, NODE_HEIGHT.dependencies),
    stack(scenario.leaves.length, NODE_HEIGHT.leaves),
  )
  /** Centres a column's nodes in the space the tallest column takes. */
  const centreY = (index: number, count: number, nodeHeight: number) =>
    TOP + (tallest - stack(count, nodeHeight)) / 2 + index * (nodeHeight + GAP) + nodeHeight / 2

  const clients = scenario.clients.map((client, i) => ({
    ...client,
    y: centreY(i, scenario.clients.length, NODE_HEIGHT.clients),
    failing: !find('deadline', client.name).pass,
  }))
  const serviceY = centreY(0, 1, NODE_HEIGHT.service)
  const dependencies = scenario.dependencies.map((dep, i) => {
    const edge = find('edge', dep.name)
    return {
      ...dep,
      y: centreY(i, scenario.dependencies.length, NODE_HEIGHT.dependencies),
      failing: !edge.pass,
      worstMs: edge.value,
    }
  })
  const leaves = scenario.leaves.map((leaf, i) => {
    const capacity = find('capacity', leaf.name)
    return {
      ...leaf,
      y: centreY(i, scenario.leaves.length, NODE_HEIGHT.leaves),
      failing: !capacity.pass,
      loadRps: capacity.value,
    }
  })

  const right = (column: { left: number; width: number }) => column.left + column.width
  const links: Link[] = [
    ...clients.map((client) => ({
      x1: right(COLUMNS.clients),
      y1: client.y,
      x2: COLUMNS.service.left,
      y2: serviceY,
      failing: client.failing,
    })),
    ...dependencies.flatMap((dep) => {
      const leaf = leaves.find((l) => l.name === dep.leaf)!
      return [
        {
          x1: right(COLUMNS.service),
          y1: serviceY,
          x2: COLUMNS.dependencies.left,
          y2: dep.y,
          // Orange for a failing edge, and as the path to an overloaded leaf.
          failing: dep.failing || leaf.failing,
        },
        {
          x1: right(COLUMNS.dependencies),
          y1: dep.y,
          x2: COLUMNS.leaves.left,
          y2: leaf.y,
          failing: leaf.failing,
        },
      ]
    }),
  ]

  return {
    height: TOP + tallest,
    clients,
    serviceY,
    dependencies,
    leaves,
    links: links.sort((a, b) => Number(a.failing) - Number(b.failing)),
  }
}

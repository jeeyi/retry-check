import type { ReactNode } from 'react'
import type { CheckKind } from '../engine/types'

// The card frame and layout shared by the failing state (WhyItFails) and the
// safe state (PassingChecks): one card at a time, with a dot per card.

/** The element the request path scrolls to when a node is clicked. */
export const CARD_SECTION_ID = 'details'

interface SectionProps {
  title: string
  /** The cards available, in order. */
  kinds: CheckKind[]
  /** The card being shown, passed as children. */
  active: CheckKind
  onSelect: (kind: CheckKind) => void
  children: ReactNode
}

export function CardSection({ title, kinds, active, onSelect, children }: SectionProps) {
  return (
    <section className="card-section" id={CARD_SECTION_ID}>
      <div className="card-section-head">
        <h2>{title}</h2>
        {kinds.length > 1 && (
          <div className="dots" role="group" aria-label="Choose a card">
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                className="dot"
                aria-label={`${kind} card`}
                aria-pressed={kind === active}
                onClick={() => onSelect(kind)}
              />
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}

export function Card(props: { eyebrow: string; tone: 'pass' | 'fail'; children: ReactNode }) {
  return (
    <article className="panel card">
      <div className={`eyebrow ${props.tone}`}>{props.eyebrow}</div>
      {props.children}
    </article>
  )
}

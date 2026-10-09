import type { ReactNode } from 'react'

// The card frame and layout shared by the failing state (WhyItFails) and the
// safe state (PassingChecks). Change the layout here and in `.cards`.

export function CardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-section">
      <h2>{title}</h2>
      <div className="cards">{children}</div>
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

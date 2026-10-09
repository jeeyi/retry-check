export interface BarSpan {
  start: number
  end: number
  /** Shown inside the span when it is wide enough, falling back to shortLabel. */
  label?: string
  shortLabel?: string
  /** A wait between attempts rather than work. */
  muted?: boolean
}

interface Props {
  spans: BarSpan[]
  /** Where the limit falls. Everything after it is drawn as overrun. */
  marker: number
  total: number
  markerLabel: string
  caption: string
}

/** A horizontal bar with a limit marker. Shared by the retry timelines and the capacity bar. */
export function OverrunBar({ spans, marker, total, markerLabel, caption }: Props) {
  const pct = (value: number) => (value / total) * 100
  // A span that crosses the marker is drawn as two pieces; only the larger keeps the label.
  const pieces = spans.flatMap((span) => {
    if (span.start >= marker || span.end <= marker) return [span]
    const before = { ...span, end: marker }
    const after = { ...span, start: marker }
    const smaller = marker - span.start < span.end - marker ? before : after
    smaller.label = smaller.shortLabel = undefined
    return [before, after]
  })

  return (
    <div className="overrun">
      <div className="overrun-track">
        <div className="overrun-bar">
          {pieces.map((piece) => {
            const width = pct(piece.end - piece.start)
            const classes = ['piece', piece.start >= marker && 'after', piece.muted && 'muted']
            return (
              <div
                key={piece.start}
                className={classes.filter(Boolean).join(' ')}
                style={{ left: `${pct(piece.start)}%`, width: `${width}%` }}
              >
                {width >= 22 ? piece.label : width >= 4 ? piece.shortLabel : null}
              </div>
            )
          })}
        </div>
        <div className={`overrun-marker ${pct(marker) > 50 ? 'flip' : ''}`} style={{ left: `${pct(marker)}%` }}>
          <span>{markerLabel}</span>
        </div>
      </div>
      <div className="overrun-caption">{caption}</div>
    </div>
  )
}

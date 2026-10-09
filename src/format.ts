/** "750 ms" below one second, otherwise seconds: "2.7 s", "1.0 s", "1.05 s". */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const seconds = (ms / 1000).toFixed(2)
  return `${seconds.endsWith('0') ? seconds.slice(0, -1) : seconds} s`
}

export function formatRps(rps: number): string {
  return `${rps.toLocaleString('en-US')} RPS`
}

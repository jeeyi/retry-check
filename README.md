# Retry Check

A developer tool that answers one question: **is this retry configuration safe to deploy?**

Each team's retry policy looks reasonable on its own. The danger is in how policies compose across a dependency chain. Retry Check takes one service's retry config, places it in its chain, and returns a pass/fail verdict with reasons and fixes.

See [docs/SPEC.md](docs/SPEC.md) for the model, the checks and the expected results.

## Status

Project scaffold only. No application code yet.

## Develop

```sh
npm install
npm run dev        # local dev server
npm test           # engine tests
npm run build      # typecheck and production build into dist/
```

## Layout

```
src/
  engine/      pure analysis: scenario + config in, checks + verdict out (no UI imports)
  scenarios/   preloaded demo scenarios
  ui/          React components
docs/
  SPEC.md      prototype spec
  mockups/     design reference
```

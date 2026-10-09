# Retry Check

A developer tool that answers one question: **is this retry configuration safe to deploy?**

Each team's retry policy looks reasonable on its own. The danger is in how policies compose across a dependency chain. Retry Check takes one service's retry config, places it in its chain, and returns a pass/fail verdict with reasons and fixes.

See [docs/SPEC.md](docs/SPEC.md) for the model, the checks and the expected results, and [docs/RATIONALE.md](docs/RATIONALE.md) for the design rationale.

Live at https://retry-check.vercel.app/

## Status

Built so far: the analysis engine, one demo scenario, and a page with the verdict, the editable retry config, a request path graph that marks what fails and the path to it, a card explaining each kind of failure with its fix, and tables of the passing checks once the config is safe.

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

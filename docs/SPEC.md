# Retry Check: prototype spec

A developer tool that answers one question: **is this retry configuration safe to deploy?**

Each team's retry policy looks reasonable on its own. The danger is in how policies compose across a dependency chain, which nobody owns. The tool takes one service's retry config, places it in its chain, and returns a pass/fail verdict with reasons and fixes.

## Constraints

- Runs in a browser with no install, login, or reviewer-supplied data.
- Ships with preloaded demo scenarios.
- Target build time is 1-2 hours. One idea done well beats breadth.
- All analysis is static and deterministic (no simulation, no backend needed).

## The model

Four kinds of node, left to right:

| Node | Fields | Editable |
|---|---|---|
| Client | deadline, request rate (RPS) | No |
| Service under assessment | attempts, per-attempt timeout, backoff, overall timeout, retry budget | Yes |
| Dependency service | attempts, per-attempt timeout, backoff | No |
| Leaf service | capacity (RPS) | No |

Only the service under assessment is editable. Other teams' services are shown as deployed.

Assumptions:

- The service calls its dependencies in parallel.
- Every client request reaches every dependency.
- Backoff doubles from a base value (100 ms base, 3 attempts: 100 + 200 = 300 ms). The multiplier is fixed at 2; only the base is editable.
- All numbers are worst case: every call fails and every retry is used.

## Calculations

**Worst-case duration of a retrying node**

    raw     = attempts × per_attempt_timeout + total_backoff
    worst   = min(raw, overall_timeout)   if an overall timeout is set
            = raw                         otherwise

**Retry multiplier of the service under assessment**

    multiplier = attempts                       with no retry budget
               = min(attempts, 1 + budget)      with a budget (10% gives 1.1)

**Worst-case load on a leaf**

    load = total_client_rps × multiplier(service) × attempts(dependency)

## Checks

A config is safe only if every check passes.

1. **Deadline, one per client.** `worst(service) <= client.deadline`. On failure the client gives up while the service and everything below it keep working.
2. **Edge, one per dependency.** `worst(dependency) <= min(service.per_attempt_timeout, service.overall_timeout)`. Same failure one level down: the service gives up on a dependency that is still retrying. An overall timeout below the per-attempt timeout is a valid config, and it is the overall timeout that then cuts each attempt short.
3. **Capacity, one per leaf.** `load(leaf) <= leaf.capacity`.

The verdict reads "Not safe to deploy. N of M checks fail." or "Safe to deploy."

## Demo scenario: "Looks reasonable"

Clients:

| Client | Deadline | RPS |
|---|---|---|
| Mobile app | 1.0 s | 300 |
| Web checkout | 3.0 s | 200 |
| Batch export | 10 s | 50 |

Service under assessment, `orders-api`: 3 attempts, 800 ms per attempt, 100 ms doubling backoff, no overall timeout, no retry budget.

Dependencies and leaves:

| Dependency | Attempts | Per-attempt timeout | Backoff base | Worst case | Leaf | Leaf capacity |
|---|---|---|---|---|---|---|
| inventory-svc | 3 | 200 ms | 50 ms | 750 ms | Inventory DB | 2,000 RPS |
| pricing-svc | 2 | 300 ms | 50 ms | 650 ms | Pricing cache | 8,000 RPS |

### Expected results (use these as test cases)

**A. As deployed: 2 of 7 fail**

| Check | Value | Limit | Result |
|---|---|---|---|
| Mobile app deadline | 2.7 s | 1.0 s | Fail |
| Web checkout deadline | 2.7 s | 3.0 s | Pass |
| Batch export deadline | 2.7 s | 10 s | Pass |
| inventory-svc edge | 750 ms | 800 ms | Pass |
| pricing-svc edge | 650 ms | 800 ms | Pass |
| Inventory DB capacity | 4,950 RPS | 2,000 RPS | Fail |
| Pricing cache capacity | 3,300 RPS | 8,000 RPS | Pass |

**B. Overall timeout 900 ms and retry budget 10%: 7 of 7 pass**

- Service worst case is 0.9 s.
- Inventory DB load is 1,815 RPS (9% headroom).
- Pricing cache load is 1,210 RPS.

**C. As B, but per-attempt timeout lowered to 400 ms: 2 of 7 fail**

- inventory-svc edge: 750 ms against 400 ms, 350 ms orphaned.
- pricing-svc edge: 650 ms against 400 ms, 250 ms orphaned.

**D. Overall timeout 500 ms (below the 800 ms per-attempt timeout) and retry budget 10%: 2 of 7 fail**

- Service worst case is 0.5 s, so every deadline passes.
- inventory-svc edge: 750 ms against 500 ms.
- pricing-svc edge: 650 ms against 500 ms.

## UI

Principle: the verdict leads, the graph is the map, and detail appears only for what fails.

1. **Header.** Tool name, the service being assessed, and a demo scenario picker.
2. **Verdict banner.** Pass or fail and the check count. When failing, one button applies every fix; there are no per-card buttons. One fix can expose another problem (a longer per-attempt timeout can overrun a client deadline), so the button repeats until the config is safe.
3. **Request path graph.** Four columns: clients, your service, dependencies (read-only), leaf services. Each node shows two or three numbers. Everything is muted except your service (dark) and failing nodes and the paths to them (orange). Each leaf has a load bar with a capacity tick.
4. **Why it fails.** One card per fix, not per failing check, so at most three. Each card has a one-sentence title with the numbers in it, a visual, a short explanation, and the recommended fix. A card features the check furthest over its limit and names the others.
   - Deadline and edge failures use the same timeline: attempts as segments, a marker where the caller gives up, and the work after the marker in orange.
   - Capacity failures show the multiplication chain (550 × 3 × 3 = 4,950) and a bar against capacity.
   - All cards are shown at once, in the order deadline, edge, capacity. To be revisited when the whole UI is reviewed.
5. **Config panel.** The five editable fields. Fields that cause a failure are flagged with the problem they cause. Any edit recomputes the verdict immediately. No field accepts typed input, so no value can be invalid and there are no error states:

   | Field | Control | Range | Step |
   |---|---|---|---|
   | Attempts | Segmented buttons | 1 to 5 | |
   | Per-attempt timeout | Slider | 100 to 2,000 ms | 50 ms |
   | Backoff base | Slider | 0 to 500 ms | 50 ms |
   | Overall timeout | Switch, plus slider when on | 100 to 5,000 ms | 100 ms |
   | Retry budget | Segmented buttons | None, 5%, 10%, 20%, 50% | |

   Switching the overall timeout on starts it at the current worst case, so the switch alone changes nothing (unless the worst case is above the 5,000 ms maximum, where it starts at the maximum). Fields are not validated against each other; judging a plausible but bad combination is the tool's job. When the overall timeout is below the per-attempt timeout, the panel says that attempts are capped by it.
6. **Safe state.** The cards become tables of passing checks, including headroom per leaf.

Recommendations:

| Failure | Fix | In the demo |
|---|---|---|
| Deadline | Set the overall timeout to 90% of the shortest client deadline, rounded down to its 100 ms step | 900 ms |
| Capacity | Set the retry budget to 10% | 1,815 RPS on Inventory DB |
| Edge | Raise whichever timeout is below the slowest dependency's worst case, rounded up to its step. If both are, raise both | Per-attempt 750 ms, overall 800 ms |

Every fix value is one the controls can produce. A test checks, for every config the controls can produce, that each fix clears its own checks and that applying all fixes ends in a safe config.

Visual reference: mockup screens exported into `docs/mockups/` (failing state and safe state).

## Proposed, not yet confirmed

- Show the safe range on the fields themselves: a floor on per-attempt timeout (slowest dependency, 750 ms) and a ceiling on overall timeout (shortest client deadline, 1.0 s).
- Two more demo scenarios, "Deep chain" and "Shared database". Neither is designed yet.
- List passing checks on the failing screen so the check count can be inspected. Built as a table in slice 1 and currently not rendered; to be decided when the whole UI is reviewed.

## Out of scope

- Simulation, partial failure rates, and recovery after a fault clears.
- Deadline propagation and cancellation.
- Sequential dependency calls.
- Fixes that conflict with each other, beyond showing the safe range.
- Editing other services, or loading real configs.

## Known limits to state in the rationale

- Worst-case analysis is pessimistic: it assumes every call fails.
- Capacity is a single number per leaf, with no model of how a leaf degrades under load.
- Duration and load use different worst cases. Duration assumes every attempt runs to its timeout; load assumes every attempt is used. With a short overall timeout both cannot happen at once, but each is a valid upper bound.

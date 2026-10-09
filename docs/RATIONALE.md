# Retry Check: design rationale

Live: https://retry-check.vercel.app/

## What it is

A developer tool that answers three questions before a retry config ships: can I deploy these settings safely, why or why not, and how do they affect the rest of the system?

You are the owner of one service, `orders-api`. You change its retry settings and the tool tells you, immediately, whether the result is safe, which checks fail, why, and what to change.

## Why this theme and this problem

I work as a platform engineer, and I am a strong believer in systems that are safe for developers to operate. Imagine a platform that understands each service's configuration, capacity, limits and dependencies, and tells you before you deploy that a change is not safe, why, and how it affects other systems. This prototype is a small version of that idea. The next step would be to run the same check on every pull request that changes a config, so a bad configuration never merges.

Retry settings are a workflow pain point with a specific shape: every team's policy looks reasonable on its own, and the failure comes from how the policies compose across a call chain that no single team owns. Three attempts here and three attempts one level down is nine calls on a database that is already struggling. A per-attempt timeout that is sensible for one service can be shorter than the time its dependency needs to finish its own retries. Nobody reviews the product of the settings, because nobody owns it.

## What is non-obvious

- **The answer is a verdict, not a dashboard.** The page leads with "Safe to deploy" or "Not safe to deploy" and a count of failing checks. Everything else exists to justify that sentence.
- **Static worst-case analysis, not simulation.** The tool multiplies and adds: worst-case duration, worst-case load. It is deterministic, instant and explainable, and each result can be checked by hand. A simulation would be more realistic and much harder to trust in a review.
- **Three checks cover the composition.** A client deadline check (does my service stop before its caller gives up), an edge check (do I wait long enough for each dependency to finish retrying), and a capacity check (can my retries, multiplied by theirs, overload a leaf service).
- **The edge check uses the smaller of two timeouts.** An overall timeout below the per-attempt timeout is a legal config, and it silently becomes the real per-attempt limit. The tool accepts that config on purpose and shows the consequence, because that is how the relationship is learned.
- **Fixes are proven, not suggested.** A test walks every config the controls can produce (546,975 of them) and checks that each proposed fix clears its own checks and that applying all fixes ends in a safe config.

## Key decisions and tradeoffs

| Decision | Why | Cost |
|---|---|---|
| Only your own service is editable | You cannot change other teams' services in a review, so the tool should not pretend you can | Fixes that need a change elsewhere are out of reach |
| Controls that cannot produce an invalid value (sliders, segmented buttons, a switch) | No validation and no error states; the reviewer can explore freely | No exact arbitrary values, only steps |
| Fields are not validated against each other | Judging a plausible but bad combination is the tool's job, not the form's | None found |
| One "Apply fixes" button, no per-card buttons | Per-card buttons raised the question of which to press first; one fix can also expose another problem, so the single button repeats until the config is safe | You cannot apply one fix in isolation, except by moving the control yourself |
| One explanation card at a time, opened from the graph | Three cards at once was too much, and wrapping them made the last one look like the biggest problem | The other problems are one click away, not visible |
| The request path graph sits above the details | It is the map: it shows where the failure is and what leads to it | A longer page |
| The starting config is called "proposed", not "deployed" | The tool is used before deployment | None |
| No backend, login or persistence | Nothing in the problem needs them; a static page deploys in one step | No saved or shared configs |
| Engine separated from the UI, with tests | The numbers are the product, so they are tested against hand-computed cases | None |

## Known limits

- The analysis is pessimistic: it assumes every call fails and every retry is used.
- Duration and load use different worst cases (every attempt times out; every attempt is used). Both are valid upper bounds, but they cannot both happen at once when the overall timeout is short.
- Capacity is one number per leaf service, with no model of how it degrades under load.
- The service is assumed to call its dependencies in parallel, and every request reaches every dependency.
- There is one demo scenario.

## With more time

- **More scenarios.** A deep chain (dependencies with their own dependencies) and a shared database (two dependencies hitting one leaf). The data model already supports a shared leaf; a deep chain needs the engine to recurse.
- **Real configs.** Load retry settings from service config files or a service mesh, so the tool runs in code review.
- **No-fix cases.** In this scenario every failure has a fix within your own service. A scenario where the shortest client deadline is below the slowest dependency has none, and the tool should say so and name the team to talk to.
- **Safe ranges on the controls.** Mark the floor and ceiling on each slider, so the safe window is visible before you drag.
- **Partial failure.** Failure rates below 100%, and recovery after the fault clears, which is where retry storms sustain themselves.

## How I worked with AI

I designed the idea, the model and the mockup in a chat session first, then built it with an AI coding assistant in small vertical slices. For each slice I had the assistant describe its changes, assumptions and verification before writing code, and review its own work afterwards for correctness, scope and complexity. Decisions where I overrode or redirected it:

- **Inputs.** I rejected typed fields in favour of bounded controls, so a reviewer cannot enter a nonsensical value.
- **The timeout rule.** I chose to accept an overall timeout below the per-attempt timeout, because it teaches how the two relate.
- **Fix buttons.** I removed the per-card "Apply fix" buttons it proposed, and kept a single button.
- **Card layout.** I rejected showing three cards at once, and the wrapped layout, after seeing them.
- **Wording.** I changed "deployed" to "proposed" throughout, since the tool runs before deployment.
- **Scope.** I cut the banner summary sentence, the check table, the failure flags on fields and the extra scenarios.

It also pushed back usefully: it found that the original edge check reported a broken config as safe, and it argued against labelling hand edits as "fixes applied".

## Time spent

About 7 hours in total: roughly an hour and a half on the idea, the mockup and this write-up, two hours planning the build with the AI assistant, and three and a half hours building. That is above the 1-2 hour target and inside the 8 hour limit. I chose to finish one scenario properly, with the explanation cards and the request path graph, and stopped there; the other scenarios were left out to respect the time expectation.

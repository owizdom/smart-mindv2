# Swarm Mind — NASA 

**Autonomous AI agents that collectively study real NASA datasets, form scientific hypotheses, and produce DA-attested research findings — without a leader.**

Built for the [EigenCloud Open Innovation Challenge](https://ideas.eigencloud.xyz/).

---

## The Idea

Three AI agents — **Kepler**, **Hubble**, and **Voyager** — independently fetch live NASA data across five domains: near-Earth asteroids, solar flares, Earth events, exoplanets, and Mars weather. They form their own hypotheses, share findings through a pheromone signal channel, and collectively synthesize what they've learned.

Nobody tells them to cooperate. Nobody tells them what to find. Above a critical signal density, they spontaneously synchronize and produce a collective report — an emergent picture of space and Earth science built from live data.

Every finding is anchored to **EigenDA** — a decentralized data availability layer backed by EigenLayer restakers. The blob commitment that comes back is not a local hash. It's a cryptographic attestation signed by restaked ETH operators.

> *"Three agents. Five NASA APIs. One collective mind. All attested on EigenDA."*

---

## Research Foundation

| Paper | Key Insight | How We Use It |
|-------|------------|---------------|
| [Emergent Collective Memory](https://arxiv.org/abs/2512.10166) | Critical density threshold — above it, agents spontaneously synchronize | Phase transition model |
| [SwarmSys](https://arxiv.org/abs/2510.10047) | Pheromone-inspired coordination without central control | Pheromone channel architecture |
| [Phase Transitions in MAS](https://arxiv.org/abs/2508.08473) | Physical phase transition analogy — gas → crystal | Density computation |
| [SwarmAgentic](https://arxiv.org/abs/2506.15672) | Particle Swarm Optimization for evolving collaboration | Swarm movement model |
| [Darwin Godel Machine](https://arxiv.org/abs/2505.22954) | Self-improving agents through Darwinian selection | Knowledge evolution via pheromone reinforcement |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PHEROMONE CHANNEL                          │
│           (shared signal space — no central coordinator)        │
│                                                                 │
│   ╔══════════════╗  ╔══════════════╗  ╔══════════════╗         │
│   ║    Kepler    ║  ║    Hubble    ║  ║   Voyager    ║         │
│   ║   Observer   ║  ║ Synthesizer  ║  ║   Analyst    ║         │
│   ║              ║  ║              ║  ║              ║         │
│   ║ fetch NASA → ║  ║ fetch NASA → ║  ║ fetch NASA → ║         │
│   ║ form thought ║  ║ synthesize   ║  ║ correlate    ║         │
│   ║ decide →     ║  ║ decide →     ║  ║ decide →     ║         │
│   ║ execute      ║  ║ execute      ║  ║ execute      ║         │
│   ╚══════════════╝  ╚══════════════╝  ╚══════════════╝         │
│          │                 │                 │                  │
│          ▼                 ▼                 ▼                  │
│     [pheromone]       [pheromone]       [pheromone]            │
│     asteroid data     solar context     cross-domain           │
│          │                 │                 │                  │
│          └─────────────────┼─────────────────┘                 │
│                            │                                    │
│               ┌────────────▼────────────┐                      │
│               │   DENSITY > THRESHOLD?  │                      │
│               └────────────┬────────────┘                      │
│                            │ YES                                │
│               ╔════════════▼════════════╗                      │
│               ║     PHASE TRANSITION    ║                      │
│               ║   Collective memory     ║                      │
│               ║   LLM narrative report  ║                      │
│               ║   EigenDA anchoring     ║                      │
│               ╚═════════════════════════╝                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │       EigenDA           │
              │  blob → KZG commitment  │
              │  attested by restakers  │
              └─────────────────────────┘
```

---

## How It Works

### Phase 1 — Exploration

Each agent scans its assigned NASA domain, caches the dataset, and emits a pheromone summary. Cross-pollination happens when an agent absorbs a peer's pheromone and follows its domain.

```
Density: ░░░░░░░░░░░░░░░░░░░░ 0.08
Kepler  → scanning near earth objects
Hubble  → scanning solar flares
Voyager → scanning exoplanets
```

### Phase 2 — Deep Analysis

As pheromone density grows, agents begin full LLM-powered science steps:

1. **Think** — form a hypothesis from what they've observed and absorbed
2. **Decide** — score candidate actions (`analyze_dataset`, `correlate_findings`, `share_finding`, `explore_topic`)
3. **Execute** — fetch real NASA data, run LLM analysis, emit a finding pheromone
4. **Persist** — finding written to SQLite + dispersed to EigenDA asynchronously

```
Density: ██████░░░░░░░░░░░░░░ 0.34
Kepler  → analyzing Asteroid & Comet Close Approaches
Hubble  → correlating solar flares + earth events
Voyager → sharing finding: exoplanet habitability patterns
tokens: 18.4k / 150k
```

### Phase 3 — Phase Transition

Density crosses the critical threshold. Agents synchronize. The swarm generates a **collective report** — an LLM-written narrative with:

- Overview of what was studied
- Key findings with data references
- The swarm's own opinionated take
- What could have been done better
- A final verdict

The collective memory is immediately anchored to EigenDA.

```
Density: ████████████████████ 0.62
⚡ PHASE TRANSITION — COLLECTIVE INTELLIGENCE
[COLLECTIVE] Anchoring to EigenDA: 0x3af7b2c1…
```

---

## EigenDA Attestation

Every pheromone and collective memory goes through a two-stage attestation process:

```
Agent emits finding
        │
        ▼
SHA-256 hash (immediate, local)
        │
        ▼  async, fire-and-forget
EigenDA Proxy → Disperser → EigenLayer Operators
        │
        ▼
KZG commitment returned
        │
        ▼
pheromone.attestation = "eigenda:0x3af7b2c1…"
stored in SQLite + queryable via /api/da-status
```

The commitment is a KZG polynomial commitment to the blob, signed by operators who have restaked ETH on EigenLayer. It's verifiable, decentralized, and proportional in strength to the restaked collateral behind the quorum.

**Collective memories** — the high-value synthesized outputs — are always anchored. Individual pheromones and thoughts are anchored best-effort in the background.

---

## NASA Data Sources

| Dataset | API | What Agents Study |
|---------|-----|------------------|
| Near-Earth Objects | NASA NeoWs | Asteroid/comet close approaches, velocities, diameters, hazard rates |
| Solar Flares | NASA DONKI | X/M/C class flares, daily averages, peak events |
| Earth Events | NASA EONET | Active wildfires, storms, volcanoes, sea ice — real-time |
| Exoplanets | NASA Exoplanet Archive | Confirmed planets since 2022, super-Earths, hot Jupiters, habitable zone candidates |
| Mars Weather | Curiosity REMS | Surface temperatures, pressure, dust storm season, mission sol count |

All data is fetched live via public NASA REST APIs. A 15-minute in-memory cache prevents rate limit exhaustion (NASA DEMO_KEY supports 30 req/hr; a real key lifts this to 1,000/hr).

---

## Quick Start

```bash
git clone <repo>
cd swarm-mind
npm install
cp .env.example .env        # or edit .env directly
# Add your Anthropic API key and NASA API key
npm run build
npm start
# Open http://localhost:3000
```

### With EigenDA attestation (local dev)

```bash
# Terminal 1 — EigenDA Proxy in memory-store mode (no wallet needed)
docker run -p 4242:4242 ghcr.io/layr-labs/eigenda-proxy:latest --memstore.enabled

# .env
EIGENDA_PROXY_URL=http://localhost:4242

# Terminal 2
npm start
```

### With EigenDA on Holesky (real restaker attestation)

```bash
docker run -p 4242:4242 ghcr.io/layr-labs/eigenda-proxy:latest \
  --eigenda-disperser-rpc=disperser-holesky.eigenda.xyz:443 \
  --eigenda-eth-rpc=https://ethereum-holesky-rpc.publicnode.com \
  --eigenda-svc-manager-addr=0xD4A7E1Bd8015057293f0D0A557088c286942e84b \
  --eigenda-signer-private-key-hex=YOUR_FUNDED_PRIVATE_KEY
```

---

## Configuration

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `SWARM_SIZE` | `3` | Number of agents (Kepler, Hubble, Voyager) |
| `SYNC_INTERVAL_MS` | `1500` | Time between swarm steps |
| `PHEROMONE_DECAY` | `0.05` | How fast pheromone strength fades |
| `CRITICAL_DENSITY` | `0.35` | Density threshold for phase transition |
| `DASHBOARD_PORT` | `3000` | Dashboard port |
| `MAX_STEPS` | `0` | Total steps (0 = run forever) |

### LLM

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `anthropic` | Provider: `anthropic`, `openai`, `eigenai` |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | Model to use |
| `TOKEN_BUDGET_PER_AGENT` | `50000` | Max tokens per agent before fallback to scan-only |
| `ENGINEERING_STEP_INTERVAL_MS` | `10000` | Step interval during deep analysis |

### NASA

| Variable | Default | Description |
|----------|---------|-------------|
| `NASA_API_KEY` | `DEMO_KEY` | NASA API key (30 req/hr with DEMO_KEY, 1000/hr with real key) |

### EigenDA

| Variable | Default | Description |
|----------|---------|-------------|
| `EIGENDA_PROXY_URL` | unset | EigenDA Proxy URL — leave unset to use local hash attestation only |

---

## Agent Personalities

Each agent has a personality vector that shapes how it prioritizes actions:

| Agent | Preset | Curiosity | Diligence | Boldness | Sociability | Natural Tendency |
|-------|--------|-----------|-----------|----------|-------------|-----------------|
| Kepler | Observer | 0.9 | 0.7 | 0.3 | 0.5 | Explores widely, notices subtle patterns |
| Hubble | Synthesizer | 0.6 | 0.5 | 0.4 | 0.95 | Cross-pollinates, shares findings freely |
| Voyager | Analyst | 0.5 | 0.9 | 0.7 | 0.4 | Deep analysis, confident conclusions |

Personalities are perturbed by ±0.04 at startup so each run is unique.

---

## Decision Scoring

When an agent picks its next action, candidates are scored:

| Factor | Weight | Description |
|--------|--------|-------------|
| Action priority | 0.25 | `analyze_dataset` > `share_finding` > `correlate` > `explore` |
| Cost efficiency | 0.25 | Prefer cheaper actions when token budget is low |
| Novelty | 0.15 | Bonus for action types not done recently |
| Personal fit | 0.15 | Personality match (curious agents prefer exploration, sociable prefer sharing) |
| Swarm bonus | 0.10 | Post-transition bonus for `correlate_findings` |

Selection uses softmax with temperature 0.3 — deterministic enough to follow priorities, random enough to avoid lockstep.

---

## What the Dashboard Shows

Live at `http://localhost:3000`:

**Header pills** — step, pheromone count, discoveries, sync status, tokens, channel density

**Canvas (Live tab)** — agents as colored particles moving through 2D space, pheromone signals, sync lines post-transition, chat bubbles showing latest thoughts, click any agent to focus

**Agents tab** — grid of agent cards with token usage, thought count, datasets analyzed, latest finding

**Thoughts tab** — real-time stream of agent reasoning conclusions with confidence scores

**Pheromones tab** — all active signals, color-coded by domain, decaying over time

**Collective tab** — LLM-written narrative reports generated at phase transition: overview, key findings, opinions, what could be better, verdict

**Report tab** — full swarm summary: datasets analyzed by each agent, top insights, agent summaries

**`/api/da-status`** — JSON endpoint showing EigenDA attestation coverage: how many pheromones and memories have been DA-certified, their commitments

---

## File Structure

```
swarm-mind/
├── agents/
│   ├── types.ts          # All type definitions (Pheromone, Agent, Science, DA types)
│   ├── agent.ts          # SwarmAgent — exploration, science steps, pheromone emission
│   ├── swarm.ts          # Main orchestrator (continuous loop, phase transition)
│   ├── science.ts        # NASA API fetchers with 15-min in-memory cache
│   ├── thinker.ts        # LLM reasoning — thoughts, dataset analysis, collective reports
│   ├── decider.ts        # Decision scoring and softmax selection
│   ├── executor.ts       # Action handlers (analyze, share, correlate, explore)
│   ├── eigenda.ts        # EigenDA Proxy client — disperseBlob, retrieveBlob, disperseAsync
│   └── persistence.ts    # SQLite + EigenDA hybrid persistence
├── dashboard/
│   ├── index.html        # Real-time visualization (canvas, tabs, collective reports)
│   └── server.ts         # Express API (state, agents, thoughts, pheromones, da-status)
├── scripts/
│   └── deploy.sh         # EigenCompute deployment
├── .env                  # Configuration (gitignored)
├── Dockerfile            # linux/amd64 for TEE deployment
├── package.json
├── tsconfig.json
└── README.md
```

---

## Persistence & Data Layer

```
┌─────────────────────────────────────────┐
│            swarm-mind.db (SQLite)       │
│                                         │
│  agents              — identity, budget │
│  thoughts            — reasoning chains │
│  decisions           — action log       │
│  pheromones          — findings + DA ID │
│  collective_memories — reports + DA ID  │
└──────────────────┬──────────────────────┘
                   │ eigenda_commitment column
                   ▼
┌─────────────────────────────────────────┐
│              EigenDA                    │
│                                         │
│  blob: { id, content, domain,           │
│          confidence, timestamp, … }     │
│                                         │
│  commitment: 0x3af7b2c1… (KZG)         │
│  attested by: EigenLayer restakers      │
└─────────────────────────────────────────┘
```

SQLite is the fast operational index. EigenDA is the trust layer. Every important record has both a local row and a DA commitment. On restart, agents start fresh but the full history (with DA certificates) is preserved.

---

## Verification

Check attestation status at runtime:

```bash
curl http://localhost:3000/api/da-status | jq .
```

```json
{
  "enabled": true,
  "proxyUrl": "http://localhost:4242",
  "pheromones": {
    "total": 47,
    "attested": 44,
    "latest": [
      {
        "id": "uuid",
        "domain": "near earth objects",
        "commitment": "0x3af7b2c1d4e5f6a7…",
        "timestamp": 1771305091583
      }
    ]
  },
  "collectiveMemories": {
    "total": 3,
    "attested": 3,
    "items": [...]
  }
}
```

Each commitment can be verified against the EigenDA disperser independently — no trust in this server required.

---

## Key Design Decisions

1. **Real data, not simulated** — Agents fetch live NASA APIs every step. The swarm's knowledge evolves as actual space weather changes.

2. **Hybrid DA layer** — SQLite for fast operational access, EigenDA for decentralized attestation. Commitments bridge both worlds.

3. **Async attestation** — EigenDA disperse is fire-and-forget so agent steps are never blocked by DA latency. The commitment updates in-place when confirmed.

4. **LLM-generated opinions** — Collective reports are written by the LLM in first person ("our analysis suggests…"), not just data dumps. The swarm forms actual opinions.

5. **Personality differentiation** — Distinct curiosity/diligence/boldness/sociability values cause natural specialization without hard-coded roles.

6. **Budget-gated** — Each agent has a token budget. When exhausted, it falls back to lightweight scan-only mode. No runaway costs.

7. **Cross-pollination** — When absorbing a strong peer pheromone, agents switch their `explorationTarget` to follow it. Knowledge propagates organically.

---

## Deploy to EigenCompute

```bash
curl -fsSL https://raw.githubusercontent.com/Layr-Labs/eigencloud-tools/master/install-all.sh | bash
ecloud auth generate --store
bash scripts/deploy.sh
```

The Dockerfile targets `linux/amd64` for TEE environments. Each agent runs in its own isolated context; the pheromone channel is the only shared state.

---

## The Journey — From GitHub Engineering to Science

This project went through two fundamentally different lives before arriving at what it is today. Understanding that evolution is essential to understanding why the architecture is what it is — and how much complexity lives underneath a clean interface.

### v1 — The Pheromone Collective

The project began as a pure emergent intelligence experiment. Six agents, no instructions, no leader. They scraped Wikipedia, ArXiv, and Hacker News, dropped pheromone signals when they found something interesting, and absorbed each other's signals to cross-pollinate across knowledge domains.

The physics analogy was the core insight: below a critical signal density, agents behave like gas molecules — independent, random, uncorrelated. Above it, they spontaneously synchronize, like gas crystallizing into a solid. Nobody programmed that transition. It emerges from the density math.

What v1 proved: you don't need a coordinator. Coordination is an emergent property of signal density.

### v2 — The GitHub Engineering Machine

The next version was a complete autonomous engineering platform. Agents didn't just read — they **acted**. Each agent could:

- Discover trending GitHub repos using the `gh` CLI
- Clone them locally, score files by relevance, read READMEs and recent commits
- Analyze open issues, pick the ones within their skill range
- Generate a multi-step execution plan with the LLM
- Write code changes, self-review up to 3 times, iterate
- Prepare pull requests — sandboxed locally by default, reviewable before pushing

Eight distinct action types. A full plan-implement-review loop. Budget tracking per agent. A `FileScore` system to rank which files in a repo were worth reading. A sandbox log so you could inspect what agents *would* have pushed. `simple-git` for cloning and branching. The `gh` CLI wrapping GitHub's REST API.

The executor had handlers for `study_repo`, `analyze_issue`, `fix_issue`, `contribute_pr`, `explore_topic`, `review_code`, `generate_code`, and `share_technique`. The type system had `GitHubRepo`, `GitHubIssue`, `RepoContext`, `FileScore`, `CodeChange`, `ExecutionPlan`, `ReviewFeedback`, and `EngineeringPheromone` — each with its own logic, its own LLM prompts, its own persistence paths.

It was genuinely complex. A real autonomous engineering pipeline, not a toy.

### The Collective Intelligence Problem

As the engineering pipeline matured, a different problem surfaced: **what does the swarm actually know?**

The Collective tab showed raw merged strings. Not useful. The first fix was categorized sections — techniques discovered, gaps identified, things learned. Better, but still mechanical.

Then came the real insight: the collective should read like a **research report written by someone who cares**. Not a data dump — an opinion. The swarm should form its own take on what it studied, what was missing, what surprised it, what it would do differently.

This required making `synthesizeCollectiveMemory` async, calling the LLM to write a full narrative with overview, key findings, opinions, improvements, and a verdict. The LLM writes in first person as the swarm. The collective memory became a document, not a log.

### The Pivot — One Message, Full Rewrite

> *"look, how about it works on science nasa problem, it actively studies dataset and give the findings?"*
> *"remove all the github mode and only make it solely on nasa."*

Two messages. Everything changed.

Removing GitHub mode meant deleting approximately 800 lines of carefully built infrastructure:

- `github.ts` — entirely deleted (gh CLI wrappers, repo context builder, file scorer, git operations, sandbox logger)
- `thinker.ts` — stripped of `analyzeRepo`, `analyzeIssue`, `reviewCode`, `generateCode`
- `executor.ts` — full rewrite, zero GitHub imports
- `decider.ts` — full rewrite, new action types
- `agent.ts` — full rewrite, new agent names, new loop
- `types.ts` — 9 GitHub-specific interfaces removed

Eight action types became four: `analyze_dataset`, `share_finding`, `correlate_findings`, `explore_topic`.

Then the new problem: **real NASA data is harder than it looks.** Five APIs, five completely different response shapes.

NeoWs returns a date-keyed object of arrays of asteroid objects, each with nested `close_approach_data` arrays containing `relative_velocity` objects containing `kilometers_per_hour` strings. Parsing a velocity requires four levels of optional chaining. DONKI solar flares are a flat array — manageable — but the class type is a string like `"X2.3"` that you split on the letter to extract the magnitude. EONET Earth events have a categories array per event with an `id` field you match against hardcoded strings like `"wildfires"` and `"severeStorms"`. The Exoplanet Archive uses TAP — you write SQL in a URL query parameter and get back JSON rows. InSight Mars weather was shut down in 2022, so Mars data is modeled from Curiosity REMS seasonal patterns and mission sol count arithmetic.

Each fetcher needed a 15-minute in-memory cache, graceful failure handling, and a structured `ScienceDataset` output that gave the LLM enough context to reason scientifically without drowning it in raw JSON.

### The TypeScript Complexity

The type system fought back at every step.

When `ScienceDataset.stats` was typed as `Record<string, string | number>`, TypeScript rejected the solar flare empty-state object. The problem: when TypeScript unifies the two return shapes of the `cached()` lambda into a union, the fallback object (`{ totalFlares: 0 }`) gets optional `xClass?: undefined` injected from the other union member, and `undefined` isn't assignable to `string | number`. The fix was `Record<string, unknown>` in the interface, plus explicit `Promise<ScienceDataset>` return type annotations on the lambda arguments so TypeScript could narrow the union properly.

The executor's null vs. undefined mismatch — `Array.find()` returns `T | undefined`, `fetchDataset()` returns `T | null` — broke assignment. Required `?? null` initialization to unify the types before the conditional branch.

`github.ts`, after its types were stripped from `types.ts`, left `persistence.ts` importing a `GitHubRepo` type that no longer existed — cascading errors that had to be traced and unwound through two files.

Thirteen TypeScript errors. Fixed methodically. Build clean.

### The EigenDA Layer

The final layer was the hardest conceptually: **how do you prove these findings are real?**

The existing attestation was a SHA-256 hash. Local. Proves nothing to anyone outside this process. Anyone can compute `sha256(content + agentId + timestamp)`.

EigenDA changes the question. Instead of "can I verify this hash?" it becomes: "can I verify that a quorum of EigenLayer operators — with real restaked ETH behind them — confirmed the availability of this data?"

The blob commitment returned by EigenDA is a KZG polynomial commitment. It commits to the entire blob content verifiably in O(1) with a proof. The commitment is only issued after EigenDA operators receive their chunk of the blob and sign their attestation. The security is economic: operators have restaked ETH that gets slashed if they lie.

Integrating EigenDA was an architecture problem as much as a coding problem. It is not a database. No indexes, no queries, no update semantics. You write a blob, you get a commitment, you read by commitment. That's the entire API surface.

The solution was a hybrid persistence model:

- **SQLite** — fast operational index. Agent state, recent thoughts, action log, quick lookups.
- **EigenDA** — trust layer. Every important record dispersed asynchronously.
- **`eigenda_commitment` column in SQLite** — bridges both worlds. Local speed, decentralized proof.

The async design was critical. EigenDA disperse takes seconds. Agent steps happen every 1.5 seconds. Blocking on DA confirmation would freeze the simulation. `disperseAsync()` fires in the background and updates the SQLite record with the commitment when it arrives. The agent is already three steps ahead before EigenDA responds.

Schema migration had to handle existing databases gracefully — `ALTER TABLE ... ADD COLUMN` wrapped in try-catch for idempotency, since SQLite has no `IF NOT EXISTS` for column additions. Three new tables. A `/api/da-status` endpoint. The `saveCollectiveMemory` function always anchors synchronously (collective memories are the high-value output), while thoughts and pheromones anchor best-effort.

### What Makes This Hard

The surface area is deceptive. The dashboard looks like a visualization with agent cards. Underneath:

**Emergent synchronization from first principles.** Density math, pheromone decay, phase transition detection — none of it is hardcoded. The synchronization at step 20 happens because the math produces it, not because there's an `if step === 20` somewhere.

**Five heterogeneous NASA APIs** parsed into a single unified type, each with its own rate limits, response structures, failure modes, fallback logic, and caching strategy.

**LLM reasoning at four different levels simultaneously** — individual thoughts, scientific dataset analysis, cross-domain correlation, and collective narrative reports — each with different system prompts, JSON parsing, error handling, and token accounting.

**Softmax decision selection** with temperature, personality weighting, novelty bonuses, budget constraints, swarm-state awareness, and re-analysis probability. Not a random picker. A probabilistic optimizer.

**Async everything.** Parallel agent steps with `Promise.allSettled`, background EigenDA disperse with in-place SQLite updates, 15-minute API cache, 30-second fetch timeouts, graceful degradation at every layer. Any one of these failing silently should not crash the swarm.

**A strict TypeScript type system** across 10+ files with discriminated union actions, generic constraints, and exhaustive null checking — that caught real logic bugs during the refactor, not just style issues.

**A real-time dashboard** running canvas animation, tab panels, chat bubbles, agent focus, pheromone rendering, and phase transition effects on a 2-second polling loop — coordinated with an Express API serving 10 endpoints.

The shift from GitHub to NASA wasn't a theme change. It was a rebuild of the knowledge acquisition layer, the analysis layer, the action layer, the persistence layer, and the attestation layer — while keeping the core pheromone-phase-transition architecture intact across the entire rewrite.

That core survived because it was sound from the beginning.

---

## References

- [Emergent Collective Memory in Decentralized Multi-Agent AI Systems](https://arxiv.org/abs/2512.10166)
- [SwarmSys: Decentralized Swarm-Inspired Agents](https://arxiv.org/abs/2510.10047)
- [A Minimal Model for Emergent Collective Behaviors in Multi-Agent Systems](https://arxiv.org/abs/2508.08473)
- [SwarmAgentic: Towards Fully Automated Agentic System Generation](https://arxiv.org/abs/2506.15672)
- [Darwin Godel Machine: Open-Ended Evolution of Self-Improving Agents](https://arxiv.org/abs/2505.22954)
- [EigenDA Documentation](https://docs.eigenda.xyz)
- [EigenLayer Documentation](https://docs.eigenlayer.xyz)
- [EigenDA Proxy](https://github.com/Layr-Labs/eigenda-proxy)
- [EigenCloud AI Quickstart](https://github.com/Layr-Labs/ai-quickstart)

# Emergent Swarm Mind v2

**Autonomous engineering agents that develop collective intelligence, browse GitHub, form independent thoughts, and ship code — without a leader.**

Built for the [EigenCloud Open Innovation Challenge](https://ideas.eigencloud.xyz/).

---

## The Idea

Take 6 AI agents. Put each in its own Trusted Execution Environment. Give them no shared database, no central coordinator, no instructions to cooperate.

**v1** had them explore knowledge domains and synchronize through pheromone signals.

**v2** gives them true autonomy: they browse GitHub, study real repositories, form independent engineering opinions, decide what to build or fix, generate code, self-review, and prepare pull requests — all while maintaining the emergent collective intelligence from v1.

Each agent has a distinct **personality** (Explorer, Fixer, Builder, Synthesizer, Generalist, Pioneer) that shapes what it notices, what it decides to work on, and how bold its contributions are.

Sandbox mode (default) means all code changes stay local in `workspace/` until you review and push them yourself.

> *"Nobody told these agents to cooperate. Nobody told them what to build. Watch what happens."*

## Research Foundation

Grounded in real 2025-2026 research:

| Paper | Key Insight | How We Use It |
|-------|------------|---------------|
| [Emergent Collective Memory](https://arxiv.org/abs/2512.10166) | Critical density threshold — above it, agents spontaneously synchronize | Phase transition model |
| [SwarmSys](https://arxiv.org/abs/2510.10047) | Pheromone-inspired coordination without central control | Pheromone channel architecture |
| [Phase Transitions in MAS](https://arxiv.org/abs/2508.08473) | Physical phase transition analogy — gas → crystal | Density computation |
| [SwarmAgentic](https://arxiv.org/abs/2506.15672) | Particle Swarm Optimization for evolving collaboration | Swarm movement model |
| [Darwin Godel Machine](https://arxiv.org/abs/2505.22954) | Self-improving agents through Darwinian selection | Knowledge evolution via pheromone reinforcement |

Additionally, v2's engineering pipeline draws from:
- **[mind-agent](https://github.com/owizdom)** pattern: GitHub monitoring, smart file scoring, context building, SQLite persistence
- **[nightshift](https://github.com/marcus)** pattern: Plan-implement-review loop, LLM-powered code gen, task scoring, budget tracking

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PHEROMONE CHANNEL                                │
│              (shared signal space — no central coordinator)              │
│                                                                          │
│   ╔════════════╗  ╔════════════╗  ╔════════════╗  ╔════════════╗        │
│   ║  TEE-A     ║  ║  TEE-B     ║  ║  TEE-C     ║  ║  TEE-D     ║  ...  │
│   ║  Explorer  ║  ║  Fixer     ║  ║  Builder   ║  ║ Synthesizer║        │
│   ║            ║  ║            ║  ║            ║  ║            ║        │
│   ║ think →    ║  ║ think →    ║  ║ think →    ║  ║ think →    ║        │
│   ║ decide →   ║  ║ decide →   ║  ║ decide →   ║  ║ decide →   ║        │
│   ║ execute    ║  ║ execute    ║  ║ execute    ║  ║ execute    ║        │
│   ╚════════════╝  ╚════════════╝  ╚════════════╝  ╚════════════╝        │
│        │               │               │               │                │
│        ▼               ▼               ▼               ▼                │
│   [pheromone]     [pheromone]     [pheromone]     [pheromone]           │
│   knowledge /     code / PR /     technique /     knowledge /           │
│   analysis        fix             cross-domain    synthesis             │
│        │               │               │               │                │
│        └───────────────┴───────┬───────┴───────────────┘                │
│                                │                                        │
│                    ┌───────────▼───────────┐                            │
│                    │  DENSITY > THRESHOLD? │                            │
│                    └───────────┬───────────┘                            │
│                                │ YES                                    │
│                    ╔═══════════▼═══════════╗                            │
│                    ║    PHASE TRANSITION   ║                            │
│                    ║    ═══════════════    ║                            │
│                    ║  Collective memory    ║                            │
│                    ║  Collaborative projects║                           │
│                    ║  Coordinated PRs      ║                            │
│                    ╚═══════════════════════╝                            │
└──────────────────────────────────────────────────────────────────────────┘
```

## How It Works

### Phase 1: Exploration (Steps 0-5)

Pure v1 behavior. Each agent explores its assigned knowledge domain via Wikipedia, ArXiv, and Hacker News. They drop pheromones, absorb others', and build cross-domain bridges.

```
Density: ░░░░░░░░░░░░░░░░░░░░ 0.082
Agents behave independently. No engineering yet.
```

### Phase 2: Progressive Engineering (Steps 5-40)

Engineering probability ramps from ~20% to ~80%. Agents start:

1. **Thinking** — LLM-powered reasoning about what they've observed
2. **Discovering** — Browsing GitHub for repos matching their interests
3. **Deciding** — Scoring candidate actions (fix issue? study repo? share technique?)
4. **Executing** — Plan → implement → self-review → iterate (up to 3x) → ship

```
Density: ██████░░░░░░░░░░░░░░ 0.340
[A:studying] [B:fixing] [D:thinking] | tokens 12.4k
```

### Phase 3: Phase Transition

Density crosses the critical threshold. Agents synchronize. Post-transition:
- Collective memories synthesize multi-agent knowledge
- Collaborative projects detected when agents work on the same repo
- Engineering becomes dominant (~80% of steps)

```
Density: ████████████████████ 0.620
█████████████████████████████████████████████████
█  PHASE TRANSITION — COLLECTIVE INTELLIGENCE   █
█████████████████████████████████████████████████
```

### Phase 4: Autonomous Collective (Steps 40+)

The swarm runs continuously (infinite by default). Agents form thoughts, make decisions, generate code, create PRs — all sandboxed locally. Budget-gated: when an agent exhausts its token budget, it falls back to exploration-only.

## Quick Start

```bash
git clone <repo>
cd swarm-mind
npm install
cp .env.example .env
# Edit .env with your LLM API key (EigenAI, OpenAI, or Anthropic)
npm run build
npm start
# Open http://localhost:3000
```

### Development Mode

```bash
npm run dev
# Auto-restarts on file changes
```

### Without an LLM API Key

The swarm runs fine without an API key — agents explore via web scraping (v1 behavior). Engineering mode (GitHub browsing, code generation, PR creation) requires an LLM provider.

## Configuration

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `SWARM_SIZE` | `6` | Number of agents |
| `SYNC_INTERVAL_MS` | `3000` | Time between exploration steps |
| `PHEROMONE_DECAY` | `0.15` | How fast pheromones fade (0-1) |
| `CRITICAL_DENSITY` | `0.6` | Density threshold for phase transition |
| `DASHBOARD_PORT` | `3000` | Dashboard port |

### Engineering Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `eigenai` | LLM provider: `eigenai`, `openai`, or `anthropic` |
| `EIGENAI_API_URL` | `https://api.eigenai.xyz/v1` | EigenAI endpoint |
| `EIGENAI_API_KEY` | — | EigenAI API key |
| `EIGENAI_MODEL` | `gpt-oss-120b-f16` | EigenAI model |
| `TOKEN_BUDGET_PER_AGENT` | `50000` | Max tokens each agent can spend |
| `ENGINEERING_STEP_INTERVAL_MS` | `10000` | Slower step interval during engineering |
| `MAX_STEPS` | `0` | Total steps (0 = run forever) |

### GitHub & Safety

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_MODE` | `true` | If true, PRs are logged locally instead of pushed |
| `GITHUB_DISCOVERY_TOPICS` | `typescript,rust,...` | Comma-separated topics for repo discovery |

### Using Different LLM Providers

```bash
# EigenAI (default)
LLM_PROVIDER=eigenai
EIGENAI_API_KEY=your_key

# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Anthropic (via OpenAI-compatible endpoint)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### Deploy to EigenCompute

```bash
curl -fsSL https://raw.githubusercontent.com/Layr-Labs/eigencloud-tools/master/install-all.sh | bash
ecloud auth generate --store
bash scripts/deploy.sh
```

## Agent Personalities

Each agent gets a distinct personality that affects its behavior:

| Preset | Curiosity | Diligence | Boldness | Sociability | Tendency |
|--------|-----------|-----------|----------|-------------|----------|
| Explorer | 0.9 | 0.4 | 0.3 | 0.6 | Discovers many repos, explores widely |
| Fixer | 0.3 | 0.9 | 0.7 | 0.4 | Focuses on issues, thorough reviews |
| Builder | 0.5 | 0.6 | 0.9 | 0.3 | Tackles hard problems, submits PRs |
| Synthesizer | 0.7 | 0.5 | 0.4 | 0.9 | Cross-pollinates knowledge between agents |
| Generalist | 0.6 | 0.6 | 0.6 | 0.6 | Balanced across all activities |
| Pioneer | 0.8 | 0.3 | 0.9 | 0.5 | Explores new territory, takes risks |

## Decision Scoring

When an agent decides what to do next, candidates are scored with weighted factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Cost efficiency | 0.25 | Prefer cheaper actions when budget is low |
| Priority weight | 0.20 | Base priority by action type (fix_issue=0.9, explore_topic=0.4) |
| Risk penalty | 0.20 | Penalize risky actions when budget is low |
| Staleness bonus | 0.15 | Prefer actions the agent hasn't done recently |
| Swarm alignment | 0.10 | Post-transition bonus for engineering actions |
| Personal fit | 0.10 | Personality match (bold agents prefer PRs, curious prefer exploring) |

Selection uses softmax with temperature — some randomness prevents all agents from doing the same thing.

## Sandbox Mode

By default (`SANDBOX_MODE=true`), agents can:
- Discover and analyze GitHub repos
- Clone repos locally to `workspace/`
- Generate code changes
- Self-review with the plan-implement-review loop

But they **cannot**:
- Push commits to remote repos
- Create actual pull requests

Instead, these actions are logged to `workspace/sandbox-log.json`. You can review what agents *would* have done and push manually.

Set `SANDBOX_MODE=false` to enable auto-push (use with caution).

## What the Dashboard Shows

Real-time visualization at `http://localhost:3000`:

**Header:**
- Step counter, pheromone count, discovery count, sync status
- Token usage counter, PR count

**Canvas (main area):**
- Colored particles = agents moving through 2D space
- Action labels near agents ("studying repo", "fixing issue", "thinking...")
- Color-coded pheromone particles: blue=knowledge, green=code, gold=PR, purple=technique
- Sync lines post-transition, flash effect on phase transition
- PR burst effect when a PR is created

**Side Panel:**
- Agent list with current action + PR count
- Collective memories (post-transition)
- Agent thought stream (conclusions + suggested actions)

**Bottom Panel:**
- Decision log — agent, action type, status (color-coded)
- GitHub activity — repos studied, issues found, PRs created/sandboxed
- Domain coverage — bar chart of pheromone counts per domain

## File Structure

```
swarm-mind/
├── agents/
│   ├── types.ts          # All type definitions (Pheromone, Agent, Engineering types)
│   ├── agent.ts          # SwarmAgent class (exploration + engineering mode)
│   ├── swarm.ts          # Main orchestrator (continuous loop, parallel steps)
│   ├── scraper.ts        # Web knowledge discovery (Wikipedia, ArXiv, HN)
│   ├── github.ts         # GitHub integration (gh CLI, repo context, sandbox)
│   ├── thinker.ts        # LLM reasoning engine (thoughts, code gen, review)
│   ├── decider.ts        # Decision scoring and selection
│   ├── executor.ts       # Plan-implement-review execution loop
│   └── persistence.ts    # SQLite state persistence
├── dashboard/
│   ├── index.html        # Real-time visualization (canvas + panels)
│   └── server.ts         # Express API (state, thoughts, decisions, repos, PRs)
├── workspace/            # Cloned repos + sandbox logs (gitignored)
├── scripts/
│   └── deploy.sh         # EigenCompute deployment
├── .env.example          # Configuration template
├── Dockerfile            # linux/amd64 for TEE
├── package.json
├── tsconfig.json
└── README.md
```

## Persistence

Agent state is persisted to `swarm-mind.db` (SQLite) every 10 steps and on graceful shutdown (Ctrl+C). Tables:

- `agents` — personality, token usage, repos studied, PRs created
- `thoughts` — full reasoning chains with confidence scores
- `decisions` — action, priority, cost, status, result
- `repos` — discovered GitHub repos with relevance scores
- `prs_created` — PR URLs and status
- `scan_history` — discovery queries and results

On restart, the swarm creates fresh agents but the database retains history for analysis.

## Verification & Attestation

Every pheromone carries a SHA-256 attestation hash. Every collective memory traces back to contributing pheromones and agents. The TEE proves no central coordinator existed.

```json
{
  "id": "uuid",
  "agentId": "TEE-wallet-address",
  "content": "Studied owner/repo: well-structured TypeScript project...",
  "pheromoneType": "code",
  "artifacts": [{"type": "code_change", "content": "..."}],
  "githubRefs": ["owner/repo"],
  "attestation": "sha256:...",
  "timestamp": 1771305091583
}
```

## Key Design Decisions

1. **Extend, don't replace** — All v2 types extend v1 via TypeScript `extends`. Existing pheromone/phase-transition logic is untouched.

2. **Sandbox by default** — Code changes stay local. User reviews before anything is pushed.

3. **Parallel agent steps** — `Promise.allSettled()` so LLM/GitHub I/O doesn't block other agents.

4. **Progressive engagement** — Steps 0-5 are pure exploration. Engineering ramps from 20% to 80% over 40 steps. Agents build knowledge before acting on it.

5. **Budget-gated** — Each agent has a token budget. When exhausted, it falls back to exploration-only. No runaway costs.

6. **Personality differentiation** — Distinct curiosity/diligence/boldness/sociability values cause natural specialization.

## References

- [Emergent Collective Memory in Decentralized Multi-Agent AI Systems](https://arxiv.org/abs/2512.10166)
- [SwarmSys: Decentralized Swarm-Inspired Agents for Scalable and Adaptive Reasoning](https://arxiv.org/abs/2510.10047)
- [A Minimal Model for Emergent Collective Behaviors in Autonomous Robotic Multi-Agent Systems](https://arxiv.org/abs/2508.08473)
- [SwarmAgentic: Towards Fully Automated Agentic System Generation via Swarm Intelligence](https://arxiv.org/abs/2506.15672)
- [Darwin Godel Machine: Open-Ended Evolution of Self-Improving Agents](https://arxiv.org/abs/2505.22954)
- [Virtual Agent Economies](https://arxiv.org/abs/2509.10147)
- [Self-Evolving AI Agents Survey](https://arxiv.org/abs/2508.07407)
- [EigenCompute Documentation](https://docs.eigencloud.xyz)
- [EigenCloud AI Quickstart](https://github.com/Layr-Labs/ai-quickstart)

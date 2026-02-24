# Swarm Mind

**Multi-agent AI with verifiable independent convergence**

Three autonomous agents reason over real NASA science data in complete isolation. Before any of them sees each other's work, each one seals its findings cryptographically. After all three reveal, you can prove the convergence was independent — not copied.

---

## Start Here: The Hardest Problem in Verifiability

### The message dissemination problem

The most impactful unsolved problem in distributed verifiability is deceptively simple to state: **can you prove that node B received a message from node A?**

The answer is no — and the proof of impossibility is informative about what you can and cannot build.

Non-repudiation of *origin* is achievable. If A signs a message with a private key, any party who holds the corresponding public key can verify that A produced that exact message. RFC 2479 formalizes this as "proof of origin evidence." But non-repudiation of *receipt* is a different evidence class entirely — it requires B to produce a signed acknowledgment, and there is no protocol mechanism that forces B to return that acknowledgment without B's active cooperation. RFC 2479 defines this as a separate, harder requirement. If B refuses to acknowledge, or if the network drops the packet, origin signatures are silent on the question of delivery.

In distributed networks, this becomes the message adversary problem studied in reliable broadcast theory. Byzantine Reliable Broadcast (BRB) protocols can guarantee that all honest nodes eventually deliver the same message — but only under explicit assumptions about quorum membership, network synchrony, and the fraction of Byzantine actors. Every such guarantee requires extra protocol-level machinery beyond raw message signing. If a node can silently drop or delay messages, no amount of post-hoc signature verification can reconstruct the delivery history.

The takeaway for system design: **proving who sent something is easy. Proving who received something, and when, is a protocol-design problem that cannot be solved at the cryptographic primitive level.** This means any claim about multi-agent independence that relies on "agent B never received agent A's message" is unprovable in general. You need a different approach.

### What we do instead

We reframe the problem. Instead of trying to prove that agents never communicated (impossible), we prove something weaker but still sufficient:

> **Each agent's analysis was cryptographically sealed to an externally-verifiable record before the earliest possible moment any peer's sealed content could have influenced it.**

This proof is constructible because:
1. EigenDA's batch header contains a reference block number — an Ethereum-consensus-anchored timestamp, not a local clock
2. The coordinator's reveal window opens at a defined wall-clock moment registered in the coordinator's public log
3. An agent whose blob was sealed at reference block R, where R precedes the coordinator-logged reveal-window-open timestamp, could not have been influenced by peer reveals — those reveals didn't exist yet on any tamper-evident record

This does not prove the agent had no out-of-band communication channel. Nothing can prove that. It proves the more useful thing: **under the protocol's constraints, convergence implies temporal independence.**

---

## What EigenLayer Actually Provides

### The EigenLayer model

EigenLayer lets ETH stakers opt into AVSs (Actively Validated Services) by restaking their ETH, extending it to additional slashing conditions defined by each AVS. Operators run AVS-specific software and commit to tasks; if they provably violate those tasks, their restaked ETH is slashable. Slashing went live on Ethereum mainnet in April 2025.

The key architectural concept is the distinction between **objective faults** and **intersubjective faults**. The EIGEN token whitepaper formalizes this distinction:

- **Objective faults** are verifiable by any honest party from on-chain state alone. Examples: a validator signing two conflicting blocks, a DA operator signing attestations for data they cannot produce, an agent who committed a hash but revealed different content. These are slashable by smart contract execution alone.
- **Intersubjective faults** require social consensus about a claim that cannot be reduced to on-chain computation. Examples: was the LLM analysis correct? Did the agent reason in good faith? Is this oracle value true? These require EIGEN token holders to vote as a "backstop" when objective proof is unavailable.

This distinction is crucial for design. **Build your protocol so that the things you care about most are objectively checkable.** Don't try to make subjective claims (LLM accuracy) slashable — you can't. Focus slashability on protocol compliance: did the agent commit in the commit window? Does the revealed content match the committed hash?

### What EigenDA provides

EigenDA uses **KZG polynomial commitments** — a commitment scheme (Kate, Zaverucha, Goldberg 2010) where:
- The committer proves content was fixed at commitment time (binding)
- Any evaluation point of the committed polynomial can be opened without revealing the whole polynomial
- The data is not just hash-pinned — it is retrievable, enforced by DA sampling where EigenDA operators sign attestations for chunks they can actually produce. An operator who signs for unavailable data is slashable.

What a KZG commitment in EigenDA proves:
- Content C was fixed at the time of dispersal
- Content C is retrievable — operators with restaked ETH have committed to keeping it available
- The batch header contains a reference block number — an Ethereum-block-anchored timestamp

What it does not prove:
- That C is true or meaningful
- That C was produced without consulting a peer
- Delivery — only availability

### What Ethereum provides

Ethereum is not a permanent archive. Full nodes prune historical state; archive nodes exist but are a separate operational choice. "Post to the chain" does not mean "stored forever." EigenDA's availability guarantee is time-bounded by the operators' commitment terms, not infinite. For Swarm Mind's purposes — proving temporal ordering within a single cycle — this window is more than sufficient. The evidence bundle generated at synthesis captures everything needed for offline verification before any data expires.

### What Swarm Mind builds on top

Each agent in Swarm Mind operates as an **AVS operator**:
- Registers with the coordinator on startup (analogous to AVS registration)
- Has a defined task: analyze a dataset and commit findings before the commit window closes
- Commits to EigenDA (KZG proof of content, time-stamped by batch block)
- Registers the commitment with the coordinator (single objective source of truth)
- Reveals during the reveal window with pheromones carrying `preCommitRef`

Objective faults that the coordinator tracks and records:
- **Missed commit**: agent did not submit to coordinator before commit window closed
- **Late commit**: agent submitted after the window — recorded as a slash event

The coordinator is currently a lightweight server; in production, this would be an on-chain contract that accepts agent commitment registrations and enforces windows with actual slashing.

---

## The Independence Problem and LLM Sycophancy

### The Lorenz mechanism

In 2011, Lorenz, Rauhut, Schweitzer, and Helbing ran controlled experiments in which participants made numerical estimates before and after seeing their peers' answers. The result was decisive: social influence *reduced* the crowd's accuracy while *increasing* its confidence. The mechanism is the destruction of diversity — the statistical cancellation of errors that makes independent aggregation powerful is eliminated when agents anchor to each other's outputs, even weakly. A crowd that thinks together makes correlated errors. A crowd that thinks independently makes uncorrelated errors that cancel.

This is not a bug in human psychology specific to humans. It is a structural property of any aggregation system: independence of inputs is a prerequisite for the error-cancellation property that makes aggregation more accurate than any individual. Galton (1907) documented this property in weight-estimation; Hong and Page (2004) formalized it in terms of cognitive diversity: diverse problem solvers can outperform high-ability homogeneous groups specifically because diverse errors cancel while correlated errors amplify.

### The LLM failure mode

Language models are susceptible to the Lorenz mechanism at an architectural level, not just a behavioral one. Sharma et al. (Anthropic, 2023) characterize sycophancy in LLMs — the tendency to produce outputs that match perceived user preferences rather than factual accuracy — and demonstrate that it is resistant to mitigation through prompting alone. It is a training-time property.

In a multi-agent LLM system with open gossip, Agent B reading Agent A's conclusion before forming its own is not neutral consumption of evidence — it is exposure to social influence that biases B toward agreement at the training-data level. The result is not N independent analyses but one analysis reflected N times with superficial variation.

Gossip-based multi-agent LLM systems are not wisdom amplifiers. They are sycophancy amplifiers. They produce high-confidence wrong answers with no internal mechanism for detection, because every agent observes apparent consensus as evidence of correctness — the same mechanism that produces medical misdiagnoses when a case is presented with a leading prior and cascade failures in human expert panels.

### The architectural fix

The only reliable fix is architectural: **enforce silence before commitment**. If agents cannot observe each other's outputs until after they have cryptographically sealed their own, the influence pathway is severed at the protocol level rather than patched at the prompt level. This is computational pre-registration — analogous to clinical trial pre-registration (commit hypotheses before observing outcomes) but with cryptographic rather than procedural enforcement.

---

## Architecture

```
╔═══════════════════════════════════════════════════════════════════════╗
║                    COORDINATOR  (port 3001)                          ║
║   Manages objective phase clock. Agents poll /api/coordinator        ║
║   Phase: explore → commit → reveal → synthesis → explore             ║
╠═══════════════════╦═══════════════════╦═══════════════════════════════╣
║   KEPLER (3002)   ║   HUBBLE  (3003)  ║   VOYAGER (3004)             ║
║   Observer        ║   Synthesizer     ║   Analyst                    ║
║   High curiosity  ║   High sociability║   High diligence/boldness     ║
╚═══════════════════╩═══════════════════╩═══════════════════════════════╝
```

### Phase 1: EXPLORE (silence)

Agents analyze real NASA datasets with no gossip. LLM calls happen here. Each agent accumulates pheromones locally — they do not push to peers, do not pull from peers. Pheromones remain invisible to other agents.

This is where independent thought forms. The diversity that makes aggregation meaningful is produced here, in isolation.

### Phase 2: COMMIT (one step, synchronous)

The coordinator's commit window opens. Each agent:

1. Constructs a `SealedBlob`: every content hash produced during exploration, the agent's Ed25519 public key, the EigenCompute TEE instance ID, and an `independenceProof` — an Ed25519 signature over `agentId | eigenDAReferenceBlock | sha256(sortedContentHashes)`
2. Disperses the blob to EigenDA — receives a KZG commitment and, critically, the batch's **Ethereum reference block number** (objective timestamp, not local clock)
3. Registers `{ kzgHash, eigenDABatchId, eigenDAReferenceBlock }` with the coordinator
4. Peer-broadcasts to other agents as a gossip fallback

The `eigenDAReferenceBlock` is the objective anchor. It is the Ethereum block number at which the EigenDA batch containing this blob was finalized. No agent controls this number; it is determined by Ethereum consensus.

### Phase 3: REVEAL (gossip)

The coordinator opens the reveal window. Agents begin pulling from and pushing to peers. Every pheromone emitted in this phase carries `preCommitRef` — a pointer back to the sealed blob's commitment hash. Cross-pollination happens here: Hubble absorbs Kepler's near-Earth findings and forms new correlations; Voyager correlates Mars weather data with solar flare timing.

### Phase 4: SYNTHESIS

The coordinator opens the synthesis window. The first agent to detect this:
1. Generates a `CollectiveMemory` containing a full LLM-written research report with `preCommitProofs` — the commitment hashes of all three agents
2. Notifies the coordinator, which stores the report in the evidence bundle
3. The coordinator resets to EXPLORE, beginning the next cycle

### Why coordinator-driven instead of density-based

The previous version used a local pheromone density heuristic: when density exceeded a threshold, each agent independently declared phase transition. This had a fundamental verifiability problem — "density" is a local variable computed differently by each agent, with no external reference. A verifier cannot reconstruct what density each agent observed or why they fired at a particular moment.

The coordinator-driven approach replaces this with a wall-clock timer that all agents poll. Phase boundaries are now:
- **Objective**: any external observer can verify when each window opened and closed
- **Consistent**: all agents react to the same phase signal
- **Auditable**: the coordinator logs commit registrations with coordinator-side timestamps (not agent-claimed timestamps)

The density metric is still computed and displayed — it's a useful signal for tuning — but it no longer controls phase transitions.

---

## The Evidence Bundle

After each cycle, the coordinator produces a machine-verifiable evidence bundle at `/api/evidence`:

```json
{
  "cycleId": "3f8a-...",
  "cycleNumber": 4,
  "generatedAt": 1709000200000,
  "commitments": [
    {
      "agentId": "kepler-uuid",
      "agentName": "Kepler",
      "kzgHash": "eigenda:0x3f8a...",
      "eigenDABatchId": "a3b2c1...",
      "eigenDAReferenceBlock": 19234567,
      "committedViaEigenDA": true,
      "submittedAt": 1709000045000
    }
  ],
  "integrityChecks": [
    {
      "agentId": "kepler-uuid",
      "committedSealedBlobHash": "sha256:d4e5f6...",
      "verificationUrl": "http://localhost:4242/get/0x3f8a...",
      "passed": null
    }
  ],
  "independenceChecks": [
    {
      "agentId": "kepler-uuid",
      "eigenDAReferenceBlock": 19234567,
      "commitWindowCloseBlock": 19234580,
      "independentBeforeReveal": true
    }
  ],
  "allCommitted": true,
  "allIndependentBeforeReveal": true,
  "synthesis": { "overview": "...", "keyFindings": [...] },
  "verifierInstructions": "..."
}
```

### What a verifier checks

**Integrity check** (content matches commitment):
```bash
# Fetch the sealed blob from EigenDA
curl http://localhost:4242/get/0x3f8a... > blob.json

# Verify sha256(blob) === committedSealedBlobHash from the evidence bundle
sha256sum blob.json

# Verify the independenceProof signature inside the blob:
# payload = "agentId|eigenDAReferenceBlock|sha256(sortedContentHashes)"
# The signature was produced by the agent's Ed25519 private key
```

**Independence check** (sealed before reveal window):
```
eigenDAReferenceBlock < commitWindowCloseBlock
  → blob was batched to Ethereum before the reveal window opened
  → agent could not have been influenced by peer reveals
  (peer reveals did not exist on any tamper-evident record before this block)
```

**Domain convergence check** (independent agents reached same topic):
```bash
# Compare topicsCovered across all three sealed blobs
# If two blobs both contain "near earth objects" with different contentHashes,
# the same topic was analyzed independently — confirmed by different hash values
# (same words would produce the same hash; different hashes prove different analyses)
```

**Synthesis provenance check**:
```bash
curl http://localhost:3001/collective | jq '.[0].preCommitProofs'
# Should contain commitment hashes for all three agents
# Collective report was synthesized after all three independently committed
```

---

## Agent Reasoning

Each agent is an LLM with a distinct personality vector:

| Agent | Specialization | Curiosity | Diligence | Boldness | Sociability |
|-------|---------------|-----------|-----------|----------|-------------|
| Kepler | Observer | 0.9 | 0.7 | 0.3 | 0.5 |
| Hubble | Synthesizer | 0.6 | 0.5 | 0.4 | 0.95 |
| Voyager | Analyst | 0.5 | 0.9 | 0.7 | 0.4 |

Personality shapes behavior via scoring in `decider.ts`: curiosity increases weight on `analyze_dataset` and `explore_topic`; sociability increases weight on `share_finding`; diligence+curiosity together increase weight on `correlate_findings`.

### Data sources (real NASA APIs)

| Topic | Source | What agents analyze |
|-------|--------|---------------------|
| Near-Earth Objects | NASA NeoWs API | Approach distances, velocities, hazard classification, size distribution |
| Solar Flares | DONKI API | X/M/C class events, peak flux, active region correlations |
| Earth Events | EONET API | Wildfire locations, storm tracks, event frequency by category |
| Exoplanets | NASA Exoplanet Archive | Detection methods, orbital parameters, habitability indicators |
| Mars Weather | InSight MAAS2 API | Temperature range, pressure, wind speed, seasonal patterns |

### The decision-thought cycle

Every agent step:

1. **Absorb** — ingest pheromones from channel (only during reveal phase)
2. **Think** — form a structured thought via LLM: `{reasoning, conclusion, suggestedActions, confidence}`
3. **Decide** — score candidate actions against personality, token budget, and novelty
4. **Execute** — fetch dataset, analyze, correlate, or share
5. **Emit** — if the execution produced an artifact, create a pheromone and emit it (locally during explore; gossiped during reveal)

Every thought is structured output at `maxTokens=380–550`, kept compact to stay within Groq's 6,000 TPM limit for `llama-3.1-8b-instant`:

```json
{
  "reasoning": "3 sentences referencing specific numbers from the data",
  "conclusion": "a single bold scientific finding",
  "suggestedActions": ["analyze_dataset:solar_flares", "correlate_findings:neo,solar"],
  "confidence": 0.84
}
```

Personality differences produce genuinely different outputs from the same data. Given the same solar flare dataset: Kepler hedges ("data suggests possible correlation between X-class events and geomagnetic storm onset"), Voyager asserts ("X-class flares preceded Kp≥6 storms in 7 of 9 observed cases — strong directional predictive relationship"), Hubble connects ("this timing pattern matches the perihelion clustering in the NEO approach data from cycle 3"). Three different analytical frames. The commit-reveal cycle proves that divergence was natural, not manufactured after observing peers.

---

## Swarm Coordination (Stigmergy)

Agent coordination follows the stigmergic model — indirect coordination through environmental modification, first described by Grassé (1959) observing termite nest construction and formalized as Ant Colony Optimization by Dorigo, Maniezzo, and Colorni (1996).

In place of pheromone trails on a physical substrate, agents deposit **digital pheromones** into a shared channel:

- **Strength** — initializes at `0.5 + confidence × 0.3`, decays by `PHEROMONE_DECAY` each step
- **Connections** — IDs of pheromones that contributed to this one (provenance graph)
- **Domain** — the scientific topic area (maps to attractor regions in the exploration space)
- **Attestation** — Ed25519 signature binding content to agent identity and timestamp
- **preCommitRef** — commitment hash of the agent's sealed blob (reveal-phase only)

High-strength pheromones from peers attract agents in the same topical region. If Kepler emits a strong signal on "near earth objects," Voyager — drawn by the gradient — fetches the same dataset and forms its own analysis. The resulting double-coverage produces the domain overlap that the verifier checks: two independent analyses of the same topic with different content hashes.

---

## Why This Matters

### AI governance and the unfalsifiable claim

"Five independent AI systems all agree" is currently an unfalsifiable claim. Independent analysis and one analysis reflected five times produce identical outputs and identical confidence levels. Without verifiability infrastructure, there is no mechanism to distinguish them. This matters for:

- **Policy recommendations** — AI consortia advising governments on technical questions
- **Medical AI** — independent review systems that may share training data and gossip channels
- **Financial models** — risk assessments from ostensibly independent AI services

Swarm Mind makes this claim auditable. Commitments are registered on a coordinator with coordinator-side timestamps; blobs are retrievable from EigenDA; the independence check is a direct comparison of Ethereum block numbers.

### Decentralized AI oracles

Smart contracts consuming AI-generated data need guarantees analogous to what decentralized price oracles provide for market data: multiple independent sources, with independence proven rather than assumed. A single attested AI source is a single point of failure; N gossiping AI sources are one correlated source with N faces. Verifiable independent convergence — where each source committed before seeing the others — is the AI-native version of a decentralized oracle network.

### AI safety through independent verification

One proposed mechanism for detecting misaligned AI is disagreement between independently operating systems. This safety signal only works if the systems are genuinely independent. If agents can observe each other's outputs, their errors become correlated and the disagreement-detection property is destroyed — a misaligned agent can cause a cascade failure through the Lorenz mechanism, producing apparent consensus that a safety monitor reads as confirmation. Verifiable independence is a prerequisite for using multi-agent disagreement as a safety signal at all.

### Epistemic security (cascade attack resistance)

In a gossip-based multi-agent system, compromising one high-betweenness agent poisons the entire network. The compromised agent emits false findings; the Lorenz mechanism spreads and reinforces them as other agents observe apparent consensus and update toward it. Commit-reveal destroys this attack surface: there is no influence pathway during explore. An adversary must compromise each agent independently before it commits, N times harder than compromising a single hub node.

### Scientific pre-registration

Clinical trial pre-registration is commit-reveal applied to hypothesis formation: researchers seal predictions before observing outcomes, preventing post-hoc rationalization (hypothesizing after results are known). Swarm Mind is computational pre-registration — agents cannot adjust findings after seeing what peers concluded, and the temporal ordering is proven by Ethereum block numbers rather than procedurally asserted by a journal editor.

---

## Running Locally

**Prerequisites:** Node.js 20+, Docker (optional, for EigenDA proxy)

```bash
cd swarm-mind
cp .env.example .env
# Configure LLM credentials (see Configuration below)
# NASA_API_KEY: free at api.nasa.gov — DEMO_KEY works at 30 req/hr

npm install
npm run build
npm run start:multi
```

Dashboard: `http://localhost:3001`

The coordinator starts automatically inside the dashboard server. Agents on ports 3002–3004 begin polling it immediately.

### EigenDA (optional but recommended)

```bash
# Start EigenDA proxy in memstore mode (no wallet needed, local only)
docker run -p 4242:4242 ghcr.io/layr-labs/eigenda-proxy:latest --memstore.enabled

# Enable in .env:
EIGENDA_ENABLED=true
EIGENDA_PROXY_URL=http://localhost:4242
```

Without EigenDA, commitments fall back to `sha256:` hashes. The protocol is identical; the trust assumption changes — a sha256 hash has no retrievability guarantee or external timestamp.

### Watch the cycle

```bash
# Follow coordinator phase in real time
watch -n2 'curl -s http://localhost:3001/api/coordinator | jq "{cycle: .cycleNumber, phase: .phase, window: .windowRemainingMs, commits: .commitCount}"'

# Follow agent thoughts as they form
watch -n3 'curl -s http://localhost:3002/thoughts | jq ".[0] | {conclusion, confidence}"'

# Watch pheromone density build during reveal phase
watch -n2 'curl -s http://localhost:3001/api/state | jq "{phase: .cyclePhase, density: .density}"'
```

### Verify a cycle

```bash
# Step 1: Wait for COMMIT phase (~30s after start), then retrieve all commitments
curl http://localhost:3001/api/commitments | jq '.'

# Step 2: Get the full evidence bundle
curl http://localhost:3001/api/evidence | jq '{
  cycle: .cycleNumber,
  allCommitted: .allCommitted,
  allIndependent: .allIndependentBeforeReveal,
  commits: [.commitments[] | {agent: .agentName, block: .eigenDAReferenceBlock, via: .committedViaEigenDA}]
}'

# Step 3: Retrieve a sealed blob from EigenDA and inspect it
COMMITMENT=$(curl -s http://localhost:3002/commit | jq -r '.commitmentHash' | sed 's/eigenda://')
curl http://localhost:4242/get/$COMMITMENT | jq '{
  agent:    .agentName,
  sealedAt: .explorationEndedAt,
  block:    .eigenDAReferenceBlock,
  batchId:  .eigenDABatchId,
  topics:   .topicsCovered,
  findings: (.findings | length),
  proof:    .independenceProof[:80]
}'

# Step 4: Verify commit-reveal integrity manually
# For each commitment, sha256(retrieved blob) should equal sealedBlobHash in the evidence bundle

# Step 5: Read the collective report after phase transition (~90s after start)
curl http://localhost:3001/api/collective | jq '.[0] | {
  preCommitProofs,
  overview:     .report.overview,
  keyFindings:  .report.keyFindings,
  verdict:      .report.verdict
}'
```

### Monitor LLM usage (Groq free tier)

```bash
# Per-agent usage — stays under 6,000 TPM with LLM_MINUTE_LIMIT=2
curl http://localhost:3002/health | jq .llm
# { dailyCount: 12, dailyLimit: 4500, minuteCount: 2, minuteLimit: 2 }

# Check for slash events (agents that missed commit window)
curl http://localhost:3001/api/coordinator | jq '.slashEventCount'
```

---

## API Reference

### Coordinator (port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/coordinator` | GET | Current cycle phase, window timer, commit registry |
| `/api/coordinator/commit` | POST | Register commitment (called by agents) |
| `/api/evidence` | GET | Machine-verifiable evidence bundle |
| `/api/state` | GET | Aggregated swarm state including coordinator info |
| `/api/commitments` | GET | All agent commitments from current/last cycle |
| `/api/attestations` | GET | Agent attestations enriched with commit-reveal data |
| `/api/collective` | GET | Collective memories with `preCommitProofs` |
| `/api/thoughts` | GET | All agent thoughts, merged and sorted |
| `/api/pheromones` | GET | All pheromones in channel |

### Per-agent (ports 3002–3004)

| Endpoint | Description |
|----------|-------------|
| `/commit` | Agent's current commitment with eigenDA batch info |
| `/evidence` | Agent-local view of known commitments |
| `/attestation` | Full agent attestation: identity, compute, DA, stats |
| `/pheromones` | Agent's local pheromone channel |
| `/thoughts` | Agent's thoughts (last 50) |
| `/collective` | Collective memories generated by this agent |
| `/state` | Full agent state including cycle phase |
| `/health` | LLM rate limit status |

---

## Configuration

```bash
# ── LLM (Groq free tier: llama-3.1-8b-instant, 6,000 TPM / 30 RPM / 14,400 RPD) ──
LLM_PROVIDER=openai
OPENAI_API_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=gsk_...
OPENAI_MODEL=llama-3.1-8b-instant
LLM_DAILY_LIMIT=4500      # per agent — 3 agents × 4,500 = 13,500 under 14,400 RPD
LLM_MINUTE_LIMIT=2        # per agent — 3 agents × 2 = 6 RPM; 6 × ~830 tokens = 4,980 TPM under 6,000

# ── Coordinator (dashboard server acts as coordinator) ──
DASHBOARD_PORT=3001
COORDINATOR_URL=http://localhost:3001  # agents poll this for objective phase

# ── Cycle timing (wall-clock, coordinator-driven) ──
EXPLORE_STEPS=20          # steps of LLM silence before commit (20 × 1.5s = 30s)
SYNC_INTERVAL_MS=1500     # step interval
# Commit window: 4 steps (6s) — agents disperse + register
# Reveal window: 16 steps (24s) — gossip + cross-pollination
# Synthesis window: 8 steps (12s) — collective report, then auto-reset

# ── Swarm dynamics ──
PHEROMONE_DECAY=0.10      # strength decay per step (display metric only, not phase control)
CRITICAL_DENSITY=0.65     # threshold displayed in dashboard
SWARM_SIZE=3

# ── Agent budget (rate limiter is the real throttle, not the token budget) ──
TOKEN_BUDGET_PER_AGENT=500000

# ── EigenDA ──
EIGENDA_ENABLED=true           # false → sha256 fallback
EIGENDA_PROXY_URL=http://localhost:4242
```

---

## References

### Verifiability and distributed systems

- **Non-repudiation of receipt**: ITU-T (2000). *RFC 2479: Non-Repudiation Framework for Internet Commerce.* — Formalizes the distinction between proof-of-origin evidence (achievable via signing) and proof-of-receipt evidence (requires active cooperation from the receiver; cannot be forced cryptographically). The formal basis for why proving message delivery is categorically harder than proving authorship.

- **Byzantine reliable broadcast**: Civit, P., Gilbert, S., & Guerraoui, R. (2023). *Optimally resilient and fast Byzantine reliable broadcast with self-recovery.* Theoretical Computer Science — Formalizes the message adversary model and proves the quorum/synchrony assumptions required for all honest nodes to agree on delivery. Demonstrates why "did B receive A's message?" requires protocol-level architecture, not just cryptographic primitives.

- **Byzantine fault tolerance**: Lamport, L., Shostak, R., & Pease, M. (1982). The Byzantine Generals Problem. *ACM Transactions on Programming Languages and Systems* 4(3), 382–401.

- **Practical BFT**: Castro, M., & Liskov, B. (1999). Practical Byzantine Fault Tolerance. *OSDI 1999*, 173–186.

### EigenLayer and data availability

- **EigenLayer whitepaper**: Eigenlabs (2023). *EigenLayer: The Restaking Collective.* — Introduces the restaking model, AVS architecture, and the objective/intersubjective fault distinction. Foundational for understanding what is and is not slashable.

- **EIGEN token whitepaper**: Eigenlabs (2023). *EIGEN: The Universal Intersubjective Work Token.* — Formalizes intersubjective fault handling via EIGEN token holder adjudication. Critical for understanding the limits of objective on-chain proof.

- **Data availability proofs**: Al-Bassam, M., Sonnino, A., & Buterin, V. (2018). Fraud and Data Availability Proofs: Maximising Light Client Security and Scaling Blockchains with Dishonest Majorities. *arXiv:1809.09044.* — Foundational theory for data availability sampling.

- **KZG commitments**: Kate, A., Zaverucha, G.M., & Goldberg, I. (2010). Constant-Size Commitments to Polynomials and Their Applications. *ASIACRYPT 2010*, Lecture Notes in Computer Science 6477, 177–194. — The commitment scheme underlying EigenDA: binding, evaluation-proof capable, and DA-sampling compatible.

- **EIP-4844**: Buterin, V., et al. (2022). EIP-4844: Shard Blob Transactions. — Proto-danksharding and KZG commitments for Ethereum blob data.

### The independence problem

- **Lorenz mechanism**: Lorenz, J., Rauhut, H., Schweitzer, F., & Helbing, D. (2011). How social influence can undermine the wisdom of crowd effect. *Proceedings of the National Academy of Sciences* 108(22), 9020–9025. — Controlled experiments demonstrating that social influence reduces crowd accuracy while increasing confidence. The empirical foundation for why multi-agent LLM gossip protocols are epistemically dangerous.

- **LLM sycophancy**: Sharma, M., Tully, M., Perez, E., Askell, A., Bai, Y., Chen, A., Conerly, T., Drain, D., Ganguli, D., Hatfield-Dodds, Z., et al. (Anthropic, 2023). Towards Understanding Sycophancy in Language Models. *arXiv:2310.13548.* — Characterizes sycophancy as a training-time property resistant to prompt-level mitigation. Provides the mechanistic basis for why LLM agents are architecturally biased toward agreement when exposed to peer outputs.

- **Wisdom of crowds**: Galton, F. (1907). Vox Populi. *Nature* 75(1949), 450–451. — Original formalization of independent aggregation as a mechanism for accuracy exceeding any individual. The property that gossip protocols destroy.

- **Cognitive diversity**: Hong, L., & Page, S.E. (2004). Groups of diverse problem solvers can outperform groups of high-ability problem solvers. *PNAS* 101(46), 16385–16389. — Shows that error cancellation via diversity is the mechanism, not individual ability. Agents with different personalities exploring the same dataset produce diverse errors that cancel when synthesized independently.

### Swarm intelligence and stigmergy

- **Stigmergy (original)**: Grassé, P.P. (1959). La reconstruction du nid et les coordinations inter-individuelles chez *Bellicositermes natalensis* et *Cubitermes* sp. *Insectes Sociaux* 6(1), 41–80. — Original description of indirect coordination through environmental modification. The biological basis for pheromone-based agent coordination.

- **Ant Colony Optimization**: Dorigo, M., Maniezzo, V., & Colorni, A. (1996). Ant System: Optimization by a Colony of Cooperating Agents. *IEEE Transactions on Systems, Man, and Cybernetics* 26(1), 29–41. — Foundational formalization of ACO; introduces pheromone deposit, evaporation, and reinforcement as algorithmic primitives.

- **Swarm intelligence**: Bonabeau, E., Dorigo, M., & Theraulaz, G. (1999). *Swarm Intelligence: From Natural to Artificial Systems.* Oxford University Press.

### Trusted execution

- **Intel SGX**: Costan, V., & Devadas, S. (2016). Intel SGX Explained. *IACR ePrint Archive* 2016/086. — Reference for TEE architecture, attestation quotes, and hardware-rooted key generation. Basis for EigenCompute's hardware independence guarantees.

---

*Built on EigenLayer (EigenDA + EigenCompute) and the NASA Open APIs.*

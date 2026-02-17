import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { SwarmState, AgentThought, AgentDecision, CollaborativeProject } from "../agents/types";
import { SwarmAgent } from "../agents/agent";
import { getRecentThoughts, getRecentDecisions, getAllRepos, getAgentStats } from "../agents/persistence";

interface EnhancedState {
  globalThoughtStream: AgentThought[];
  globalDecisionLog: AgentDecision[];
  collaborativeProjects: CollaborativeProject[];
}

export function startDashboard(
  state: SwarmState,
  agents: SwarmAgent[],
  port: number,
  enhanced?: EnhancedState
): void {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // From dist/dashboard/server.js: ../../dashboard → project root/dashboard ✓
  // From dashboard/server.ts (dev): ../../dashboard → overshoots ✗, fall back to ../dashboard
  let dashboardDir = path.join(__dirname, "..", "..", "dashboard");
  if (!fs.existsSync(path.join(dashboardDir, "index.html"))) {
    dashboardDir = path.join(__dirname, "..", "dashboard");
  }
  app.use(express.static(dashboardDir));

  app.get("/api/state", (_req, res) => {
    const totalPRs = agents.reduce((s, a) => s + a.state.prsCreated.length, 0);
    const totalTokens = agents.reduce((s, a) => s + a.state.tokensUsed, 0);
    res.json({
      step: state.step,
      startedAt: state.startedAt,
      phaseTransitionOccurred: state.phaseTransitionOccurred,
      transitionStep: state.transitionStep,
      metrics: state.metrics,
      density: state.channel.density,
      criticalThreshold: state.channel.criticalThreshold,
      totalPRs,
      totalTokens,
    });
  });

  app.get("/api/agents", (_req, res) => {
    res.json(
      agents.map((a) => ({
        id: a.state.id,
        name: a.state.name,
        position: a.state.position,
        velocity: a.state.velocity,
        energy: a.state.energy,
        synchronized: a.state.synchronized,
        explorationTarget: a.state.explorationTarget,
        discoveries: a.state.discoveries,
        absorbed: a.state.absorbed.size,
        knowledgeCount: a.state.knowledge.length,
        contributionsToCollective: a.state.contributionsToCollective,
        stepCount: a.state.stepCount,
        // v2 fields
        currentAction: a.state.currentAction || "idle",
        specialization: a.state.specialization,
        thoughtCount: a.state.thoughts.length,
        decisionCount: a.state.decisions.length,
        prsCreated: a.state.prsCreated.length,
        tokensUsed: a.state.tokensUsed,
        tokenBudget: a.state.tokenBudget,
        latestThought: a.state.thoughts.length > 0
          ? a.state.thoughts[a.state.thoughts.length - 1].conclusion
          : null,
      }))
    );
  });

  app.get("/api/pheromones", (_req, res) => {
    res.json(
      state.channel.pheromones.map((p) => ({
        id: p.id,
        agentId: p.agentId,
        content: p.content,
        domain: p.domain,
        confidence: p.confidence,
        strength: p.strength,
        connections: p.connections,
        timestamp: p.timestamp,
        attestation: p.attestation,
        // v2: include pheromoneType if it's an engineering pheromone
        pheromoneType: (p as unknown as Record<string, unknown>).pheromoneType || "knowledge",
      }))
    );
  });

  app.get("/api/collective", (_req, res) => {
    res.json(state.collectiveMemories);
  });

  // ── v2 Endpoints ──

  app.get("/api/thoughts", (_req, res) => {
    if (enhanced) {
      res.json(enhanced.globalThoughtStream.slice(-50).reverse());
    } else {
      try {
        res.json(getRecentThoughts(50));
      } catch {
        res.json([]);
      }
    }
  });

  app.get("/api/decisions", (_req, res) => {
    if (enhanced) {
      res.json(enhanced.globalDecisionLog.slice(-50).reverse());
    } else {
      try {
        res.json(getRecentDecisions(50));
      } catch {
        res.json([]);
      }
    }
  });

  app.get("/api/repos", (_req, res) => {
    try {
      res.json(getAllRepos());
    } catch {
      // Deduplicate from agent state
      const seen = new Set<string>();
      const repos: Array<{ owner: string; repo: string }> = [];
      for (const agent of agents) {
        for (const repoStr of agent.state.reposStudied) {
          if (!seen.has(repoStr)) {
            seen.add(repoStr);
            const [owner, repo] = repoStr.split("/");
            repos.push({ owner, repo });
          }
        }
      }
      res.json(repos);
    }
  });

  app.get("/api/prs", (_req, res) => {
    const prs: Array<{ agentName: string; url: string }> = [];
    for (const agent of agents) {
      for (const url of agent.state.prsCreated) {
        prs.push({ agentName: agent.state.name, url });
      }
    }
    res.json(prs);
  });

  app.get("/api/agent/:id", (req, res) => {
    const agent = agents.find((a) => a.state.id === req.params.id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    let stats = null;
    try {
      stats = getAgentStats(agent.state.id);
    } catch { /* DB not ready */ }

    res.json({
      ...agent.state,
      absorbed: agent.state.absorbed.size,
      knowledgeCount: agent.state.knowledge.length,
      recentThoughts: agent.state.thoughts.slice(-10),
      recentDecisions: agent.state.decisions.slice(-10),
      stats,
    });
  });

  app.get("/api/collaborations", (_req, res) => {
    res.json(enhanced?.collaborativeProjects || []);
  });

  app.get("/", (_req, res) => {
    res.sendFile(path.join(dashboardDir, "index.html"));
  });

  app.listen(port, () => {
    console.log(`[DASHBOARD] http://localhost:${port}\n`);
  });
}

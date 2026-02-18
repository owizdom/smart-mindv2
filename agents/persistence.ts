import Database from "better-sqlite3";
import path from "path";
import type {
  AgentThought,
  AgentDecision,
  Pheromone,
  CollectiveMemory,
  AutonomousAgentState,
} from "./types";
import { disperseAsync } from "./eigenda";

let db: Database.Database | null = null;

export function initDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || path.join(process.cwd(), "swarm-mind.db");
  db = new Database(resolvedPath);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialization TEXT,
      personality_json TEXT,
      tokens_used INTEGER DEFAULT 0,
      token_budget INTEGER DEFAULT 0,
      repos_studied_json TEXT DEFAULT '[]',
      prs_created_json TEXT DEFAULT '[]',
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS thoughts (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      trigger TEXT,
      observation TEXT,
      reasoning TEXT,
      conclusion TEXT,
      suggested_actions_json TEXT,
      confidence REAL,
      timestamp INTEGER,
      eigenda_commitment TEXT,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS pheromones (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      content TEXT,
      domain TEXT,
      confidence REAL,
      strength REAL,
      connections_json TEXT DEFAULT '[]',
      timestamp INTEGER,
      attestation TEXT,
      eigenda_commitment TEXT
    );

    CREATE TABLE IF NOT EXISTS collective_memories (
      id TEXT PRIMARY KEY,
      domain TEXT,
      synthesis TEXT,
      contributors_json TEXT DEFAULT '[]',
      confidence REAL,
      timestamp INTEGER,
      eigenda_commitment TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      action_json TEXT NOT NULL,
      priority REAL,
      cost_json TEXT,
      status TEXT DEFAULT 'pending',
      result_json TEXT,
      created_at INTEGER,
      completed_at INTEGER,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS repos (
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      description TEXT,
      language TEXT,
      stars INTEGER DEFAULT 0,
      topics_json TEXT DEFAULT '[]',
      relevance_score REAL DEFAULT 0,
      discovered_at INTEGER,
      PRIMARY KEY (owner, repo)
    );

    CREATE TABLE IF NOT EXISTS prs_created (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      pr_url TEXT,
      title TEXT,
      status TEXT DEFAULT 'sandboxed',
      created_at INTEGER,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS scan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      scan_type TEXT NOT NULL,
      query TEXT,
      results_count INTEGER DEFAULT 0,
      scanned_at INTEGER,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_thoughts_agent ON thoughts(agent_id);
    CREATE INDEX IF NOT EXISTS idx_decisions_agent ON decisions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
    CREATE INDEX IF NOT EXISTS idx_thoughts_timestamp ON thoughts(timestamp);
    CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at);
    CREATE INDEX IF NOT EXISTS idx_pheromones_timestamp ON pheromones(timestamp);
    CREATE INDEX IF NOT EXISTS idx_collective_timestamp ON collective_memories(timestamp);
  `);

  // Migrate existing schemas — add eigenda_commitment if missing
  for (const table of ["thoughts", "pheromones", "collective_memories"]) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN eigenda_commitment TEXT`); } catch { /* column exists */ }
  }

  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ── Agent CRUD ──

export function saveAgent(state: AutonomousAgentState): void {
  const d = getDb();
  d.prepare(`
    INSERT OR REPLACE INTO agents (id, name, specialization, personality_json, tokens_used, token_budget, repos_studied_json, prs_created_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    state.id,
    state.name,
    state.specialization,
    JSON.stringify(state.personality),
    state.tokensUsed,
    state.tokenBudget,
    JSON.stringify(state.reposStudied),
    JSON.stringify(state.prsCreated),
    Date.now()
  );
}

export function loadAgent(id: string): Partial<AutonomousAgentState> | null {
  const d = getDb();
  const row = d.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    specialization: row.specialization as string,
    personality: JSON.parse((row.personality_json as string) || "{}"),
    tokensUsed: row.tokens_used as number,
    tokenBudget: row.token_budget as number,
    reposStudied: JSON.parse((row.repos_studied_json as string) || "[]"),
    prsCreated: JSON.parse((row.prs_created_json as string) || "[]"),
  };
}

// ── Thought CRUD ──

export function saveThought(thought: AgentThought): void {
  const d = getDb();
  d.prepare(`
    INSERT OR REPLACE INTO thoughts (id, agent_id, trigger, observation, reasoning, conclusion, suggested_actions_json, confidence, timestamp, eigenda_commitment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    thought.id,
    thought.agentId,
    thought.trigger,
    thought.observation,
    thought.reasoning,
    thought.conclusion,
    JSON.stringify(thought.suggestedActions),
    thought.confidence,
    thought.timestamp,
    null // updated asynchronously below
  );

  // Fire-and-forget: disperse to EigenDA, update commitment when confirmed
  disperseAsync(thought, (result) => {
    try {
      getDb()
        .prepare("UPDATE thoughts SET eigenda_commitment = ? WHERE id = ?")
        .run(result.commitment, thought.id);
    } catch { /* DB closed */ }
  }, `thought:${thought.id.slice(0, 8)}`);
}

export function savePheromone(pheromone: Pheromone): void {
  const d = getDb();
  d.prepare(`
    INSERT OR REPLACE INTO pheromones (id, agent_id, content, domain, confidence, strength, connections_json, timestamp, attestation, eigenda_commitment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    pheromone.id,
    pheromone.agentId,
    pheromone.content,
    pheromone.domain,
    pheromone.confidence,
    pheromone.strength,
    JSON.stringify(pheromone.connections),
    pheromone.timestamp,
    pheromone.attestation,
    null
  );

  // Disperse pheromone to EigenDA — the returned commitment replaces the local hash
  disperseAsync(
    { id: pheromone.id, agentId: pheromone.agentId, content: pheromone.content, domain: pheromone.domain, confidence: pheromone.confidence, timestamp: pheromone.timestamp },
    (result) => {
      try {
        getDb()
          .prepare("UPDATE pheromones SET eigenda_commitment = ?, attestation = ? WHERE id = ?")
          .run(result.commitment, `eigenda:${result.commitment}`, pheromone.id);
      } catch { /* DB closed */ }
    },
    `pheromone:${pheromone.id.slice(0, 8)}`
  );
}

export function saveCollectiveMemory(memory: CollectiveMemory): void {
  const d = getDb();
  d.prepare(`
    INSERT OR REPLACE INTO collective_memories (id, domain, synthesis, contributors_json, confidence, timestamp, eigenda_commitment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    memory.id,
    memory.topic,
    memory.synthesis,
    JSON.stringify(memory.contributors),
    memory.confidence,
    memory.createdAt,
    null
  );

  // Collective memories are the high-value output — always anchor to EigenDA
  disperseAsync(memory, (result) => {
    try {
      getDb()
        .prepare("UPDATE collective_memories SET eigenda_commitment = ? WHERE id = ?")
        .run(result.commitment, memory.id);
      console.log(`  [EigenDA] Collective memory anchored: ${result.commitment.slice(0, 24)}…`);
    } catch { /* DB closed */ }
  }, `collective:${memory.topic}`);
}

export function getRecentThoughts(limit = 50): AgentThought[] {
  const d = getDb();
  const rows = d.prepare("SELECT * FROM thoughts ORDER BY timestamp DESC LIMIT ?").all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    agentId: row.agent_id as string,
    trigger: row.trigger as string,
    observation: row.observation as string,
    reasoning: row.reasoning as string,
    conclusion: row.conclusion as string,
    suggestedActions: JSON.parse((row.suggested_actions_json as string) || "[]"),
    confidence: row.confidence as number,
    timestamp: row.timestamp as number,
  }));
}

// ── Decision CRUD ──

export function saveDecision(decision: AgentDecision): void {
  const d = getDb();
  d.prepare(`
    INSERT OR REPLACE INTO decisions (id, agent_id, action_json, priority, cost_json, status, result_json, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    decision.id,
    decision.agentId,
    JSON.stringify(decision.action),
    decision.priority,
    JSON.stringify(decision.cost),
    decision.status,
    decision.result ? JSON.stringify(decision.result) : null,
    decision.createdAt,
    decision.completedAt
  );
}

export function updateDecisionStatus(
  id: string,
  status: AgentDecision["status"],
  result?: AgentDecision["result"]
): void {
  const d = getDb();
  d.prepare(`
    UPDATE decisions SET status = ?, result_json = ?, completed_at = ?
    WHERE id = ?
  `).run(
    status,
    result ? JSON.stringify(result) : null,
    status === "completed" || status === "failed" ? Date.now() : null,
    id
  );
}

export function getRecentDecisions(limit = 50): AgentDecision[] {
  const d = getDb();
  const rows = d.prepare("SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    agentId: row.agent_id as string,
    action: JSON.parse(row.action_json as string),
    priority: row.priority as number,
    cost: JSON.parse((row.cost_json as string) || "{}"),
    status: row.status as AgentDecision["status"],
    result: row.result_json ? JSON.parse(row.result_json as string) : null,
    createdAt: row.created_at as number,
    completedAt: row.completed_at as number | null,
  }));
}

// ── Pheromone queries ──

export function getRecentPheromones(limit = 50): Array<{ id: string; domain: string; content: string; confidence: number; eigendaCommitment: string | null; timestamp: number }> {
  const d = getDb();
  const rows = d.prepare("SELECT * FROM pheromones ORDER BY timestamp DESC LIMIT ?").all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    domain: r.domain as string,
    content: r.content as string,
    confidence: r.confidence as number,
    eigendaCommitment: (r.eigenda_commitment as string | null),
    timestamp: r.timestamp as number,
  }));
}

export function getCollectiveMemories(): Array<{ id: string; domain: string; synthesis: string; eigendaCommitment: string | null; timestamp: number }> {
  const d = getDb();
  const rows = d.prepare("SELECT * FROM collective_memories ORDER BY timestamp DESC").all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    domain: r.domain as string,
    synthesis: r.synthesis as string,
    eigendaCommitment: (r.eigenda_commitment as string | null),
    timestamp: r.timestamp as number,
  }));
}

// ── Stats ──

export function getAgentStats(agentId: string): {
  thoughtCount: number;
  decisionCount: number;
  completedDecisions: number;
  failedDecisions: number;
} {
  const d = getDb();
  const thoughts = d.prepare("SELECT COUNT(*) as count FROM thoughts WHERE agent_id = ?").get(agentId) as { count: number };
  const decisions = d.prepare("SELECT COUNT(*) as count FROM decisions WHERE agent_id = ?").get(agentId) as { count: number };
  const completed = d.prepare("SELECT COUNT(*) as count FROM decisions WHERE agent_id = ? AND status = 'completed'").get(agentId) as { count: number };
  const failed = d.prepare("SELECT COUNT(*) as count FROM decisions WHERE agent_id = ? AND status = 'failed'").get(agentId) as { count: number };
  return {
    thoughtCount: thoughts.count,
    decisionCount: decisions.count,
    completedDecisions: completed.count,
    failedDecisions: failed.count,
  };
}

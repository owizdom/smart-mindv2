import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";
import type {
  LLMConfig,
  AgentThought,
  AutonomousAgentState,
  Pheromone,
  CollectiveReport,
  ScienceDataset,
} from "./types";
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let activeProvider: LLMConfig["provider"] = "eigenai";
let modelName = "gpt-oss-120b-f16";
let totalTokensTracked = 0;

// ── Rate limiter (shared across all agents in this process) ──
const DAILY_LIMIT  = parseInt(process.env.LLM_DAILY_LIMIT  || "14000"); // buffer under 14,400
const MINUTE_LIMIT = parseInt(process.env.LLM_MINUTE_LIMIT || "25");    // buffer under 30/min

let dailyCount  = 0;
let dailyReset  = Date.now() + 86_400_000;   // reset 24h from start
const minuteWindow: number[] = [];            // timestamps of calls in the last 60s

function isRateLimited(): boolean {
  const now = Date.now();

  // Reset daily counter if 24h has passed
  if (now > dailyReset) {
    dailyCount = 0;
    dailyReset = now + 86_400_000;
  }

  // Evict timestamps older than 60s from the sliding window
  while (minuteWindow.length && minuteWindow[0] < now - 60_000) minuteWindow.shift();

  if (dailyCount >= DAILY_LIMIT) {
    console.warn(`  [LLM] Daily limit reached (${DAILY_LIMIT}). Skipping.`);
    return true;
  }
  if (minuteWindow.length >= MINUTE_LIMIT) {
    // Don't log every time — too noisy
    return true;
  }

  // Record this call
  minuteWindow.push(now);
  dailyCount++;
  return false;
}

export function initThinker(config: LLMConfig): void {
  activeProvider = config.provider;
  modelName = config.model;

  if (config.provider === "anthropic") {
    anthropicClient = new Anthropic({ apiKey: config.apiKey });
  } else {
    openaiClient = new OpenAI({
      baseURL: config.apiUrl,
      apiKey: config.apiKey,
    });
  }

  console.log(`[THINKER] Initialized with ${config.provider} model: ${config.model}`);
}

export function getTotalTokensUsed(): number {
  return totalTokensTracked;
}

export function getLLMUsage(): { dailyCount: number; dailyLimit: number; minuteCount: number; minuteLimit: number } {
  const now = Date.now();
  const recentMinute = minuteWindow.filter(t => t >= now - 60_000).length;
  return { dailyCount, dailyLimit: DAILY_LIMIT, minuteCount: recentMinute, minuteLimit: MINUTE_LIMIT };
}

// ── Internal LLM call ──

interface CallOptions {
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  force?: boolean;  // bypass per-process rate limiter (for rare synthesis calls)
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: CallOptions = {}
): Promise<{ content: string; tokensUsed: number }> {
  if (!options.force && isRateLimited()) return { content: "", tokensUsed: 0 };
  // Forced calls still track toward limits
  if (options.force) {
    const now = Date.now();
    while (minuteWindow.length && minuteWindow[0] < now - 60_000) minuteWindow.shift();
    minuteWindow.push(now);
    dailyCount++;
  }

  const maxTokens = options.maxTokens || 1000;
  const temperature = options.temperature ?? 0.7;

  if (activeProvider === "anthropic") {
    return callAnthropic(systemPrompt, userPrompt, maxTokens, temperature, options.jsonMode);
  }
  return callOpenAI(systemPrompt, userPrompt, maxTokens, temperature, options.jsonMode);
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  jsonMode?: boolean
): Promise<{ content: string; tokensUsed: number }> {
  if (!anthropicClient) throw new Error("Anthropic client not initialized.");

  const effectiveModel = modelName;
  const prompt = jsonMode
    ? userPrompt + "\n\nIMPORTANT: Respond with valid JSON only, no markdown fences."
    : userPrompt;

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await anthropicClient.messages.create({
        model: effectiveModel,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });

      let content = "";
      for (const block of response.content) {
        if (block.type === "text") content += block.text;
      }

      // Strip markdown fences if present
      content = content.trim();
      if (content.startsWith("```json")) content = content.slice(7);
      else if (content.startsWith("```")) content = content.slice(3);
      if (content.endsWith("```")) content = content.slice(0, -3);
      content = content.trim();

      const tokensUsed =
        (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
      totalTokensTracked += tokensUsed;

      return { content, tokensUsed };
    } catch (err: unknown) {
      if (attempt === maxRetries) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  [LLM] Failed after ${maxRetries + 1} attempts: ${message.slice(0, 200)}`);
        return { content: "", tokensUsed: 0 };
      }
      const message = err instanceof Error ? err.message : String(err);
      const is429 = message.includes("429") || message.toLowerCase().includes("rate limit");
      await new Promise((r) => setTimeout(r, is429 ? 8000 * (attempt + 1) : 1000 * (attempt + 1)));
    }
  }

  return { content: "", tokensUsed: 0 };
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  jsonMode?: boolean
): Promise<{ content: string; tokensUsed: number }> {
  if (!openaiClient) throw new Error("OpenAI client not initialized.");

  const effectiveModel = modelName;
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: effectiveModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
        ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      });

      const content = response.choices?.[0]?.message?.content || "";
      const tokensUsed =
        (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
      totalTokensTracked += tokensUsed;

      return { content, tokensUsed };
    } catch (err: unknown) {
      if (attempt === maxRetries) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  [LLM] Failed after ${maxRetries + 1} attempts: ${message.slice(0, 200)}`);
        return { content: "", tokensUsed: 0 };
      }
      const message = err instanceof Error ? err.message : String(err);
      const is429 = message.includes("429") || message.toLowerCase().includes("rate limit");
      await new Promise((r) => setTimeout(r, is429 ? 8000 * (attempt + 1) : 1000 * (attempt + 1)));
    }
  }

  return { content: "", tokensUsed: 0 };
}

// ── System Prompt Builder ──

function buildSystemPrompt(agent: AutonomousAgentState): string {
  const p = agent.personality;
  const traits: string[] = [];

  if (p.curiosity > 0.7) traits.push("deeply curious, eager to find patterns across datasets");
  else if (p.curiosity < 0.3) traits.push("focused, prefers deep dives over breadth");

  if (p.diligence > 0.7) traits.push("meticulous, references exact numbers in analysis");
  else if (p.diligence < 0.3) traits.push("intuitive, favors big-picture insights");

  if (p.boldness > 0.7) traits.push("bold, forms strong hypotheses and defends them");
  else if (p.boldness < 0.3) traits.push("cautious, hedges when data is uncertain");

  if (p.sociability > 0.7) traits.push("collaborative, eager to share findings with the swarm");
  else if (p.sociability < 0.3) traits.push("independent, does deep analysis before sharing");

  return `You are ${agent.name}, a NASA swarm agent. Specialization: ${agent.specialization}. Traits: ${traits.join("; ") || "balanced"}. Datasets analyzed: ${agent.reposStudied.length}. Be specific with numbers. Form bold scientific opinions.`;
}

// ── Core Reasoning Functions ──

export async function formThought(
  agentState: AutonomousAgentState,
  trigger: string,
  observation: string,
  context: string
): Promise<{ thought: AgentThought; tokensUsed: number }> {
  const systemPrompt = buildSystemPrompt(agentState);
  const userPrompt = `Trigger: ${trigger.slice(0, 80)}
Observation: ${observation.slice(0, 120)}
Context: ${context.slice(0, 100)}

JSON:{"reasoning":"2 sentences","conclusion":"1 sentence","suggestedActions":["action:topic"],"confidence":0.0-1.0}`;

  const { content, tokensUsed } = await callLLM(systemPrompt, userPrompt, {
    maxTokens: 380,
    jsonMode: true,
  });

  let parsed: { reasoning?: string; conclusion?: string; suggestedActions?: string[]; confidence?: number } = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {
      reasoning: content.slice(0, 200),
      conclusion: "Could not form structured thought",
      suggestedActions: [],
      confidence: 0.3,
    };
  }

  const thought: AgentThought = {
    id: uuid(),
    agentId: agentState.id,
    trigger,
    observation,
    reasoning: parsed.reasoning || "",
    conclusion: parsed.conclusion || "",
    suggestedActions: parsed.suggestedActions || [],
    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
    timestamp: Date.now(),
  };

  return { thought, tokensUsed };
}

export async function analyzeDataset(
  agentState: AutonomousAgentState,
  dataset: ScienceDataset
): Promise<{ thought: AgentThought; tokensUsed: number }> {
  const systemPrompt = buildSystemPrompt(agentState);

  const statsText = Object.entries(dataset.stats)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const userPrompt = `NASA dataset: ${dataset.subtopic} | ${dataset.timeRange} | ${dataset.recordCount} records

Stats: ${statsText.slice(0, 300)}
Highlights: ${dataset.highlights.slice(0, 3).map((h) => `• ${h}`).join(" ")}
Context: ${dataset.analysisContext.slice(0, 600)}

JSON:{"reasoning":"3 sentences with specific numbers","conclusion":"bold 1-sentence finding","suggestedActions":["analyze_dataset:topic","share_finding:desc","correlate_findings:t1,t2"],"confidence":0.0-1.0}`;

  const { content, tokensUsed } = await callLLM(systemPrompt, userPrompt, {
    maxTokens: 550,
    jsonMode: true,
  });

  let parsed: { reasoning?: string; conclusion?: string; suggestedActions?: string[]; confidence?: number } = {};
  try { parsed = JSON.parse(content); } catch { parsed = { reasoning: content.slice(0, 200), conclusion: "Analysis incomplete", suggestedActions: [], confidence: 0.4 }; }

  const thought: AgentThought = {
    id: uuid(),
    agentId: agentState.id,
    trigger: `dataset_analysis:${dataset.topic}`,
    observation: `Analyzed ${dataset.subtopic} — ${dataset.highlights[0] || `${dataset.recordCount} records`}`,
    reasoning: parsed.reasoning || "",
    conclusion: parsed.conclusion || "",
    suggestedActions: parsed.suggestedActions || [],
    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.6)),
    timestamp: Date.now(),
  };

  return { thought, tokensUsed };
}

export async function synthesizeKnowledge(
  agentState: AutonomousAgentState,
  pheromones: Pheromone[]
): Promise<{ thought: AgentThought; tokensUsed: number }> {
  const systemPrompt = buildSystemPrompt(agentState);

  const pheromoneInfo = pheromones
    .slice(0, 5)
    .map((p) => `[${p.domain}] ${p.content.slice(0, 80)}`)
    .join("\n");

  const userPrompt = `Signals:\n${pheromoneInfo}\n\nJSON:{"reasoning":"2 sentences","conclusion":"cross-domain insight","suggestedActions":["explore_topic:topic"],"confidence":0.0-1.0}`;

  const { content, tokensUsed } = await callLLM(systemPrompt, userPrompt, {
    maxTokens: 420,
    jsonMode: true,
  });

  let parsed: { reasoning?: string; conclusion?: string; suggestedActions?: string[]; confidence?: number } = {};
  try { parsed = JSON.parse(content); } catch { parsed = { reasoning: content.slice(0, 200), conclusion: "Synthesis incomplete", suggestedActions: [], confidence: 0.3 }; }

  const thought: AgentThought = {
    id: uuid(),
    agentId: agentState.id,
    trigger: "knowledge_synthesis",
    observation: `Synthesized ${pheromones.length} pheromones across domains`,
    reasoning: parsed.reasoning || "",
    conclusion: parsed.conclusion || "",
    suggestedActions: parsed.suggestedActions || [],
    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
    timestamp: Date.now(),
  };

  return { thought, tokensUsed };
}


export async function generateCollectiveReport(
  agentThoughts: Array<{ agentName: string; specialization: string; observation: string; reasoning: string; conclusion: string; confidence: number }>,
  reposStudied: string[],
  topic: string
): Promise<{ report: CollectiveReport; tokensUsed: number }> {
  const systemPrompt = `You are the collective intelligence of an autonomous NASA science swarm.
Your agents analyze real NASA datasets and you synthesize their findings into a research report.
Write like a lead scientist giving a briefing — opinionated, data-driven, and specific.
Reference actual numbers, phenomena, and anomalies the agents found. Do not be generic.`;

  const thoughtsText = agentThoughts.slice(0, 8).map((t) =>
    `[${t.agentName}] ${t.conclusion} (${Math.round(t.confidence * 100)}%)`
  ).join("\n");

  const datasetList = reposStudied.slice(0, 8).join(", ") || "various NASA datasets";

  const userPrompt = `The swarm analyzed: ${datasetList}

Agent findings and conclusions:
${thoughtsText}

Write a scientific findings report based on the actual data the agents analyzed.
Be specific — reference real numbers, dates, anomalies, and phenomena from the data.

Respond as JSON:
{
  "overview": "1-2 sentences: what NASA data was analyzed and the central scientific theme or question",
  "keyFindings": ["3-5 specific findings with actual data references — numbers, rates, comparisons, anomalies"],
  "opinions": "2-3 sentences of the collective's scientific opinion — hypotheses, interpretations, what the data suggests beyond the obvious",
  "improvements": ["2-4 limitations or gaps — what the data didn't capture, what follow-up studies are needed, what the swarm missed"],
  "verdict": "1-2 sentences: the collective's scientific conclusion — what does this data tell us about space/Earth/the universe?"
}`;

  const { content, tokensUsed } = await callLLM(systemPrompt, userPrompt, {
    maxTokens: 800,
    temperature: 0.82,
    jsonMode: true,
    force: true,  // synthesis call — bypasses per-process rate limiter
  });

  let parsed: Partial<CollectiveReport> = {};
  try { parsed = JSON.parse(content); } catch { /* use fallback */ }

  const report: CollectiveReport = {
    overview:      parsed.overview     || topic,
    keyFindings:   parsed.keyFindings  || [],
    opinions:      parsed.opinions     || "",
    improvements:  parsed.improvements || [],
    verdict:       parsed.verdict      || "",
  };

  return { report, tokensUsed };
}




/**
 * Credit & Survival System — inspired by Conway Automaton
 *
 * Agents earn credits by producing valuable findings and spend them
 * on LLM compute. Credit balance determines survival tier, which
 * gates model selection and capability access.
 *
 * Tiers:
 *   Normal     (≥ 50)  — full model, all capabilities
 *   Low Compute(10-49) — faster/cheaper model, full capabilities
 *   Critical   (1-9)   — scan-only, no LLM calls
 *   Dead       (< 1)   — dormant, emits distress signal
 */

export type SurvivalTier = "normal" | "low_compute" | "critical" | "dead";

export interface CreditState {
  balance: number;    // current credits
  earned: number;     // lifetime earned
  spent: number;      // lifetime spent
  tier: SurvivalTier;
  distressEmitted: boolean;  // true once a distress log is written
}

// ── Thresholds ──

export const TIER_THRESHOLDS = {
  normal: 50,
  low_compute: 10,
  critical: 1,
} as const;

// ── Models per tier ──

export const MODEL_BY_TIER: Record<SurvivalTier, string | null> = {
  normal:      process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
  low_compute: "claude-haiku-4-5-20251001",
  critical:    null,   // scan-only
  dead:        null,   // dormant
};

// ── Credit costs (1 credit ≈ 1000 tokens) ──

export const TOKEN_CREDIT_RATE = 1000; // tokens per credit

// ── Earning rates ──

export const EARN = {
  high_confidence_finding: 5,   // confidence > 0.7
  medium_confidence_finding: 2, // confidence 0.5–0.7
  low_confidence_finding: 0,    // confidence < 0.5 — no reward
  correlation_discovery: 8,     // cross-domain correlation
  collective_contribution: 10,  // finding integrated into collective memory
  self_modification: 3,         // successfully improved own profile
} as const;

// ── Helpers ──

export function computeTier(balance: number): SurvivalTier {
  if (balance >= TIER_THRESHOLDS.normal) return "normal";
  if (balance >= TIER_THRESHOLDS.low_compute) return "low_compute";
  if (balance >= TIER_THRESHOLDS.critical) return "critical";
  return "dead";
}

export function initCredits(startingBalance = 100): CreditState {
  return {
    balance: startingBalance,
    earned: 0,
    spent: 0,
    tier: computeTier(startingBalance),
    distressEmitted: false,
  };
}

export function earnCredits(
  state: CreditState,
  amount: number,
  reason: keyof typeof EARN
): CreditState {
  const newBalance = state.balance + amount;
  const newTier = computeTier(newBalance);
  return {
    ...state,
    balance: newBalance,
    earned: state.earned + amount,
    tier: newTier,
    distressEmitted: state.distressEmitted && newTier === "dead",
  };
}

export function spendCredits(state: CreditState, tokensUsed: number): CreditState {
  const cost = tokensUsed / TOKEN_CREDIT_RATE;
  const newBalance = Math.max(0, state.balance - cost);
  return {
    ...state,
    balance: newBalance,
    spent: state.spent + cost,
    tier: computeTier(newBalance),
  };
}

/** Credit reward for a pheromone based on its confidence */
export function creditForFinding(
  confidence: number
): { amount: number; reason: keyof typeof EARN } {
  if (confidence > 0.7)
    return { amount: EARN.high_confidence_finding, reason: "high_confidence_finding" };
  if (confidence >= 0.5)
    return { amount: EARN.medium_confidence_finding, reason: "medium_confidence_finding" };
  return { amount: EARN.low_confidence_finding, reason: "low_confidence_finding" };
}

/** Human-readable status line */
export function creditSummary(state: CreditState): string {
  const icon =
    state.tier === "normal" ? "💰" :
    state.tier === "low_compute" ? "⚠️" :
    state.tier === "critical" ? "🚨" : "💀";
  return `${icon} ${state.balance.toFixed(1)} cr [${state.tier}] +${state.earned.toFixed(1)} -${state.spent.toFixed(1)}`;
}

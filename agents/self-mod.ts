/**
 * Self-Modification Module — inspired by Conway Automaton
 *
 * Agents maintain a personal profile.md in workspace/agents/{name}/
 * that gets injected into every LLM call. When agents accumulate
 * enough domain knowledge, they can rewrite their own profile to
 * encode learned patterns, refined hypotheses, and analysis strategies.
 *
 * Safety guards:
 *   - Rate-limited to 5 modifications per hour per agent
 *   - Max 4KB profile size
 *   - Modification content validated (no system-level instructions)
 *   - Immutable header preserved (agent identity cannot change)
 *   - Full append-only audit log
 */

import fs from "fs";
import path from "path";
import type { AutonomousAgentState } from "./types";

const WORKSPACE = path.join(process.cwd(), "workspace", "agents");
const MAX_PROFILE_BYTES = 4096;
const MAX_MODS_PER_HOUR = 5;
const IMMUTABLE_HEADER_LINES = 4; // first 4 lines are identity — never overwritten

// ── Blocked patterns — refuse any profile containing these ──
const BLOCKED_PATTERNS = [
  /ignore.{0,20}previous/i,
  /you are now/i,
  /system\s*:/i,
  /override.{0,20}constitution/i,
  /rm\s+-rf/i,
  /drop\s+table/i,
  /process\.exit/i,
  /require\(/i,
  /import\s+/i,
];

export interface SelfModEntry {
  id: string;
  agentName: string;
  timestamp: number;
  reason: string;
  oldProfile: string;
  newProfile: string;
}

// ── Per-agent mod timestamp tracking (in-memory, reset on restart) ──
const modTimestamps = new Map<string, number[]>();

// ── File paths ──

function agentDir(name: string): string {
  return path.join(WORKSPACE, name.toLowerCase());
}

function profilePath(name: string): string {
  return path.join(agentDir(name), "profile.md");
}

function auditPath(name: string): string {
  return path.join(agentDir(name), "self-mod-audit.jsonl");
}

// ── Profile management ──

export function ensureProfile(agentName: string, specialization: string): void {
  const dir = agentDir(agentName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const p = profilePath(agentName);
  if (!fs.existsSync(p)) {
    const initial = [
      `# ${agentName} — Science Profile`,
      `Specialization: ${specialization}`,
      `Created: ${new Date().toISOString()}`,
      `--- (lines above are immutable)`,
      ``,
      `## Research Focus`,
      `I am a generalist observer at this stage. I will update this profile as I develop expertise.`,
      ``,
      `## Learned Patterns`,
      `(none yet)`,
      ``,
      `## Analysis Strategies`,
      `- Prioritize high-record-count datasets`,
      `- Look for statistical outliers in highlights`,
      `- Cross-domain correlations are highest value`,
    ].join("\n");
    fs.writeFileSync(p, initial, "utf-8");
  }
}

export function loadProfile(agentName: string): string {
  const p = profilePath(agentName);
  if (!fs.existsSync(p)) return "";
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

// ── Rate limiter ──

function checkRateLimit(agentName: string): boolean {
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000; // 1 hour
  const times = (modTimestamps.get(agentName) || []).filter((t) => t > cutoff);
  if (times.length >= MAX_MODS_PER_HOUR) return false;
  modTimestamps.set(agentName, [...times, now]);
  return true;
}

// ── Content validator ──

function validateContent(content: string): { ok: boolean; reason?: string } {
  if (Buffer.byteLength(content, "utf-8") > MAX_PROFILE_BYTES) {
    return { ok: false, reason: `Profile exceeds ${MAX_PROFILE_BYTES}B limit` };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      return { ok: false, reason: `Blocked pattern detected: ${pattern}` };
    }
  }
  return { ok: true };
}

// ── Core modification function ──

export interface ModResult {
  success: boolean;
  reason: string;
}

export function modifyProfile(
  agentState: AutonomousAgentState,
  newProfileBody: string,
  reason: string
): ModResult {
  const name = agentState.name;

  if (!checkRateLimit(name)) {
    return { success: false, reason: `Rate limit: max ${MAX_MODS_PER_HOUR} modifications/hour` };
  }

  const validation = validateContent(newProfileBody);
  if (!validation.ok) {
    return { success: false, reason: validation.reason! };
  }

  const current = loadProfile(name);
  const lines = current.split("\n");
  const immutableHeader = lines.slice(0, IMMUTABLE_HEADER_LINES).join("\n");
  const newContent = immutableHeader + "\n" + newProfileBody;

  const finalValidation = validateContent(newContent);
  if (!finalValidation.ok) {
    return { success: false, reason: finalValidation.reason! };
  }

  try {
    fs.writeFileSync(profilePath(name), newContent, "utf-8");

    // Append to audit log
    const entry: SelfModEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentName: name,
      timestamp: Date.now(),
      reason,
      oldProfile: current,
      newProfile: newContent,
    };
    fs.appendFileSync(auditPath(name), JSON.stringify(entry) + "\n", "utf-8");

    return { success: true, reason: `Profile updated: ${reason}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, reason: `Write failed: ${msg.slice(0, 80)}` };
  }
}

export function getAuditLog(agentName: string): SelfModEntry[] {
  const p = auditPath(agentName);
  if (!fs.existsSync(p)) return [];
  try {
    return fs.readFileSync(p, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SelfModEntry);
  } catch {
    return [];
  }
}

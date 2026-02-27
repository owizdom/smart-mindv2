/**
 * Clock-based Phase Machine
 *
 * Loads the content-addressed Wasm module (phase-machine.wasm) and exposes
 * computePhase(nowMs) → PhaseState. Every agent that loads the same binary
 * derives the same phase at the same wall-clock instant — no coordinator needed.
 *
 * The Wasm module divides Unix time into fixed-duration cycles:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ explore │ commit │       reveal       │    synthesis     │
 *   └──────────────────────────────────────────────────────────┘
 *   0         E        E+C                  E+C+R             total
 *
 * Phase durations are passed at call time so they can be tuned via env
 * without recompiling the Wasm module (the module itself just does arithmetic).
 *
 * Content address: sha256(phase-machine.wasm)
 * This hash is logged at startup so operators can verify all agents agree.
 */

import fs   from "fs";
import path from "path";
import crypto from "crypto";
import type { CyclePhase } from "./types";

// WebAssembly is a Node.js built-in but not in TypeScript's non-DOM lib.
// Declare the minimal subset we use so we don't need to add "dom" to tsconfig.
declare const WebAssembly: {
  instantiate(buffer: Buffer): Promise<{ instance: { exports: Record<string, unknown> } }>;
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface PhaseState {
  phase:            CyclePhase;
  cycleNumber:      number;
  phaseElapsedMs:   number;
  phaseRemainingMs: number;
  moduleHash:       string;   // sha256 of the loaded Wasm binary
}

interface WasmExports {
  computePhase:     (now: bigint, e: bigint, c: bigint, r: bigint, s: bigint) => number;
  cycleNumber:      (now: bigint, e: bigint, c: bigint, r: bigint, s: bigint) => bigint;
  phaseElapsedMs:   (now: bigint, e: bigint, c: bigint, r: bigint, s: bigint) => bigint;
  phaseRemainingMs: (now: bigint, e: bigint, c: bigint, r: bigint, s: bigint) => bigint;
}

const PHASE_NAMES: CyclePhase[] = ["explore", "commit", "reveal", "synthesis"];

// ── State ──────────────────────────────────────────────────────────────────

let exports_: WasmExports | null = null;
let moduleHash_                  = "";

// ── Init ───────────────────────────────────────────────────────────────────

/**
 * Load and instantiate the Wasm phase machine.
 * Must be called before computePhase(). Returns the module's content hash.
 */
export async function initPhaseMachine(wasmPath?: string): Promise<string> {
  const p = wasmPath ?? path.join(__dirname, "phase-machine.wasm");
  const binary = fs.readFileSync(p);

  moduleHash_ = crypto.createHash("sha256").update(binary).digest("hex");

  const result = await WebAssembly.instantiate(binary);
  exports_ = result.instance.exports as unknown as WasmExports;

  console.log(`[WasmPhase] Loaded phase-machine.wasm`);
  console.log(`[WasmPhase] hash = ${moduleHash_}`);

  return moduleHash_;
}

// ── computePhase ───────────────────────────────────────────────────────────

/**
 * Compute the current cycle phase from a Unix timestamp.
 *
 * @param nowMs       Current time in ms (usually Date.now())
 * @param exploreMs   Duration of the explore phase
 * @param commitMs    Duration of the commit phase
 * @param revealMs    Duration of the reveal phase
 * @param synthMs     Duration of the synthesis phase
 */
export function computePhase(
  nowMs:     number,
  exploreMs: number,
  commitMs:  number,
  revealMs:  number,
  synthMs:   number,
): PhaseState {
  if (!exports_) throw new Error("Phase machine not initialized — call initPhaseMachine() first");

  const now = BigInt(Math.floor(nowMs));
  const e   = BigInt(exploreMs);
  const c   = BigInt(commitMs);
  const r   = BigInt(revealMs);
  const s   = BigInt(synthMs);

  const phaseCode = exports_.computePhase(now, e, c, r, s);
  const cycle     = Number(exports_.cycleNumber(now, e, c, r, s));
  const elapsed   = Number(exports_.phaseElapsedMs(now, e, c, r, s));
  const remaining = Number(exports_.phaseRemainingMs(now, e, c, r, s));

  return {
    phase:            PHASE_NAMES[phaseCode] ?? "explore",
    cycleNumber:      cycle,
    phaseElapsedMs:   elapsed,
    phaseRemainingMs: remaining,
    moduleHash:       moduleHash_,
  };
}

/** The sha256 content hash of the loaded Wasm binary. */
export function getModuleHash(): string {
  return moduleHash_;
}

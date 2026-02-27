#!/usr/bin/env node
/**
 * Compile agents/phase-machine.wat → agents/phase-machine.wasm
 *
 * Run:  node scripts/compile-wasm.js
 * Or:   npm run compile:wasm
 *
 * The output binary is the content-addressed Wasm state machine.
 * Its sha256 hash serves as the canonical module identifier — every
 * agent that loads this exact binary will derive the same phase state.
 */

const path = require("path");
const fs   = require("fs");
const crypto = require("crypto");

const root    = path.join(__dirname, "..");
const watPath = path.join(root, "agents", "phase-machine.wat");
const outPath = path.join(root, "agents", "phase-machine.wasm");

async function main() {
  const wabt  = await require("wabt")();
  const src   = fs.readFileSync(watPath, "utf-8");
  const mod   = wabt.parseWat("phase-machine.wat", src, {
    mutable_globals:           true,
    sat_float_to_int:          true,
    sign_extension:            true,
    bulk_memory:               true,
    multi_value:               true,
    reference_types:           true,
    tail_call:                 true,
    exceptions:                true,
    gc:                        false,
    memory64:                  false,
    extended_const:            false,
    relaxed_simd:              false,
  });

  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  const binary = Buffer.from(buffer);
  fs.writeFileSync(outPath, binary);

  const hash = crypto.createHash("sha256").update(binary).digest("hex");
  console.log(`✓ Compiled  ${path.relative(root, outPath)}`);
  console.log(`  size:     ${binary.length} bytes`);
  console.log(`  sha256:   ${hash}`);
  console.log(`\nThis hash is the content address. All agents must load the`);
  console.log(`same binary to derive the same phase at the same wall-clock time.`);
}

main().catch(err => { console.error("Compile failed:", err.message); process.exit(1); });

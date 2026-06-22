#!/usr/bin/env node
// Phase 1 — Critical validation experiment (Apart AI judge requirement).
//
// Runs single-agent baseline + HAZE debate (VULNERABLE/SAFE framing) on the
// same 20-artifact CVE benchmark. Writes to results/raw_phase1.jsonl.
//
// Prerequisites:
//   cp .env.example .env   # add OPENROUTER_API_KEY
//
// Usage (from evaluation/):
//   node run_phase1.mjs
//   LIMIT=2 node run_phase1.mjs          # smoke test (~4 tasks)
//
// After completion:
//   RAW_FILE=raw_phase1.jsonl python3 analyze.py
//
// Estimated cost: ~USD 0.40 baseline (60 tasks) + ~USD 1.15 debate (60 tasks)
// ≈ USD 1.55 total at prior ~$0.019/task rates (may vary by model pricing).

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = {
  ...process.env,
  CONDITIONS: 'baseline,debate',
  REPEATS: process.env.REPEATS || '3',
  ROUNDS: process.env.ROUNDS || '1',
  RAW_FILE: 'raw_phase1.jsonl',
  CONCURRENCY: process.env.CONCURRENCY || '4',
};

console.log('=== HAZE Phase 1: baseline + debate (VULNERABLE/SAFE) ===');
console.log(`Output: results/${env.RAW_FILE}`);
console.log(`Conditions: ${env.CONDITIONS} | repeats: ${env.REPEATS} | rounds: ${env.ROUNDS}`);

const child = spawn('node', ['run_eval.mjs'], {
  cwd: __dirname,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));

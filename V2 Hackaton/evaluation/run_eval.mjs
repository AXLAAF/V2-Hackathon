// Batch evaluation runner for HAZE on the CVE vulnerable/patched dataset.
//
// Usage (from evaluation/):
//   node run_eval.mjs                       # full run, default config
//   LIMIT=2 CONDITIONS=baseline,debate node run_eval.mjs   # smoke test
//   REPEATS=3 ROUNDS=2 node run_eval.mjs
//
// Env / config:
//   OPENROUTER_API_KEY  (required; read from evaluation/.env if present)
//   CONDITIONS  comma list of: baseline, debate, debate_no_defense  (default all three)
//   REPEATS     repetitions per (artifact, condition)               (default 3)
//   ROUNDS      debate rounds                                        (default 2)
//   LIMIT       cap on number of artifacts (smoke testing)           (default: all)
//   CONCURRENCY parallel artifact-condition tasks                    (default 4)

import { readFile, readdir, mkdir, writeFile, appendFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDebate, runBaseline, verdictToPrediction, DEFAULT_MODELS } from './lib/protocol.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_DIR = path.resolve(__dirname, '..', 'vulnerabilities');
const RESULTS_DIR = path.resolve(__dirname, 'results');
const TRANSCRIPTS_DIR = path.join(RESULTS_DIR, 'transcripts');
const RAW = path.join(RESULTS_DIR, process.env.RAW_FILE || 'raw.jsonl');

async function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  const txt = await readFile(envPath, 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function discoverArtifacts() {
  const cves = (await readdir(DATASET_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name.startsWith('CVE-'))
    .map((d) => d.name)
    .sort();

  const artifacts = [];
  for (const cve of cves) {
    for (const [variant, label] of [['vulnerable', 1], ['patched', 0]]) {
      const dir = path.join(DATASET_DIR, cve, 'code', variant);
      if (!existsSync(dir)) continue;
      const files = (await readdir(dir, { withFileTypes: true })).filter(
        (f) => f.isFile() && !f.name.startsWith('.')
      );
      for (const f of files) {
        const full = path.join(dir, f.name);
        const content = await readFile(full, 'utf8');
        if (!content.trim()) continue;
        artifacts.push({
          id: `${cve}__${variant}`,
          cve,
          variant,
          label,
          filename: f.name,
          kind: 'source code',
          content,
        });
      }
    }
  }
  return artifacts;
}

async function runOne(artifact, condition, repeat, rounds, models) {
  let res;
  if (condition === 'baseline') res = await runBaseline({ artifact, models });
  else if (condition === 'debate') res = await runDebate({ artifact, models, rounds, variant: 'full' });
  else if (condition === 'debate_no_defense')
    res = await runDebate({ artifact, models, rounds, variant: 'no_defense' });
  else throw new Error(`Unknown condition: ${condition}`);

  const v = res.verdict;
  const record = {
    ts: new Date().toISOString(),
    id: artifact.id,
    cve: artifact.cve,
    variant: artifact.variant,
    label: artifact.label,
    condition,
    repeat,
    verdict: v.verdict,
    prediction: verdictToPrediction(v.verdict),
    confidence: v.confidence ?? null,
    severity: v.severity ?? null,
    cwe: v.cwe ?? null,
    winningTeam: v.winningTeam ?? null,
    reasoning: v.reasoning ?? null,
    judgeModel: v.model ?? null,
  };

  await appendFile(RAW, JSON.stringify(record) + '\n');
  const tname = `${artifact.id}__${condition}__r${repeat}.json`;
  await writeFile(
    path.join(TRANSCRIPTS_DIR, tname),
    JSON.stringify({ artifact: { ...artifact, content: undefined }, condition, repeat, verdict: v, transcript: res.transcript }, null, 2)
  );
  return record;
}

// Minimal concurrency limiter.
async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  await loadEnv();
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('ERROR: OPENROUTER_API_KEY not set (evaluation/.env).');
    process.exit(1);
  }

  const conditions = (process.env.CONDITIONS || 'baseline,debate,debate_no_defense')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const repeats = parseInt(process.env.REPEATS || '3', 10);
  const rounds = parseInt(process.env.ROUNDS || '1', 10);
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
  const concurrency = parseInt(process.env.CONCURRENCY || '4', 10);

  const models = { ...DEFAULT_MODELS };
  for (const k of Object.keys(DEFAULT_MODELS)) {
    const envk = `MODEL_${k.toUpperCase()}`;
    if (process.env[envk]) models[k] = process.env[envk];
  }

  await mkdir(TRANSCRIPTS_DIR, { recursive: true });

  let artifacts = await discoverArtifacts();
  if (Number.isFinite(limit)) artifacts = artifacts.slice(0, limit);

  // Build task list (artifact × condition × repeat).
  const tasks = [];
  for (const a of artifacts)
    for (const c of conditions)
      for (let r = 1; r <= repeats; r++) tasks.push({ a, c, r });

  console.log(
    `Dataset: ${artifacts.length} artifacts | conditions: ${conditions.join(', ')} | repeats: ${repeats} | rounds: ${rounds}`
  );
  console.log(`Total tasks: ${tasks.length} | concurrency: ${concurrency}`);
  console.log(`Models: ${JSON.stringify(models)}`);

  await writeFile(
    path.join(RESULTS_DIR, 'run_config.json'),
    JSON.stringify({ ts: new Date().toISOString(), conditions, repeats, rounds, models, nArtifacts: artifacts.length }, null, 2)
  );

  let done = 0;
  const t0 = Date.now();
  await mapLimit(tasks, concurrency, async ({ a, c, r }) => {
    try {
      const rec = await runOne(a, c, r, rounds, models);
      done++;
      console.log(
        `[${done}/${tasks.length}] ${a.id} | ${c} r${r} -> ${rec.verdict} (pred=${rec.prediction}, label=${a.label})`
      );
    } catch (err) {
      done++;
      console.error(`[${done}/${tasks.length}] ${a.id} | ${c} r${r} FAILED: ${err.message}`);
      await appendFile(
        RAW,
        JSON.stringify({ ts: new Date().toISOString(), id: a.id, cve: a.cve, variant: a.variant, label: a.label, condition: c, repeat: r, error: err.message }) + '\n'
      );
    }
  });

  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s. Raw -> ${RAW}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

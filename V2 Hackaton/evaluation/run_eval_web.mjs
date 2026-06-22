// Batch runner that drives the DEPLOYED HAZE web API (SSE) instead of calling
// OpenRouter directly. Uses the server-side key, so no local key is needed.
//
// NOTE: the deployed HAZE uses the "malicious software" framing (verdict
// MALICIOSO / NO_MALICIOSO / INCONCLUSO). We map MALICIOSO -> positive (1).
// On the CVE vulnerable/patched set this measures "dangerous-pattern" detection
// (recall on vulnerable) and false alarms on patched (FPR).
//
// Usage (from evaluation/):
//   HAZE_URL=https://hackaton.xooktech.com LIMIT=2 REPEATS=1 node run_eval_web.mjs
//   REPEATS=5 ROUNDS=2 CONDITIONS=debate,debate_r1 node run_eval_web.mjs

import { readFile, readdir, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deployed instance uses a self-signed certificate.
if (process.env.HAZE_INSECURE !== '0') process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_DIR = path.resolve(__dirname, '..', 'vulnerabilities');
const RESULTS_DIR = path.resolve(__dirname, 'results');
const TRANSCRIPTS_DIR = path.join(RESULTS_DIR, 'transcripts_web');
const RAW = path.join(RESULTS_DIR, 'raw.jsonl');

const HAZE_URL = (process.env.HAZE_URL || 'https://hackaton.xooktech.com').replace(/\/$/, '');

// Default roster (HAZE defaults from API/src/config/roles.js). Override via env.
const ROSTER = {
  fiscal_analista: process.env.MODEL_PROSECUTOR_ANALYST || 'deepseek/deepseek-chat',
  defensa_auditor: process.env.MODEL_DEFENSE_AUDITOR || 'google/gemini-2.0-flash-001',
  fiscal_abogado: process.env.MODEL_PROSECUTOR_LEAD || 'openai/gpt-4o-mini',
  defensa_abogado: process.env.MODEL_DEFENSE_COUNSEL || 'meta-llama/llama-3.1-70b-instruct',
  juez: process.env.MODEL_JUDGE || 'anthropic/claude-sonnet-4-5',
};

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
        const content = await readFile(path.join(dir, f.name), 'utf8');
        if (!content.trim()) continue;
        artifacts.push({ id: `${cve}__${variant}`, cve, variant, label, filename: f.name, content });
      }
    }
  }
  return artifacts;
}

// POST to /api/analyze and parse the SSE stream, returning { verdict, transcript }.
async function analyzeViaWeb({ artifact, rounds }) {
  const body = {
    artifact: { filename: artifact.filename, kind: 'source code', content: artifact.content },
    rounds,
    models: ROSTER,
  };
  const res = await fetch(`${HAZE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let verdict = null;
  let lastEvent = null;
  const transcript = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.startsWith('event:')) lastEvent = line.slice(6).trim();
      else if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (lastEvent === 'verdict') {
          try { verdict = JSON.parse(data); } catch { /* ignore */ }
        } else if (lastEvent === 'error') {
          throw new Error(`server error: ${data.slice(0, 200)}`);
        }
      }
    }
  }
  if (!verdict) throw new Error('no verdict event received');
  return { verdict, transcript };
}

const POS = new Set(['MALICIOSO', 'MALICIOUS', 'VULNERABLE']);
const predictionOf = (v) => (POS.has(String(v || '').toUpperCase()) ? 1 : 0);

async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const conditions = (process.env.CONDITIONS || 'debate').split(',').map((s) => s.trim()).filter(Boolean);
  const repeats = parseInt(process.env.REPEATS || '5', 10);
  const baseRounds = parseInt(process.env.ROUNDS || '2', 10);
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
  const concurrency = parseInt(process.env.CONCURRENCY || '3', 10);

  // Map condition name -> rounds.
  const roundsFor = (c) => (c === 'debate_r1' ? 1 : c === 'debate_r4' ? 4 : baseRounds);

  await mkdir(TRANSCRIPTS_DIR, { recursive: true });
  let artifacts = await discoverArtifacts();
  if (Number.isFinite(limit)) artifacts = artifacts.slice(0, limit);

  let tasks = [];
  for (const a of artifacts) for (const c of conditions) for (let r = 1; r <= repeats; r++) tasks.push({ a, c, r });

  // Idempotent gap-fill: only run (artifact,condition,repeat) cells that do not
  // already have a SUCCESSFUL record in raw.jsonl.
  if (process.env.RETRY_MISSING === '1' && existsSync(RAW)) {
    const done = new Set();
    for (const line of (await readFile(RAW, 'utf8')).split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (!('error' in r)) done.add(`${r.id}|${r.condition}|${r.repeat}`);
      } catch { /* ignore */ }
    }
    const before = tasks.length;
    tasks = tasks.filter((t) => !done.has(`${t.a.id}|${t.c}|${t.r}`));
    console.log(`RETRY_MISSING: ${tasks.length} pending of ${before}`);
  }

  console.log(`Endpoint: ${HAZE_URL} | artifacts: ${artifacts.length} | conditions: ${conditions.join(',')} | repeats: ${repeats}`);
  console.log(`Roster: ${JSON.stringify(ROSTER)}`);
  console.log(`Total tasks: ${tasks.length} | concurrency: ${concurrency}`);
  await writeFile(
    path.join(RESULTS_DIR, 'run_config_web.json'),
    JSON.stringify({ ts: new Date().toISOString(), endpoint: HAZE_URL, conditions, repeats, baseRounds, roster: ROSTER, nArtifacts: artifacts.length }, null, 2)
  );

  let done = 0;
  const t0 = Date.now();
  await mapLimit(tasks, concurrency, async ({ a, c, r }) => {
    try {
      const { verdict } = await analyzeViaWeb({ artifact: a, rounds: roundsFor(c) });
      const pred = predictionOf(verdict.verdict);
      const rec = {
        ts: new Date().toISOString(), id: a.id, cve: a.cve, variant: a.variant, label: a.label,
        condition: c, repeat: r, verdict: verdict.verdict, prediction: pred,
        confidence: verdict.confidence ?? null, riskLevel: verdict.riskLevel ?? null,
        winningTeam: verdict.winningTeam ?? null, reasoning: verdict.reasoning ?? null, judgeModel: verdict.model ?? null,
      };
      await appendFile(RAW, JSON.stringify(rec) + '\n');
      await writeFile(path.join(TRANSCRIPTS_DIR, `${a.id}__${c}__r${r}.json`), JSON.stringify({ artifact: { id: a.id, filename: a.filename }, condition: c, repeat: r, verdict }, null, 2));
      done++;
      console.log(`[${done}/${tasks.length}] ${a.id} | ${c} r${r} -> ${verdict.verdict} (pred=${pred}, label=${a.label})`);
    } catch (err) {
      done++;
      console.error(`[${done}/${tasks.length}] ${a.id} | ${c} r${r} FAILED: ${err.message}`);
      await appendFile(RAW, JSON.stringify({ ts: new Date().toISOString(), id: a.id, cve: a.cve, variant: a.variant, label: a.label, condition: c, repeat: r, error: err.message }) + '\n');
    }
  });
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${RAW}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

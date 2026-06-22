# HAZE evaluation harness

Reproducible batch evaluation of the HAZE protocol (multi-agent adversarial
debate + isolated judge) against a **single-agent baseline**, on the labeled
CVE dataset (`../vulnerabilities/`, 10 CVEs × {vulnerable, patched} = 20
artifacts).

The protocol mirrors `../../API` (HAZE) in structure — same 2v2 + isolated-judge
topology, turn order and temperatures (0.7 debaters / 0.1 judge) — but the
prompts are reframed from "is this malware?" to **"does this artifact contain an
exploitable vulnerability?"**, which matches the CVE dataset.

## Ground truth and labels

- `vulnerable/` artifact → label **1** (positive: exploitable).
- `patched/` artifact → label **0** (negative: safe).
- A judge/baseline verdict of `VULNERABLE` → positive prediction; `SAFE` or
  `INCONCLUSIVE` → negative prediction.

This makes **recall** the detection rate on vulnerable code and **FPR** the rate
of false alarms on patched code.

## Conditions

| Condition | Description |
|---|---|
| `baseline` | Single LLM, one pass: "find the vulnerability" |
| `debate` | Full HAZE: 2v2 debaters × N rounds + isolated judge |
| `debate_no_defense` | Ablation: only the prosecution speaks (isolates the value of structured opposition) |

## Run

```bash
# 1) deps
npm --version            # Node >= 18 (uses global fetch, no node deps)
pip install -r requirements.txt

# 2) key
cp .env.example .env     # add OPENROUTER_API_KEY

# 3) smoke test (2 artifacts, 2 conditions)
LIMIT=2 REPEATS=1 CONDITIONS=baseline,debate node run_eval.mjs

# 4) full run
REPEATS=3 ROUNDS=2 node run_eval.mjs

# 5) analysis -> results/metrics.json, results/summary.md, results/figures/
python analyze.py
```

## Config (env vars)

`CONDITIONS`, `REPEATS` (default 3), `ROUNDS` (default 2), `LIMIT`,
`CONCURRENCY` (default 4), and per-role `MODEL_*` overrides (see `.env.example`).

## Outputs

- `results/raw.jsonl` — one row per (artifact, condition, repeat).
- `results/transcripts/` — full debate transcripts + verdict per run.
- `results/metrics.json`, `results/summary.md`, `results/figures/`.

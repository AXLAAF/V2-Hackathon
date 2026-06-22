# HAZE — Hallucination-Aware Zero-sum Examination

> **Core claim:** *Single-agent auditors ask “is there a bug?” and often invent one; HAZE asks “did this accusation survive refutation?”*

**Conceptual foundation:** [AI Control through Majority Voting (UIAA)](https://apartresearch.com/project/ai-control-through-majority-voting-uiaa) — never trust a single LLM pass; aggregate redundant samples. HAZE extends this from *generation* control to *audit* control via adversarial debate.

**HAZE** is a multi-agent adversarial debate system for automated software security auditing. Four LLM roles (prosecution 2v2 + defense 2v2) cross-examine a code artifact; an **isolated judge** rules only on what survived refutation.

**Authors:** Samuel Blanco, Samuel Díaz, Axel Morales, Alex Novelo

**Live demo (30 seconds):** Open [hackaton.xooktech.com](https://hackaton.xooktech.com/) → paste code from `API/examples/suspicious_installer.py` → **Start trial** → watch four agents debate live → read the judge's structured verdict.

## Headline results (n = 20 artifacts, 3 repeats each)

| Condition | Precision | Recall | FPR | F1 | Status |
|---|---|---|---|---|---|
| Single-agent baseline | — | — | — | — | Harness ready, **not yet run** |
| HAZE debate (2 rounds) | 72.7% | **80.0%** | 30.0% | 76.2% | Measured |
| HAZE debate (1 round) | 72.7% | **80.0%** | 30.0% | 76.2% | Ablation (McNemar *p* = 1.0) |

Full analysis: [`evaluation/results/summary.md`](V2%20Hackaton/evaluation/results/summary.md)

### Error taxonomy (why it fails — and where it works)

| Class | What happens | Count |
|---|---|---|
| **A — Visible-sink detection** | Dangerous primitive explicit in file (`eval`, `memcpy`, `system`) | 8 TP |
| **B — Cross-file blind spot** | Bug lives outside the artifact (module, config, templating) | 2 FN |
| **C — Framing false alarm** | Patched code still looks dangerous under “malware?” framing | 3 FP |

## Repository layout

| Path | Description |
|---|---|
| [`API/`](API/) | HAZE monolith — Fastify, OpenRouter, SSE debate API, web UI |
| [`V2 Hackaton/vulnerabilities/`](V2%20Hackaton/vulnerabilities/) | Benchmark: 10 CVEs × {vulnerable, patched} = 20 artifacts |
| [`V2 Hackaton/evaluation/`](V2%20Hackaton/evaluation/) | Batch harness, metrics, figures, 120 debate transcripts |
| [`V2 Hackaton/global-south-ais-template-main/draft_submission.md`](V2%20Hackaton/global-south-ais-template-main/draft_submission.md) | Research paper (English, extended draft) |
| [`V2 Hackaton/global-south-ais-template-main/report.tex`](V2%20Hackaton/global-south-ais-template-main/report.tex) | **Hackathon submission PDF source** |
| [`V2 Hackaton/global-south-ais-template-main/SUBMISSION.md`](V2%20Hackaton/global-south-ais-template-main/SUBMISSION.md) | Compile & upload checklist |

## Quick start — run HAZE locally

```bash
cd API
npm install
cp .env.example .env   # add OPENROUTER_API_KEY
npm run dev            # http://localhost:4747
```

## Quick start — reproduce evaluation

```bash
cd "V2 Hackaton/evaluation"
cp .env.example .env   # for local baseline only
HAZE_URL=https://hackaton.xooktech.com node run_eval_web.mjs
python analyze.py      # -> results/metrics.json, summary.md, figures/
```

## Research questions

| # | Question | Answer (this run) |
|---|---|---|
| RQ1 | Does debate detect real vulnerabilities? | **80% recall** (8/10) |
| RQ2 | Does it hallucinate on patched code? | **30% FPR** (3/10) |
| RQ3 | Does a 2nd round change verdicts? | **No** (McNemar *p* = 1.0) |
| RQ4 | Does debate beat single-agent on FPR? | **Pending** — run `run_eval.mjs` |

## License

See repository for hackathon submission terms.

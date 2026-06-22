# HAZE — Hallucination-Aware Zero-sum Examination

**HAZE** is a multi-agent adversarial debate system for automated software security
auditing. Four LLM roles (prosecution 2v2 + defense 2v2) argue over whether a code
artifact is malicious or vulnerable; an **isolated judge** reads the transcript and
emits a structured verdict. Built for the [Global South AI Safety Hackathon](https://github.com/AXLAAF/V2-Hackathon).

**Authors:** Samuel Blanco, Samuel Díaz, Axel Morales, Alex Novelo

**Live demo:** https://hackaton.xooktech.com/

## Repository layout

| Path | Description |
|---|---|
| [`API/`](API/) | HAZE monolith — Fastify backend, OpenRouter orchestrator, SSE debate API, web UI |
| [`V2 Hackaton/vulnerabilities/`](V2%20Hackaton/vulnerabilities/) | Ground-truth benchmark: 10 CVEs × {vulnerable, patched} = 20 artifacts |
| [`V2 Hackaton/evaluation/`](V2%20Hackaton/evaluation/) | Batch evaluation harness, metrics, figures, and debate transcripts |
| [`V2 Hackaton/global-south-ais-template-main/draft_submission.md`](V2%20Hackaton/global-south-ais-template-main/draft_submission.md) | Research paper draft (English) |
| [`V2 Hackaton/global-south-ais-template-main/report.tex`](V2%20Hackaton/global-south-ais-template-main/report.tex) | LaTeX report |

## Quick start (HAZE tool)

```bash
cd API
npm install
cp .env.example .env   # add OPENROUTER_API_KEY
npm run dev            # http://localhost:4747
```

## Quick start (evaluation)

```bash
cd "V2 Hackaton/evaluation"
cp .env.example .env   # add OPENROUTER_API_KEY (for local baseline only)
# Against deployed HAZE:
HAZE_URL=https://hackaton.xooktech.com node run_eval_web.mjs
python analyze.py      # metrics, CIs, figures -> results/
```

## Headline results (web evaluation, n=20 artifacts)

| Condition | Precision | Recall | FPR | F1 |
|---|---|---|---|---|
| HAZE debate (2 rounds) | 72.7% | 80.0% | 30.0% | 76.2% |
| HAZE debate (1 round) | 72.7% | 80.0% | 30.0% | 76.2% |

Full analysis: [`evaluation/results/summary.md`](V2%20Hackaton/evaluation/results/summary.md)

## License

See repository for hackathon submission terms.

# HAZE — Hallucination-Aware Zero-sum Examination

> **Core claim:** *Single-agent auditors ask “is there a bug?” and often invent one; HAZE asks “did this accusation survive refutation?”*

**Conceptual foundation:** [AI Control through Majority Voting (UIAA)](https://apartresearch.com/project/ai-control-through-majority-voting-uiaa) — never trust a single LLM pass; aggregate redundant samples. HAZE extends this from *generation* control to *audit* control via adversarial debate.

**HAZE** is a multi-agent adversarial debate system for automated software security auditing. Four LLM roles (prosecution 2v2 + defense 2v2) cross-examine a code artifact; an **isolated judge** rules only on what survived refutation.

**Authors:** Samuel Blanco, Samuel Díaz, Axel Morales, Alex Novelo

**Live demo (30 seconds):** Open [hackaton.xooktech.com](https://hackaton.xooktech.com/) → paste code from `API/examples/suspicious_installer.py` → **Start trial** → watch four agents debate live → read the judge's structured verdict.

## Headline results — Phase 1 (VULNERABLE/SAFE, n = 20, 3 repeats)

| Condition | Precision | Recall | FPR | F1 | Status |
|---|---|---|---|---|---|
| Single-agent baseline | 55.6% | **100%** | **80.0%** | 71.4% | **Measured** |
| HAZE debate (1 round) | **80.0%** | 80.0% | **20.0%** | **80.0%** | **Measured** |

McNemar baseline vs debate: *p* = 0.344 (directional; FPR 80%→20%, underpowered at n=20).

Full analysis: [`evaluation/results/summary_phase1.md`](V2%20Hackaton/evaluation/results/summary_phase1.md)

Prior web run (malware framing): [`summary.md`](V2%20Hackaton/evaluation/results/summary.md)

**Cost efficiency:** The full web benchmark (120 labeled verdicts, five models, 1–2 debate rounds) cost **~USD 2.3** in OpenRouter tokens (~**$0.02 per verdict**, ~42 min wall-clock). At this price, defaulting to **1 debate round** (McNemar showed zero verdict change) would roughly halve cost and latency.

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
| [`V2 Hackaton/docs/VALIDATION-ROADMAP.md`](V2%20Hackaton/docs/VALIDATION-ROADMAP.md) | Measured vs pending experiments (judge review) |

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
| RQ4 | Does debate beat single-agent on FPR? | **Yes (directional):** 80%→20% FPR; McNemar *p* = 0.34 at n=20 |

## License

See repository for hackathon submission terms.

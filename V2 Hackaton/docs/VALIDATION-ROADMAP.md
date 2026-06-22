# HAZE Validation Roadmap

Status after **second judge review** (June 2026). The judge confirmed cost-efficiency
(~USD 2.3 / 120 web runs) but noted the **central hypothesis remains unproven** until
controlled experiments are measured—not merely acknowledged in text.

## What is measured vs pending

| Experiment | Framing | Status | Blocks claim |
|---|---|---|---|
| Web eval (120 tasks) | Malware (`MALICIOSO`) | **Done** — 80% recall, 30% FPR | RQ4 (vs baseline) |
| Single-agent baseline | `VULNERABLE`/`SAFE` | **Done** — 100% recall, **80% FPR** | RQ4 answered (directional) |
| HAZE debate (local harness) | `VULNERABLE`/`SAFE` | **Done** — 80% recall, **20% FPR** | Class C largely fixed |
| Round-2 ablation (re-run) | `VULNERABLE`/`SAFE` | **Pending** | Prompt patch validation |
| Benchmark expansion (n≥60) | — | **Pending** | Statistical power |
| Investigator (NVD/OSV) | — | Not implemented | Class B partial |
| Multi-file RAG | — | Not implemented | Class B |

## Phase 1 — Run now (~USD 1.5–2.0)

```bash
cd "V2 Hackaton/evaluation"
cp .env.example .env          # OPENROUTER_API_KEY required
node run_phase1.mjs             # 120 tasks: baseline + debate × 20 × 3 repeats
RAW_FILE=raw_phase1.jsonl python3 analyze.py
```

**Success criterion:** FPR(debate) < FPR(baseline) with McNemar p < 0.05 on paired artifacts.

Smoke test first:

```bash
LIMIT=2 REPEATS=1 node run_phase1.mjs
```

## Phase 2 — Implemented in code (needs re-evaluation)

- [x] API prompts reframed to **VULNERABLE / SEGURO** (AppSec, not malware)
- [x] Default **1 debate round** (McNemar p=1.0 on prior run)
- [x] **Early-stop** moderator after round 1 when consensus is clear
- [x] Round 2+ prompts require explicit line-by-line rebuttal
- [ ] Deploy updated API to production
- [ ] Re-run benchmark and update `report.pdf` tables

## Phase 3 — Post-hackathon

1. Expand benchmark to 30 CVEs (n=60 artifacts)
2. Implement Investigator role (OSV/NVD lookup → judge context)
3. Lightweight dependency RAG for Class B cross-file flaws

## Judge verdict (summary)

> Excellent cost-efficient engineering scaffold; formal scientific validation requires
> the control experiment. Acknowledging missing data ≠ substituting for data.

The honest submission stance: **HAZE is a reproducible, ~$0.02/verdict audit harness**;
whether debate beats single-agent auditing is a **testable claim with a one-command experiment**.

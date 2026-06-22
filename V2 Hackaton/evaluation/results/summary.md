# Evaluation results (auto-generated)

> **Headline:** 80% recall · 30% FPR · 76.2% F1 on 20 labeled artifacts (8 TP, 3 FP, 7 TN, 2 FN).

- Records (artifact × condition × repeat): **120**
- Artifacts per condition (majority-vote over repeats): **20**

## Table 1 — Measured vs pending conditions

| Condition | Precision | Recall | FPR | Accuracy | F1 | TP/FP/TN/FN | Status |
|---|---|---|---|---|---|---|---|
| Single-agent baseline | — | — | — | — | — | — | **Not yet run** |
| HAZE debate (2 rounds) | 72.7% [43.4, 90.3] | 80.0% [49.0, 94.3] | 30.0% [10.8, 60.3] | 75.0% [53.1, 88.8] | 76.2% | 8/3/7/2 | Measured |
| HAZE debate (1 round) | 72.7% [43.4, 90.3] | 80.0% [49.0, 94.3] | 30.0% [10.8, 60.3] | 75.0% [53.1, 88.8] | 76.2% | 8/3/7/2 | Ablation |

**McNemar (1 vs 2 rounds):** discordant b=1, c=1, p = 1.0000 (n=20).

## Table 2 — Error taxonomy

| Class | Mechanism | Count | CVEs |
|---|---|---|---|
| A — Visible-sink detection | Dangerous sink explicit in artifact | 8 TP | 10520, 44262, 24061, 53435, 41089, 44815, 50751, 5076 |
| B — Cross-file blind spot | Root cause outside artifact text | 2 FN | 42945 (NGINX module), 32625 (MCP templating) |
| C — Framing false alarm | Patched code looks dangerous under malware framing | 3 FP | 24061, 41089, 44815 (patched) |

![Figure 1](figures/fig1_fpr.svg)

![Figure 2](figures/fig2_metrics.svg)

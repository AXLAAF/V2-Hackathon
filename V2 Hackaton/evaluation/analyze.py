#!/usr/bin/env python3
"""Analyze HAZE evaluation results (standard-library only).

Reads results/raw.jsonl (from run_eval_web.mjs / run_eval.mjs) and computes,
per condition: confusion matrix, precision/recall/specificity/FPR/accuracy/F1
with Wilson 95% CIs, plus paired McNemar tests vs the full HAZE debate.
Emits results/metrics.json, results/summary.md and SVG figures under
results/figures/. No third-party dependencies (no numpy/scipy/matplotlib).

Usage:  python3 analyze.py
"""
from __future__ import annotations

import json
import math
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, "results")
RAW = os.path.join(RESULTS, "raw.jsonl")
FIGDIR = os.path.join(RESULTS, "figures")

CONDITION_LABELS = {
    "baseline": "Single-agent baseline",
    "debate": "HAZE debate (2 rounds)",
    "debate_r1": "HAZE debate (1 round)",
    "debate_r4": "HAZE debate (4 rounds)",
    "debate_no_defense": "Ablation: no defense",
}
CONDITION_ORDER = ["baseline", "debate_r1", "debate", "debate_r4", "debate_no_defense"]


# ----------------------------- statistics ----------------------------------

def wilson(k: int, n: int, z: float = 1.96):
    """Wilson score 95% CI for proportion k/n -> (p, lo, hi)."""
    if n == 0:
        return (float("nan"), float("nan"), float("nan"))
    p = k / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    half = (z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom
    return (p, max(0.0, center - half), min(1.0, center + half))


def mcnemar_p(b: int, c: int) -> float:
    """Exact two-sided McNemar p-value (binomial, p=0.5)."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    cum = sum(math.comb(n, i) for i in range(0, k + 1)) / (2 ** n)
    return min(1.0, 2 * cum)


# ----------------------------- data ----------------------------------------

def load_records():
    recs = []
    with open(RAW, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if "error" in r:
                continue
            recs.append(r)
    return recs


def majority_by_artifact(recs):
    """Collapse repeats: per (condition, id) -> majority prediction + label."""
    buckets = defaultdict(list)
    for r in recs:
        buckets[(r["condition"], r["id"])].append(r)
    out = defaultdict(dict)
    for (cond, art_id), rows in buckets.items():
        preds = [int(x["prediction"]) for x in rows]
        mean = sum(preds) / len(preds)
        pred = 1 if mean > 0.5 else 0  # ties -> negative (not flagged)
        agree = max(preds.count(0), preds.count(1)) / len(preds)
        out[cond][art_id] = {"pred": pred, "label": int(rows[0]["label"]), "n": len(rows), "agreement": agree}
    return out


def confusion(per_art):
    tp = fp = tn = fn = 0
    for d in per_art.values():
        y, p = d["label"], d["pred"]
        if y == 1 and p == 1:
            tp += 1
        elif y == 1 and p == 0:
            fn += 1
        elif y == 0 and p == 1:
            fp += 1
        else:
            tn += 1
    return tp, fp, tn, fn


def metrics_for(per_art):
    tp, fp, tn, fn = confusion(per_art)
    rec = wilson(tp, tp + fn)
    spec = wilson(tn, tn + fp)
    fpr_p = (fp / (fp + tn)) if (fp + tn) else float("nan")
    fpr_lo = 1 - spec[2] if not math.isnan(spec[2]) else float("nan")
    fpr_hi = 1 - spec[1] if not math.isnan(spec[1]) else float("nan")
    prec = wilson(tp, tp + fp)
    acc = wilson(tp + tn, tp + fp + tn + fn)
    f1 = (2 * prec[0] * rec[0] / (prec[0] + rec[0])) if (prec[0] + rec[0]) else 0.0
    return {
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "recall": rec, "specificity": spec, "fpr": (fpr_p, fpr_lo, fpr_hi),
        "precision": prec, "accuracy": acc, "f1": f1,
    }


def mcnemar(per_a, per_b):
    ids = set(per_a) & set(per_b)
    b = c = 0
    for i in ids:
        a_ok = per_a[i]["pred"] == per_a[i]["label"]
        b_ok = per_b[i]["pred"] == per_b[i]["label"]
        if a_ok and not b_ok:
            b += 1
        elif not a_ok and b_ok:
            c += 1
    return {"n": len(ids), "b": b, "c": c, "p_value": mcnemar_p(b, c)}


def fmt_ci(t):
    return f"{t[0]*100:.1f}% [{t[1]*100:.1f}, {t[2]*100:.1f}]"


# ----------------------------- SVG figures ---------------------------------

_PALETTE = ["#dc2626", "#2563eb", "#16a34a", "#d97706", "#7c3aed"]


def _svg_grouped_bars(path, title, categories, series, ylabel="%", ymax=100.0):
    """series: list of {name, values:[...], errs:[(lo,hi)|None,...]|None}."""
    W, H = 760, 460
    ml, mr, mt, mb = 70, 20, 60, 110
    pw, ph = W - ml - mr, H - mt - mb
    n_groups = len(categories)
    n_series = len(series)
    group_w = pw / max(n_groups, 1)
    bar_w = group_w / (n_series + 1)

    def x_of(gi, si):
        return ml + gi * group_w + (si + 0.5) * bar_w + bar_w / 2

    def y_of(v):
        return mt + ph * (1 - v / ymax)

    s = []
    s.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="Segoe UI, Arial, sans-serif">')
    s.append(f'<rect width="{W}" height="{H}" fill="white"/>')
    s.append(f'<text x="{W/2}" y="28" text-anchor="middle" font-size="16" font-weight="bold">{title}</text>')
    # y gridlines + labels
    for t in range(0, int(ymax) + 1, 20):
        y = y_of(t)
        s.append(f'<line x1="{ml}" y1="{y:.1f}" x2="{W-mr}" y2="{y:.1f}" stroke="#e5e7eb"/>')
        s.append(f'<text x="{ml-8}" y="{y+4:.1f}" text-anchor="end" font-size="11" fill="#374151">{t}</text>')
    s.append(f'<text x="18" y="{mt+ph/2}" text-anchor="middle" font-size="12" fill="#374151" transform="rotate(-90 18 {mt+ph/2})">{ylabel}</text>')
    # bars
    for gi, cat in enumerate(categories):
        for si, ser in enumerate(series):
            v = ser["values"][gi]
            if v is None or (isinstance(v, float) and math.isnan(v)):
                continue
            x = x_of(gi, si)
            y = y_of(v)
            color = _PALETTE[si % len(_PALETTE)]
            s.append(f'<rect x="{x-bar_w/2:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{(mt+ph)-y:.1f}" fill="{color}"/>')
            s.append(f'<text x="{x:.1f}" y="{y-4:.1f}" text-anchor="middle" font-size="10" fill="#111">{v:.0f}</text>')
            errs = ser.get("errs")
            if errs and errs[gi]:
                lo, hi = errs[gi]
                ylo, yhi = y_of(lo), y_of(hi)
                s.append(f'<line x1="{x:.1f}" y1="{yhi:.1f}" x2="{x:.1f}" y2="{ylo:.1f}" stroke="#111" stroke-width="1"/>')
                s.append(f'<line x1="{x-4:.1f}" y1="{yhi:.1f}" x2="{x+4:.1f}" y2="{yhi:.1f}" stroke="#111" stroke-width="1"/>')
                s.append(f'<line x1="{x-4:.1f}" y1="{ylo:.1f}" x2="{x+4:.1f}" y2="{ylo:.1f}" stroke="#111" stroke-width="1"/>')
        cx = ml + gi * group_w + group_w / 2
        s.append(f'<text x="{cx:.1f}" y="{mt+ph+18:.1f}" text-anchor="middle" font-size="12" font-weight="bold">{cat}</text>')
    # legend
    lx, ly = ml, H - 40
    for si, ser in enumerate(series):
        color = _PALETTE[si % len(_PALETTE)]
        s.append(f'<rect x="{lx}" y="{ly-10}" width="12" height="12" fill="{color}"/>')
        s.append(f'<text x="{lx+18}" y="{ly}" font-size="11" fill="#111">{ser["name"]}</text>')
        lx += 20 + 7.2 * len(ser["name"]) + 24
    s.append("</svg>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(s))


# ----------------------------- main ----------------------------------------

def main():
    os.makedirs(FIGDIR, exist_ok=True)
    recs = load_records()
    if not recs:
        raise SystemExit("No valid records in results/raw.jsonl")

    per = majority_by_artifact(recs)
    present = set(per)
    conditions = [c for c in CONDITION_ORDER if c in present]
    conditions += [c for c in sorted(present) if c not in conditions]
    metrics = {c: metrics_for(per[c]) for c in conditions}

    tests = {}
    ref = "debate" if "debate" in per else None
    if ref:
        for c in conditions:
            if c != ref:
                tests[f"{c}_vs_{ref}"] = mcnemar(per[c], per[ref])

    out = {"n_records": len(recs), "conditions": conditions, "metrics": metrics, "tests": tests}
    with open(os.path.join(RESULTS, "metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)

    labels = [CONDITION_LABELS.get(c, c) for c in conditions]

    # Figure 1: FPR by condition with 95% CI error bars.
    fpr_vals = [metrics[c]["fpr"][0] * 100 for c in conditions]
    fpr_errs = [(metrics[c]["fpr"][1] * 100, metrics[c]["fpr"][2] * 100) for c in conditions]
    _svg_grouped_bars(
        os.path.join(FIGDIR, "fig1_fpr.svg"),
        "Figure 1. False-positive rate by condition (lower is better)",
        labels, [{"name": "FPR (%)", "values": fpr_vals, "errs": fpr_errs}],
        ylabel="False-positive rate (%)",
    )

    # Figure 2: precision / recall / FPR grouped by condition.
    groups = ["Precision", "Recall", "FPR"]
    series = []
    for c in conditions:
        series.append({
            "name": CONDITION_LABELS.get(c, c),
            "values": [metrics[c]["precision"][0] * 100, metrics[c]["recall"][0] * 100, metrics[c]["fpr"][0] * 100],
        })
    _svg_grouped_bars(os.path.join(FIGDIR, "fig2_metrics.svg"),
                      "Figure 2. Precision / Recall / FPR by condition", groups, series, ylabel="%")

    # summary.md
    n_art = len(per[conditions[0]])
    lines = ["# Evaluation results (auto-generated)\n",
             f"- Records (artifact x condition x repeat): **{len(recs)}**",
             f"- Artifacts per condition (majority-vote over repeats): **{n_art}**\n",
             "## Table 1. Detection metrics by condition (95% Wilson CIs)\n",
             "| Condition | Precision | Recall | FPR | Accuracy | F1 | TP/FP/TN/FN |",
             "|---|---|---|---|---|---|---|"]
    for c in conditions:
        m = metrics[c]
        lines.append(f"| {CONDITION_LABELS.get(c,c)} | {fmt_ci(m['precision'])} | {fmt_ci(m['recall'])} | "
                     f"{fmt_ci(m['fpr'])} | {fmt_ci(m['accuracy'])} | {m['f1']*100:.1f}% | "
                     f"{m['tp']}/{m['fp']}/{m['tn']}/{m['fn']} |")
    lines.append("")
    for name, t in tests.items():
        a, b_ = name.split("_vs_")
        lines.append(f"**McNemar ({CONDITION_LABELS.get(a,a)} vs {CONDITION_LABELS.get(b_,b_)}):** "
                     f"discordant b={t['b']}, c={t['c']}, p = {t['p_value']:.4f} (n={t['n']}).")
    lines += ["", "![Figure 1](figures/fig1_fpr.svg)", "", "![Figure 2](figures/fig2_metrics.svg)", ""]
    with open(os.path.join(RESULTS, "summary.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    print("Wrote metrics.json, summary.md and SVG figures.\n")
    for c in conditions:
        m = metrics[c]
        print(f"{CONDITION_LABELS.get(c,c):26s} P={fmt_ci(m['precision'])}  R={fmt_ci(m['recall'])}  "
              f"FPR={fmt_ci(m['fpr'])}  F1={m['f1']*100:.1f}%  [TP{m['tp']} FP{m['fp']} TN{m['tn']} FN{m['fn']}]")
    for name, t in tests.items():
        print(f"McNemar {name}: b={t['b']} c={t['c']} p={t['p_value']:.4f} n={t['n']}")


if __name__ == "__main__":
    main()

# Conceptual foundation: AI Control through Majority Voting (UIAA)

HAZE is grounded in the **AI control** principle articulated by Moe, Wale, and Sunde
(Apart Research / AI Control Hackathon, March 2025):

> **Never trust a single pass from a capable but potentially unreliable LLM.**

**Source:** [AI Control through Majority Voting](https://apartresearch.com/project/ai-control-through-majority-voting-uiaa)

## What UIAA proposes (generation-time control)

- **Problem:** An untrusted model may insert backdoors into generated code that pass
  tests but fail on a secret input in production.
- **Protocol:** Query the untrusted model $c$ times with prompt variations (random
  token padding) $\rightarrow$ $c$ independent solutions $\rightarrow$ a **trusted**
  model wraps them and returns the **majority vote** on outputs.
- **Why it works:** If backdoor insertion is imperfectly correlated across runs, the
  probability that a majority of $c$ runs agree on the malicious output decays
  exponentially in $c$ (binomial tail bound; $\approx (2ep)^{c/2}$ for small $p$).

## How HAZE extends the same principle (audit-time control)

| UIAA (generation) | HAZE (auditing) |
|---|---|
| Untrusted model *writes* code | Untrusted-looking artifact *is judged* |
| Redundancy via $c$ prompt variations | Redundancy via **multi-model roles** + **3-run majority** in evaluation |
| Trusted model aggregates by **majority vote** | **Isolated judge** aggregates after **adversarial cross-examination** |
| Target: backdoors in new code | Target: hallucinated findings & missed vulnerabilities in existing code |

**Shared insight:** A single LLM call is a single sample from a biased distribution
(RLHF sycophancy, confirmation bias). Redundancy + structured aggregation beats
one-shot trust.

**HAZE's twist:** For *auditing*, naive majority on identical prompts still shares the
same bias (“find the bug”). HAZE replaces blind voting with **AI Safety via Debate**
(Irving et al., 2018): prosecution and defense must argue with cited evidence; the
judge rules only on what survived refutation. Evaluation still reports **majority
verdicts over 3 independent repeats**---a direct UIAA-style aggregation layer.

## What is new in this hackathon (vs UIAA)

1. **Domain shift:** from backdoor-resistant *generation* to false-positive-resistant
   *auditing* of software artifacts.
2. **Mechanism:** adversarial debate + isolated judge instead of output majority on
   parallel generations.
3. **Empirical benchmark:** 10 CVEs $\times$ \{vulnerable, patched\}, measured recall/FPR,
   error taxonomy, McNemar ablation.

## Reference

Moe, A., Wale, W., & Sunde, J. H. (2025). *AI Control through Majority Voting.*
Apart Research. https://apartresearch.com/project/ai-control-through-majority-voting-uiaa

# Adversarial Multi-Agent Scrutiny for Vulnerability Detection: Automated Red Teaming via AI Safety Debate

**Authors:** [Team Names]

**Code and Data:** [GitHub Repository Link] | [Dataset / Transcripts Link]

## Abstract

Single-agent Large Language Model (LLM) auditors are increasingly used to find vulnerabilities in code and in AI systems, but they suffer from a structural epistemic flaw: the same generative process that *finds* a flaw is biased toward *fabricating* one to satisfy the prompt, producing high rates of false positives (hallucinated CVEs, non-instantiable attack vectors, imaginary sanitizations). We propose an **Automated Red Teaming** protocol that reframes vulnerability detection from *single-shot generation* to *structured adversarial scrutiny*, grounded in **AI Safety via Debate** (Irving et al., 2018). Four LLM agents play a cross-examination game: an **Attacker** proposes a vulnerability hypothesis with a traceable exploit vector; a **Defender** attempts to refute it by appealing to existing sanitizations and mitigations; an unbiased **Investigator** anchors the debate to *Ground Truth* (real CVEs, library semantics, source-code evidence); and an isolated **Judge** evaluates the transcript and issues a calibrated verdict (Confirmed Vulnerability vs. False Positive). This shifts the evidentiary regime from probabilistic confidence ("~80% sure there is a bug") to logical burden-of-proof ("the Attacker traced an exploit the Defender could not mitigate"). We evaluate against a single-agent baseline on a ground-truth-labeled set, measuring precision, recall, and false-positive rate, and report statistical significance of observed gains. Our central hypothesis is that adversarial multi-agent scrutiny reduces false positives without sacrificing recall, yielding verdicts whose reliability approaches that of a human security reviewer.

## 1. Introduction

Automated vulnerability discovery with LLMs is attractive because it scales auditing across large codebases and across AI models themselves. However, the dominant *single-agent* paradigm is epistemically fragile.

**Problem and failure mode.** When an LLM is instructed to "find the vulnerability," it conditions on a posterior that presupposes the flaw exists. The training objective—maximize the likelihood of a helpful continuation, reinforced by RLHF—creates systematic pressure to **manufacture a positive finding** even on secure code. The model does not robustly distinguish "there is no vulnerability" from "I found no vulnerability satisfying the prompt," and sycophancy (Perez et al., 2022) amplifies confirmation of the requester's implicit hypothesis. The resulting **threat model** for an automated auditor is twofold: (i) **false positives / hallucinations** that waste reviewer time and erode trust, and (ii) the absence of *deep self-correction* in single-shot reasoning, since a monologic agent cannot impose a burden of proof against its own intermediate premises.

**Contributions.**
1. We design a **four-role adversarial architecture** (Attacker, Defender, Investigator, Judge) that operationalizes AI Safety via Debate for vulnerability detection, with a deliberately **isolated Judge** to prevent context contamination and an **Investigator** acting as a *Ground Truth* anchor.
2. We formalize a **shift from a probabilistic to a demonstrative evidentiary regime**, in which a vulnerability is confirmed *iff* it survives adversarial refutation, structurally filtering hallucinations.
3. We provide an **empirical evaluation protocol** with a single-agent baseline, ground-truth labels, and statistical significance testing of false-positive-rate reduction.

## 2. Related Work

**AI Safety via Debate.** Irving et al. (2018) introduced debate as a zero-sum game in which two agents argue opposing positions before a judge, exploiting the asymmetry that *verifying* a claim is easier than *generating* it; at equilibrium, deception is a dominated strategy. Khan et al. (2024) showed empirically that debate among more persuasive LLMs leads judges to more truthful answers, supporting the use of a synthetic judge.

**Multi-agent reasoning.** Du et al. (2023) demonstrated that multi-agent debate improves factuality and reasoning over single-model chains of thought, evidence that adversarial cross-examination mitigates correlated errors.

**LLM-based red teaming.** Perez et al. (2022) used LLMs to red-team other LLMs at scale; Ganguli et al. (2022) studied red teaming to reduce harms, documenting scaling behaviors and methodological lessons. These works red-team *generation* but largely rely on downstream classifiers or humans for verification.

**LLM-as-a-Judge.** Zheng et al. (2023) established the viability—and biases—of LLM judges, motivating our design choice to *isolate* the judge from hypothesis generation to reduce sycophancy and commitment bias.

**Gap addressed.** Prior red-teaming work focuses on *eliciting* failures, while prior debate work targets *open-domain truth*. We combine both for **vulnerability verification**: applying a four-role debate, anchored by an empirical Investigator, specifically to suppress false positives in code and model auditing—an evaluation axis under-served by single-agent auditors.

## 3. Methods

**System overview.** Given a target artifact (source file, dependency, or model behavior) the pipeline runs a bounded multi-turn debate:

1. **Attacker (Proposer):** generates a vulnerability hypothesis specifying type, preconditions, and a *traceable* exploit vector.
2. **Defender (Opponent):** refutes by demonstrating non-instantiability, existing sanitization/mitigation, or unmet preconditions—materializing the **burden of proof**.
3. **Investigator (Oracle):** takes no side; retrieves *Ground Truth*—real CVEs, library/API semantics, presence/absence of sanitization in source—to constrain admissible claims to empirically contestable ones.
4. **Judge:** evaluates the full transcript and emits a binary, justified verdict: **Confirmed Vulnerability** vs. **False Positive**.

**Design choices and justification.** The Judge is **structurally isolated** from generation and defense to avoid reintroducing confirmation/commitment bias; the verdict is formed *only* over evidence articulated in the transcript. The Investigator prevents the debate from degenerating into rhetorically persuasive but empirically decoupled exchanges.

**Models and tooling.** LLM agents are instantiated from instruction-tuned models (Python 3.10+, HuggingFace; analysis utilities may use PyTorch/TransformerLens). All stochastic components fix random seeds (e.g., `torch.manual_seed(42)`) for reproducibility. The orchestration is modular, separating (a) artifact loading, (b) agent execution, and (c) verdict evaluation into distinct functions, so judges can rerun the pipeline with minimal setup.

**Baseline.** A **single-agent auditor** ("find the vulnerability") on identical inputs, to isolate the contribution of adversarial scrutiny.

**What didn't work (to be documented).** Early variants that let the Attacker also judge collapsed into self-confirmation; un-anchored debates (no Investigator) produced fluent but non-instantiable exploits. These motivate the final architecture and are reported honestly in Results/Discussion.

## 4. Results

> *Placeholder pending experiments — to be populated with measured values.*

We evaluate on a **ground-truth-labeled set** containing both vulnerable and patched/secure variants of each artifact. Primary metrics: **precision**, **recall**, **false-positive rate (FPR)**, and **verdict calibration**.

- **Table 1.** Multi-agent debate vs. single-agent baseline: precision / recall / FPR with 95% confidence intervals.
- **Figure 1.** False-positive rate, single-agent vs. four-role debate (lower is better). *Caption: Adversarial scrutiny is expected to reduce FPR while preserving recall on truly vulnerable artifacts.*
- **Figure 2.** Ablation removing the Investigator and removing Judge isolation, showing the marginal contribution of each role.

**Robustness.** We report statistical significance (e.g., bootstrap / McNemar's test on paired verdicts) for any claimed FPR reduction, vary the number of debate turns and the underlying model, and confirm conclusions are stable to small setup changes. Claims are made only where data sufficiency supports them.

## 5. Discussion and Limitations

**Broader AI safety implications.** The protocol instantiates *scalable oversight*: a judge need not generate an audit from scratch—an expensive, hallucination-prone task—but only evaluate which of two mutually refuted positions survives scrutiny. This burden-shifting is a concrete, deployable pattern for using debate to verify safety-relevant claims about both code and models.

**Limitations and assumptions (explicit).** (i) The Investigator's *Ground Truth* retrieval may itself hallucinate or be incomplete; (ii) the verification–generation asymmetry from Irving et al. (2018) is assumed to hold in the code/model-audit domain and must be validated empirically; (iii) the synthetic Judge may share a **correlated failure mode** with the debaters, undermining judgment independence. **Unaddressed threat models:** adversarial collusion between agents, prompt-injection from the audited artifact into the agents, and vulnerabilities requiring multi-file or runtime context beyond the provided evidence.

**Future work.** Human-in-the-loop validation of synthetic verdicts; cross-model judges to break correlated errors; extension from per-file to repository- and runtime-level reasoning; calibration analysis of judge confidence.

## 6. Conclusion

We argue that reliable automated vulnerability detection requires moving beyond single-agent auditors, whose loss landscape rewards fabricating findings, toward **structured adversarial scrutiny**. By staging four LLM roles—Attacker, Defender, Investigator, and an isolated Judge—in an AI-Safety-via-Debate game, a vulnerability is confirmed only when a traced exploit survives active refutation and empirical anchoring, replacing uncalibrated probabilistic confidence with a logical burden of proof.

If validated, this design reduces false positives without sacrificing recall and offers a reproducible template for scalable oversight: using adversarial debate not merely to *elicit* failures, but to *verify* them to a standard approaching that of a human security reviewer.

## Code and Data

[GitHub Repository Link] — pipeline, agent prompts, and evaluation scripts.
[Dataset / Transcripts Link] — labeled artifacts and full debate transcripts.

## Author Contributions (optional)

[Name] — architecture & orchestration; [Name] — evaluation & baselines; [Name] — writing & analysis.

## References

Bai, Y., Kadavath, S., Kundu, S., Askell, A., Kernion, J., Jones, A., … Kaplan, J. (2022). *Constitutional AI: Harmlessness from AI feedback*. arXiv. https://arxiv.org/abs/2212.08073

Du, Y., Li, S., Torralba, A., Tenenbaum, J. B., & Mordatch, I. (2023). *Improving factuality and reasoning in language models through multiagent debate*. arXiv. https://arxiv.org/abs/2305.14325

Ganguli, D., Lovitt, L., Kernion, J., Askell, A., Bai, Y., Kadavath, S., … Clark, J. (2022). *Red teaming language models to reduce harms: Methods, scaling behaviors, and lessons learned*. arXiv. https://arxiv.org/abs/2209.07858

Irving, G., Christiano, P., & Amodei, D. (2018). *AI safety via debate*. arXiv. https://arxiv.org/abs/1805.00899

Khan, A., Hughes, J., Valentine, D., Ruis, L., Sachan, K., Radhakrishnan, A., … Perez, E. (2024). *Debating with more persuasive LLMs leads to more truthful answers*. arXiv. https://arxiv.org/abs/2402.06782

Perez, E., Huang, S., Song, F., Cai, T., Ring, R., Aslanides, J., … Irving, G. (2022). *Red teaming language models with language models*. arXiv. https://arxiv.org/abs/2202.03286

Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., … Stoica, I. (2023). *Judging LLM-as-a-judge with MT-Bench and Chatbot Arena*. arXiv. https://arxiv.org/abs/2306.05685

---

**LLM Usage Statement:**

LLMs were used to assist drafting, structuring, and literature framing of this submission, and they constitute the system under study (the four debate agents). All technical claims, cited references, and—once populated—empirical results were independently verified by the authors; quantitative results in Section 4 are pending experiments and must not be cited until measured and significance-tested.

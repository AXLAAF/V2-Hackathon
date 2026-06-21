# HAZE: Adversarial Multi-Agent Scrutiny for Vulnerability Detection

**HAZE** (*Hallucination-Aware Zero-sum Examination*) — Automated Red Teaming via AI Safety Debate

**Authors:** [Team Names]

**Code and Data:** [GitHub Repository Link]/`API` | [Dataset / Transcripts Link]

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

**System overview (theoretical protocol).** Given a target artifact (source file, dependency, or model behavior) the pipeline runs a bounded multi-turn debate:

1. **Attacker (Proposer):** generates a vulnerability hypothesis specifying type, preconditions, and a *traceable* exploit vector.
2. **Defender (Opponent):** refutes by demonstrating non-instantiability, existing sanitization/mitigation, or unmet preconditions—materializing the **burden of proof**.
3. **Investigator (Oracle):** takes no side; retrieves *Ground Truth*—real CVEs, library/API semantics, presence/absence of sanitization in source—to constrain admissible claims to empirically contestable ones.
4. **Judge:** evaluates the full transcript and emits a binary, justified verdict: **Confirmed Vulnerability** vs. **False Positive**.

**Design choices and justification.** The Judge is **structurally isolated** from generation and defense to avoid reintroducing confirmation/commitment bias; the verdict is formed *only* over evidence articulated in the transcript. The Investigator prevents the debate from degenerating into rhetorically persuasive but empirically decoupled exchanges.

### 3.1 HAZE implementation (`API/`)

We implement the debate protocol as **HAZE**, a deployable monolith in `API/` that orchestrates adversarial scrutiny over software artifacts via OpenRouter. The system evaluates whether a pasted or uploaded artifact (code, dependency manifest, documentation) exhibits **malicious behavior**—backdoors, data exfiltration, RCE, obfuscation, typosquatting, suspicious network calls—rather than issuing a single-model guess.

**Architecture.** A Fastify 5 (Node.js ESM) backend serves both the REST/SSE API and a vanilla HTML/CSS/JS frontend. The pipeline is modular:

| Module | Role |
|---|---|
| `src/config/roles.js` | Team roster, turn order, default models |
| `src/services/prompts.js` | Role-specific system/user prompts and judge JSON schema |
| `src/services/orchestrator.js` | Multi-round debate engine and verdict parsing |
| `src/services/openrouter.js` | OpenRouter client (streaming + structured JSON) |
| `src/routes/api.js` | `GET /api/config`, `GET /api/models`, `POST /api/analyze` (SSE) |
| `public/` | Live debate UI with token-by-token streaming |

**Agent mapping (theory → implementation).** The current prototype instantiates a **2v2 + isolated Judge** topology:

| Theoretical role | HAZE role(s) | Team | Function |
|---|---|---|---|
| Attacker | **Forensic Analyst** + **Prosecutor** | Accusation | Surface technical evidence of malicious patterns; synthesize and rebut defense arguments |
| Defender | **Auditor** + **Defense Counsel** | Defense | Explain legitimate intent; refute accusations with benign context and standard practices |
| Investigator | *(planned)* | — | Not yet implemented as a separate, side-neutral agent |
| Judge | **Judge** | Tribunal | Reads full transcript only; emits structured verdict |

Each debater role is bound to a **distinct LLM** (configurable per role in the UI), breaking correlated single-model failure modes. Turn order alternates accusation/defense each round: Forensic Analyst → Auditor → Prosecutor → Defense Counsel (1–4 rounds, default 2). Debater temperature is 0.7; the Judge uses temperature 0.1 and `response_format: json_object`.

**End-to-end flow.**
1. User pastes or uploads an artifact (≤24,000 chars; larger inputs truncated with flag).
2. User configures debate rounds and selects an OpenRouter model slug per role.
3. `POST /api/analyze` streams Server-Sent Events: `open` → `meta` → `round` → `turn-start` / `token` / `turn-end` → `verdict` → `done`.
4. The orchestrator accumulates a transcript; debaters see prior turns and must cite exact lines/functions—prompts explicitly forbid inventing evidence.
5. The **isolated Judge** receives artifact + transcript only (never participated in debate) and returns JSON: `verdict` (`MALICIOUS` / `NOT_MALICIOUS` / `INCONCLUSIVE`), `confidence` (0–100), `riskLevel`, `keyFindings`, `winningTeam`, `reasoning`.

**Prompt constraints (burden of proof).** All debater prompts require claims to be grounded in the artifact, cap responses at ~180 words, and enforce intellectual honesty within each team. The Judge prompt penalizes unsupported arguments and demands verdict justification from transcript quality and code evidence—operationalizing the shift from probabilistic fluency to **demonstrative scrutiny**.

**Models and tooling.** Agents are routed through **OpenRouter** (OpenAI-compatible API); no local GPU required. Setup: `npm install`, copy `.env.example` → `.env` with `OPENROUTER_API_KEY`, `npm run dev` → `http://localhost:3000`. Example artifacts in `API/examples/` (`suspicious_installer.py`, `benign_utils.py`) support manual smoke testing.

**Baseline.** A **single-agent auditor** ("find the vulnerability") on identical inputs, to isolate the contribution of adversarial scrutiny.

**What didn't work (documented).** Early variants that let the Attacker also judge collapsed into self-confirmation; un-anchored debates produced fluent but non-instantiable exploits. The separate **Investigator** role remains future work—the current 2v2 design partially mitigates hallucinations via cross-examination but lacks an impartial *Ground Truth* retrieval agent.

### 3.2 Execution pipeline

HAZE is not a classical static analyzer (AST/SAST). It is a **verification protocol**: multiple LLMs compete under strict rules, and an isolated judge emits a structured verdict. The client sends a JSON payload to `POST /api/analyze`:

```json
{
  "artifact": { "filename": "setup.py", "content": "...", "kind": "code" },
  "rounds": 2,
  "models": { "fiscal_analista": "deepseek/deepseek-chat", "juez": "anthropic/claude-3.5-sonnet" }
}
```

**Phase 0 — Config resolution.** `resolveConfig()` validates the artifact is non-empty, truncates content to 24,000 characters (flagging `truncated: true` if exceeded), resolves per-role model overrides, and clamps rounds to [1, 4].

**Phase 1 — Multi-round debate.** For each round *r*, the orchestrator executes `TURN_ORDER`: Forensic Analyst → Auditor → Prosecutor → Defense Counsel. For each turn:

1. `buildDebaterMessages()` assembles a **system** prompt (persona, objective, tribunal rules) and a **user** prompt (artifact block + accumulated transcript + opening/refutation instruction).
2. `streamChat()` calls OpenRouter at temperature 0.7 (`max_tokens: 700`, streaming enabled).
3. Each token delta is emitted to the client via SSE (`event: token`).
4. The full turn text is appended to `transcript[]`—an append-only shared state visible to all subsequent debaters and to the Judge.

**Phase 2 — Isolated verdict.** The Judge has generated no debate turns. It receives only the original artifact and the full transcript. `buildJudgeMessages()` requests strict JSON output; `chat()` is called at temperature 0.1 with `response_format: { type: "json_object" }`. `parseVerdict()` extracts the JSON object even if the model adds surrounding noise.

**Phase 3 — Client streaming.** The API hijacks the HTTP response for Server-Sent Events:

`open` → `meta` → `round` → `turn-start` → `token*` → `turn-end` → … → `verdict` → `done`

If the client disconnects, an `AbortController` cancels in-flight OpenRouter requests.

### 3.3 Core technical mechanisms

**Per-role model separation.** Each role may bind a distinct LLM (e.g., DeepSeek, Gemini, GPT-4o-mini, Llama 70B, Claude 3.5 Sonnet). This partially decorrelates failure modes: a model that hallucinates a backdoor may be refuted by another with different architecture and training biases.

**Transcript as shared state.** Debate state is an append-only array with no hidden memory between turns. Every claim and refutation is auditable in the transcript the Judge evaluates.

**Epistemic isolation of the Judge.** The Judge (i) never participates in hypothesis generation, (ii) carries no adversarial persona, (iii) runs at low temperature with forced JSON schema, and (iv) is instructed to penalize unsupported arguments. This implements **LLM-as-a-Judge** with institutional separation: accusers and defenders do not decide the outcome.

**Burden of proof via prompt engineering.** Debaters must cite exact lines/functions from the artifact and are forbidden from inventing code. Round 1 elicits opening evidence; later rounds require active refutation. The Prosecutor synthesizes the accusation; the Defense Counsel refutes point-by-point. Findings that cannot survive refutation are weakened in the transcript the Judge reads.

**Functional decomposition of the 2v2 topology.**

| Role | Technical function |
|---|---|
| **Forensic Analyst** | Offensive detection: malicious patterns, in-code indicators |
| **Auditor** | Defensive context: legitimate use, benign explanations |
| **Prosecutor** | Argument synthesis + rebuttal of defense claims |
| **Defense Counsel** | Point-by-point refutation; concedes strong evidence but challenges intent/severity |

A single prompt ("find the malware") conflates detection, context, and judgment; HAZE separates these functions across adversarial roles.

### 3.4 Evaluation scope

The current prototype targets **malicious-software detection**, not generic CVE enumeration. HAZE evaluates whether an artifact exhibits patterns such as: backdoors and reverse shells; data exfiltration (`urllib`, `socket`, encoded POST); RCE / `exec()` of downloaded payloads; obfuscation and self-modification; typosquatting in dependencies; credential/environment access; and covert telemetry. Smoke-test artifacts live in `API/examples/` (`suspicious_installer.py`, `benign_utils.py`).

### 3.5 Contribution to AI Security

HAZE addresses AI Security in two complementary dimensions.

**Security *with* AI (using LLMs to audit software).**

| Single-agent failure | HAZE mitigation |
|---|---|
| Confirmation bias: inventing findings to satisfy the prompt | Dedicated adversary (Defense) actively refutes claims |
| Uncalibrated confidence ("~80% sure") | Structured verdict JSON: `verdict`, `confidence`, `keyFindings`, `reasoning` |
| Single model, single blind spot | Multi-model roles with partially decorrelated errors |
| No audit trail | Full transcript for human review |
| Weak intrinsic self-correction | Cross-examination across multiple rounds |

HAZE is **automated red teaming of artifacts**: it scales review of suspicious packages, PRs, dependencies, or snippets before merge/deploy.

**Security *of* AI (AI Safety / Alignment).**

1. **AI Safety via Debate (Irving et al., 2018).** Verification is easier than generation. The Judge does not produce the audit—it *evaluates* which side survived scrutiny. This is *scalable oversight*: supervising systems more capable than the supervisor.
2. **Hallucination reduction by institutional design.** The system does not trust a probability threshold. The accusation must **withstand refutation**—a shift from probabilistic to demonstrative evidentiary regime.
3. **Multi-agent debate (Du et al., 2023).** Debate improves factuality over monologic chain-of-thought; HAZE applies this to cybersecurity auditing.
4. **LLM-as-a-Judge with bias mitigation (Zheng et al., 2023).** Judge isolation reduces *commitment bias* and *sycophancy*: the evaluator did not generate the hypothesis it judges.
5. **Model red teaming (Perez et al., 2022; Ganguli et al., 2022).** The protocol generalizes: the "artifact" may be **model behavior** (jailbreaks, prompt injection) rather than Python source—the same adversarial topology elicits and verifies alignment failures.

**Epistemic cycle.** Input artifact → adversarial debate (accusation proposes, defense refutes, synthesis, closure) → isolated Judge asks whether the accusation survived refutation → `MALICIOUS` / `NOT_MALICIOUS` / `INCONCLUSIVE`.

**Known limitations (implementation).** (i) No Investigator role yet—no external CVE/database lookup; reasoning is confined to artifact text. (ii) LLMs may share correlated hallucination biases despite multi-model assignment. (iii) 24k-character window; no multi-file or runtime analysis. (iv) The Judge is still an LLM—verdicts assist review, not formal certification. (v) Latency and API cost scale with roles × rounds + judge vs. a single prompt.

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

[GitHub Repository Link]/`API` — HAZE monolith: Fastify backend, OpenRouter orchestrator, role prompts, SSE debate API, and live web UI.
[Dataset / Transcripts Link] — labeled artifacts, example PoCs (`API/examples/`), and full debate transcripts.

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

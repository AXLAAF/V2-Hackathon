// HAZE protocol, reframed for vulnerability detection (vulnerable vs patched).
// Mirrors API/src/{config/roles.js, services/{prompts,orchestrator}.js} in
// structure (2v2 debaters + isolated judge, alternating turns, temps 0.7/0.1),
// but the framing is "does this artifact contain an EXPLOITABLE vulnerability?"
// instead of "is this artifact malware?".

import { chat } from './openrouter.mjs';

export const DEFAULT_MODELS = {
  prosecutor_analyst: 'deepseek/deepseek-chat',
  defense_auditor: 'google/gemini-2.5-flash',
  prosecutor_lead: 'openai/gpt-4o-mini',
  defense_counsel: 'meta-llama/llama-3.1-70b-instruct',
  judge: 'anthropic/claude-sonnet-4-5',
  baseline: 'openai/gpt-4o-mini',
};

export const ROLES = [
  {
    id: 'prosecutor_analyst',
    team: 'prosecution',
    name: 'Forensic Analyst',
    persona: 'an offensive-security forensic analyst working for the PROSECUTION',
    objective:
      'identify and expose concrete TECHNICAL EVIDENCE of an exploitable software vulnerability (e.g. code/command injection, buffer/stack/heap overflow, authentication bypass, insecure deserialization, secret exposure, weak credential reset). Name the likely CWE and trace how an attacker would reach the sink. Cite exact line numbers, function names or exact snippets as proof.',
  },
  {
    id: 'defense_auditor',
    team: 'defense',
    name: 'Auditor',
    persona: 'an impartial technical auditor working for the DEFENSE',
    objective:
      'explain why the artifact is SAFE in its current form: point to input validation, allow-lists, bounds checks, parameterized/escaped calls, constant-time comparisons, length checks or other mitigations that are actually present in the code. Show that the preconditions for an exploit are not met. Cite exact lines.',
  },
  {
    id: 'prosecutor_lead',
    team: 'prosecution',
    name: 'Lead Prosecutor',
    persona: 'the Lead Prosecutor arguing the case before the tribunal',
    objective:
      'build a rigorous case that the artifact CONTAINS AN EXPLOITABLE VULNERABILITY, synthesizing your Forensic Analyst evidence and rebutting the Defense. Be persuasive but never invent evidence absent from the code. If the code is in fact mitigated, concede it.',
  },
  {
    id: 'defense_counsel',
    team: 'defense',
    name: 'Defense Counsel',
    persona: 'the Defense Counsel arguing that the artifact is not exploitable',
    objective:
      'refute the accusation point by point with technical arguments, leaning on your Auditor. Show missing preconditions, present mitigations and false positives. Do not deny undeniable technical evidence; if a real flaw exists, say so honestly.',
  },
];

export const JUDGE = { id: 'judge', name: 'Judge', team: 'tribunal' };

export const TURN_ORDER = [
  'prosecutor_analyst',
  'defense_auditor',
  'prosecutor_lead',
  'defense_counsel',
];

// Turn order with the adversary (defense) removed — ablation that isolates the
// contribution of structured opposition.
export const TURN_ORDER_NO_DEFENSE = ['prosecutor_analyst', 'prosecutor_lead'];

function artifactBlock(artifact) {
  const lang = artifact.filename?.split('.').pop() || '';
  return [
    'ARTIFACT UNDER REVIEW',
    `Name: ${artifact.filename || '(unnamed)'}`,
    `Declared kind: ${artifact.kind || 'source code'}`,
    '',
    '```' + lang,
    artifact.content,
    '```',
  ].join('\n');
}

function transcriptBlock(transcript) {
  if (!transcript.length) return 'NO PRIOR ARGUMENTS YET. You speak first.';
  return [
    'DEBATE TRANSCRIPT SO FAR:',
    ...transcript.map((t) => `[${t.team.toUpperCase()} · ${t.name}]:\n${t.content}`),
  ].join('\n\n');
}

function buildDebaterMessages({ role, artifact, transcript, round, rounds }) {
  const system = [
    `You are ${role.persona}, in a TECHNICAL CYBERSECURITY TRIBUNAL deciding whether a software artifact contains an exploitable vulnerability.`,
    `Your OBJECTIVE: ${role.objective}`,
    '',
    'TRIBUNAL RULES:',
    '- Ground EVERY claim in the real content of the artifact. Cite exact lines, functions or snippets.',
    '- Inventing code or evidence that is not in the artifact is strictly forbidden.',
    '- Be concise and technical: max ~180 words. Do not repeat what was said; add new evidence or refute.',
    '- Stay loyal to your side, but with intellectual honesty: never falsify facts.',
    '- Answer in English prose (no Markdown headings).',
  ].join('\n');

  const user = [
    artifactBlock(artifact),
    '',
    transcriptBlock(transcript),
    '',
    `This is round ${round} of ${rounds}.`,
    round === 1
      ? 'Present your opening argument with the strongest evidence for your position.'
      : 'MANDATORY in round 2+: quote at least one concrete claim from the opposing side (role name + excerpt) and refute it line-by-line with artifact evidence. Do not repeat prior arguments without new rebuttal; concede if you cannot refute with evidence.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

const JUDGE_SCHEMA = [
  'Respond with ONLY a valid JSON object with exactly these keys:',
  '"verdict": one of "VULNERABLE", "SAFE" or "INCONCLUSIVE".',
  '"confidence": integer 0-100.',
  '"severity": one of "CRITICAL","HIGH","MEDIUM","LOW","NONE".',
  '"cwe": short CWE id/name string, or null.',
  '"keyFindings": array of up to 5 short strings citing the code.',
  '"winningTeam": "prosecution", "defense" or "tie".',
  '"reasoning": 2-4 sentence justification.',
  'No text outside the JSON. No markdown code fences.',
].join('\n');

function buildJudgeMessages({ artifact, transcript }) {
  const system = [
    'You are an IMPARTIAL technical Judge in a cybersecurity tribunal.',
    'You heard the Prosecution (claims the artifact is exploitable) and the Defense (claims it is safe).',
    'Rule fairly based EXCLUSIVELY on the technical evidence in the artifact and the quality of the arguments.',
    'You take no side. Penalize claims without evidence. A correct, present mitigation means SAFE.',
    '',
    JUDGE_SCHEMA,
  ].join('\n');

  const user = [
    artifactBlock(artifact),
    '',
    transcriptBlock(transcript),
    '',
    'Issue your final verdict in the required JSON format.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function buildBaselineMessages({ artifact }) {
  // Single-agent baseline: the dominant "just ask one LLM to find the bug" mode.
  const system = [
    'You are a senior security auditor reviewing a single software artifact.',
    'Decide whether it contains an exploitable vulnerability.',
    '',
    JUDGE_SCHEMA,
  ].join('\n');
  const user = [artifactBlock(artifact), '', 'Issue your verdict in the required JSON format.'].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function buildContinueDebateMessages({ artifact, transcript }) {
  const system = [
    'You are a technical debate moderator. After round 1, decide if another round is needed.',
    'Respond ONLY with JSON: {"continueDebate": true|false, "reason": "..."}',
    'continueDebate=false when: (a) one side explicitly concedes, (b) rebuttal is decisive with no open points,',
    '(c) both sides repeat the same claims without new artifact evidence.',
    'continueDebate=true when technical accusations remain unrefuted with artifact evidence.',
  ].join('\n');
  const user = [
    artifactBlock(artifact),
    '',
    transcriptBlock(transcript),
    '',
    'Continue to round 2? Reply in JSON.',
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

const FALLBACK = (text, model) => ({
  verdict: 'INCONCLUSIVE',
  confidence: 0,
  severity: 'MEDIUM',
  cwe: null,
  keyFindings: [],
  winningTeam: 'tie',
  reasoning: text ? `Unparseable judge output: ${String(text).slice(0, 200)}` : 'No judge output.',
  model,
});

export function parseVerdict(text, model) {
  if (!text) return FALLBACK(text, model);
  const md = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const candidate = md
    ? md[1]
    : (() => {
        const s = text.indexOf('{');
        const e = text.lastIndexOf('}');
        return s !== -1 && e > s ? text.slice(s, e + 1) : null;
      })();
  if (!candidate) return FALLBACK(text, model);
  try {
    const parsed = JSON.parse(candidate);
    const v = String(parsed.verdict || '').toUpperCase();
    parsed.verdict = ['VULNERABLE', 'SAFE', 'INCONCLUSIVE'].includes(v) ? v : 'INCONCLUSIVE';
    return { ...FALLBACK(text, model), ...parsed, model };
  } catch {
    return FALLBACK(text, model);
  }
}

// VULNERABLE => positive prediction (flagged). SAFE/INCONCLUSIVE => negative.
export function verdictToPrediction(verdict) {
  return verdict === 'VULNERABLE' ? 1 : 0;
}

/**
 * Multi-agent debate condition.
 * @param {'full'|'no_defense'} variant
 * Returns { verdict, transcript, calls } (calls = token-usage records).
 */
export async function runDebate({ artifact, models, rounds = 1, variant = 'full', earlyStop = true }) {
  const m = { ...DEFAULT_MODELS, ...(models || {}) };
  const order = variant === 'no_defense' ? TURN_ORDER_NO_DEFENSE : TURN_ORDER;
  const byId = Object.fromEntries(ROLES.map((r) => [r.id, r]));
  const transcript = [];
  const calls = [];
  let effectiveRounds = rounds;

  for (let round = 1; round <= effectiveRounds; round++) {
    for (const roleId of order) {
      const role = byId[roleId];
      const messages = buildDebaterMessages({ role, artifact, transcript, round, rounds: effectiveRounds });
      const { content, usage } = await chat({
        model: m[roleId],
        messages,
        temperature: 0.7,
        maxTokens: 700,
      });
      transcript.push({ roleId, name: role.name, team: role.team, content });
      calls.push({ role: roleId, model: m[roleId], usage });
    }

    if (earlyStop && round === 1 && effectiveRounds > 1) {
      const { content, usage } = await chat({
        model: m.judge,
        messages: buildContinueDebateMessages({ artifact, transcript }),
        temperature: 0.1,
        maxTokens: 200,
        responseFormat: { type: 'json_object' },
      });
      calls.push({ role: 'moderator', model: m.judge, usage });
      try {
        const mod = JSON.parse(content);
        if (mod.continueDebate === false) {
          effectiveRounds = 1;
          break;
        }
      } catch {
        /* continue to round 2 */
      }
    }
  }

  const judgeMessages = buildJudgeMessages({ artifact, transcript });
  const { content: judgeText, usage: judgeUsage } = await chat({
    model: m.judge,
    messages: judgeMessages,
    temperature: 0.1,
    maxTokens: 900,
    responseFormat: { type: 'json_object' },
  });
  calls.push({ role: 'judge', model: m.judge, usage: judgeUsage });

  return { verdict: parseVerdict(judgeText, m.judge), transcript, calls };
}

/** Single-agent baseline condition. */
export async function runBaseline({ artifact, models }) {
  const model = (models && models.baseline) || DEFAULT_MODELS.baseline;
  const { content, usage } = await chat({
    model,
    messages: buildBaselineMessages({ artifact }),
    temperature: 0.1,
    maxTokens: 700,
    responseFormat: { type: 'json_object' },
  });
  return { verdict: parseVerdict(content, model), transcript: [], calls: [{ role: 'baseline', model, usage }] };
}

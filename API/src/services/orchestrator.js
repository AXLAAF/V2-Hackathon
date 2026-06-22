// Orquestador del debate: coordina turnos de los dos equipos y el veredicto.
// Emite eventos al cliente vía la función `send(event, data)` (SSE).

import { ROLES, JUDGE, TURN_ORDER, DEFAULTS } from '../config/roles.js';
import { streamChat, chat } from './openrouter.js';
import {
  buildDebaterMessages,
  buildJudgeMessages,
  buildContinueDebateMessages,
} from './prompts.js';

function resolveConfig(body = {}) {
  const artifactContent = (body.artifact?.content || '').toString();
  if (!artifactContent.trim()) {
    throw new Error('El artefacto está vacío. Pega o sube código/documentación para juzgar.');
  }

  const artifact = {
    filename: body.artifact?.filename || 'artefacto.txt',
    kind: body.artifact?.kind || 'código/documentación',
    content: artifactContent.slice(0, DEFAULTS.maxArtifactChars),
    truncated: artifactContent.length > DEFAULTS.maxArtifactChars,
  };

  const models = body.models || {};
  const roster = ROLES.map((r) => ({ ...r, model: models[r.id] || r.defaultModel }));
  const judge = { ...JUDGE, model: models[JUDGE.id] || JUDGE.defaultModel };

  const rounds = Math.min(Math.max(parseInt(body.rounds, 10) || DEFAULTS.rounds, 1), 4);
  const earlyStop = body.earlyStop !== false && DEFAULTS.earlyStop !== false;

  return { artifact, roster, judge, rounds, earlyStop };
}

function extractJson(text) {
  if (!text) return null;
  const mdMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const candidate = mdMatch
    ? mdMatch[1]
    : (() => {
        const s = text.indexOf('{');
        const e = text.lastIndexOf('}');
        return s !== -1 && e > s ? text.slice(s, e + 1) : null;
      })();
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeVerdict(raw) {
  const v = String(raw || '').toUpperCase();
  if (v === 'VULNERABLE' || v === 'MALICIOSO') return 'VULNERABLE';
  if (v === 'SEGURO' || v === 'SAFE' || v === 'NO_MALICIOSO') return 'SEGURO';
  return 'INCONCLUSO';
}

function parseVerdict(text, model) {
  const fallback = {
    verdict: 'INCONCLUSO',
    confidence: 0,
    riskLevel: 'MEDIO',
    cwe: null,
    keyFindings: [],
    winningTeam: 'empate',
    reasoning: text
      ? `Respuesta del juez (no parseable como JSON): ${text.slice(0, 300)}`
      : 'El juez no emitió respuesta.',
    model,
  };
  const parsed = extractJson(text);
  if (!parsed) return fallback;

  const result = { ...fallback, ...parsed, model };
  result.verdict = normalizeVerdict(parsed.verdict);
  if (result.verdict === 'SEGURO' && ['CRITICO', 'ALTO'].includes(result.riskLevel)) {
    result.verdict = 'VULNERABLE';
    result.reasoning = `[Corregido: riesgo ${result.riskLevel} incompatible con SEGURO] ${result.reasoning}`;
  }
  return result;
}

async function shouldContinueDebate({ artifact, transcript, judge, signal }) {
  try {
    const text = await chat({
      model: judge.model,
      messages: buildContinueDebateMessages({ artifact, transcript }),
      temperature: 0.1,
      signal,
    });
    const parsed = extractJson(text);
    if (parsed && typeof parsed.continueDebate === 'boolean') {
      return { continueDebate: parsed.continueDebate, reason: parsed.reason || '' };
    }
  } catch {
    /* fall through: default continue if moderator fails */
  }
  return { continueDebate: true, reason: 'moderador no disponible' };
}

/**
 * Ejecuta el juicio completo. `send` es (event, data) => void.
 */
export async function runDebate(body, send, signal) {
  const { artifact, roster, judge, rounds, earlyStop } = resolveConfig(body);
  const byId = Object.fromEntries(roster.map((r) => [r.id, r]));
  let effectiveRounds = rounds;

  send('meta', {
    artifact: {
      filename: artifact.filename,
      chars: artifact.content.length,
      truncated: artifact.truncated,
    },
    rounds,
    earlyStop,
    roster: roster.map(({ id, team, name, title, model, color }) => ({
      id,
      team,
      name,
      title,
      model,
      color,
    })),
    judge: { id: judge.id, name: judge.name, model: judge.model, color: judge.color },
  });

  const transcript = [];

  for (let round = 1; round <= effectiveRounds; round++) {
    send('round', { round, rounds: effectiveRounds });

    for (const roleId of TURN_ORDER) {
      if (signal?.aborted) return;
      const role = byId[roleId];
      const turnId = `${role.id}-r${round}`;

      send('turn-start', {
        turnId,
        roleId: role.id,
        team: role.team,
        name: role.name,
        title: role.title,
        model: role.model,
        color: role.color,
        round,
      });

      try {
        const messages = buildDebaterMessages({
          role,
          artifact,
          transcript,
          round,
          rounds: effectiveRounds,
        });
        const text = await streamChat({
          model: role.model,
          messages,
          temperature: 0.7,
          signal,
          onToken: (t) => send('token', { turnId, text: t }),
        });
        send('turn-end', { turnId });
        transcript.push({ roleId: role.id, name: role.name, team: role.team, content: text });
      } catch (err) {
        send('turn-error', { turnId, message: err.message });
        transcript.push({
          roleId: role.id,
          name: role.name,
          team: role.team,
          content: `(El modelo ${role.model} no pudo intervenir: ${err.message})`,
        });
      }
    }

    if (earlyStop && round === 1 && effectiveRounds > 1) {
      const { continueDebate, reason } = await shouldContinueDebate({
        artifact,
        transcript,
        judge,
        signal,
      });
      if (!continueDebate) {
        send('early-stop', { afterRound: 1, reason });
        effectiveRounds = 1;
        break;
      }
    }
  }

  if (signal?.aborted) return;

  send('turn-start', {
    turnId: 'veredicto',
    roleId: judge.id,
    team: judge.team,
    name: judge.name,
    title: judge.title,
    model: judge.model,
    color: judge.color,
  });

  try {
    const text = await chat({
      model: judge.model,
      messages: buildJudgeMessages({ artifact, transcript }),
      temperature: 0.1,
      signal,
    });
    send('verdict', parseVerdict(text, judge.model));
  } catch (err) {
    send('turn-error', { turnId: 'veredicto', message: err.message });
    send('verdict', parseVerdict('', judge.model));
  }
}

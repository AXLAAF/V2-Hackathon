// Orquestador del debate: coordina turnos de los dos equipos y el veredicto.
// Emite eventos al cliente vía la función `send(event, data)` (SSE).

import { ROLES, JUDGE, TURN_ORDER, DEFAULTS } from '../config/roles.js';
import { streamChat, chat } from './openrouter.js';
import { buildDebaterMessages, buildJudgeMessages } from './prompts.js';

// Combina la configuración del cliente con los valores por defecto.
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

  return { artifact, roster, judge, rounds };
}

// Extrae el primer objeto JSON del texto del juez, tolerando markdown y ruido.
function parseVerdict(text, model) {
  const fallback = {
    verdict: 'INCONCLUSO',
    confidence: 0,
    riskLevel: 'MEDIO',
    keyFindings: [],
    winningTeam: 'empate',
    reasoning: text
      ? `Respuesta del juez (no parseable como JSON): ${text.slice(0, 300)}`
      : 'El juez no emitió respuesta.',
    model,
  };
  if (!text) return fallback;

  // Intenta extraer desde un bloque ```json ... ``` primero.
  const mdMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const candidate = mdMatch ? mdMatch[1] : (() => {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    return s !== -1 && e > s ? text.slice(s, e + 1) : null;
  })();

  if (!candidate) return fallback;
  try {
    const parsed = JSON.parse(candidate);
    return { ...fallback, ...parsed, model };
  } catch {
    return fallback;
  }
}

/**
 * Ejecuta el juicio completo. `send` es (event, data) => void.
 */
export async function runDebate(body, send, signal) {
  const { artifact, roster, judge, rounds } = resolveConfig(body);
  const byId = Object.fromEntries(roster.map((r) => [r.id, r]));

  send('meta', {
    artifact: {
      filename: artifact.filename,
      chars: artifact.content.length,
      truncated: artifact.truncated,
    },
    rounds,
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

  for (let round = 1; round <= rounds; round++) {
    send('round', { round, rounds });

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
        const messages = buildDebaterMessages({ role, artifact, transcript, round, rounds });
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
  }

  if (signal?.aborted) return;

  // --- Veredicto del Juez ---
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
    const verdict = parseVerdict(text, judge.model);
    send('verdict', verdict);
  } catch (err) {
    send('turn-error', { turnId: 'veredicto', message: err.message });
    send('verdict', parseVerdict('', judge.model));
  }
}

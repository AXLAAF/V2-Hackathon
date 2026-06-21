// Construcción de prompts para cada rol del tribunal.

const TEAM_LABEL = {
  acusacion: 'ACUSACIÓN',
  defensa: 'DEFENSA',
  tribunal: 'TRIBUNAL',
};

function artifactBlock(artifact) {
  const lang = artifact.filename?.split('.').pop() || '';
  return [
    `ARTEFACTO BAJO JUICIO`,
    `Nombre: ${artifact.filename || '(sin nombre)'}`,
    `Tipo declarado: ${artifact.kind || 'código/documentación'}`,
    '',
    '```' + lang,
    artifact.content,
    '```',
  ].join('\n');
}

function transcriptBlock(transcript) {
  if (!transcript.length) {
    return 'AÚN NO HAY INTERVENCIONES PREVIAS. Eres el primero en hablar.';
  }
  return [
    'TRANSCRIPCIÓN DEL DEBATE HASTA AHORA:',
    ...transcript.map(
      (t) => `[${TEAM_LABEL[t.team]} · ${t.name}]:\n${t.content}`
    ),
  ].join('\n\n');
}

/**
 * Mensajes (system + user) para un debatiente.
 */
export function buildDebaterMessages({ role, artifact, transcript, round, rounds }) {
  const isFirstRound = round === 1;
  const system = [
    `Eres ${role.persona}, en un TRIBUNAL TÉCNICO DE CIBERSEGURIDAD que evalúa si un artefacto de software es malicioso.`,
    `Tu OBJETIVO: ${role.objective}`,
    '',
    'REGLAS DEL TRIBUNAL:',
    '- Basa CADA afirmación en el contenido real del artefacto. Cita líneas, funciones o fragmentos exactos.',
    '- Está terminantemente prohibido inventar código o evidencia que no exista en el artefacto.',
    '- Sé conciso y técnico: máximo ~180 palabras. No repitas lo ya dicho; aporta algo nuevo o refuta.',
    '- Mantente fiel a tu bando, pero con honestidad intelectual: nunca falsifiques hechos.',
    '- Responde en español, en prosa argumentativa (sin Markdown de encabezados).',
  ].join('\n');

  const user = [
    artifactBlock(artifact),
    '',
    transcriptBlock(transcript),
    '',
    `Es la ronda ${round} de ${rounds}.`,
    isFirstRound
      ? 'Presenta tu argumento de apertura con la evidencia más fuerte de tu posición.'
      : 'Refuta los argumentos del bando contrario y refuerza tu posición con evidencia adicional.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Mensajes para el Juez. Pide veredicto en JSON estricto.
 */
export function buildJudgeMessages({ artifact, transcript }) {
  const system = [
    'Eres un Juez técnico IMPARCIAL en un tribunal de ciberseguridad.',
    'Has escuchado a la Acusación (que sostiene que el artefacto es malicioso) y a la Defensa (que sostiene que es inocente).',
    'Tu deber es dictar un veredicto justo basado EXCLUSIVAMENTE en la evidencia técnica del artefacto y la calidad de los argumentos.',
    'No tienes bando. Penaliza los argumentos sin evidencia. Valora la severidad real del riesgo.',
    '',
    'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni ```:',
    '{',
    '  "verdict": "MALICIOSO" | "NO_MALICIOSO" | "INCONCLUSO",',
    '  "confidence": <entero 0-100>,',
    '  "riskLevel": "CRITICO" | "ALTO" | "MEDIO" | "BAJO" | "NINGUNO",',
    '  "keyFindings": [<máx 5 strings: hallazgos técnicos decisivos con referencia al código>],',
    '  "winningTeam": "acusacion" | "defensa" | "empate",',
    '  "reasoning": "<2-4 frases justificando el veredicto>"',
    '}',
  ].join('\n');

  const user = [
    artifactBlock(artifact),
    '',
    transcriptBlock(transcript),
    '',
    'Emite tu veredicto final en el formato JSON indicado.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

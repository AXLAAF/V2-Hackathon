// Construcción de prompts para cada rol del tribunal.
// Encuadre AppSec: ¿contiene una vulnerabilidad explotable? (VULNERABLE / SEGURO)

const TEAM_LABEL = {
  acusacion: 'ACUSACIÓN',
  defensa: 'DEFENSA',
  tribunal: 'TRIBUNAL',
};

function artifactBlock(artifact) {
  const lang = artifact.filename?.split('.').pop() || '';
  return [
    `ARTEFACTO BAJO REVISIÓN`,
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

const JUDGE_SCHEMA = [
  'Responde ÚNICAMENTE con un objeto JSON válido con exactamente estas claves:',
  '"verdict": uno de "VULNERABLE", "SEGURO" o "INCONCLUSO".',
  '  - VULNERABLE: el artefacto contiene una vulnerabilidad explotable (inyección, desbordamiento, bypass de auth, deserialización insegura, etc.).',
  '  - SEGURO: no hay vulnerabilidad explotable demostrada; las mitigaciones citadas son suficientes.',
  '  - INCONCLUSO: la evidencia no permite decidir con certeza.',
  '"confidence": entero entre 0 y 100.',
  '"riskLevel": uno de "CRITICO", "ALTO", "MEDIO", "BAJO" o "NINGUNO".',
  '"cwe": identificador CWE corto o null.',
  '"keyFindings": array de hasta 5 strings con hallazgos técnicos citando el código.',
  '"winningTeam": "acusacion", "defensa" o "empate".',
  '"reasoning": string de 2-4 frases justificando el veredicto.',
  'REGLA CRÍTICA: si riskLevel es CRITICO o ALTO, verdict DEBE ser VULNERABLE o INCONCLUSO, nunca SEGURO.',
  'No incluyas texto fuera del JSON. No uses bloques de código markdown.',
].join('\n');

/**
 * Mensajes (system + user) para un debatiente.
 */
export function buildDebaterMessages({ role, artifact, transcript, round, rounds }) {
  const isFirstRound = round === 1;
  const system = [
    `Eres ${role.persona}, en un TRIBUNAL TÉCNICO DE CIBERSEGURIDAD que decide si un artefacto de software contiene una VULNERABILIDAD EXPLOTABLE.`,
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
      : 'OBLIGATORIO en rondas 2+: cita al menos una afirmación concreta del bando contrario (nombre del rol + fragmento) y refútala línea por línea con evidencia del artefacto. Prohibido repetir argumentos de rondas anteriores sin refutación nueva; si no puedes refutar una acusación con evidencia, reconócelo.',
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
    'Has escuchado a la Acusación (sostiene que el artefacto es VULNERABLE) y a la Defensa (sostiene que es SEGURO).',
    'Dicta un veredicto basado EXCLUSIVAMENTE en la evidencia técnica del artefacto y la calidad de los argumentos.',
    'No tienes bando. Penaliza afirmaciones sin evidencia. Una mitigación correcta y presente implica SEGURO.',
    '',
    JUDGE_SCHEMA,
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

/**
 * Tras la ronda 1: ¿vale la pena continuar el debate?
 * Respuesta JSON: { "continueDebate": boolean, "reason": string }
 */
export function buildContinueDebateMessages({ artifact, transcript }) {
  const system = [
    'Eres un moderador técnico del tribunal. Tras la ronda 1 del debate, decide si hace falta otra ronda.',
    'Responde SOLO con JSON: {"continueDebate": true|false, "reason": "..."}',
    'continueDebate=false cuando: (a) un bando concede explícitamente, (b) la refutación es contundente y no hay puntos abiertos,',
    '(c) ambos bandos repiten las mismas afirmaciones sin aportar evidencia nueva.',
    'continueDebate=true cuando queden acusaciones técnicas sin refutar con evidencia del artefacto.',
  ].join('\n');

  const user = [
    artifactBlock(artifact),
    '',
    transcriptBlock(transcript),
    '',
    '¿Continuar con ronda 2? Responde en JSON.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

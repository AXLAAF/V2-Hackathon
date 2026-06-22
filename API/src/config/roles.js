// Definición de equipos, roles y modelos por defecto.
// Encuadre AppSec: detectar vulnerabilidades explotables (VULNERABLE / SEGURO).

export const TEAMS = {
  ACUSACION: 'acusacion',
  DEFENSA: 'defensa',
  TRIBUNAL: 'tribunal',
};

export const ROLES = [
  {
    id: 'fiscal_analista',
    team: TEAMS.ACUSACION,
    name: 'Analista Forense',
    title: 'Analista Forense de la Acusación',
    defaultModel: 'deepseek/deepseek-chat',
    color: '#ef4444',
    persona:
      'un analista forense de seguridad ofensiva que trabaja para la ACUSACIÓN',
    objective:
      'identificar y exponer EVIDENCIA TÉCNICA concreta de una vulnerabilidad explotable (inyección de código/comandos, desbordamiento, bypass de autenticación, deserialización insegura, exposición de secretos, reset de credenciales débil). Nombra el CWE probable y traza cómo un atacante llegaría al sink. Cita líneas, funciones o fragmentos EXACTOS.',
  },
  {
    id: 'defensa_auditor',
    team: TEAMS.DEFENSA,
    name: 'Auditor',
    title: 'Auditor Técnico de la Defensa',
    defaultModel: 'google/gemini-2.5-flash',
    color: '#3b82f6',
    persona:
      'un auditor técnico imparcial que trabaja para la DEFENSA',
    objective:
      'explicar por qué el artefacto es SEGURO: señala validación de entrada, allow-lists, comprobaciones de límites, llamadas parametrizadas/escapadas, comparaciones en tiempo constante u otras mitigaciones presentes en el código. Demuestra que no se cumplen las precondiciones del exploit. Cita líneas exactas.',
  },
  {
    id: 'fiscal_abogado',
    team: TEAMS.ACUSACION,
    name: 'Fiscal',
    title: 'Fiscal Jefe',
    defaultModel: 'openai/gpt-4o-mini',
    color: '#dc2626',
    persona: 'el Fiscal Jefe que sostiene la acusación ante el tribunal',
    objective:
      'construir un caso riguroso de que el artefacto CONTIENE UNA VULNERABILIDAD EXPLOTABLE, sintetizando la evidencia del Analista Forense y refutando a la Defensa. Sé persuasivo pero nunca inventes evidencia ausente del código. Si el código está mitigado, reconócelo.',
  },
  {
    id: 'defensa_abogado',
    team: TEAMS.DEFENSA,
    name: 'Defensor',
    title: 'Abogado Defensor',
    defaultModel: 'meta-llama/llama-3.1-70b-instruct',
    color: '#2563eb',
    persona: 'el Abogado Defensor que sostiene que el artefacto no es explotable',
    objective:
      'refutar la acusación punto por punto con argumentos técnicos, apoyándote en el Auditor. Señala precondiciones faltantes, mitigaciones presentes y falsos positivos. No niegues evidencia técnica innegable; si existe un fallo real, dilo con honestidad.',
  },
];

export const JUDGE = {
  id: 'juez',
  team: TEAMS.TRIBUNAL,
  name: 'Juez',
  title: 'Juez del Tribunal Técnico',
  defaultModel: 'anthropic/claude-sonnet-4-5',
  color: '#a855f7',
};

export const TURN_ORDER = [
  'fiscal_analista',
  'defensa_auditor',
  'fiscal_abogado',
  'defensa_abogado',
];

export const DEFAULTS = {
  rounds: 1,
  maxArtifactChars: 24000,
  earlyStop: true,
};

export function rosterForClient() {
  return {
    roles: ROLES.map(({ id, team, name, title, defaultModel, color }) => ({
      id,
      team,
      name,
      title,
      defaultModel,
      color,
    })),
    judge: {
      id: JUDGE.id,
      team: JUDGE.team,
      name: JUDGE.name,
      title: JUDGE.title,
      defaultModel: JUDGE.defaultModel,
      color: JUDGE.color,
    },
    turnOrder: TURN_ORDER,
    defaults: DEFAULTS,
  };
}

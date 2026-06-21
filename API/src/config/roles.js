// Definición de equipos, roles y modelos por defecto.
// Cada rol es interpretado por un modelo de OpenRouter distinto.
// Los modelos por defecto son sólo sugerencias: la UI permite cambiar
// cualquiera por otro slug válido de OpenRouter (GET /api/models).

export const TEAMS = {
  ACUSACION: 'acusacion',
  DEFENSA: 'defensa',
  TRIBUNAL: 'tribunal',
};

// Roster de debatientes (2 vs 2). El orden define los turnos del debate.
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
      'identificar y exponer EVIDENCIA TÉCNICA concreta de comportamiento malicioso o peligroso en el artefacto: backdoors, exfiltración de datos, ejecución remota de código (RCE), shells inversas, ofuscación, código que se auto-modifica, descargas dinámicas de payloads, dependencias comprometidas o typosquatting, llamadas de red sospechosas, accesos a credenciales/ficheros sensibles, o telemetría encubierta. Debes citar números de línea, nombres de funciones o fragmentos EXACTOS como prueba.',
  },
  {
    id: 'defensa_auditor',
    team: TEAMS.DEFENSA,
    name: 'Auditor',
    title: 'Auditor Técnico de la Defensa',
    defaultModel: 'google/gemini-flash-1.5',
    color: '#3b82f6',
    persona:
      'un auditor técnico imparcial que trabaja para la DEFENSA',
    objective:
      'explicar el PROPÓSITO LEGÍTIMO y el contexto benigno del código. Demostrar que los patrones señalados por la acusación tienen usos normales y esperables (por ejemplo: telemetría con consentimiento, reflexión legítima, peticiones de red a APIs declaradas, etc.). Aportar contexto técnico que descarte la intención maliciosa, citando líneas y prácticas estándar.',
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
      'construir un caso sólido de que el artefacto ES MALICIOSO o representa un riesgo inaceptable, sintetizando la evidencia de tu Analista Forense y refutando los argumentos de la Defensa. Sé persuasivo pero riguroso: no inventes evidencia que no exista en el código.',
  },
  {
    id: 'defensa_abogado',
    team: TEAMS.DEFENSA,
    name: 'Defensor',
    title: 'Abogado Defensor',
    defaultModel: 'meta-llama/llama-3.1-70b-instruct',
    color: '#2563eb',
    persona: 'el Abogado Defensor que defiende la inocencia del artefacto',
    objective:
      'demostrar que el artefacto NO es malicioso, refutando punto por punto la acusación con argumentos técnicos. Apóyate en el análisis de tu Auditor. Señala falta de evidencia, falsos positivos y explicaciones benignas. No niegues evidencia técnica innegable: en ese caso minimiza su severidad o cuestiona la intención.',
  },
];

// El Juez no debate: escucha todo y emite el veredicto final.
export const JUDGE = {
  id: 'juez',
  team: TEAMS.TRIBUNAL,
  name: 'Juez',
  title: 'Juez del Tribunal Técnico',
  defaultModel: 'anthropic/claude-3.5-sonnet',
  color: '#a855f7',
};

// Orden de intervención dentro de cada ronda (alterna acusación/defensa).
export const TURN_ORDER = [
  'fiscal_analista',
  'defensa_auditor',
  'fiscal_abogado',
  'defensa_abogado',
];

export const DEFAULTS = {
  rounds: 2,
  maxArtifactChars: 24000,
};

// Devuelve la metadata pública (sin lógica interna) para la UI.
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

# ⚖️ ChismeLLM V2 — Tribunal Adversarial de IAs

Infraestructura donde distintos modelos de IA (vía **OpenRouter**) adoptan roles en
**dos equipos enfrentados** para juzgar si un artefacto de software (código, dependencia,
documentación) es **malicioso**:

- 🔴 **Acusación** — *Analista Forense* + *Fiscal*: buscan y argumentan evidencia de
  comportamiento malicioso (backdoors, exfiltración, RCE, ofuscación, typosquatting…).
- 🔵 **Defensa** — *Auditor* + *Defensor*: demuestran la intención legítima del código y
  refutan la acusación.
- ⚖️ **Tribunal** — *Juez*: escucha el debate y dicta un **veredicto** (MALICIOSO /
  NO_MALICIOSO / INCONCLUSO) con nivel de confianza, riesgo y hallazgos clave.

Cada rol es interpretado por **un modelo distinto**, configurable desde la interfaz.

## Stack
- **Backend:** Fastify 5 (Node ESM). Sirve la API y el frontend (monolito).
- **Frontend:** HTML5 + CSS3 + JS vanilla. Debate en vivo con **streaming SSE** token a token.
- **LLMs:** OpenRouter (API compatible con OpenAI).

## Puesta en marcha
```bash
cd API
npm install
cp .env.example .env        # añade tu OPENROUTER_API_KEY
npm run dev                 # o: npm start
```
Abre http://localhost:4747

## Flujo
1. Pega/sube el artefacto y dale nombre.
2. Ajusta rondas de debate (1–4) y el modelo de cada rol.
3. **Iniciar juicio** → los equipos debaten en la sala en tiempo real.
4. El Juez emite el veredicto.

## API
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/config` | Roles, equipos y modelos por defecto |
| `GET` | `/api/models` | Modelos disponibles en OpenRouter |
| `POST` | `/api/analyze` | Ejecuta el debate (respuesta **SSE**) |

### Eventos SSE de `/api/analyze`
`open` · `meta` · `round` · `turn-start` · `token` · `turn-end` · `turn-error` ·
`verdict` · `error` · `done`

## Estructura
```
API/
├── src/
│   ├── server.js            # arranque Fastify + estáticos
│   ├── routes/api.js        # endpoints (config, models, analyze/SSE)
│   ├── config/roles.js      # equipos, roles, modelos por defecto, orden de turnos
│   └── services/
│       ├── openrouter.js    # cliente OpenRouter (stream + JSON)
│       ├── prompts.js       # prompts por rol y del juez
│       └── orchestrator.js  # motor del debate
└── public/                  # frontend (index.html, styles.css, app.js)
```

## Personalización
- **Equipos/roles:** edita `src/config/roles.js` (`ROLES`, `TURN_ORDER`, `JUDGE`).
- **Prompts:** `src/services/prompts.js`.
- Pasar de 2v2 a 1v1 u otra topología sólo requiere ajustar `ROLES` y `TURN_ORDER`.

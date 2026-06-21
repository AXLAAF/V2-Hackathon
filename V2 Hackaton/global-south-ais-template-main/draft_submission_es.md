# HAZE: Escrutinio Adversarial Multi-Agente para la Detección de Vulnerabilidades

**HAZE** (*Hallucination-Aware Zero-sum Examination*) — Red Teaming Automatizado mediante AI Safety Debate

**Autores:** [Nombres del Equipo]

**Código y Datos:** [Enlace al Repositorio de GitHub]/`API` | [Enlace al Dataset / Transcripciones]

## Resumen (Abstract)

Los auditores basados en un único Modelo de Lenguaje de Gran Escala (LLM) se usan cada vez más para hallar vulnerabilidades en código y en sistemas de IA, pero adolecen de un defecto epistémico estructural: el mismo proceso generativo que *encuentra* un fallo está sesgado hacia *fabricarlo* para satisfacer el prompt, produciendo altas tasas de falsos positivos (CVEs alucinados, vectores de ataque no instanciables, sanitizaciones imaginarias). Proponemos un protocolo de **Red Teaming Automatizado** que reformula la detección de vulnerabilidades desde la *generación de inferencia única* (single-shot) hacia el *escrutinio adversarial estructurado*, fundamentado en **AI Safety via Debate** (Irving et al., 2018). Cuatro agentes LLM juegan un juego de información cruzada (*cross-examination*): un **Atacante** propone una hipótesis de vulnerabilidad con un vector de ataque trazable; un **Defensor** intenta refutarla apelando a sanitizaciones y mitigaciones existentes; un **Investigador** imparcial ancla el debate a la *Verdad de Terreno* (CVEs reales, semántica de librerías, evidencia del código fuente); y un **Juez** aislado evalúa la transcripción y emite un veredicto calibrado (Vulnerabilidad Confirmada vs. Falso Positivo). Esto desplaza el régimen probatorio desde la confianza probabilística ("~80% seguro de que hay un bug") hacia la carga de la prueba lógica ("el Atacante trazó un exploit que el Defensor no pudo mitigar"). Evaluamos contra un baseline de un solo agente sobre un conjunto etiquetado con verdad de terreno, midiendo precisión, recall y tasa de falsos positivos, y reportamos la significancia estadística de las mejoras observadas. Nuestra hipótesis central es que el escrutinio adversarial multi-agente reduce los falsos positivos sin sacrificar el recall, produciendo veredictos cuya fiabilidad se aproxima a la de un revisor de seguridad humano.

## 1. Introducción

El descubrimiento automatizado de vulnerabilidades con LLMs es atractivo porque escala la auditoría a grandes bases de código y a los propios modelos de IA. Sin embargo, el paradigma dominante de *un solo agente* es epistémicamente frágil.

**Problema y modo de fallo.** Cuando se instruye a un LLM a "encontrar la vulnerabilidad", este condiciona sobre una distribución a posteriori que presupone la existencia del fallo. El objetivo de entrenamiento —maximizar la verosimilitud de una continuación útil, reforzado por RLHF— crea una presión sistemática hacia **fabricar un hallazgo positivo** incluso en código seguro. El modelo no distingue de forma robusta entre "no hay vulnerabilidad" y "no encontré una vulnerabilidad que satisfaga el prompt", y la sicofancia (Perez et al., 2022) amplifica la confirmación de la hipótesis implícita del solicitante. El **modelo de amenaza** resultante para un auditor automatizado es doble: (i) **falsos positivos / alucinaciones** que desperdician el tiempo del revisor y erosionan la confianza, y (ii) la ausencia de *auto-corrección profunda* en el razonamiento de un solo paso, ya que un agente monológico no puede imponer una carga de la prueba contra sus propias premisas intermedias.

**Contribuciones.**
1. Diseñamos una **arquitectura adversarial de cuatro roles** (Atacante, Defensor, Investigador, Juez) que operacionaliza AI Safety via Debate para la detección de vulnerabilidades, con un **Juez deliberadamente aislado** para prevenir la contaminación de contexto y un **Investigador** que actúa como ancla de *Verdad de Terreno*.
2. Formalizamos un **cambio de régimen probatorio, del probabilístico al demostrativo**, en el que una vulnerabilidad se confirma *si y solo si* sobrevive a la refutación adversarial, filtrando estructuralmente las alucinaciones.
3. Proporcionamos un **protocolo de evaluación empírica** con un baseline de un solo agente, etiquetas de verdad de terreno y pruebas de significancia estadística de la reducción de la tasa de falsos positivos.

## 2. Trabajo Relacionado

**AI Safety via Debate.** Irving et al. (2018) introdujeron el debate como un juego de suma cero en el que dos agentes argumentan posiciones opuestas ante un juez, explotando la asimetría de que *verificar* una afirmación es más fácil que *generarla*; en equilibrio, el engaño es una estrategia dominada. Khan et al. (2024) demostraron empíricamente que el debate entre LLMs más persuasivos lleva a los jueces a respuestas más veraces, lo que respalda el uso de un juez sintético.

**Razonamiento multi-agente.** Du et al. (2023) demostraron que el debate multi-agente mejora la factualidad y el razonamiento sobre las cadenas de pensamiento de un solo modelo, evidencia de que la información cruzada adversarial mitiga errores correlacionados.

**Red teaming basado en LLMs.** Perez et al. (2022) usaron LLMs para hacer red teaming a otros LLMs a escala; Ganguli et al. (2022) estudiaron el red teaming para reducir daños, documentando comportamientos de escalado y lecciones metodológicas. Estos trabajos hacen red teaming a la *generación*, pero dependen mayormente de clasificadores posteriores o humanos para la verificación.

**LLM-as-a-Judge.** Zheng et al. (2023) establecieron la viabilidad —y los sesgos— de los jueces LLM, lo que motiva nuestra decisión de diseño de *aislar* al juez de la generación de hipótesis para reducir la sicofancia y el sesgo de compromiso (*commitment bias*).

**Brecha abordada.** El trabajo previo de red teaming se centra en *provocar* fallos, mientras que el trabajo previo de debate apunta a la *verdad de dominio abierto*. Combinamos ambos para la **verificación de vulnerabilidades**: aplicando un debate de cuatro roles, anclado por un Investigador empírico, específicamente para suprimir los falsos positivos en la auditoría de código y de modelos —un eje de evaluación poco atendido por los auditores de un solo agente.

## 3. Métodos

**Visión general del protocolo teórico.** Dado un artefacto objetivo (archivo de código fuente, dependencia o comportamiento de un modelo), el pipeline ejecuta un debate acotado de múltiples turnos:

1. **Atacante (Proponente):** genera una hipótesis de vulnerabilidad especificando tipo, precondiciones y un vector de ataque *trazable*.
2. **Defensor (Opositor):** refuta demostrando la no instanciabilidad, la existencia de sanitización/mitigación, o precondiciones no satisfechas —materializando la **carga de la prueba**.
3. **Investigador (Oráculo):** no toma bando; recupera la *Verdad de Terreno* —CVEs reales, semántica de librerías/APIs, presencia/ausencia de sanitización en el código— para acotar las afirmaciones admisibles a aquellas empíricamente contrastables.
4. **Juez:** evalúa la transcripción completa y emite un veredicto binario y justificado: **Vulnerabilidad Confirmada** vs. **Falso Positivo**.

**Decisiones de diseño y justificación.** El Juez está **estructuralmente aislado** de la generación y la defensa para evitar reintroducir el sesgo de confirmación/compromiso; el veredicto se forma *únicamente* sobre la evidencia articulada en la transcripción. El Investigador previene que el debate degenere en intercambios retóricamente persuasivos pero empíricamente desacoplados.

### 3.1 Implementación de HAZE (`API/`)

Implementamos el protocolo de debate como **HAZE**, un monolito desplegable en `API/` que orquesta el escrutinio adversarial sobre artefactos de software vía OpenRouter. El sistema evalúa si un artefacto pegado o subido (código, manifiesto de dependencias, documentación) exhibe **comportamiento malicioso** —backdoors, exfiltración de datos, RCE, ofuscación, typosquatting, llamadas de red sospechosas— en lugar de emitir una conjetura de un solo modelo.

**Arquitectura.** Un backend Fastify 5 (Node.js ESM) sirve tanto la API REST/SSE como un frontend vanilla HTML/CSS/JS. El pipeline es modular:

| Módulo | Función |
|---|---|
| `src/config/roles.js` | Plantilla de equipos, orden de turnos, modelos por defecto |
| `src/services/prompts.js` | Prompts system/user por rol y esquema JSON del juez |
| `src/services/orchestrator.js` | Motor de debate multi-ronda y parseo del veredicto |
| `src/services/openrouter.js` | Cliente OpenRouter (streaming + JSON estructurado) |
| `src/routes/api.js` | `GET /api/config`, `GET /api/models`, `POST /api/analyze` (SSE) |
| `public/` | UI de debate en vivo con streaming token a token |

**Mapeo de agentes (teoría → implementación).** El prototipo actual instancia una topología **2v2 + Juez aislado**:

| Rol teórico | Rol(es) en HAZE | Equipo | Función |
|---|---|---|---|
| Atacante | **Analista Forense** + **Fiscal** | Acusación | Exponer evidencia técnica de patrones maliciosos; sintetizar y refutar argumentos de la defensa |
| Defensor | **Auditor** + **Defensor** | Defensa | Explicar intención legítima; refutar acusaciones con contexto benigno y prácticas estándar |
| Investigador | *(planificado)* | — | Aún no implementado como agente separado e imparcial |
| Juez | **Juez** | Tribunal | Lee solo la transcripción completa; emite veredicto estructurado |

Cada rol debatiente está vinculado a un **LLM distinto** (configurable por rol en la UI), rompiendo modos de fallo correlacionados de un solo modelo. El orden de turnos alterna acusación/defensa cada ronda: Analista Forense → Auditor → Fiscal → Defensor (1–4 rondas, default 2). Temperatura de debatientes: 0.7; el Juez usa temperatura 0.1 y `response_format: json_object`.

**Flujo de extremo a extremo.**
1. El usuario pega o sube un artefacto (≤24.000 caracteres; entradas mayores se truncan con flag).
2. Configura las rondas de debate y selecciona un slug de modelo OpenRouter por rol.
3. `POST /api/analyze` transmite Server-Sent Events: `open` → `meta` → `round` → `turn-start` / `token` / `turn-end` → `verdict` → `done`.
4. El orquestador acumula una transcripción; los debatientes ven turnos previos y deben citar líneas/funciones exactas —los prompts prohíben explícitamente inventar evidencia.
5. El **Juez aislado** recibe solo artefacto + transcripción (nunca participó en el debate) y devuelve JSON: `verdict` (`MALICIOSO` / `NO_MALICIOSO` / `INCONCLUSO`), `confidence` (0–100), `riskLevel`, `keyFindings`, `winningTeam`, `reasoning`.

**Restricciones de prompts (carga de la prueba).** Todos los prompts de debatientes exigen afirmaciones ancladas al artefacto, limitan respuestas a ~180 palabras y aplican honestidad intelectual dentro de cada equipo. El prompt del Juez penaliza argumentos sin evidencia y exige justificación del veredicto a partir de la calidad de la transcripción y la evidencia del código —operacionalizando el cambio de fluidez probabilística a **escrutinio demostrativo**.

**Modelos y herramientas.** Los agentes se enrutan por **OpenRouter** (API compatible con OpenAI); no requiere GPU local. Setup: `npm install`, copiar `.env.example` → `.env` con `OPENROUTER_API_KEY`, `npm run dev` → `http://localhost:3000`. Artefactos de ejemplo en `API/examples/` (`suspicious_installer.py`, `benign_utils.py`) para pruebas manuales.

**Baseline.** Un **auditor de un solo agente** ("encuentra la vulnerabilidad") sobre entradas idénticas, para aislar la contribución del escrutinio adversarial.

**Lo que no funcionó (documentado).** Las variantes iniciales que permitían al Atacante también juzgar colapsaron en auto-confirmación; los debates sin anclaje produjeron exploits fluidos pero no instanciables. El rol **Investigador** separado queda como trabajo futuro —el diseño 2v2 actual mitiga parcialmente las alucinaciones vía información cruzada, pero carece de un agente imparcial de recuperación de *Verdad de Terreno*.

### 3.2 Pipeline de ejecución

HAZE no es un analizador estático clásico (AST/SAST). Es un **protocolo de verificación**: varios LLMs compiten bajo reglas estrictas y un juez aislado emite un veredicto estructurado. El cliente envía un payload JSON a `POST /api/analyze`:

```json
{
  "artifact": { "filename": "setup.py", "content": "...", "kind": "código" },
  "rounds": 2,
  "models": { "fiscal_analista": "deepseek/deepseek-chat", "juez": "anthropic/claude-3.5-sonnet" }
}
```

**Fase 0 — Resolución de configuración.** `resolveConfig()` valida que el artefacto no esté vacío, trunca el contenido a 24.000 caracteres (marcando `truncated: true` si aplica), resuelve overrides de modelo por rol y acota las rondas a [1, 4].

**Fase 1 — Debate multi-ronda.** Por cada ronda *r*, el orquestador ejecuta `TURN_ORDER`: Analista Forense → Auditor → Fiscal → Defensor. Por cada turno:

1. `buildDebaterMessages()` ensambla un prompt **system** (persona, objetivo, reglas del tribunal) y un prompt **user** (bloque del artefacto + transcripción acumulada + instrucción de apertura/refutación).
2. `streamChat()` llama a OpenRouter con temperatura 0.7 (`max_tokens: 700`, streaming activado).
3. Cada delta de token se emite al cliente vía SSE (`event: token`).
4. El texto completo del turno se añade a `transcript[]` —estado compartido append-only visible para todos los debatientes posteriores y para el Juez.

**Fase 2 — Veredicto aislado.** El Juez no ha generado ningún turno de debate. Recibe solo el artefacto original y la transcripción completa. `buildJudgeMessages()` solicita salida JSON estricta; `chat()` se invoca con temperatura 0.1 y `response_format: { type: "json_object" }`. `parseVerdict()` extrae el objeto JSON aunque el modelo añada ruido circundante.

**Fase 3 — Streaming al cliente.** La API secuestra la respuesta HTTP para Server-Sent Events:

`open` → `meta` → `round` → `turn-start` → `token*` → `turn-end` → … → `verdict` → `done`

Si el cliente se desconecta, un `AbortController` cancela las peticiones en curso a OpenRouter.

### 3.3 Mecanismos técnicos centrales

**Separación de modelos por rol.** Cada rol puede vincular un LLM distinto (p. ej., DeepSeek, Gemini, GPT-4o-mini, Llama 70B, Claude 3.5 Sonnet). Esto descorrelaciona parcialmente los modos de fallo: un modelo que alucina un backdoor puede ser refutado por otro con arquitectura y sesgos de entrenamiento distintos.

**Transcripción como estado compartido.** El estado del debate es un array append-only sin memoria oculta entre turnos. Toda afirmación y refutación es auditable en la transcripción que evalúa el Juez.

**Aislamiento epistémico del Juez.** El Juez (i) nunca participa en la generación de hipótesis, (ii) no tiene persona adversarial, (iii) opera a baja temperatura con esquema JSON forzado, y (iv) está instruido para penalizar argumentos sin evidencia. Esto implementa **LLM-as-a-Judge** con separación institucional: quien acusa y defiende no decide el resultado.

**Carga de la prueba vía ingeniería de prompts.** Los debatientes deben citar líneas/funciones exactas del artefacto y tienen prohibido inventar código. La ronda 1 elicita evidencia de apertura; las rondas posteriores exigen refutación activa. El Fiscal sintetiza la acusación; el Defensor refuta punto por punto. Los hallazgos que no sobreviven la refutación quedan debilitados en la transcripción que lee el Juez.

**Descomposición funcional de la topología 2v2.**

| Rol | Función técnica |
|---|---|
| **Analista Forense** | Detección ofensiva: patrones maliciosos, indicadores en el código |
| **Auditor** | Contexto defensivo: uso legítimo, explicaciones benignas |
| **Fiscal** | Síntesis argumentativa + refutación de la defensa |
| **Defensor** | Refutación punto por punto; admite evidencia fuerte pero cuestiona intención/severidad |

Un solo prompt ("encuentra el malware") mezcla detección, contexto y juicio; HAZE separa estas funciones en roles adversariales.

### 3.4 Alcance de evaluación

El prototipo actual apunta a la **detección de software malicioso**, no a la enumeración genérica de CVEs. HAZE evalúa si un artefacto exhibe patrones como: backdoors y shells inversas; exfiltración de datos (`urllib`, `socket`, POST codificado); RCE / `exec()` de payloads descargados; ofuscación y auto-modificación; typosquatting en dependencias; acceso a credenciales/entorno; y telemetría encubierta. Los artefactos de prueba están en `API/examples/` (`suspicious_installer.py`, `benign_utils.py`).

### 3.5 Contribución a AI Security

HAZE aborda AI Security en dos dimensiones complementarias.

**Seguridad *con* IA (usar LLMs para auditar software).**

| Fallo del single-agent | Mitigación en HAZE |
|---|---|
| Sesgo de confirmación: inventar hallazgos para satisfacer el prompt | Adversario dedicado (Defensa) refuta activamente las afirmaciones |
| Confianza no calibrada ("~80% seguro") | Veredicto JSON estructurado: `verdict`, `confidence`, `keyFindings`, `reasoning` |
| Un solo modelo, un solo punto ciego | Roles multi-modelo con errores parcialmente descorrelacionados |
| Sin trazabilidad | Transcripción completa auditable por humanos |
| Auto-corrección intrínseca débil | Información cruzada adversarial en múltiples rondas |

HAZE es **red teaming automatizado de artefactos**: escala la revisión de paquetes sospechosos, PRs, dependencias o snippets antes de merge/deploy.

**Seguridad *de* IA (AI Safety / Alignment).**

1. **AI Safety via Debate (Irving et al., 2018).** Verificar es más fácil que generar. El Juez no produce la auditoría —*evalúa* qué bando sobrevivió al escrutinio. Esto es *supervisión escalable* (*scalable oversight*): supervisar sistemas más capaces que el supervisor.
2. **Reducción de alucinaciones por diseño institucional.** El sistema no confía en un umbral de probabilidad. La acusación debe **resistir la refutación** —cambio de régimen probatorio probabilístico a demostrativo.
3. **Debate multi-agente (Du et al., 2023).** El debate mejora la factualidad frente al chain-of-thought monológico; HAZE lo aplica a la auditoría de ciberseguridad.
4. **LLM-as-a-Judge con mitigación de sesgos (Zheng et al., 2023).** El aislamiento del Juez reduce el *commitment bias* y la *sicofancia*: el evaluador no generó la hipótesis que juzga.
5. **Red teaming de modelos (Perez et al., 2022; Ganguli et al., 2022).** El protocolo generaliza: el "artefacto" puede ser **comportamiento de un modelo** (jailbreaks, prompt injection) en lugar de código Python —la misma topología adversarial provoca y verifica fallos de alineación.

**Ciclo epistémico.** Artefacto de entrada → debate adversarial (acusación propone, defensa refuta, síntesis, cierre) → Juez aislado pregunta si la acusación sobrevivió la refutación → `MALICIOSO` / `NO_MALICIOSO` / `INCONCLUSO`.

**Limitaciones conocidas (implementación).** (i) Sin rol Investigador aún —sin consulta externa de CVEs/bases de datos; el razonamiento se limita al texto del artefacto. (ii) Los LLMs pueden compartir sesgos de alucinación correlacionados pese a la asignación multi-modelo. (iii) Ventana de 24k caracteres; sin análisis multi-archivo ni en tiempo de ejecución. (iv) El Juez sigue siendo un LLM —los veredictos asisten la revisión, no certifican formalmente. (v) Latencia y coste de API escalan con roles × rondas + juez vs. un solo prompt.

## 4. Resultados

> *Marcador de posición pendiente de experimentos — a poblar con valores medidos.*

Evaluamos sobre un **conjunto etiquetado con verdad de terreno** que contiene variantes tanto vulnerables como parcheadas/seguras de cada artefacto. Métricas primarias: **precisión**, **recall**, **tasa de falsos positivos (FPR)** y **calibración del veredicto**.

- **Tabla 1.** Debate multi-agente vs. baseline de un solo agente: precisión / recall / FPR con intervalos de confianza del 95%.
- **Figura 1.** Tasa de falsos positivos, un solo agente vs. debate de cuatro roles (menor es mejor). *Pie de figura: Se espera que el escrutinio adversarial reduzca la FPR preservando el recall en artefactos verdaderamente vulnerables.*
- **Figura 2.** Ablación eliminando al Investigador y eliminando el aislamiento del Juez, mostrando la contribución marginal de cada rol.

**Robustez.** Reportamos la significancia estadística (p. ej., bootstrap / prueba de McNemar sobre veredictos pareados) para cualquier reducción de FPR afirmada, variamos el número de turnos del debate y el modelo subyacente, y confirmamos que las conclusiones son estables ante pequeños cambios de configuración. Las afirmaciones se hacen solo donde la suficiencia de datos las respalda.

## 5. Discusión y Limitaciones

**Implicaciones más amplias para AI Safety.** El protocolo instancia la *supervisión escalable* (*scalable oversight*): un juez no necesita generar una auditoría desde cero —tarea costosa y propensa a la alucinación— sino solo evaluar cuál de dos posiciones mutuamente refutadas sobrevive al escrutinio. Este desplazamiento de la carga es un patrón concreto y desplegable para usar el debate en la verificación de afirmaciones relevantes para la seguridad, tanto de código como de modelos.

**Limitaciones y asunciones (explícitas).** (i) La recuperación de *Verdad de Terreno* del Investigador puede alucinar o ser incompleta; (ii) la asimetría verificación–generación de Irving et al. (2018) se asume válida en el dominio de auditoría de código/modelos y debe validarse empíricamente; (iii) el Juez sintético puede compartir un **modo de fallo correlacionado** con los debatientes, socavando la independencia del juicio. **Modelos de amenaza no abordados:** colusión adversarial entre agentes, inyección de prompts desde el artefacto auditado hacia los agentes, y vulnerabilidades que requieren contexto multi-archivo o de tiempo de ejecución más allá de la evidencia provista.

**Trabajo futuro.** Validación con humano en el bucle (*human-in-the-loop*) de los veredictos sintéticos; jueces de modelos cruzados para romper errores correlacionados; extensión del razonamiento de nivel-archivo a nivel-repositorio y tiempo de ejecución; análisis de calibración de la confianza del juez.

## 6. Conclusión

Sostenemos que la detección automatizada y fiable de vulnerabilidades requiere ir más allá de los auditores de un solo agente, cuyo paisaje de pérdida recompensa la fabricación de hallazgos, hacia el **escrutinio adversarial estructurado**. Al escenificar cuatro roles LLM —Atacante, Defensor, Investigador y un Juez aislado— en un juego de AI Safety via Debate, una vulnerabilidad se confirma solo cuando un exploit trazado sobrevive a la refutación activa y al anclaje empírico, reemplazando la confianza probabilística no calibrada por una carga de la prueba lógica.

De validarse, este diseño reduce los falsos positivos sin sacrificar el recall y ofrece una plantilla reproducible para la supervisión escalable: usar el debate adversarial no solo para *provocar* fallos, sino para *verificarlos* a un estándar que se aproxima al de un revisor de seguridad humano.

## Código y Datos

[Enlace al Repositorio de GitHub]/`API` — monolito HAZE: backend Fastify, orquestador OpenRouter, prompts por rol, API de debate SSE e interfaz web en vivo.
[Enlace al Dataset / Transcripciones] — artefactos etiquetados, PoCs de ejemplo (`API/examples/`) y transcripciones completas de los debates.

## Contribuciones de los Autores (opcional)

[Nombre] — arquitectura y orquestación; [Nombre] — evaluación y baselines; [Nombre] — redacción y análisis.

## Referencias

Bai, Y., Kadavath, S., Kundu, S., Askell, A., Kernion, J., Jones, A., … Kaplan, J. (2022). *Constitutional AI: Harmlessness from AI feedback*. arXiv. https://arxiv.org/abs/2212.08073

Du, Y., Li, S., Torralba, A., Tenenbaum, J. B., & Mordatch, I. (2023). *Improving factuality and reasoning in language models through multiagent debate*. arXiv. https://arxiv.org/abs/2305.14325

Ganguli, D., Lovitt, L., Kernion, J., Askell, A., Bai, Y., Kadavath, S., … Clark, J. (2022). *Red teaming language models to reduce harms: Methods, scaling behaviors, and lessons learned*. arXiv. https://arxiv.org/abs/2209.07858

Irving, G., Christiano, P., & Amodei, D. (2018). *AI safety via debate*. arXiv. https://arxiv.org/abs/1805.00899

Khan, A., Hughes, J., Valentine, D., Ruis, L., Sachan, K., Radhakrishnan, A., … Perez, E. (2024). *Debating with more persuasive LLMs leads to more truthful answers*. arXiv. https://arxiv.org/abs/2402.06782

Perez, E., Huang, S., Song, F., Cai, T., Ring, R., Aslanides, J., … Irving, G. (2022). *Red teaming language models with language models*. arXiv. https://arxiv.org/abs/2202.03286

Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., … Stoica, I. (2023). *Judging LLM-as-a-judge with MT-Bench and Chatbot Arena*. arXiv. https://arxiv.org/abs/2306.05685

---

**Declaración de Uso de LLMs:**

Se usaron LLMs para asistir en la redacción, estructuración y encuadre bibliográfico de esta entrega, y constituyen el sistema bajo estudio (los cuatro agentes de debate). Todas las afirmaciones técnicas, las referencias citadas y —una vez poblados— los resultados empíricos fueron verificados de forma independiente por los autores; los resultados cuantitativos de la Sección 4 están pendientes de experimentos y no deben citarse hasta ser medidos y sometidos a pruebas de significancia.

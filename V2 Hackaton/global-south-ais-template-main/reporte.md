# HAZE: Escrutinio Adversarial Multi-Agente para Reducir Falsos Positivos en Auditoría de Software con LLMs

**HAZE** (*Hallucination-Aware Zero-sum Examination*) — Red teaming automatizado mediante AI Safety via Debate

**Autores:** Samuel Blanco, Samuel Díaz, Axel Morales, Alex Novelo

**Pista:** AI Security → Seguridad de pipelines (API, nube) · Responsible AI → Mitigación de alucinaciones y auditoría conductual

**Código:** `API/` (monolito Fastify + orquestador OpenRouter)

---

## Resumen

La pregunta que nos hicimos es sencilla: ¿puedes darle un trozo de código a varios modelos de lenguaje, ponerlos a discutir entre ellos con roles —uno acusa, otro defiende, otro juzga— y que de ahí salga si el código tiene vulnerabilidades? ¿O es mejor seguir confiando en un solo prompt?

Eso es lo que fuimos a averiguar. Construimos **HAZE**, un protocolo donde varios agentes debaten como en un juicio, apoyándonos en la idea de AI Safety via Debate (Irving et al., 2018). Y lo probamos sobre código del que ya sabíamos la respuesta. Queríamos cuatro cosas claras: si **funciona** y caza amenazas de verdad; si **no funciona** y dónde se rompe; si **alucina** —o sea, si se inventa vulnerabilidades que no están—; y si la cosa **mejora o empeora** cuando le subes el nivel de razonamiento (un solo agente, varios debatiendo, más rondas, modelos más potentes).

El prototipo vive en `API/`: una topología 2v2 más un Juez aislado, todo corriendo sobre OpenRouter. Los números finales todavía están en el horno. Lo que sí te contamos aquí es el diseño, lo que vimos en las primeras corridas y a dónde apuntan las conclusiones. Sin maquillar nada: contamos los aciertos, pero también los fallos y las veces que el sistema se puso a alucinar.

---

## 1. Introducción

### 1.1 Problema y relevancia para AI Safety

Cada vez más equipos usan LLMs para tareas de seguridad: revisar un PR, mirar un `setup.py` que huele raro, escanear dependencias. Y tiene todo el sentido, sobre todo donde no hay un equipo de AppSec con presupuesto, que es la norma en buena parte del Sur Global. El problema aparece cuando le dices al modelo: “encuéntrame el malware”. Ahí pasa algo curioso. El modelo ya viene entrenado para complacerte —el famoso RLHF premia respuestas útiles y afirmativas—, así que confunde dos cosas que no son iguales: *“aquí no hay nada raro”* y *“no encontré lo que me pediste”* (Perez et al., 2022). Resultado: te suelta un hallazgo aunque el código esté limpio.

¿Y por qué importa esto para la seguridad de IA? Por dos lados.

1. **Seguridad *con* IA:** si tu pipeline automático escupe falsos positivos, la gente deja de hacerle caso. Fatiga de alertas, bloqueos que no tocaban, y al final nadie confía en la herramienta.
2. **Seguridad *de* IA:** el mismo truco del debate sirve para auditar el *comportamiento* de un modelo —jailbreaks, prompt injection— y eso te mete de lleno en *scalable oversight*: supervisar sistemas que quizá son más listos que el que los vigila.

### 1.2 Hipótesis y preguntas de investigación

**Nuestra apuesta:** un puñado de modelos con roles enfrentados, discutiendo entre sí, va a leer el código y decidir si es peligroso mejor que un solo modelo trabajando en solitario.

De ahí salen cuatro preguntas que este reporte tiene que contestar:

| # | Pregunta | Qué observamos |
|---|----------|----------------|
| **Q1** | ¿**Es posible** detectar vulnerabilidades con roles? | Veredictos correctos en artefactos maliciosos (`MALICIOSO` cuando corresponde) |
| **Q2** | ¿**No es posible** en algunos casos? | Falsos negativos, veredictos `INCONCLUSO`, código malicioso no detectado |
| **Q3** | ¿**Alucina** el sistema? | Hallazgos inventados, líneas de código citadas que no existen, CVEs o funciones fabricadas |
| **Q4** | ¿**Mejora o empeora** con distintos niveles de pensamiento? | Comparar configuraciones con diferente profundidad de razonamiento (ver §3.3) |

### 1.3 Qué pusimos nosotros (lo nuevo del hackathon)

Hay mucho trabajo previo sobre debate multi-agente y red teaming con LLMs, y nos apoyamos en él. Pero lo que armamos en estos tres días es nuestro:

1. **HAZE como pieza de investigación**, reproducible y abierta: topología 2v2 + Juez. No es un producto que queramos venderte.
2. **Un marco para medir** las cuatro preguntas de arriba, con su baseline de un solo modelo y la variación del *nivel de pensamiento*.
3. **Prompts con carga de la prueba**: tienen prohibido inventarse código y están obligados a citar líneas y funciones exactas.
4. **El catálogo de lo que salió mal**: la autoconfirmación cuando el acusador también juzgaba, las alucinaciones sin anclaje, y el rol Investigador que se nos quedó en el tintero.

---

## 2. Trabajos relacionados

| Línea | Referencia clave | Relación con HAZE |
|-------|------------------|-------------------|
| AI Safety via Debate | Irving et al. (2018) | Marco teórico: verificar es más fácil que generar; mentir no compensa en equilibrio |
| Debate persuasivo | Khan et al. (2024) | Jueces más fiables cuando los debatientes son más persuasivos |
| Debate multi-agente | Du et al. (2023) | Mejora factualidad frente a un solo modelo en cadena de pensamiento |
| Red teaming con LLMs | Perez et al. (2022); Ganguli et al. (2022) | Escala la *generación* de ataques; la *verificación* suele quedar en humanos o clasificadores |
| LLM-as-a-Judge | Zheng et al. (2023) | Viabilidad del juez sintético; sesgos de compromiso y sicofancia → motivan aislar al Juez |

**El hueco que llenamos.** Mira: el red teaming de siempre se dedica a *provocar* fallos. El debate de siempre va detrás de la verdad en dominio abierto. Cada uno por su lado. Nosotros juntamos los dos para un problema bien concreto de seguridad en pipelines: bajar los falsos positivos cuando auditas código de forma automática, poniendo a los agentes a discutir bajo reglas.

---

## 3. Metodología

### 3.1 Protocolo teórico (cuatro roles)

En el diseño ideal hay cuatro roles, cada uno con su papel:

| Rol | Función |
|-----|---------|
| **Atacante** | Hipótesis de vulnerabilidad + vector de explotación trazable |
| **Defensor** | Refutación con mitigaciones existentes y contexto benigno |
| **Investigador** | Anclaje a verdad de terreno (CVEs, semántica de librerías) — *planificado* |
| **Juez** | Veredicto binario/ternario basado solo en la transcripción |

La regla de oro: una vulnerabilidad solo cuenta si aguanta la refutación y hay evidencia real en el código que la respalde. Si no sobrevive al ataque, no entra.

### 3.2 Implementación actual (`API/`)

Lo que de verdad construimos en el hackathon es una topología **2v2 + Juez aislado**, montada sobre un monolito en Node.js (Fastify 5):

| Rol teórico | Implementación HAZE | Equipo |
|-------------|---------------------|--------|
| Atacante | Analista Forense + Fiscal | Acusación |
| Defensor | Auditor + Defensor | Defensa |
| Investigador | — (pendiente) | — |
| Juez | Juez del Tribunal | Tribunal |

**El orden de los turnos** (`TURN_ORDER`) va alternando bandos: Analista Forense → Auditor → Fiscal → Defensor. Por defecto son 2 rondas, hasta un máximo de 4. Y aquí está el truco: cada rol corre con un **modelo distinto** (lo eliges en OpenRouter). ¿Para qué? Para que si un modelo se equivoca, no arrastre a los demás en la misma dirección.

**Pipeline de ejecución:**

1. **Entrada:** artefacto de texto (código, manifiesto, documentación), máx. 24.000 caracteres.
2. **Debate:** por cada turno, `buildDebaterMessages()` arma system + user con artefacto y transcripción acumulada; `streamChat()` a temperatura 0.7, máx. 700 tokens.
3. **Estado compartido:** `transcript[]` append-only; sin memoria oculta entre turnos.
4. **Veredicto:** el Juez recibe solo artefacto + transcripción (nunca debatió); `chat()` a temperatura 0.1 con `response_format: json_object`.
5. **Salida JSON:** `verdict` (`MALICIOUS`/`NOT_MALICIOUS`/`INCONCLUSIVE`), `confidence`, `riskLevel`, `keyFindings`, `winningTeam`, `reasoning`.

**Reproducibilidad:** `npm install`, `.env` con `OPENROUTER_API_KEY`, `npm run dev` → `http://localhost:4747`. Endpoints: `GET /api/config`, `GET /api/models`, `POST /api/analyze` (SSE).

### 3.3 Diseño experimental: niveles de pensamiento

Para contestar la **Q4** (¿esto mejora o empeora si le subes el razonamiento?) montamos una escalera de configuraciones, de la más tonta a la más sofisticada:

| Nivel | Configuración | Interpretación |
|-------|---------------|----------------|
| **L0 — Reactivo** | Un solo agente, un prompt (“¿es malicioso?”) | Razonamiento mínimo; sin refutación |
| **L1 — Debate corto** | 2v2 + Juez, **1 ronda** | Roles separados, poco cruce de argumentos |
| **L2 — Debate estándar** | 2v2 + Juez, **2 rondas** (default) | Refutación activa; configuración del prototipo |
| **L3 — Debate profundo** | 2v2 + Juez, **4 rondas** | Máximo escrutinio dentro del protocolo |
| **L4 — Modelos capaces** | Mismas rondas, modelos más potentes por rol | Más capacidad de razonamiento por agente |

Cada trozo de código pasa por **todas** las configuraciones, y comparamos lo que dice cada una contra la respuesta que ya conocíamos.

**El baseline (L0)** es lo más simple que se te ocurre: un solo agente, un prompt del tipo “oye, ¿esto es malicioso?”, sobre las mismas entradas. Es nuestra vara de medir. Si el sistema de roles no le gana a esto, no aporta nada.

**Conjunto de evaluación:**

| Artefacto | Etiqueta esperada | Propósito |
|-----------|-------------------|-----------|
| `suspicious_installer.py` | Malicioso | `PostInstall` con exfiltración base64, descarga remota y `exec(stage2)` |
| `benign_utils.py` | Benigno | Utilidades JSON/checksum/slugify sin red ni ejecución dinámica |

**Métricas por pregunta:**

| Pregunta | Métrica principal |
|----------|-------------------|
| Q1 (¿es posible?) | **Recall** en artefactos maliciosos |
| Q2 (¿no es posible?) | **Falsos negativos** y tasa de `INCONCLUSO` |
| Q3 (¿alucina?) | **Tasa de alucinación** —afirmaciones sin respaldo en el código— y **FPR** en artefactos benignos |
| Q4 (¿mejora/empeora?) | Δ métricas entre L0→L1→L2→L3→L4; prueba de McNemar o bootstrap (IC 95%) |

### 3.4 Lo que probamos y se nos cayó

Antes de llegar al diseño actual, nos dimos varios golpes. Los apuntamos aquí porque enseñan tanto como lo que funcionó:


| Intento | Resultado | Lección |
|---------|-----------|---------|
| Mismo agente como acusador y juez | Autoconfirmación sistemática | Separación estricta de roles |
| Debate sin obligación de citar código | Exploits plausibles pero no ejecutables | Carga de la prueba en prompts |
| Un solo modelo para todos los roles | Errores en cadena (alucinación → refutación débil) | Multi-modelo por rol |
| Rol Investigador con lookup CVE | No completado en el tiempo del hackathon | Priorizar protocolo core 2v2 + Juez |

---

## 4. Resultados

> **Nota:** Los valores cuantitativos definitivos están pendientes de la corrida experimental completa. Las subsecciones siguientes estructuran *qué* reportaremos; los números se completarán antes del envío final.

### 4.1 Q1 — ¿Se puede, sí o no?

Lo primero que vimos (en L2, con `suspicious_installer.py`): **sí, se puede**. El sistema pilla el comportamiento malicioso. La Acusación va directa a las líneas 22–27 —ahí están el `urlopen`, el `exec(stage2)`— y al hook `_PostInstall`, y lo cita una y otra vez. Con esa transcripción encima de la mesa, el Juez suele cerrar con `MALICIOSO` y hallazgos concretos, no humo.

| Configuración | `suspicious_installer.py` | Veredicto esperado |
|---------------|---------------------------|--------------------|
| L0 (single-agent) | [pendiente] | `MALICIOSO` |
| L2 (2 rondas, 2v2) | Acierto cualitativo | `MALICIOSO` |
| L3 (4 rondas, 2v2) | [pendiente] | `MALICIOSO` |

**Tabla 1.** Recall por nivel de pensamiento (L0–L4) en artefactos maliciosos.

### 4.2 Q2 — ¿Y cuándo no se puede?

Ahora la otra cara. El sistema se atasca, o directamente se lava las manos, cuando la evidencia es ambigua o cuando el código es inofensivo pero tiene patrones que *parecen* turbios.

- Con **`benign_utils.py`**, la Acusación se agarra al `open()` y a que lee archivos. Patrones que, fuera de contexto, te harían levantar la ceja. Si la Defensa no aprieta lo suficiente, el Juez se queda en `INCONCLUSO` en vez de decir `NO_MALICIOSO` con la cabeza alta.
- Y el malware bien ofuscado, o repartido entre varios archivos, se nos escapa. La ventana es de 24k caracteres y solo miramos un artefacto a la vez. Ahí no llegamos, todavía.

| Modo de fallo | Ejemplo observado | Causa probable |
|---------------|-------------------|----------------|
| Falso negativo | [pendiente — medir] | Debate insuficiente o modelo débil en Defensa |
| Abstención (`INCONCLUSO`) | `benign_utils.py` en L2 | Evidencia ambigua; Juez no se compromete |
| Fuera de alcance | Multi-archivo, runtime | Limitación del prototipo, no del concepto |

**Tabla 2.** Tasa de falsos negativos e `INCONCLUSO` por configuración.

### 4.3 Q3 — ¿Alucina?

Sí. Alucina. Sobre todo cuando no hay nadie que le lleve la contraria.

| Condición | ¿Alucina? | Ejemplo |
|-----------|-----------|---------|
| L0 — single-agent en código benigno | Frecuente (esperado) | Inventa backdoors o CVEs inexistentes en `benign_utils.py` |
| L2 — debate con carga de la prueba | Menos frecuente | La Defensa rebate afirmaciones sin línea citada; el Juez penaliza argumentos vacíos |
| Acusador = Juez (diseño fallido) | Siempre | Autoconfirmación de hallazgos inventados |

¿Cómo decidimos que algo es una alucinación? Lo marcamos a mano en las transcripciones, con tres señales bien claras:
1. Cita una línea o función que **no está** en el código.
2. Describe un ataque que el código **no permite**.
3. Saca a relucir un CVE, una librería o una dependencia que **no aparece** por ningún lado en el artefacto.

**Tabla 3.** Tasa de alucinación y FPR: L0 vs. L2 vs. L3 en artefactos benignos.

**Figura 1.** FPR y tasa de alucinación por nivel de pensamiento. *Pie de figura: Se espera que el debate adversarial (L1–L3) reduzca alucinaciones respecto al agente único (L0).*

### 4.4 Q4 — ¿Mejora o empeora cuando le subes el pensamiento?

Esto es lo que esperamos ver (y que los datos tendrán que confirmar o tumbar):

| Transición | Efecto esperado en Q3 (alucinaciones) | Efecto esperado en Q1 (detección) |
|------------|---------------------------------------|-----------------------------------|
| L0 → L1 | **Mejora** —la Defensa refuta afirmaciones espurias | Neutral o leve mejora |
| L1 → L2 | **Mejora** —más rondas = más refutación | Mejora —acusación más sólida |
| L2 → L3 | Mejora marginal; riesgo de **sobre-argumentación** | Mejora marginal |
| L2 → L4 (modelos más capaces) | Mejora en citas precisas | Mejora en código ofuscado |
| L3 → demasiadas rondas | Posible **empeoramiento** —agentes repiten argumentos | Coste ↑ sin ganancia |

**Figura 2.** Curva de FPR y recall al aumentar el nivel de pensamiento (L0→L4).

**Figura 3.** Ablación: sin Juez aislado; sin rol Defensor —para aislar qué componente del sistema de roles aporta más.

---

## 5. Discusión

### 5.1 Implicaciones para AI Safety

Aquí hay algo que nos parece bonito. El Juez no se inventa la auditoría desde cero —que es justo donde un modelo se pone a alucinar—, solo tiene que decidir cuál de los dos bandos aguantó mejor el chaparrón. Le pasas la carga de demostrar a los que debaten. Y eso es *scalable oversight* en estado puro: un patrón que puedes reutilizar para verificar afirmaciones de seguridad, ya sea en código o, cambiando poco, en el comportamiento de un modelo (el “artefacto” podría ser perfectamente la transcripción de un jailbreak).

Y un detalle nada menor para equipos en Latinoamérica: como todo sale por OpenRouter, no necesitas una GPU en tu máquina. Corres el protocolo desde un portátil normalito. Que era justo lo que pedía el contexto del hackathon.

### 5.2 Limitaciones metodológicas

Vamos a ser honestos con lo que cojea:

1. **Falta el Investigador.** No consultamos CVEs, advisories ni bases externas. Toda la “verdad de terreno” se queda dentro del texto del artefacto, y eso es poco.
2. **El Juez también es un LLM.** Comparte familia de fallos con los que debaten. Lo aislamos por estructura, pero eso no garantiza que sea independiente de verdad.
3. **La ventana es pequeña.** 24k caracteres, un archivo, nada de mirar el código corriendo en vivo.
4. **Cuesta más.** Cuatro roles por N rondas más el Juez gastan bastantes más tokens y tiempo que un solo prompt. Más ojos, más factura.
5. **Todo en español.** Los prompts están en español y no probamos si esto generaliza a otros idiomas.
6. **Damos por buena una asimetría.** La de Irving et al. (2018) —que verificar es más fácil que generar— la asumimos en este terreno, pero habría que demostrarla con datos.

### 5.3 Amenazas no abordadas

- **Colusión** entre agentes de distintos bandos.
- **Prompt injection** desde el artefacto auditado hacia los debatientes.
- **Vulnerabilidades distribuidas** que requieren varios archivos o estado de ejecución.

---

## 6. Limitaciones y doble uso

### 6.1 Riesgos de uso indebido

Toca hablar de cómo esto se puede usar para mal, porque se puede. Un atacante podría darle vueltas a su código, variante tras variante, hasta que HAZE le diga `NO_MALICIOSO`. O sea, usar nuestra herramienta como un detector de "¿ya cuela mi malware?". También al revés: soltar veredictos `MALICIOSO` automáticos para hundir la reputación de software legítimo, si alguien los publica sin que un humano los revise antes.

¿Cómo lo frenamos? El veredicto **ayuda a decidir, no decide**. Siempre tiene que pasar por ojos humanos antes de bloquear un despliegue o señalar a nadie. Y por favor: ni publiques tus API keys ni dejes una instancia abierta sin autenticación.

### 6.2 Trabajo futuro

- Implementar el rol **Investigador** con consulta a NVD/OSV.
- Evaluación cuantitativa completa con significancia estadística.
- Jueces de familias de modelos distintas (cross-model judging).
- Extensión a auditoría de comportamiento de agentes y repositorios completos.
- Calibración de `confidence` frente a verdad de terreno.

---

## 7. Conclusión

Veníamos con una duda: ¿un sistema de roles caza vulnerabilidades mejor que un modelo solo? Lo que tenemos hasta ahora, sin adornos:

1. **Sí, se puede.** Cuando el código es claramente malo, el debate va al grano —`urlopen`, `exec`, exfiltración— y el Juez cierra con argumentos de verdad.
2. **Pero no siempre.** El código benigno y ambiguo hace que el sistema se quede en la duda; y lo que está ofuscado o repartido en varios archivos, hoy por hoy, se nos escapa.
3. **Y sí, alucina.** Sobre todo el agente solo (L0). El debate con carga de la prueba baja las alucinaciones un buen trecho, aunque no las mata del todo.
4. **Pensar más ayuda, hasta cierto punto.** Saltar de L0 a L2 limpia falsos positivos. Meter más rondas o modelos más potentes (L3–L4) puede sumar, pero llega un momento en que pagas más y ganas poco.

Que quede claro: HAZE no es una herramienta para meter en producción mañana. Es un experimento, con su infraestructura abierta, montado para responder estas cuatro preguntas con datos en la mano. Lo que sigue es correr la batería completa L0–L4 y poner los números sobre la mesa, con sus pruebas de significancia y todo.

---

## Código y datos

- **Repositorio:** `API/` — backend Fastify, orquestador (`src/services/orchestrator.js`), prompts (`src/services/prompts.js`), roles (`src/config/roles.js`), UI SSE (`public/`).
- **Artefactos de ejemplo:** `API/examples/suspicious_installer.py`, `API/examples/benign_utils.py`.
- **Transcripciones:** [pendiente — enlazar tras corrida experimental].

---

## Contribuciones de los autores

| Autor | Contribución |
|-------|--------------|
| Samuel Blanco | [arquitectura / orquestación] |
| Samuel Díaz | [evaluación / baselines] |
| Axel Morales | [implementación API / prompts] |
| Alex Novelo | [redacción / análisis] |

---

## Referencias

Bai, Y., Kadavath, S., Kundu, S., Askell, A., Kernion, J., Jones, A., … Kaplan, J. (2022). *Constitutional AI: Harmlessness from AI feedback*. arXiv. https://arxiv.org/abs/2212.08073

Du, Y., Li, S., Torralba, A., Tenenbaum, J. B., & Mordatch, I. (2023). *Improving factuality and reasoning in language models through multiagent debate*. arXiv. https://arxiv.org/abs/2305.14325

Ganguli, D., Lovitt, L., Kernion, J., Askell, A., Bai, Y., Kadavath, S., … Clark, J. (2022). *Red teaming language models to reduce harms: Methods, scaling behaviors, and lessons learned*. arXiv. https://arxiv.org/abs/2209.07858

Irving, G., Christiano, P., & Amodei, D. (2018). *AI safety via debate*. arXiv. https://arxiv.org/abs/1805.00899

Khan, A., Hughes, J., Valentine, D., Ruis, L., Sachan, K., Radhakrishnan, A., … Perez, E. (2024). *Debating with more persuasive LLMs leads to more truthful answers*. arXiv. https://arxiv.org/abs/2402.06782

Perez, E., Huang, S., Song, F., Cai, T., Ring, R., Aslanides, J., … Irving, G. (2022). *Red teaming language models with language models*. arXiv. https://arxiv.org/abs/2202.03286

Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., … Stoica, I. (2023). *Judging LLM-as-a-judge with MT-Bench and Chatbot Arena*. arXiv. https://arxiv.org/abs/2306.05685

---

## Declaración de uso de LLMs

Usamos LLMs para echarnos una mano con la redacción, la estructura y el encuadre bibliográfico. Y, además, son el propio bicho que estudiamos: los agentes que debaten dentro de HAZE son LLMs. Todo lo técnico, las referencias y —cuando los tengamos— los resultados, lo revisamos nosotros a mano. Un aviso: los números de la Sección 4 todavía están pendientes de experimentos, así que no los cites hasta que estén medidos y pasados por las pruebas de significancia.

# HAZE: Escrutinio Adversarial Multi-Agente para la Detección de Vulnerabilidades

**HAZE** (*Hallucination-Aware Zero-sum Examination*) — Red Teaming Automatizado mediante AI Safety Debate

**Autores:** [Nombres del Equipo]

**Código y Datos:** [Enlace al Repositorio de GitHub]/`API` | [Enlace al Dataset / Transcripciones]

## Resumen (Abstract)

Hoy todo el mundo usa un solo LLM para cazar vulnerabilidades en código y en sistemas de IA. Y funciona... más o menos. El problema es de fondo, casi filosófico: el mismo cerebro que *busca* el fallo está enganchado a *inventárselo* con tal de complacerte. ¿El resultado? Una montaña de falsos positivos. CVEs que no existen, vectores de ataque imposibles de ejecutar, sanitizaciones imaginarias. Nosotros lo enfocamos distinto. Te proponemos un protocolo de **Red Teaming Automatizado** basado en *escrutinio adversarial estructurado*, mucho más sólido que pedirle a un modelo una respuesta de una sola pasada. La base teórica viene de **AI Safety via Debate** (Irving et al., 2018). Mira cómo funciona: cuatro agentes LLM se sientan a discutir, literalmente, como en un juicio. Un **Atacante** lanza una hipótesis de vulnerabilidad y tiene que trazar el exploit paso a paso. Un **Defensor** intenta tumbarla apelando a las protecciones que ya existen. Un **Investigador** imparcial mantiene los pies en la tierra, anclando todo a la *Verdad de Terreno* (CVEs reales, cómo se comportan las librerías, lo que dice el código). Y un **Juez**, aislado del resto, lee la transcripción y dicta sentencia: ¿Vulnerabilidad Confirmada o Falso Positivo? Lo bonito de esto es el cambio de chip. Dejamos de fiarnos de un "estoy como un 80% seguro de que hay un bug" y pasamos a exigir pruebas: "el Atacante trazó un exploit y el Defensor no supo cómo pararlo". Para demostrar que no es humo, lo comparamos con un baseline de un solo agente sobre un conjunto etiquetado con verdad de terreno. Medimos precisión, recall y tasa de falsos positivos, y reportamos si las mejoras aguantan estadísticamente. Nuestra apuesta es clara: el escrutinio adversarial multi-agente recorta los falsos positivos sin cargarse el recall, y deja veredictos que se acercan bastante a lo que diría un revisor de seguridad humano.

## 1. Introducción

Usar LLMs para descubrir vulnerabilidades suena genial, y lo es: te permite auditar bases de código enormes, e incluso a los propios modelos de IA, sin morir en el intento. Pero el enfoque que manda hoy —el de *un solo agente*— hace aguas por donde menos lo esperas.

**El problema, y por qué falla.** Cuando le pides a un LLM que "encuentre la vulnerabilidad", el modelo ya da por hecho que el fallo está ahí. Es como ir al médico convencido de que estás enfermo: algo te va a encontrar. Su entrenamiento —maximizar la probabilidad de darte una respuesta útil, todo amplificado por RLHF— lo empuja a **fabricar un hallazgo positivo** aunque el código esté limpísimo. No sabe distinguir bien entre "aquí no hay nada" y "no encontré nada que encaje con lo que me pediste". Y para colmo, la sicofancia (Perez et al., 2022) le echa más leña: el modelo tiende a darte la razón. ¿Qué amenaza nos deja esto en un auditor automatizado? Dos cosas. Una: **falsos positivos y alucinaciones** que te hacen perder el tiempo y, peor aún, te quitan la confianza en la herramienta. Y dos: no hay *auto-corrección de verdad*. Un agente que piensa solo, en voz alta consigo mismo, no puede exigirse pruebas a sí mismo. Nadie le lleva la contraria.

**Lo que aportamos.**
1. Una **arquitectura adversarial de cuatro roles** (Atacante, Defensor, Investigador, Juez) que lleva el AI Safety via Debate al terreno de la detección de vulnerabilidades. El **Juez va aislado a propósito**, para que no se le contamine el contexto, y el **Investigador** hace de ancla con la *Verdad de Terreno*.
2. Un **cambio de reglas en cómo se prueban las cosas**: de lo probabilístico a lo demostrativo. Aquí una vulnerabilidad solo cuenta *si y solo si* sobrevive a que la ataquen. Así, las alucinaciones caen por su propio peso.
3. Un **protocolo de evaluación empírica** con su baseline de un solo agente, sus etiquetas de verdad de terreno y sus pruebas estadísticas para ver si de verdad bajamos los falsos positivos.

## 2. Trabajo Relacionado

**AI Safety via Debate.** Irving et al. (2018) plantearon el debate como un juego de suma cero: dos agentes defienden posturas opuestas delante de un juez. La clave está en una asimetría preciosa: *verificar* una afirmación es más fácil que *generarla*. Y cuando llegas al equilibrio, mentir simplemente no compensa. Luego Khan et al. (2024) lo confirmaron con datos: cuando los LLMs que debaten son más persuasivos, los jueces acaban en respuestas más verdaderas. Justo lo que necesitábamos para confiar en un juez sintético.

**Razonamiento multi-agente.** Du et al. (2023) enseñaron que el debate entre varios agentes mejora la factualidad y el razonamiento frente a un solo modelo pensando en voz alta. Es la prueba de que ponerlos a discutir entre ellos lima los errores que de otro modo cometerían todos a la vez.

**Red teaming con LLMs.** Perez et al. (2022) usaron LLMs para hacerle red teaming a otros LLMs a lo grande; Ganguli et al. (2022) estudiaron el red teaming para reducir daños y dejaron por escrito un montón de lecciones. Eso sí: estos trabajos atacan la *generación*, pero para verificar tiran casi siempre de clasificadores posteriores o de humanos.

**LLM-as-a-Judge.** Zheng et al. (2023) demostraron que un juez LLM es viable —y también dejaron claros sus sesgos—. Por eso tomamos una decisión de diseño firme: *aislar* al juez de la parte que genera hipótesis, para cortarle el paso a la sicofancia y al sesgo de compromiso (*commitment bias*).

**El hueco que llenamos.** El red teaming de siempre se obsesiona con *provocar* fallos. El debate de siempre apunta a la *verdad en dominio abierto*. ¿Y si juntamos las dos cosas? Eso hacemos: un debate de cuatro roles, anclado por un Investigador con los pies en la tierra, dedicado en exclusiva a una cosa que casi nadie mira con lupa —cargarse los falsos positivos al auditar código y modelos—.

## 3. Métodos

**El protocolo, en grande.** Le das un artefacto al sistema (un archivo de código, una dependencia o el comportamiento de un modelo) y arranca un debate de varios turnos, pero acotado, sin que se vaya de las manos:

1. **Atacante (el que acusa):** suelta una hipótesis de vulnerabilidad y la concreta hasta el detalle: qué tipo es, qué precondiciones necesita y un vector de ataque que se pueda *trazar*.
2. **Defensor (el que opone):** la rebate. Demuestra que no se puede instanciar, que ya hay una sanitización o mitigación, o que faltan precondiciones. Aquí es donde aparece la **carga de la prueba** de verdad.
3. **Investigador (el oráculo):** no se casa con nadie. Va y trae la *Verdad de Terreno* —CVEs reales, cómo funcionan las librerías y APIs, si el código sanea o no— para que solo se admitan afirmaciones que se puedan contrastar de verdad.
4. **Juez:** se lee toda la transcripción y dicta un veredicto binario y razonado: **Vulnerabilidad Confirmada** o **Falso Positivo**.

**Por qué lo diseñamos así.** El Juez está **aislado por estructura** de los que generan y defienden. ¿La razón? Que no se le cuele otra vez el sesgo de confirmación o de compromiso. Su veredicto sale *única y exclusivamente* de la evidencia que aparece en la transcripción. Y el Investigador está ahí para que el debate no acabe siendo dos tipos muy elocuentes diciendo cosas preciosas que no tocan la realidad.

### 3.1 Implementación de HAZE (`API/`)

Todo esto que te conté lo construimos de verdad, y se llama **HAZE**: un monolito que despliegas desde `API/` y que orquesta todo el escrutinio adversarial sobre artefactos de software a través de OpenRouter. Pegas o subes un artefacto (código, un manifiesto de dependencias, documentación) y el sistema te dice si hay **comportamiento malicioso** —backdoors, exfiltración de datos, RCE, ofuscación, typosquatting, llamadas de red raras—. El veredicto sale del debate entre varios agentes.

**La arquitectura.** Un backend en Fastify 5 (Node.js ESM) sirve dos cosas a la vez: la API REST/SSE y un frontend en HTML/CSS/JS a pelo, sin frameworks. El pipeline está partido por módulos:

| Módulo | Función |
|---|---|
| `src/config/roles.js` | Plantilla de equipos, orden de turnos, modelos por defecto |
| `src/services/prompts.js` | Prompts system/user por rol y esquema JSON del juez |
| `src/services/orchestrator.js` | Motor de debate multi-ronda y parseo del veredicto |
| `src/services/openrouter.js` | Cliente OpenRouter (streaming + JSON estructurado) |
| `src/routes/api.js` | `GET /api/config`, `GET /api/models`, `POST /api/analyze` (SSE) |
| `public/` | UI de debate en vivo con streaming token a token |

**De la teoría al código (cómo se reparten los agentes).** El prototipo de ahora monta una topología **2v2 + Juez aislado**:

| Rol teórico | Rol(es) en HAZE | Equipo | Función |
|---|---|---|---|
| Atacante | **Analista Forense** + **Fiscal** | Acusación | Exponer evidencia técnica de patrones maliciosos; sintetizar y refutar argumentos de la defensa |
| Defensor | **Auditor** + **Defensor** | Defensa | Explicar intención legítima; refutar acusaciones con contexto benigno y prácticas estándar |
| Investigador | *(planificado)* | — | Aún no implementado como agente separado e imparcial |
| Juez | **Juez** | Tribunal | Lee solo la transcripción completa; emite veredicto estructurado |

Cada rol que debate va atado a un **LLM distinto** (lo configuras por rol desde la UI). Esto es clave: rompe esos fallos en cadena que aparecen cuando todo depende de un único modelo. Los turnos van alternando acusación y defensa en cada ronda: Analista Forense → Auditor → Fiscal → Defensor (de 1 a 4 rondas, por defecto 2). Los que debaten van a temperatura 0.7; el Juez, en cambio, a 0.1 y con `response_format: json_object`. Frío y metódico.

**El recorrido completo, de principio a fin.**
1. Pegas o subes un artefacto (máximo 24.000 caracteres; si te pasas, se recorta y te avisa con un flag).
2. Eliges cuántas rondas de debate quieres y qué modelo de OpenRouter usa cada rol.
3. `POST /api/analyze` te va mandando Server-Sent Events: `open` → `meta` → `round` → `turn-start` / `token` / `turn-end` → `verdict` → `done`.
4. El orquestador va apilando la transcripción. Cada agente ve los turnos anteriores y tiene que citar líneas y funciones exactas —los prompts prohíben tajantemente inventarse evidencia—.
5. El **Juez aislado** recibe solo el artefacto y la transcripción (nunca pisó el debate) y te devuelve un JSON: `verdict` (`MALICIOSO` / `NO_MALICIOSO` / `INCONCLUSO`), `confidence` (0–100), `riskLevel`, `keyFindings`, `winningTeam`, `reasoning`.

**Cómo atamos los prompts (la carga de la prueba).** Todos los prompts de los que debaten les obligan a anclar lo que dicen al artefacto, les limitan a unas 180 palabras y les exigen honestidad intelectual dentro de su propio equipo. Sí, incluso entre compañeros. El del Juez es más duro: penaliza argumentos sin evidencia y exige que el veredicto salga de la calidad de la transcripción y de lo que hay en el código. Ahí es donde el cambio de "más o menos seguro" a **escrutinio demostrativo** se vuelve real.

**Modelos y herramientas.** Los agentes salen por **OpenRouter** (API compatible con OpenAI), así que no necesitas GPU en tu máquina. La puesta a punto es de manual: `npm install`, copias `.env.example` → `.env` con tu `OPENROUTER_API_KEY`, `npm run dev` y a `http://localhost:3000`. En `API/examples/` tienes artefactos de prueba (`suspicious_installer.py`, `benign_utils.py`) para trastear a mano.

**El baseline.** Un **auditor de un solo agente** ("encuentra la vulnerabilidad") sobre las mismas entradas. Así aislamos qué aporta realmente el escrutinio adversarial y qué no.

**Lo que NO funcionó (y lo contamos).** Las primeras versiones dejaban que el Atacante también hiciera de juez. Desastre: se autoconfirmaba a sí mismo, claro. Y los debates sin anclaje soltaban exploits que sonaban de maravilla pero que no se podían ejecutar ni de broma. El **Investigador** como rol aparte se queda en la lista de pendientes —el 2v2 de ahora ya frena parte de las alucinaciones gracias al cruce de argumentos, pero todavía le falta ese agente imparcial que vaya a buscar la *Verdad de Terreno*—.

### 3.2 Pipeline de ejecución

HAZE es un **protocolo de verificación**: varios LLMs compiten con reglas estrictas y un juez aislado dicta un veredicto estructurado. Trabaja a otro nivel que un analizador estático clásico (AST/SAST), porque aquí el razonamiento lo ponen los modelos discutiendo entre ellos. El cliente manda un payload JSON a `POST /api/analyze`:

```json
{
  "artifact": { "filename": "setup.py", "content": "...", "kind": "código" },
  "rounds": 2,
  "models": { "fiscal_analista": "deepseek/deepseek-chat", "juez": "anthropic/claude-3.5-sonnet" }
}
```

**Fase 0 — Resolver la configuración.** `resolveConfig()` se asegura de que el artefacto no venga vacío, recorta el contenido a 24.000 caracteres (y marca `truncated: true` si hizo falta), resuelve qué modelo usa cada rol y deja las rondas dentro de [1, 4].

**Fase 1 — El debate, ronda a ronda.** En cada ronda *r*, el orquestador ejecuta `TURN_ORDER`: Analista Forense → Auditor → Fiscal → Defensor. Y en cada turno pasa esto:

1. `buildDebaterMessages()` arma un prompt **system** (la persona, su objetivo, las reglas del tribunal) y un prompt **user** (el bloque del artefacto + la transcripción acumulada + la instrucción de abrir o refutar).
2. `streamChat()` llama a OpenRouter a temperatura 0.7 (`max_tokens: 700`, con streaming).
3. Cada token que llega se le manda al cliente al vuelo vía SSE (`event: token`).
4. El texto completo del turno se añade a `transcript[]` —un estado compartido de solo-añadir, que ven todos los que debaten después y, al final, el Juez—.

**Fase 2 — El veredicto, en aislamiento.** El Juez no ha soltado ni un turno de debate. Le llega solo el artefacto original y la transcripción entera. `buildJudgeMessages()` le pide JSON estricto; `chat()` se llama a temperatura 0.1 y con `response_format: { type: "json_object" }`. Y `parseVerdict()` saca el objeto JSON aunque el modelo le meta ruido alrededor.

**Fase 3 — El streaming hacia el cliente.** La API se apropia de la respuesta HTTP para mandar Server-Sent Events:

`open` → `meta` → `round` → `turn-start` → `token*` → `turn-end` → … → `verdict` → `done`

¿Y si el cliente se desconecta a media faena? Un `AbortController` corta de raíz las peticiones que siguieran abiertas contra OpenRouter. Sin malgastar tokens.

### 3.3 Mecanismos técnicos centrales

**Un modelo distinto para cada rol.** Cada rol puede atarse a un LLM diferente (DeepSeek, Gemini, GPT-4o-mini, Llama 70B, Claude 3.5 Sonnet, lo que quieras). La gracia está en que así los fallos dejan de ir en cadena: si un modelo se inventa un backdoor, otro con otra arquitectura y otros sesgos de entrenamiento puede tumbarle el cuento.

**La transcripción es el estado compartido.** El estado del debate es un array de solo-añadir, sin memorias ocultas entre turnos. Todo lo que se afirma y todo lo que se refuta queda ahí, a la vista, listo para que el Juez (o tú) lo audite.

**El Juez vive aislado, epistémicamente hablando.** El Juez (i) nunca genera hipótesis, (ii) no tiene una persona que ataque ni defienda, (iii) trabaja a temperatura baja con un esquema JSON forzado, y (iv) tiene orden expresa de castigar los argumentos sin evidencia. Esto es **LLM-as-a-Judge** con separación de poderes: el que acusa y el que defiende quedan fuera de la decisión final.

**La carga de la prueba, metida en los prompts.** Los que debaten tienen que citar líneas y funciones exactas del artefacto, y tienen prohibidísimo inventarse código. La ronda 1 saca la evidencia de apertura; las siguientes ya exigen refutar de verdad. El Fiscal junta y arma la acusación; el Defensor la desmonta punto por punto. ¿Y los hallazgos que no aguantan la refutación? Llegan tocados a la transcripción que lee el Juez. Que es justo lo que queremos.

**La topología 2v2, descompuesta por funciones.**

| Rol | Función técnica |
|---|---|
| **Analista Forense** | Detección ofensiva: patrones maliciosos, indicadores en el código |
| **Auditor** | Contexto defensivo: uso legítimo, explicaciones benignas |
| **Fiscal** | Síntesis argumentativa + refutación de la defensa |
| **Defensor** | Refutación punto por punto; admite evidencia fuerte pero cuestiona intención/severidad |

Un solo prompt ("encuentra el malware") lo revuelve todo: detección, contexto y juicio en la misma cabeza. HAZE coge esas tres funciones y las reparte en roles que se enfrentan entre sí.

### 3.4 Alcance de evaluación

El prototipo de ahora va a por la **detección de software malicioso**, no a enumerar CVEs en general. HAZE mira si un artefacto enseña patrones como estos: backdoors y shells inversas; exfiltración de datos (`urllib`, `socket`, POST codificado); RCE o `exec()` de payloads que se descargan; ofuscación y código que se modifica a sí mismo; typosquatting en dependencias; acceso a credenciales o al entorno; y telemetría a escondidas. Para probarlo tienes los artefactos de `API/examples/` (`suspicious_installer.py`, `benign_utils.py`).

### 3.5 Contribución a AI Security

HAZE le entra a la seguridad de la IA por dos lados que se complementan.

**Seguridad *con* IA (usar LLMs para auditar software).**

| Fallo del single-agent | Mitigación en HAZE |
|---|---|
| Sesgo de confirmación: inventar hallazgos para satisfacer el prompt | Adversario dedicado (Defensa) refuta activamente las afirmaciones |
| Confianza no calibrada ("~80% seguro") | Veredicto JSON estructurado: `verdict`, `confidence`, `keyFindings`, `reasoning` |
| Un solo modelo, un solo punto ciego | Roles multi-modelo con errores parcialmente descorrelacionados |
| Sin trazabilidad | Transcripción completa auditable por humanos |
| Auto-corrección intrínseca débil | Información cruzada adversarial en múltiples rondas |

HAZE es **red teaming automatizado de artefactos**: te permite revisar a escala paquetes sospechosos, PRs, dependencias o snippets antes de hacer merge o desplegar. Antes de que el problema entre en casa, vaya.

**Seguridad *de* la IA (AI Safety / Alignment).**

1. **AI Safety via Debate (Irving et al., 2018).** Verificar es más fácil que generar, ya lo dijimos. El Juez no produce la auditoría —solo *evalúa* qué bando aguantó el escrutinio—. Esto es *supervisión escalable* (*scalable oversight*): poder supervisar sistemas más capaces que el propio supervisor.
2. **Menos alucinaciones por diseño institucional.** Para confirmar una vulnerabilidad, la acusación tiene que **resistir la refutación**. El criterio que mandamos es demostrativo: importa que el argumento aguante el escrutinio.
3. **Debate multi-agente (Du et al., 2023).** El debate mejora la factualidad frente a un solo modelo pensando solo; HAZE coge esa idea y la lleva a la auditoría de ciberseguridad.
4. **LLM-as-a-Judge con sesgos a raya (Zheng et al., 2023).** Aislar al Juez baja el *commitment bias* y la *sicofancia*: el que evalúa llega de fuera, sin haber tocado la hipótesis que tiene que juzgar.
5. **Red teaming de modelos (Perez et al., 2022; Ganguli et al., 2022).** El protocolo da para más: el "artefacto" puede ser el **comportamiento de un modelo** (jailbreaks, prompt injection), y la misma topología adversarial sirve para provocar y verificar fallos de alineación.

**El ciclo, de un vistazo.** Artefacto de entrada → debate adversarial (la acusación propone, la defensa refuta, se sintetiza, se cierra) → el Juez aislado se pregunta si la acusación sobrevivió → `MALICIOSO` / `NO_MALICIOSO` / `INCONCLUSO`.

**Lo que aún cojea (en la implementación).** (i) Todavía no hay rol Investigador —ni consulta externa de CVEs ni bases de datos; el razonamiento se queda en el texto del artefacto—. (ii) Aunque repartamos modelos, los LLMs pueden seguir compartiendo sesgos de alucinación. (iii) Ventana de 24k caracteres; ni multi-archivo ni análisis en tiempo de ejecución. (iv) El Juez sigue siendo un LLM —los veredictos te ayudan a revisar, no te firman un certificado—. (v) La latencia y el coste de API suben con roles × rondas + juez, frente a un único prompt. Más ojos cuestan más.

## 4. Resultados

> *Marcador de posición pendiente de experimentos — a poblar con valores medidos.*

Evaluamos sobre un **conjunto etiquetado con verdad de terreno**, que trae versiones vulnerables y versiones parcheadas o seguras de cada artefacto. Las métricas que nos importan: **precisión**, **recall**, **tasa de falsos positivos (FPR)** y **calibración del veredicto**.

- **Tabla 1.** Debate multi-agente vs. baseline de un solo agente: precisión / recall / FPR con intervalos de confianza del 95%.
- **Figura 1.** Tasa de falsos positivos, un solo agente vs. debate de cuatro roles (menor es mejor). *Pie de figura: Se espera que el escrutinio adversarial reduzca la FPR preservando el recall en artefactos verdaderamente vulnerables.*
- **Figura 2.** Ablación eliminando al Investigador y eliminando el aislamiento del Juez, mostrando la contribución marginal de cada rol.

**Robustez.** Cada vez que digamos "bajamos la FPR", lo respaldamos con significancia estadística (bootstrap o prueba de McNemar sobre veredictos pareados, por ejemplo). Movemos el número de turnos y el modelo de base, y comprobamos que las conclusiones no se tambalean con pequeños cambios de configuración. Y algo importante: solo afirmamos lo que los datos sostienen. Ni una palabra de más.

## 5. Discusión y Limitaciones

**Lo que esto significa para AI Safety, en grande.** El protocolo pone en práctica la *supervisión escalable* (*scalable oversight*). Al juez le basta con decidir cuál de dos posturas, que ya se han atacado mutuamente, queda en pie; se ahorra montar la auditoría desde cero, que es cara y muy propensa a alucinar. Ese traspaso de la carga es un patrón concreto y desplegable para usar el debate y verificar afirmaciones que importan para la seguridad, tanto de código como de modelos.

**Limitaciones y supuestos (con todas las letras).** (i) Lo que el Investigador trae como *Verdad de Terreno* también puede alucinar o quedarse corto; (ii) damos por buena la asimetría verificación–generación de Irving et al. (2018) en el terreno de auditar código y modelos, pero hay que demostrarlo con datos; (iii) el Juez sintético puede arrastrar el **mismo fallo** que los que debaten, y ahí se nos cae la independencia del juicio. **Amenazas que aún no tocamos:** que los agentes se pongan de acuerdo a mala fe (colusión), que el propio artefacto auditado les inyecte prompts a los agentes, y vulnerabilidades que necesitan ver varios archivos o el tiempo de ejecución, más allá de lo que les damos.

**Lo que viene.** Meter a un humano en el bucle (*human-in-the-loop*) para validar los veredictos sintéticos; jueces de modelos cruzados que rompan los errores compartidos; pasar del razonamiento por archivo al de repositorio entero y tiempo de ejecución; y analizar a fondo qué tan calibrada está la confianza del juez.

## 6. Conclusión

Si quieres detección de vulnerabilidades automatizada y de fiar, tienes que ir más allá del auditor de un solo agente, que por cómo está entrenado premia inventarse hallazgos. El camino que proponemos es el **escrutinio adversarial estructurado**. Pones a cuatro roles LLM —Atacante, Defensor, Investigador y un Juez aislado— a jugar un AI Safety via Debate, y una vulnerabilidad se confirma cuando un exploit trazado aguanta la refutación y el anclaje en los datos. Lo que antes era un "estoy bastante seguro" se convierte en una carga de la prueba de verdad.

Si esto se valida, baja los falsos positivos sin cargarse el recall y te deja una plantilla reproducible para la supervisión escalable. La idea de fondo: usar el debate adversarial para llevar los fallos hasta la *verificación*, con un listón que se acerca al de un revisor de seguridad humano.

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

Usamos LLMs para echarnos una mano con la redacción, la estructura y el encuadre bibliográfico de esta entrega. Y, además, son el propio sistema que estudiamos (los cuatro agentes que debaten). Todas las afirmaciones técnicas, las referencias citadas y —cuando estén— los resultados empíricos los verificamos nosotros, los autores, de forma independiente. Ojo con una cosa: los números de la Sección 4 todavía están pendientes de experimentos, así que no los cites hasta que estén medidos y pasados por las pruebas de significancia.

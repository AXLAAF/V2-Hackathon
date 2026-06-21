# Escrutinio Adversarial Multi-Agente para la Detección de Vulnerabilidades: Red Teaming Automatizado mediante AI Safety Debate

**Autores:** [Nombres del Equipo]

**Código y Datos:** [Enlace al Repositorio de GitHub] | [Enlace al Dataset / Transcripciones]

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

**Visión general del sistema.** Dado un artefacto objetivo (archivo de código fuente, dependencia o comportamiento de un modelo), el pipeline ejecuta un debate acotado de múltiples turnos:

1. **Atacante (Proponente):** genera una hipótesis de vulnerabilidad especificando tipo, precondiciones y un vector de ataque *trazable*.
2. **Defensor (Opositor):** refuta demostrando la no instanciabilidad, la existencia de sanitización/mitigación, o precondiciones no satisfechas —materializando la **carga de la prueba**.
3. **Investigador (Oráculo):** no toma bando; recupera la *Verdad de Terreno* —CVEs reales, semántica de librerías/APIs, presencia/ausencia de sanitización en el código— para acotar las afirmaciones admisibles a aquellas empíricamente contrastables.
4. **Juez:** evalúa la transcripción completa y emite un veredicto binario y justificado: **Vulnerabilidad Confirmada** vs. **Falso Positivo**.

**Decisiones de diseño y justificación.** El Juez está **estructuralmente aislado** de la generación y la defensa para evitar reintroducir el sesgo de confirmación/compromiso; el veredicto se forma *únicamente* sobre la evidencia articulada en la transcripción. El Investigador previene que el debate degenere en intercambios retóricamente persuasivos pero empíricamente desacoplados.

**Modelos y herramientas.** Los agentes LLM se instancian a partir de modelos ajustados por instrucciones (Python 3.10+, HuggingFace; las utilidades de análisis pueden usar PyTorch/TransformerLens). Todos los componentes estocásticos fijan las semillas aleatorias (p. ej., `torch.manual_seed(42)`) para reproducibilidad. La orquestación es modular, separando (a) la carga del artefacto, (b) la ejecución de los agentes y (c) la evaluación del veredicto en funciones distintas, de modo que los jueces puedan reejecutar el pipeline con una configuración mínima.

**Baseline.** Un **auditor de un solo agente** ("encuentra la vulnerabilidad") sobre entradas idénticas, para aislar la contribución del escrutinio adversarial.

**Lo que no funcionó (a documentar).** Las variantes iniciales que permitían al Atacante también juzgar colapsaron en auto-confirmación; los debates sin anclaje (sin Investigador) produjeron exploits fluidos pero no instanciables. Esto motiva la arquitectura final y se reporta con honestidad en Resultados/Discusión.

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

[Enlace al Repositorio de GitHub] — pipeline, prompts de los agentes y scripts de evaluación.
[Enlace al Dataset / Transcripciones] — artefactos etiquetados y transcripciones completas de los debates.

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

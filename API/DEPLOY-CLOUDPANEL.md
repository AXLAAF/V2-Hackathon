# Despliegue en CloudPanel

Guía para publicar **ChismeLLM V2** en un servidor con CloudPanel (Nginx + Node.js).
CloudPanel hace de **reverse proxy** hacia tu app Node; el proceso lo mantiene **PM2**.

---

## 1. Crear el sitio Node.js en CloudPanel

1. En CloudPanel: **Sites → Add Site → Create a Node.js Site**.
2. Rellena:
   - **Domain Name:** `tu-dominio.com` (o un subdominio, ej. `chisme.tu-dominio.com`).
   - **Node.js Version:** 20 o superior.
   - **App Port:** `4747` (debe coincidir con `PORT` del paso 4).
3. Crear. CloudPanel genera el vhost de Nginx con el reverse proxy a `127.0.0.1:4747`
   y un usuario de sistema para el sitio (lo verás como *Site User*).

> Anota el **Site User** y la ruta raíz: `/home/<site-user>/htdocs/<dominio>/`.

---

## 2. Subir el código

Sube **el contenido de la carpeta `API/`** a la raíz del sitio
(`/home/<site-user>/htdocs/<dominio>/`). Opciones:

**a) Git (recomendado)** — por SSH como el *Site User*:
```bash
cd /home/<site-user>/htdocs/<dominio>
git clone <tu-repo> .
# Si el repo tiene la raíz en /API, sube sólo esa carpeta o muévela aquí.
```

**b) SFTP / File Manager de CloudPanel** — copia todo `API/` excepto
`node_modules/` y `.env`.

---

## 3. Instalar dependencias

Por SSH como el *Site User*, en la raíz del sitio:
```bash
npm ci --omit=dev    # o: npm install --omit=dev
```

---

## 4. Configurar el entorno

```bash
cp .env.example .env
nano .env
```
Deja así:
```
OPENROUTER_API_KEY=sk-or-v1-tu_clave_real
PORT=4747          # = App Port del sitio
HOST=127.0.0.1     # sólo localhost: el tráfico entra por el proxy de CloudPanel
APP_URL=https://tu-dominio.com
APP_TITLE=ChismeLLM V2
```

---

## 5. Arrancar con PM2

CloudPanel **no** mantiene el proceso vivo solo; usa PM2 (instálalo como *Site User*):
```bash
npm install -g pm2          # si no está; o instálalo en local del proyecto
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup                 # ejecuta la línea que imprime (con sudo) para autoarranque
```
Comprobar:
```bash
pm2 status
curl -s http://127.0.0.1:4747/api/config | head -c 100
```

---

## 6. Ajustes de Nginx para SSE (importante)

El debate usa **Server-Sent Events**. La app ya envía `X-Accel-Buffering: no` y un
*heartbeat* cada 15s, pero conviene ampliar timeouts en el vhost.

En CloudPanel: **Sites → tu sitio → Vhost**, dentro del `location` que hace
`proxy_pass` añade:
```nginx
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    chunked_transfer_encoding off;
```
Guarda (CloudPanel recarga Nginx). Si el bloque ya trae algunas de estas líneas,
no las dupliques.

---

## 7. HTTPS

En **Sites → tu sitio → SSL/TLS → Let's Encrypt** emite el certificado. CloudPanel
fuerza HTTPS automáticamente. Listo: abre `https://tu-dominio.com`.

---

## Actualizar la app
```bash
cd /home/<site-user>/htdocs/<dominio>
git pull
npm ci --omit=dev
pm2 restart chismellm-v2
```

## Ver logs / diagnosticar
```bash
pm2 logs chismellm-v2          # logs en vivo
pm2 restart chismellm-v2       # reiniciar
```
- **502 Bad Gateway:** la app no está arriba o el puerto no coincide → `pm2 status`
  y revisa que `PORT` = App Port.
- **El debate se corta a la mitad:** revisa el paso 6 (timeouts/buffering del vhost).
- **`OPENROUTER_API_KEY no está definida`:** falta el `.env` o la clave.

## Seguridad
- `HOST=127.0.0.1`: la app nunca se expone directa, sólo vía el proxy de CloudPanel.
- `.env` no debe subirse al repo (ya está en `.gitignore`).
- La carpeta `examples/` contiene un archivo de demo con patrón malicioso (inofensivo,
  no se ejecuta). Puedes borrarla en producción si lo prefieres.

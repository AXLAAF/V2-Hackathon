# Deploy on CloudPanel

Guide to publish **HAZE** on a server with CloudPanel (Nginx + Node.js).
CloudPanel acts as a **reverse proxy** to your Node app; **PM2** keeps the process alive.

---

## 1. Create the Node.js site in CloudPanel

1. In CloudPanel: **Sites → Add Site → Create a Node.js Site**.
2. Fill in:
   - **Domain Name:** `your-domain.com` (or a subdomain, e.g. `haze.your-domain.com`).
   - **Node.js Version:** 20 or higher.
   - **App Port:** `4747` (must match `PORT` in step 4).
3. Create. CloudPanel generates the Nginx vhost with reverse proxy to `127.0.0.1:4747`
   and a system user for the site (*Site User*).

> Note the **Site User** and root path: `/home/<site-user>/htdocs/<domain>/`.

---

## 2. Upload the code

Upload **the contents of the `API/` folder** to the site root
(`/home/<site-user>/htdocs/<domain>/`). Options:

**a) Git (recommended)** — via SSH as the *Site User*:
```bash
cd /home/<site-user>/htdocs/<domain>
git clone <your-repo> .
# If the repo root is not API/, copy or move only the API/ folder here.
```

**b) SFTP / CloudPanel File Manager** — copy all of `API/` except
`node_modules/` and `.env`.

---

## 3. Install dependencies

Via SSH as the *Site User*, in the site root:
```bash
npm ci --omit=dev    # or: npm install --omit=dev
```

---

## 4. Configure the environment

```bash
cp .env.example .env
nano .env
```
Set:
```
OPENROUTER_API_KEY=sk-or-v1-your_real_key
PORT=4747          # = App Port of the site
HOST=127.0.0.1     # localhost only; traffic enters via CloudPanel proxy
APP_URL=https://your-domain.com
APP_TITLE=HAZE
```

---

## 5. Start with PM2

CloudPanel does **not** keep the process alive by itself; use PM2 (install as *Site User*):
```bash
npm install -g pm2          # if missing; or install locally in the project
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup                 # run the printed line (with sudo) for boot persistence
```
Verify:
```bash
pm2 status
curl -s http://127.0.0.1:4747/api/config | head -c 100
```

---

## 6. Nginx tweaks for SSE (important)

The debate uses **Server-Sent Events**. The app already sends `X-Accel-Buffering: no` and a
*heartbeat* every 15s, but extend timeouts in the vhost.

In CloudPanel: **Sites → your site → Vhost**, inside the `location` that does
`proxy_pass`, add:
```nginx
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    chunked_transfer_encoding off;
```
Save (CloudPanel reloads Nginx). If the block already has some of these lines,
do not duplicate them.

---

## 7. HTTPS

In **Sites → your site → SSL/TLS → Let's Encrypt** issue the certificate. CloudPanel
forces HTTPS automatically. Open `https://your-domain.com`.

---

## Update the app

```bash
cd /home/<site-user>/htdocs/<domain>
git pull
npm ci --omit=dev
pm2 restart haze
```

## Logs / troubleshooting

```bash
pm2 logs haze                 # live logs
pm2 restart haze              # restart
```
- **502 Bad Gateway:** app not running or port mismatch → `pm2 status`
  and check `PORT` = App Port.
- **Debate cuts off mid-stream:** review step 6 (vhost timeouts/buffering).
- **`OPENROUTER_API_KEY is not defined`:** missing `.env` or key.

## Security

- `HOST=127.0.0.1`: the app is never exposed directly, only via CloudPanel proxy.
- `.env` must not be committed (already in `.gitignore`).
- The `examples/` folder contains a demo file with a malicious pattern (harmless,
  not executed). You may delete it in production if preferred.

# HAZE — Adversarial AI Tribunal for Software Artifacts

Infrastructure where different AI models (via **OpenRouter**) adopt roles on **two
opposing teams** to judge whether a software artifact (code, dependency,
documentation) is **malicious or vulnerable**:

- **Prosecution** — *Forensic Analyst* + *Prosecutor*: find and argue evidence of
  malicious behavior (backdoors, exfiltration, RCE, obfuscation, typosquatting…).
- **Defense** — *Auditor* + *Defense Counsel*: demonstrate legitimate intent and
  refute the accusation.
- **Tribunal** — *Judge*: listens to the debate and issues a **verdict**
  (`MALICIOUS` / `VULNERABLE` / `NOT_MALICIOUS` / `INCONCLUSIVE`) with confidence,
  risk level, and key findings.

Each role is played by a **different model**, configurable from the UI.

## Stack

- **Backend:** Fastify 5 (Node ESM). Serves the API and frontend (monolith).
- **Frontend:** HTML5 + CSS3 + vanilla JS. Live debate with **SSE token streaming**.
- **LLMs:** OpenRouter (OpenAI-compatible API).

## Getting started

```bash
cd API
npm install
cp .env.example .env        # add your OPENROUTER_API_KEY
npm run dev                 # or: npm start
```

Open http://localhost:4747

## Flow

1. Paste/upload the artifact and name it.
2. Set debate rounds (1–4) and the model for each role.
3. **Start trial** → teams debate in the live room.
4. The Judge issues the verdict.

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/config` | Roles, teams, and default models |
| `GET` | `/api/models` | Models available on OpenRouter |
| `POST` | `/api/analyze` | Run the debate (**SSE** response) |

### SSE events for `/api/analyze`

`open` · `meta` · `round` · `turn-start` · `token` · `turn-end` · `turn-error` ·
`verdict` · `error` · `done`

## Structure

```
API/
├── src/
│   ├── server.js            # Fastify bootstrap + static files
│   ├── routes/api.js        # endpoints (config, models, analyze/SSE)
│   ├── config/roles.js      # teams, roles, default models, turn order
│   └── services/
│       ├── openrouter.js    # OpenRouter client (stream + JSON)
│       ├── prompts.js       # per-role and judge prompts
│       └── orchestrator.js  # debate engine
└── public/                  # frontend (index.html, styles.css, app.js)
```

## Customization

- **Teams/roles:** edit `src/config/roles.js` (`ROLES`, `TURN_ORDER`, `JUDGE`).
- **Prompts:** `src/services/prompts.js`.
- Switching from 2v2 to 1v1 or another topology only requires adjusting `ROLES` and `TURN_ORDER`.

## Deployment

See [`DEPLOY-CLOUDPANEL.md`](DEPLOY-CLOUDPANEL.md) for CloudPanel (Nginx + PM2) setup.

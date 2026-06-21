// ChismeLLM V2 — Frontend del tribunal de IAs.

const $ = (id) => document.getElementById(id);
const lanes = { acusacion: $('lane-acusacion'), defensa: $('lane-defensa') };
let CONFIG = null; // metadata de roles desde /api/config
let MODELS = []; // modelos disponibles en OpenRouter
let running = false;

const TEAM_LABEL = { acusacion: 'acusacion', defensa: 'defensa', tribunal: 'tribunal' };
const VERDICT_LABEL = {
  MALICIOSO:    '!! MALICIOSO',
  NO_MALICIOSO: '-- NO MALICIOSO',
  INCONCLUSO:   '?? INCONCLUSO',
};

// ---------- Inicialización ----------
init();

async function init() {
  try {
    CONFIG = await (await fetch('/api/config')).json();
    renderRoleConfig();
  } catch (e) {
    setStatus('No se pudo cargar la configuración del servidor.', true);
  }
  // Carga de modelos en segundo plano (no bloquea la UI).
  fetch('/api/models')
    .then((r) => r.json())
    .then((d) => {
      MODELS = d.models || [];
      populateModelDatalists();
    })
    .catch(() => {});

  $('rounds').addEventListener('input', (e) => ($('roundsLabel').textContent = e.target.value));
  $('fileInput').addEventListener('change', handleFile);
  $('artifact').addEventListener('input', updateArtifactMeta);
  $('startBtn').addEventListener('click', startTrial);
}

function renderRoleConfig() {
  const all = [...CONFIG.roles, CONFIG.judge];
  $('roleConfig').innerHTML = all
    .map(
      (r) => `
      <div class="role-card" style="border-left-color:${r.color}">
        <div class="role-name">
          <span>${r.name}</span>
          <span class="role-team team-${r.team}">${TEAM_LABEL[r.team]}</span>
        </div>
        <input class="model-input" data-role="${r.id}" list="models-list"
               value="${r.defaultModel}" placeholder="slug de modelo OpenRouter" />
      </div>`
    )
    .join('');
  // datalist compartido
  const dl = document.createElement('datalist');
  dl.id = 'models-list';
  $('roleConfig').appendChild(dl);
}

function populateModelDatalists() {
  const dl = document.getElementById('models-list');
  if (!dl) return;
  dl.innerHTML = MODELS.map((m) => `<option value="${m.id}">${m.name || ''}</option>`).join('');
}

// ---------- Entrada del artefacto ----------
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  $('filename').value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    $('artifact').value = reader.result;
    updateArtifactMeta();
  };
  reader.readAsText(file);
}

function updateArtifactMeta() {
  const len = $('artifact').value.length;
  $('artifactMeta').textContent = len ? `${len.toLocaleString()} caracteres` : '';
}

function getModels() {
  const models = {};
  document.querySelectorAll('.model-input').forEach((i) => {
    if (i.value.trim()) models[i.dataset.role] = i.value.trim();
  });
  return models;
}

// ---------- Ejecución del juicio ----------
async function startTrial() {
  if (running) return;
  const content = $('artifact').value.trim();
  if (!content) return setStatus('Pega o sube un artefacto antes de iniciar.', true);

  running = true;
  $('startBtn').disabled = true;
  $('emptyState').classList.add('hidden');
  $('verdict').classList.add('hidden');
  lanes.acusacion.innerHTML = '';
  lanes.defensa.innerHTML = '';
  const bubbles = {}; // turnId -> elemento .body

  const payload = {
    artifact: { filename: $('filename').value.trim() || 'artefacto.txt', content },
    rounds: Number($('rounds').value),
    models: getModels(),
  };

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    await consumeSSE(res.body, (event, data) => handleEvent(event, data, bubbles));
  } catch (err) {
    setStatus('Error: ' + err.message, true);
  } finally {
    running = false;
    $('startBtn').disabled = false;
  }
}

// Parser de Server-Sent Events sobre un ReadableStream.
async function consumeSSE(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      let dataStr = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      try {
        onEvent(event, JSON.parse(dataStr));
      } catch {}
    }
  }
}

function handleEvent(event, data, bubbles) {
  switch (event) {
    case 'open':
      setStatus('El tribunal está en sesión…');
      break;
    case 'round':
      setStatus(`Ronda ${data.round} de ${data.rounds} en curso…`);
      break;
    case 'turn-start':
      bubbles[data.turnId] = createBubble(data);
      setStatus(`${data.name} (${TEAM_LABEL[data.team]}) toma la palabra…`);
      break;
    case 'token': {
      const el = bubbles[data.turnId];
      if (el) {
        el.textContent += data.text;
        el.parentElement.scrollIntoView({ block: 'nearest' });
      }
      break;
    }
    case 'turn-end': {
      const el = bubbles[data.turnId];
      if (el) el.parentElement.classList.remove('thinking');
      break;
    }
    case 'turn-error': {
      const el = bubbles[data.turnId];
      if (el) {
        el.parentElement.classList.remove('thinking');
        el.parentElement.classList.add('errored');
        el.textContent = '[error] ' + data.message;
      }
      break;
    }
    case 'verdict':
      renderVerdict(data);
      setStatus('Veredicto dictado.');
      break;
    case 'error':
      setStatus('Error: ' + data.message, true);
      break;
    case 'done':
      setStatus('Juicio finalizado.');
      break;
  }
}

function createBubble(turn) {
  // El veredicto del juez se muestra como banner, no como burbuja.
  if (turn.roleId === 'juez') return null;
  const sideClass = turn.team === 'acusacion' ? 'acu' : 'def';
  const lane = lanes[turn.team];
  const bubble = document.createElement('div');
  bubble.className = `bubble ${sideClass} thinking`;
  bubble.style.borderLeftColor = turn.color;
  bubble.innerHTML = `
    <div class="head">
      <span class="who">${turn.name}</span>
      <span class="model">${turn.model}</span>
    </div>
    <div class="round-tag">Ronda ${turn.round}</div>
    <div class="body"></div>`;
  lane.appendChild(bubble);
  bubble.scrollIntoView({ block: 'nearest' });
  return bubble.querySelector('.body');
}

function renderVerdict(v) {
  const el = $('verdict');
  el.className = `verdict ${v.verdict}`;
  const findings = (v.keyFindings || [])
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join('');
  const winner = v.winningTeam && v.winningTeam !== 'empate' ? TEAM_LABEL[v.winningTeam] : 'Empate';
  el.innerHTML = `
    <h3>${VERDICT_LABEL[v.verdict] || v.verdict}</h3>
    <div class="meta-row">
      <span>Confianza: <b>${v.confidence ?? 0}%</b></span>
      <span>Riesgo: <b>${v.riskLevel || '—'}</b></span>
      <span>Gana: <b>${winner}</b></span>
      <span class="muted">Juez: ${escapeHtml(v.model || '')}</span>
    </div>
    <div class="bar"><span style="width:${Math.min(100, v.confidence || 0)}%"></span></div>
    ${findings ? `<ul class="findings">${findings}</ul>` : ''}
    <p class="reasoning">${escapeHtml(v.reasoning || '')}</p>`;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setStatus(msg, isErr = false) {
  const s = $('status');
  s.textContent = msg;
  s.classList.toggle('err', isErr);

  const t = $('topbar-status');
  t.textContent = msg || 'inactivo';
  t.className = 'topbar-status' + (isErr ? ' err' : running ? ' active' : ' done');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

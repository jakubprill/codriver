// App shell: the panel / theme picker and the dashboard.
// Every device remembers its own theme choice (localStorage).
//
// URL parameters:  ?theme=papier – force a theme   ?pick – show the picker   ?demo – sample data
import { h } from './lib/util.js';
import { createStage } from './lib/stage.js';
import { createDemo } from './lib/demo.js';
import { themes, findTheme } from './themes/index.js';
import { qrSvg } from './lib/qr.js';
import { keepAwake, letSleep } from './lib/keep-awake.js';

const KEY = 'codriver.theme';
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const demo = params.has('demo');

const store = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode: this session only */ } },
};

let stopCurrent = () => {};

// Whether the page is open on the computer running codriver. The hostname (localhost/IP/codriver.local)
// is not enough – we ask the server, which sees where the request came from.
let isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

async function start() {
  if (!isLocal) {
    try { isLocal = !!(await (await fetch('/info')).json()).local; } catch { /* server unreachable */ }
  }
  const forced = findTheme(params.get('theme'));
  const saved = findTheme(store.get());
  if (forced) showDash(forced);
  // on the computer running codriver the start page is the panel (status, phone, DiRT 3, looks)
  else if (saved && !params.has('pick') && !isLocal) showDash(saved);
  else showPicker();
}

// ---------- panel and picker ----------
function showPicker() {
  stopCurrent();
  const current = store.get();
  const previews = [];
  const cards = themes.map((t) => {
    const preview = h('div', { class: 'preview' });
    const card = h('button', { class: `card${t.id === current ? ' current' : ''}`, type: 'button' },
      preview,
      h('div', { class: 'meta' },
        h('div', { class: 'name' }, t.name, t.id === current ? h('span', { class: 'badge' }, 'in use') : null),
        h('div', { class: 'desc' }, t.description)));
    card.addEventListener('click', () => {
      store.set(t.id);
      history.replaceState(null, '', location.pathname + (demo ? '?demo' : ''));
      showDash(t);
    });
    previews.push({ preview, t });
    return card;
  });

  const connect = h('div');
  const telemetry = h('div');
  const status = h('div');
  const awake = h('div');
  app.replaceChildren(h('section', { class: 'picker' },
    status,
    awake,
    connect,
    telemetry,
    h('h1', {}, 'Choose a display'),
    h('p', { class: 'lead' }, 'Every device remembers its own choice. Change it any time with the button in the corner of the dashboard.'),
    h('div', { class: 'grid' }, cards),
    h('p', { class: 'foot' }, 'Previews show sample data.')));

  // on the computer running codriver: status, QR code for the phone, DiRT 3 card
  let stopStatus = () => {};
  if (isLocal) {
    stopStatus = showStatus(status);
    showConnect(connect);
    showTelemetry(telemetry);
  } else {
    showAwakeHelp(awake);
  }

  // previews render live with sample data
  const views = previews.map(({ preview, t }) => t.create(createStage(preview)));
  const step = createDemo();
  const timer = setInterval(() => { const f = step(); views.forEach((v) => v.update(f)); }, 1000 / 20);
  stopCurrent = () => { clearInterval(timer); stopStatus(); };
}

/**
 * On a phone or tablet over plain http the browser refuses the screen wake lock (it needs a secure
 * context), and current Chrome on Android no longer keeps the screen on for a tiny muted video. A one-time
 * Chrome setting makes this address count as secure – then the dashboard keeps the screen on.
 */
function showAwakeHelp(slot) {
  const KEY = 'codriver.awakeHelpHidden';
  if (window.isSecureContext || demo) return;
  try { if (localStorage.getItem(KEY)) return; } catch { /* storage unavailable */ }
  const origins = [...new Set(['http://codriver.local', location.origin])].join(',');
  const value = h('textarea', { class: 'origins', readonly: '', rows: '2', 'aria-label': 'Addresses to enter' }, origins);
  value.addEventListener('focus', () => value.select());
  const hide = h('button', { class: 'toggle', type: 'button' }, 'Hide');
  hide.addEventListener('click', () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ }
    slot.replaceChildren();
  });
  slot.replaceChildren(h('div', { class: 'awake' },
    h('h2', {}, 'Keep the screen on'),
    h('p', {}, 'Over this connection the browser does not let the dashboard keep the screen on. One-time setting in Chrome on Android:'),
    h('ol', {},
      h('li', {}, 'Open a new tab and go to ', h('code', {}, 'chrome://flags/#unsafely-treat-insecure-origin-as-secure')),
      h('li', {}, 'In “Insecure origins treated as secure” enter:', value),
      h('li', {}, 'Set it to Enabled and tap Relaunch.')),
    h('p', { class: 'hint' }, 'Other browsers: set a longer screen timeout in the device settings.'),
    hide));
}

/** Status bar on the PC: version, whether game data is flowing, how many screens are connected. Refreshes every 2 s. */
function showStatus(slot) {
  const render = async () => {
    let st, info;
    try {
      [st, info] = await Promise.all([fetch('/status').then((r) => r.json()), fetch('/info').then((r) => r.json())]);
    } catch {
      slot.replaceChildren(h('div', { class: 'statusbar bad' }, 'No connection to the codriver server.'));
      return;
    }
    const live = st.frame?.live;
    const ago = st.lastPacketAgoMs == null ? null : Math.round(st.lastPacketAgoMs / 1000);
    slot.replaceChildren(h('div', { class: 'statusbar' },
      h('span', { class: 'brand' }, `codriver ${info.version ?? ''}`),
      h('span', { class: live ? 'ok' : 'idle' },
        live ? `Game: data flowing (${st.packets.toLocaleString('en-US')} packets)`
          : ago == null ? 'Game: no data – start a stage' : `Game: last data ${ago} s ago`),
      h('span', {}, `Connected screens: ${st.screens}`)));
  };
  render();
  const t = setInterval(render, 2000);
  return () => clearInterval(t);
}

// ---------- dashboard ----------
function showDash(theme) {
  stopCurrent();
  const fit = h('div', { class: 'fit' });
  const menu = h('button', { class: 'menu', type: 'button' }, 'Change look');
  const root = h('div', { class: 'dash' }, fit, menu, h('div', { class: 'rotate' }, 'Turn the device sideways for a bigger view.'));
  app.replaceChildren(root);
  const stage = createStage(fit);
  const view = theme.create(stage);
  // letterbox bars in the theme's background colour (e.g. light for Paper)
  root.style.background = getComputedStyle(stage.firstElementChild).backgroundColor;

  // the menu button appears on touch and hides after 3 s
  let hideTimer = 0;
  const showUi = () => {
    root.classList.add('ui');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => root.classList.remove('ui'), 3000);
  };
  root.addEventListener('pointerdown', (e) => {
    if (e.target === menu) return;
    showUi();
    goFullscreen();
    keepAwake();
  });
  menu.addEventListener('click', () => {
    history.replaceState(null, '', '?pick' + (demo ? '&demo' : ''));
    showPicker();
  });

  let cleanup;
  if (demo) {
    const step = createDemo();
    const t = setInterval(() => view.update(step()), 1000 / 30);
    cleanup = () => clearInterval(t);
  } else {
    const waiting = 'Connected. Data appears once a stage starts.';
    view.idle('Connecting to the computer…');
    const es = new EventSource('/events');
    es.onopen = () => view.idle(waiting);
    es.onerror = () => view.idle('No connection to the computer. Check that codriver is running on it.');
    es.onmessage = (e) => {
      const f = JSON.parse(e.data);
      if (f.live) view.update(f); else view.idle(waiting);
    };
    cleanup = () => es.close();
  }
  keepAwake();
  stopCurrent = () => { cleanup(); clearTimeout(hideTimer); letSleep(); };
}

async function showConnect(slot) {
  let info;
  try { info = await (await fetch('/info')).json(); } catch { return; }
  const url = info.urls?.[0];
  if (!url) return;
  const qr = h('div', { class: 'qr', role: 'img', 'aria-label': `QR code for ${url}` });
  qr.innerHTML = qrSvg(url, { margin: 2 });
  slot.replaceChildren(h('div', { class: 'connect' },
    qr,
    h('div', {},
      h('h2', {}, 'Connect a phone or tablet'),
      h('p', {}, 'Scan the code with the camera or type into the browser:'),
      info.name ? h('p', { class: 'addr' }, info.name) : null,
      h('p', { class: info.name ? 'addr alt' : 'addr' }, url),
      h('p', { class: 'hint' }, 'The device must be on the same Wi-Fi network as this computer.'))));
}

/** The DiRT 3 card on the PC: launch button, telemetry switch, status of the error-10038 fix. */
async function showTelemetry(slot, note = '') {
  let st;
  try { st = await (await fetch('/api/dirt3/telemetry')).json(); } catch { return; }
  // refresh every few seconds, so the card shows whether the game and the fix are running
  clearTimeout(slot.refresh);
  slot.refresh = setTimeout(() => { if (slot.isConnected) showTelemetry(slot, slot.querySelector('[role=status]')?.textContent ?? ''); }, 4000);
  if (!st.found) return;
  const on = !!st.motion?.enabled;
  const msg = h('p', { class: 'hint', role: 'status' }, note);

  const post = async (url, body) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    return json;
  };
  const action = (button, run) => button.addEventListener('click', async () => {
    slot.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try { await showTelemetry(slot, await run()); } catch (e) {
      msg.textContent = e.message;
      slot.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  });

  const buttons = [];
  if (st.canLaunch) {
    const launch = h('button', { class: 'toggle primary', type: 'button' }, 'Launch DiRT 3');
    action(launch, async () => {
      const r = await post('/api/dirt3/launch');
      if (!r.fix) return 'The game is starting via Steam – without the fix, error 10038 may come back at the finish.';
      return r.fixPrompt
        ? 'The game is starting via Steam. Windows asks to allow the fix (it needs administrator rights) – click Yes.'
        : 'The game is starting via Steam, together with the fix.';
    });
    buttons.push(launch);
  }
  const toggle = h('button', { class: 'toggle', type: 'button' }, on ? 'Turn telemetry off' : 'Turn telemetry on');
  action(toggle, async () => {
    await post('/api/dirt3/telemetry', { enabled: !on });
    return 'Saved. The change takes effect the next time the game starts.';
  });
  buttons.push(toggle);

  const r = st.running;
  const fix = st.fix?.found
    ? h('p', { class: r?.game && !r.fix ? 'fix' : 'fix ok' },
      r?.game && r.fix ? 'DiRT 3 is running, protected by the fix for “sendto failed 10038”.'
        : r?.game ? 'DiRT 3 is running WITHOUT the fix – error 10038 may stop the game at the finish.'
          : r?.fix ? 'Fix for “sendto failed 10038”: running, waiting for the game.'
            : 'Fix for “sendto failed 10038”: ready – “Launch DiRT 3” starts it with the game.',
      st.elevated === false ? h('span', { class: 'hint' }, ' Windows asks for permission each time; to skip that, start codriver with right-click → Run as administrator.') : '')
    : h('p', { class: 'fix' }, 'Fix for “sendto failed 10038”: not installed. ',
      h('a', { href: st.fix?.download, target: '_blank', rel: 'noopener' }, 'Download the ZIP'),
      ' and extract it to: ', h('code', {}, st.fix?.suggestedDir ?? ''));

  slot.replaceChildren(h('div', { class: 'telemetry' },
    h('div', {},
      h('h2', {}, 'DiRT 3 telemetry: ', h('span', { class: on ? 'on' : 'off' }, on ? (st.ready ? 'on' : 'on, but not for codriver') : 'off')),
      fix,
      msg),
    h('div', { class: 'actions' }, buttons)));
}

function goFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) {
    el.requestFullscreen()
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  }
}

start();

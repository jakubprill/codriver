// Powłoka aplikacji: ekran wyboru motywu i tryb dashboardu.
// Wybór motywu zapamiętuje każde urządzenie osobno (localStorage).
//
// Parametry adresu:  ?theme=papier  – wymuś motyw   ?pick – pokaż ekran wyboru   ?demo – dane pokazowe
import { h } from './lib/util.js';
import { createStage } from './lib/stage.js';
import { createDemo } from './lib/demo.js';
import { themes, findTheme } from './themes/index.js';
import { qrSvg } from './lib/qr.js';

const KEY = 'codriver.theme';
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const demo = params.has('demo');

const store = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch { /* tryb prywatny: tylko na tę sesję */ } },
};

let stopCurrent = () => {};

function start() {
  const forced = findTheme(params.get('theme'));
  const saved = findTheme(store.get());
  if (forced) showDash(forced);
  else if (saved && !params.has('pick')) showDash(saved);
  else showPicker();
}

// ---------- ekran wyboru ----------
function showPicker() {
  stopCurrent();
  const current = store.get();
  const previews = [];
  const cards = themes.map((t) => {
    const preview = h('div', { class: 'preview' });
    const card = h('button', { class: `card${t.id === current ? ' current' : ''}`, type: 'button' },
      preview,
      h('div', { class: 'meta' },
        h('div', { class: 'name' }, t.name, t.id === current ? h('span', { class: 'badge' }, 'teraz używany') : null),
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
  app.replaceChildren(h('section', { class: 'picker' },
    connect,
    telemetry,
    h('h1', {}, 'Wybierz wyświetlacz'),
    h('p', { class: 'lead' }, 'Każde urządzenie zapamięta swój wybór. Zmienisz go w każdej chwili przyciskiem w rogu dashboardu.'),
    h('div', { class: 'grid' }, cards),
    h('p', { class: 'foot' }, 'Podgląd pokazuje dane przykładowe.')));

  // na komputerze z codriverem: kod QR dla telefonu
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    showConnect(connect);
    showTelemetry(telemetry);
  }

  // podglądy rysują się na żywo danymi pokazowymi
  const views = previews.map(({ preview, t }) => t.create(createStage(preview)));
  const step = createDemo();
  const timer = setInterval(() => { const f = step(); views.forEach((v) => v.update(f)); }, 1000 / 20);
  stopCurrent = () => clearInterval(timer);
}

// ---------- dashboard ----------
function showDash(theme) {
  stopCurrent();
  const fit = h('div', { class: 'fit' });
  const menu = h('button', { class: 'menu', type: 'button' }, 'Zmień wygląd');
  const root = h('div', { class: 'dash' }, fit, menu, h('div', { class: 'rotate' }, 'Obróć urządzenie poziomo – będzie większe.'));
  app.replaceChildren(root);
  const stage = createStage(fit);
  const view = theme.create(stage);
  // pasy wokół planszy w kolorze tła motywu (np. jasne dla Papieru)
  root.style.background = getComputedStyle(stage.firstElementChild).backgroundColor;

  // przycisk menu pojawia się po dotknięciu i znika po 3 s
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
    const waiting = 'Połączono. Dane pojawią się po starcie odcinka.';
    view.idle('Łączenie z komputerem…');
    const es = new EventSource('/events');
    es.onopen = () => view.idle(waiting);
    es.onerror = () => view.idle('Brak połączenia z komputerem. Sprawdź, czy codriver na nim działa.');
    es.onmessage = (e) => {
      const f = JSON.parse(e.data);
      if (f.live) view.update(f); else view.idle(waiting);
    };
    cleanup = () => es.close();
  }
  stopCurrent = () => { cleanup(); clearTimeout(hideTimer); };
}

async function showConnect(slot) {
  let info;
  try { info = await (await fetch('/info')).json(); } catch { return; }
  const url = info.urls?.[0];
  if (!url) return;
  const qr = h('div', { class: 'qr', role: 'img', 'aria-label': `Kod QR z adresem ${url}` });
  qr.innerHTML = qrSvg(url, { margin: 2 });
  slot.replaceChildren(h('div', { class: 'connect' },
    qr,
    h('div', {},
      h('h2', {}, 'Podłącz telefon albo tablet'),
      h('p', {}, 'Zeskanuj kod aparatem albo wpisz w przeglądarce:'),
      info.name ? h('p', { class: 'addr' }, info.name) : null,
      h('p', { class: info.name ? 'addr alt' : 'addr' }, url),
      h('p', { class: 'hint' }, 'Urządzenie musi być w tej samej sieci Wi-Fi co ten komputer.'))));
}

/** Karta „Telemetria w DiRT 3”: włącza/wyłącza wysyłanie danych w ustawieniach gry (tylko na komputerze). */
async function showTelemetry(slot) {
  let st;
  try { st = await (await fetch('/api/dirt3/telemetry')).json(); } catch { return; }
  if (!st.found) return;
  const on = !!st.motion?.enabled;
  const button = h('button', { class: 'toggle', type: 'button' }, on ? 'Wyłącz telemetrię' : 'Włącz telemetrię');
  const msg = h('p', { class: 'hint', role: 'status' });
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const res = await fetch('/api/dirt3/telemetry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !on }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      await showTelemetry(slot);
      slot.querySelector('.hint').textContent = 'Zapisane. Zmiana zadziała po ponownym uruchomieniu gry.';
    } catch (e) {
      msg.textContent = e.message;
      button.disabled = false;
    }
  });
  slot.replaceChildren(h('div', { class: 'telemetry' },
    h('div', {},
      h('h2', {}, 'Telemetria w DiRT 3: ', h('span', { class: on ? 'on' : 'off' }, on ? (st.ready ? 'włączona' : 'włączona, ale nie dla codriver') : 'wyłączona')),
      h('p', {}, on
        ? 'DiRT 3 Complete Edition z włączoną telemetrią potrafi pokazać błąd „sendto failed 10038” na mecie. Wyłącz ją, gdy grasz bez dashboardu, albo użyj poprawki DiRTTelemetryErrorFix.'
        : 'Włącz, żeby gra wysyłała dane do dashboardu. Zamknij grę przed zmianą.'),
      msg),
    button));
}

function goFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) {
    el.requestFullscreen()
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  }
  // blokada wygaszania ekranu działa tylko na https/localhost; na zwykłym http w sieci domowej przeglądarka jej odmówi
  navigator.wakeLock?.request('screen').catch(() => {});
}

start();

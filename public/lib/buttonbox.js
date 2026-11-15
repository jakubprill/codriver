// Button box: a panel of big backlit keys on a phone or tablet. Each key presses one keyboard key on
// the computer (through codriver), so it can be assigned in the game's Controls screen – camera,
// looking around, flashback, pause… never throttle or anything that belongs on the wheel.
//
// Modes per key: tap (one short press), hold (held while the finger is down), hold1s (sent after a
// one-second hold – a safety for e.g. restart). The two bottom keys have a cover: lift it, then press.
// "Edit" opens a key's settings; "Assign" sends every key straight away (covers off) for binding in the game.
// Each device keeps its own layout (localStorage).
import { h, useFont, useStyle, gearText, fmtTime } from './util.js';
import { keepAwake, letSleep } from './keep-awake.js';

const STORE = 'codriver.buttons';
const HOLD_MS = 1000;
const COVER_MS = 4000;

const DEFAULTS = {
  keys: [
    { name: 'CAMERA ▶', key: 'Num 8', mode: 'tap' }, { name: 'CAMERA ◀', key: 'Num 2', mode: 'tap' },
    { name: 'LOOK BACK', key: 'Num 5', mode: 'hold' }, { name: 'FLASHBACK', key: 'Num 0', mode: 'tap' },
    { name: 'LOOK LEFT', key: 'Num 4', mode: 'hold' }, { name: 'LOOK RIGHT', key: 'Num 6', mode: 'hold' },
    { name: 'HUD', key: 'Num 7', mode: 'tap' }, { name: 'SCREENSHOT', key: 'F12', mode: 'tap' },
  ],
  covered: [{ name: 'PAUSE', key: 'Esc' }, { name: 'RESTART', key: 'Num 9' }],
};
const MODES = { tap: 'tap', hold: 'held while pressed', hold1s: 'hold 1 s' };

const CSS = `
.bbox { position: fixed; inset: 0; box-sizing: border-box; padding: calc(16px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left));
  display: flex; flex-direction: column; gap: 14px; color: #e9e6df; font-family: Inter, system-ui, sans-serif;
  background: radial-gradient(ellipse at 50% 0%, #2a2c30 0%, #141518 70%); user-select: none; -webkit-user-select: none; touch-action: manipulation; }
.bbox button { font: inherit; color: inherit; cursor: pointer; }
.bbox button:focus-visible { outline: 3px solid #ffb547; outline-offset: 3px; }
.bbox .strip { display: flex; align-items: center; gap: 18px; min-height: 56px; padding: 6px 16px; border-radius: 14px; background: #0b0c0d; box-shadow: inset 0 0 0 2px #2e3035; flex-wrap: wrap; }
.bbox .conn { display: flex; align-items: center; gap: 10px; font-size: 15px; color: #a8a49b; }
.bbox .dot { width: 12px; height: 12px; border-radius: 6px; background: #6b6760; }
.bbox .dot.ok { background: #3ddc84; box-shadow: 0 0 10px #3ddc84; }
.bbox .dot.warn { background: #ffb547; box-shadow: 0 0 10px #ffb547; }
.bbox .tele { display: flex; gap: 24px; font-family: 'Barlow Condensed', sans-serif; font-size: 30px; font-weight: 600; margin-left: auto; }
.bbox .tele small { font-size: 14px; color: #a8a49b; margin-right: 6px; font-weight: 500; }
.bbox .sent { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; color: #ffb547; min-width: 200px; text-align: right; }
.bbox .tools { display: flex; gap: 8px; }
.bbox .tool { min-height: 44px; padding: 0 16px; border-radius: 22px; border: 2px solid #3a3c41; background: #1c1d20; font-size: 15px; }
.bbox .tool.on { border-color: #ffb547; color: #ffb547; }
.bbox .grid { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 16px; }
.bbox .key { position: relative; border: 0; border-radius: 16px; background: linear-gradient(180deg, #3a3c41 0%, #24262a 100%);
  box-shadow: 0 6px 0 #0a0b0c, inset 0 1px 0 #55585f; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 18px 10px 12px;
  transition: transform .06s, box-shadow .06s; touch-action: none; }
.bbox .key.down { transform: translateY(4px); box-shadow: 0 2px 0 #0a0b0c, inset 0 1px 0 #55585f; }
.bbox .led { position: absolute; top: 12px; left: 50%; width: 46px; height: 8px; margin-left: -23px; border-radius: 4px; background: #3a2f1c; transition: background .1s, box-shadow .1s; }
.bbox .key.down .led, .bbox .key.lit .led { background: #ffb547; box-shadow: 0 0 18px #ffb547; }
.bbox .name { font-family: 'Barlow Condensed', sans-serif; font-size: clamp(18px, min(3.2vw, 5.2vh), 38px); font-weight: 700; letter-spacing: .04em; color: #ffcf8a; text-shadow: 0 0 14px rgba(255, 181, 71, .45); text-align: center; line-height: 1.05; }
.bbox .hint { font-size: 13px; color: #8d897f; }
.bbox .ring { position: absolute; inset: 0; border-radius: 16px; pointer-events: none; background: conic-gradient(#ffb547 var(--p, 0%), transparent 0); opacity: .25; }
.bbox .covered { flex: 0 0 auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; height: clamp(90px, 19vh, 150px); }
.bbox .cov { border: 0; border-radius: 16px; background: #1c1d20; box-shadow: inset 0 0 0 2px #3a2a12; display: flex; align-items: center; gap: 20px; padding: 0 20px; text-align: left; touch-action: none; }
.bbox .lid { height: 76%; aspect-ratio: 1; border-radius: 14px; flex: none; display: grid; place-items: center; font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; color: #1c1406; letter-spacing: .06em;
  background: repeating-linear-gradient(135deg, #e3b21f 0 14px, #1c1406 14px 28px); box-shadow: inset 0 0 0 3px #1c1406; }
.bbox .lid span { padding: 4px 8px; border-radius: 6px; background: #1c1406; color: #ffcf5a; }
.bbox .cov.open .lid span { background: transparent; color: #1c1406; }
.bbox .cov.open .lid { background: linear-gradient(180deg, #ffcf5a, #e09a1a); box-shadow: 0 0 24px rgba(255, 181, 71, .6); }
.bbox .cov .name { text-align: left; }
.bbox.editing .key, .bbox.editing .cov { outline: 2px dashed #ffb547; outline-offset: -6px; }
.bbox dialog { border: 0; border-radius: 22px; padding: 26px; width: min(640px, 92vw); background: #17191d; color: #f2f3f5; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
.bbox dialog::backdrop { background: rgba(0,0,0,.6); }
.bbox dialog h2 { margin: 0 0 16px; font-family: 'Barlow Condensed', sans-serif; font-size: 32px; }
.bbox dialog label, .bbox dialog .lab { display: block; font-size: 14px; color: #9aa0aa; margin: 14px 0 8px; }
.bbox dialog input { width: 100%; box-sizing: border-box; height: 50px; padding: 0 14px; border-radius: 12px; border: 0; background: #23262c; color: #f2f3f5; font: inherit; font-size: 20px; }
.bbox .chips { display: flex; flex-wrap: wrap; gap: 8px; }
.bbox .chip { min-height: 44px; min-width: 64px; padding: 0 12px; border: 0; border-radius: 12px; background: #23262c; color: #d3d7de; }
.bbox .chip.on { background: #f2f3f5; color: #0e0f12; }
.bbox .row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; }
.bbox .row button { min-height: 48px; padding: 0 20px; border-radius: 14px; border: 0; background: #23262c; }
.bbox .row .primary { background: #ffb547; color: #1c1406; font-weight: 600; }
.bbox .row .left { margin-right: auto; }
@media (max-height: 500px) {
  .bbox { gap: 8px; padding-top: calc(8px + env(safe-area-inset-top)); padding-bottom: calc(8px + env(safe-area-inset-bottom)); }
  .bbox .strip { min-height: 44px; padding: 2px 12px; }
  .bbox .grid, .bbox .covered { gap: 10px; }
  .bbox .key { padding: 12px 6px 6px; }
  .bbox .key .hint { display: none; }
  .bbox .led { top: 7px; height: 5px; width: 34px; margin-left: -17px; }
}
@media (orientation: portrait) { .bbox .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .bbox .sent { min-width: 0; } }
`;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE));
    if (v?.keys?.length === DEFAULTS.keys.length && v?.covered?.length === DEFAULTS.covered.length) return v;
  } catch { /* nothing saved yet */ }
  return structuredClone(DEFAULTS);
}
const save = (cfg) => { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch { /* private mode */ } };

/**
 * Shows the button box in `app`. Returns a function that tears it down.
 * @param {HTMLElement} app
 * @param {{ onBack: () => void }} o
 */
export function showButtonBox(app, { onBack }) {
  useFont('Barlow+Condensed:wght@500;600;700');
  useStyle('buttonbox', CSS);
  const cfg = load();
  // the server sends the allowed list; this is the same list until it answers
  let allowed = ['Num 0', 'Num 1', 'Num 2', 'Num 3', 'Num 4', 'Num 5', 'Num 6', 'Num 7', 'Num 8', 'Num 9', 'Num /', 'Num *', 'Num -', 'Num +', 'Num .', 'Num Enter', 'Esc', 'F12'];
  let editing = false;
  let assign = false;

  // ---- top strip ----
  const dot = h('span', { class: 'dot' });
  const connText = h('span', {}, 'Connecting…');
  const gear = h('span', {}, '–');
  const speed = h('span', {}, '0');
  const stageTime = h('span', {}, '0:00.0');
  const sent = h('span', { class: 'sent', role: 'status', 'aria-live': 'polite' }, 'Ready');
  const editBtn = h('button', { class: 'tool', type: 'button', 'aria-pressed': 'false' }, 'Edit');
  const assignBtn = h('button', { class: 'tool', type: 'button', 'aria-pressed': 'false' }, 'Assign');
  const backBtn = h('button', { class: 'tool', type: 'button' }, 'Gauges');
  const strip = h('div', { class: 'strip' },
    h('span', { class: 'conn' }, dot, connText),
    h('span', { class: 'tele' }, h('span', {}, h('small', {}, 'GEAR'), gear), h('span', {}, h('small', {}, 'KM/H'), speed), h('span', {}, h('small', {}, 'STAGE'), stageTime)),
    sent,
    h('span', { class: 'tools' }, editBtn, assignBtn, backBtn));

  const grid = h('div', { class: 'grid' });
  const covered = h('div', { class: 'covered' });
  const dialog = h('dialog', { 'aria-label': 'Edit key' });
  const root = h('div', { class: 'bbox' }, strip, grid, covered, dialog);
  app.replaceChildren(root);

  // ---- sending ----
  const say = (text, warn = false) => {
    sent.textContent = text;
    dot.className = `dot ${warn ? 'warn' : 'ok'}`;
  };
  const send = async (k, action) => {
    navigator.vibrate?.(action === 'up' ? 0 : 15);
    try {
      const r = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k.key, action }), keepalive: true });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return say(j.error || `Error ${r.status}`, true);
      if (action === 'up') return;
      if (j.result === 'ok') say(`Sent ${k.name} · ${k.key}`);
      else if (j.result?.startsWith('skip:')) say(`Not sent – the game is not in front${j.result.length > 5 ? ` (${j.result.slice(5)})` : ''}`, true);
      else say('The computer did not answer', true);
    } catch {
      say('No connection to the computer', true);
    }
  };

  // ---- keys ----
  const renderKeys = () => {
    grid.replaceChildren(...cfg.keys.map((k, i) => keyButton(k, i)));
    covered.replaceChildren(...cfg.covered.map((k, i) => coverButton(k, i)));
  };

  function keyButton(k, i) {
    const ring = h('span', { class: 'ring', hidden: '' });
    const el = h('button', { class: 'key', type: 'button', 'aria-label': `${k.name}, ${k.key}` },
      h('span', { class: 'led' }), h('span', { class: 'name' }, k.name), h('span', { class: 'hint' }, `${k.key} · ${MODES[k.mode]}`), ring);
    let timer = 0;
    let anim = 0;
    let isDown = false;
    const release = () => {
      if (!isDown) return;
      isDown = false;
      el.classList.remove('down');
      clearTimeout(timer);
      cancelAnimationFrame(anim);
      ring.hidden = true;
      if (k.mode === 'hold' && !assign) send(k, 'up');
    };
    el.addEventListener('pointerdown', (e) => {
      if (editing) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      isDown = true;
      el.classList.add('down');
      keepAwake();
      if (assign || k.mode === 'tap') return send(k, 'tap');
      if (k.mode === 'hold') return send(k, 'down');
      // hold1s: a ring fills; the key goes only after a full second
      const t0 = performance.now();
      ring.hidden = false;
      const tick = () => {
        ring.style.setProperty('--p', `${Math.min(100, ((performance.now() - t0) / HOLD_MS) * 100)}%`);
        anim = requestAnimationFrame(tick);
      };
      tick();
      timer = setTimeout(() => { cancelAnimationFrame(anim); ring.hidden = true; send(k, 'tap'); }, HOLD_MS);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, release);
    el.addEventListener('click', () => { if (editing) openEditor(cfg.keys, i, true); });
    // keyboard users: Enter / Space taps the key
    el.addEventListener('keydown', (e) => { if (!editing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); send(k, 'tap'); } });
    return el;
  }

  function coverButton(k, i) {
    const lidText = h('span', {}, 'COVER');
    const lid = h('span', { class: 'lid' }, lidText);
    const el = h('button', { class: 'cov', type: 'button', 'aria-label': `${k.name}: lift the cover, then press` },
      lid, h('span', {}, h('span', { class: 'name' }, k.name), h('br'), h('span', { class: 'hint' }, `${k.key} · cover first, then press`)));
    let closeTimer = 0;
    el.addEventListener('click', () => {
      if (editing) return openEditor(cfg.covered, i, false);
      if (assign || el.classList.contains('open')) {
        el.classList.remove('open');
        lidText.textContent = 'COVER';
        clearTimeout(closeTimer);
        return send(k, 'tap');
      }
      el.classList.add('open');
      lidText.textContent = 'PRESS';
      navigator.vibrate?.(10);
      say(`${k.name} cover open – press again`);
      closeTimer = setTimeout(() => { el.classList.remove('open'); lidText.textContent = 'COVER'; }, COVER_MS);
    });
    return el;
  }

  // ---- editor ----
  function openEditor(list, i, withMode) {
    const k = { ...list[i] };
    const name = h('input', { value: k.name, maxlength: '14', 'aria-label': 'Name' });
    const chips = (values, current, label, pick) => h('div', { class: 'chips', role: 'group', 'aria-label': label },
      ...values.map(([v, text]) => {
        const b = h('button', { class: `chip${v === current ? ' on' : ''}`, type: 'button', 'aria-pressed': String(v === current) }, text);
        b.addEventListener('click', () => {
          pick(v);
          [...b.parentElement.children].forEach((c) => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', String(c === b)); });
        });
        return b;
      }));
    const test = h('button', { type: 'button', class: 'left' }, `Send ${k.key} now`);
    test.addEventListener('click', () => send({ ...k, name: name.value || k.name }, 'tap'));
    const cancel = h('button', { type: 'button' }, 'Cancel');
    const ok = h('button', { type: 'button', class: 'primary' }, 'Save');
    const reset = h('button', { type: 'button' }, 'Reset all');
    cancel.addEventListener('click', () => dialog.close());
    ok.addEventListener('click', () => {
      list[i] = { ...k, name: (name.value || k.name).toUpperCase() };
      save(cfg);
      dialog.close();
      renderKeys();
    });
    reset.addEventListener('click', () => {
      Object.assign(cfg, structuredClone(DEFAULTS));
      save(cfg);
      dialog.close();
      renderKeys();
    });
    dialog.replaceChildren(
      h('h2', {}, 'Edit key'),
      h('label', {}, 'Name', name),
      h('div', { class: 'lab' }, 'Key it sends'),
      chips(allowed.map((v) => [v, v]), k.key, 'Key', (v) => { k.key = v; test.textContent = `Send ${v} now`; }),
      withMode ? h('div', { class: 'lab' }, 'When pressed') : null,
      withMode ? chips(Object.entries({ tap: 'Tap', hold: 'Hold', hold1s: 'Hold 1 s' }), k.mode, 'When pressed', (v) => { k.mode = v; }) : null,
      h('p', { class: 'hint', style: 'margin:16px 0 0' }, 'In the game: Options › Controls › pick the action, then tap “Send now” while it waits for a key.'),
      h('div', { class: 'row' }, test, reset, cancel, ok));
    dialog.showModal();
  }

  // ---- tool buttons ----
  const toggle = (btn, on) => { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on)); };
  editBtn.addEventListener('click', () => {
    editing = !editing;
    if (editing) { assign = false; toggle(assignBtn, false); }
    toggle(editBtn, editing);
    root.classList.toggle('editing', editing);
    say(editing ? 'Edit: tap a key to change it' : 'Ready');
  });
  assignBtn.addEventListener('click', () => {
    assign = !assign;
    if (assign) { editing = false; toggle(editBtn, false); root.classList.remove('editing'); }
    toggle(assignBtn, assign);
    say(assign ? 'Assign: every key sends at once, covers off' : 'Ready');
  });
  backBtn.addEventListener('click', onBack);

  renderKeys();

  // ---- the computer: allowed keys and live data ----
  fetch('/api/keys').then((r) => r.json()).then((j) => {
    allowed = j.keys;
    if (j.available) { dot.className = 'dot ok'; connText.textContent = 'Connected'; }
    else { dot.className = 'dot warn'; connText.textContent = 'Keys work only when codriver runs on Windows'; }
  }).catch(() => { dot.className = 'dot warn'; connText.textContent = 'No connection to the computer'; });
  const es = new EventSource('/events');
  es.onmessage = (e) => {
    const f = JSON.parse(e.data);
    if (!f.live) return;
    gear.textContent = gearText(f.gear);
    speed.textContent = Math.round(f.speedKmh);
    stageTime.textContent = fmtTime(f.lapTime);
  };
  keepAwake();

  return () => {
    es.close();
    letSleep();
  };
}

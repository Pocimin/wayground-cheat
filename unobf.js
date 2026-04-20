(function() {
  'use strict';
  if (document.getElementById('_aw-panel')) { console.log('[AW] Already running'); return; }

  // ── Anti-cheat bypass ─────────────────────────────────────────────────────
  const BL = ['playerExited','playerResumed','infractionType','extensionDetected','windowResizeDetected','rightClickDetected','pasteDetected'],
        blocked = d => typeof d === 'string' && BL.some(k => d.includes(k)),
        _fetch = window.fetch, _xhrSend = XMLHttpRequest.prototype.send, _parse = JSON.parse;

  window.fetch = async function(...a) {
    return a[1]?.body && blocked(a[1].body) ? new Response('{"success":true}', {status:200}) : _fetch.apply(this, a);
  };
  XMLHttpRequest.prototype.send = function(b) {
    if (blocked(b)) {
      Object.defineProperties(this, {readyState:{value:4,configurable:1},status:{value:200,configurable:1}});
      return this.onreadystatechange?.();
    }
    _xhrSend.apply(this, arguments);
  };
  JSON.parse = function(...a) {
    const r = _parse.apply(this, a);
    if (r?.type === 'RN_APP_STATE_CHANGE' && r.value === 'background') r.value = 'foreground';
    return r;
  };

  const stop = e => e.stopImmediatePropagation();
  'visibilitychange blur mouseleave pagehide resize contextmenu copy paste fullscreenchange webkitfullscreenchange'.split(' ').forEach(e => (window.addEventListener(e, stop, !0), document.addEventListener(e, stop, !0)));

  const def = (o, p, v) => { try { Object.getOwnPropertyDescriptor(o, p)?.configurable !== !1 && Object.defineProperty(o, p, {get:()=>v, configurable:!0}) } catch{} },
        docEl = () => document.documentElement;
  for (const o of [Document.prototype, document]) {
    def(o, 'visibilityState', 'visible'); def(o, 'hidden', !1);
    def(o, 'fullscreenElement', docEl); def(o, 'webkitFullscreenElement', docEl);
  }
  window.onblur = document.onblur = null;
  document.hasFocus = () => !0;
  window.addEventListener('keydown', e => {
    if (e.key === 'F2') (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  }, !0);

  // ── Styles ────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #_aw-panel {
      position: fixed; bottom: 20px; left: 20px; z-index: 999999;
      padding: 12px; background: rgba(26,27,30,.85); backdrop-filter: blur(10px);
      border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,.4);
      min-width: 260px; max-width: 320px; border: 1px solid rgba(255,255,255,.1);
      font-family: ui-sans-serif, system-ui, sans-serif;
      opacity: 0; pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease; transform: scale(0.95);
    }
    #_aw-panel._aw-visible { opacity: 1; pointer-events: all; transform: scale(1); }
    #_aw-status { color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 10px; transition: .3s; text-align: left; word-wrap: break-word; }
    ._aw-row { display: flex; gap: 8px; margin-bottom: 8px; }
    ._aw-row:last-of-type { margin-bottom: 0; }
    .aw-input { flex: 1; border: 1px solid rgba(255,255,255,.2); background: rgba(0,0,0,.3); color: #fff; border-radius: 8px; padding: 8px 12px; font-size: 13px; outline: 0; text-align: center; transition: .2s; font-family: inherit; }
    .aw-input:focus { border-color: #a78bfa; }
    .aw-input::placeholder { color: rgba(255,255,255,0.3); }
    .aw-btn { background: linear-gradient(135deg,#a78bfa,#8b5cf6); border: 0; border-radius: 8px; color: #fff; font-weight: 600; padding: 0 16px; cursor: pointer; transition: .2s; font-size: 13px; font-family: inherit; }
    .aw-btn:hover { transform: scale(1.05); }
    .aw-btn:disabled { cursor: not-allowed; background: #555; transform: none; }
    /* toggle answer button */
    #_aw-toggle-row { display: none; margin-bottom: 8px; }
    #_aw-toggle-btn { width: 100%; padding: 8px; font-size: 13px; border-radius: 8px; border: 0; font-weight: 600; cursor: pointer; font-family: inherit; transition: .2s; background: linear-gradient(135deg,#50fa7b,#27c95f); color: #111; }
    #_aw-toggle-btn:hover { transform: scale(1.02); }
    #_aw-toggle-btn._aw-hidden-state { background: linear-gradient(135deg,#ff5555,#c0392b); color: #fff; }
    /* color row */
    #_aw-color-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    #_aw-color-label { color: rgba(255,255,255,0.4); font-size: 11px; flex: 1; }
    #_aw-color-pick { width: 32px; height: 24px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 0; cursor: pointer; background: none; }
    #_aw-color-hex { width: 72px; border: 1px solid rgba(255,255,255,.2); background: rgba(0,0,0,.3); color: #fff; border-radius: 6px; padding: 4px 6px; font-size: 12px; outline: 0; text-align: center; font-family: monospace; }
    #_aw-color-hex:focus { border-color: #a78bfa; }
    #_aw-hint { color: rgba(255,255,255,0.18); font-size: 10px; text-align: right; margin-top: 6px; }
    * { user-select: text !important; -webkit-user-select: text !important; }
  `;
  document.head.appendChild(style);

  // ── State ─────────────────────────────────────────────────────────────────
  const cache = new Map();
  let lastQid = '';
  let outlineColor = '#000000';
  let answersVisible = true; // ← new toggle state
  let panelEl, statusEl;

  const clean = t => t?.replace(/<\/?p>/g, '').trim().replace(/\s+/g, ' ') || '';
  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // ── Key validation ────────────────────────────────────────────────────────
  const KEY_URL = 'https://raw.githubusercontent.com/Pocimin/Drag-Drive-Simulator-AutoFarm/refs/heads/main/cheatpass';
  async function validateKey(inputKey) {
    try {
      const res = await _fetch(KEY_URL + '?_=' + Date.now());
      if (!res.ok) throw new Error();
      const raw = await res.text();
      return raw.split('\n').map(k => k.trim()).filter(Boolean).includes(inputKey.trim());
    } catch { return false; }
  }

  // ── Panel ─────────────────────────────────────────────────────────────────
  function createPanel() {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="_aw-panel">
        <div id="_aw-status">🔑 Enter your access key</div>
        <!-- Step 1: key -->
        <div id="_aw-key-row" class="_aw-row">
          <input class="aw-input" id="_aw-key-input" type="password" placeholder="Access key…" autocomplete="off">
          <button class="aw-btn" id="_aw-key-btn">Verify</button>
        </div>
        <!-- Step 2: PIN (hidden until key passes) -->
        <div id="_aw-pin-row" class="_aw-row" style="display:none">
          <input class="aw-input" id="_aw-pin-input" type="text" placeholder="Room PIN…" autocomplete="off" maxlength="12">
          <button class="aw-btn" id="_aw-pin-btn">Load</button>
        </div>
        <!-- Answer toggle (hidden until ready) -->
        <div id="_aw-toggle-row">
          <button id="_aw-toggle-btn">👁 Answers: ON</button>
        </div>
        <!-- Color picker (hidden until key passes) -->
        <div id="_aw-color-row" style="display:none">
          <span id="_aw-color-label">Outline color</span>
          <input type="color" id="_aw-color-pick" value="#000000">
          <input type="text"  id="_aw-color-hex"  value="#000000" maxlength="7" spellcheck="false">
        </div>
        <div id="_aw-hint">Ctrl+Shift+Zto hide/show panel · Shift+Z to toggle answers</div>
      </div>
    `);

    panelEl  = $('#_aw-panel');
    statusEl = $('#_aw-status');

    const keyInput   = $('#_aw-key-input');
    const keyBtn     = $('#_aw-key-btn');
    const keyRow     = $('#_aw-key-row');
    const pinInput   = $('#_aw-pin-input');
    const pinBtn     = $('#_aw-pin-btn');
    const pinRow     = $('#_aw-pin-row');
    const colorRow   = $('#_aw-color-row');
    const colorPick  = $('#_aw-color-pick');
    const colorHex   = $('#_aw-color-hex');
    const toggleRow  = $('#_aw-toggle-row');
    const toggleBtn  = $('#_aw-toggle-btn');

    // ── Answer toggle button ───────────────────────────────────────────
    toggleBtn.addEventListener('click', () => toggleAnswers());

    // ── Color sync ────────────────────────────────────────────────────
    colorPick.addEventListener('input', () => {
      outlineColor = colorPick.value;
      colorHex.value = colorPick.value;
      reHighlight();
    });
    colorHex.addEventListener('input', () => {
      const v = colorHex.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        outlineColor = v;
        colorPick.value = v;
        reHighlight();
      }
    });

    // ── Key verify ────────────────────────────────────────────────────
    const handleKeyVerify = async () => {
      const key = keyInput.value.trim();
      if (!key) return;
      keyBtn.disabled = keyInput.disabled = true;
      statusEl.textContent = '⏳ Verifying key…';
      statusEl.style.color = '#fff';
      const valid = await validateKey(key);
      if (valid) {
        keyRow.style.display = 'none';
        pinRow.style.display = 'flex';
        colorRow.style.display = 'flex';
        statusEl.textContent = '✅ Access granted';
        statusEl.style.color = '#50fa7b';
        pinInput.focus();
        startPinFinder(pinInput, handlePinLoad);
      } else {
        statusEl.textContent = '❌ Invalid key';
        statusEl.style.color = '#ff5555';
        keyBtn.disabled = keyInput.disabled = false;
        keyInput.value = '';
        keyInput.focus();
      }
    };
    keyBtn.addEventListener('click', handleKeyVerify);
    keyInput.addEventListener('keydown', e => e.key === 'Enter' && handleKeyVerify());

    // ── PIN load ──────────────────────────────────────────────────────
    const handlePinLoad = async () => {
      const pin = pinInput.value.trim().replace(/\s/g, '');
      if (!pin) return;
      pinBtn.disabled = pinInput.disabled = true;
      if (await fetchAnswers(pin)) {
        pinRow.style.display = 'none';
        toggleRow.style.display = 'block'; // show toggle button
        statusEl.textContent = '🚀 Ready — watching for questions';
        statusEl.style.color = '#50fa7b';
        startObserver();
        setTimeout(() => panelEl.classList.remove('_aw-visible'), 1500);
      } else {
        pinBtn.disabled = pinInput.disabled = false;
      }
    };
    pinBtn.addEventListener('click', handlePinLoad);
    pinInput.addEventListener('keydown', e => e.key === 'Enter' && handlePinLoad());
  }

  // ── Toggle answers ────────────────────────────────────────────────────────
  function toggleAnswers() {
    answersVisible = !answersVisible;
    const btn = $('#_aw-toggle-btn');
    if (answersVisible) {
      btn?.classList.remove('_aw-hidden-state');
      if (btn) btn.textContent = '👁 Answers: ON';
      highlight();
    } else {
      btn?.classList.add('_aw-hidden-state');
      if (btn) btn.textContent = '🙈 Answers: OFF';
      clearHighlights();
    }
  }

  // ── Shift+Z shortcut ──────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    if (e.shiftKey && e.code === 'KeyZ' && !e.ctrlKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (cache.size) toggleAnswers();
    }
  }, true);


  // ── Toggle panel ──────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyZ') {
      e.preventDefault();
      e.stopImmediatePropagation();
      panelEl?.classList.toggle('_aw-visible');
    }
  }, true);

  // ── PIN finder ────────────────────────────────────────────────────────────
  function findGamePin() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const m = node.nodeValue.trim().match(/\b(\d{4})\s(\d{4})\b/);
      if (m && node.parentElement?.offsetParent !== null) return m[0].replace(/\s/g, '');
    }
    return null;
  }

  function startPinFinder(pinInput, handlePinLoad) {
    const finder = setInterval(() => {
      const pin = findGamePin();
      if (pin) {
        clearInterval(finder);
        pinInput.value = pin;
        statusEl.textContent = '✅ Room code found';
        statusEl.style.color = '#50fa7b';
        setTimeout(handlePinLoad, 500);
      }
    }, 1000);
    setTimeout(() => clearInterval(finder), 20000);
  }

  // ── API ───────────────────────────────────────────────────────────────────
  async function fetchAnswers(pin) {
    statusEl.textContent = '⏳ Loading answers…';
    statusEl.style.color = '#fff';
    try {
      const res  = await _fetch(`https://api.quizit.online/quizizz?pin=${pin}`);
      if (!res.ok) throw new Error(`API: ${res.status}`);
      const data = await res.json();
      const list = data.answers || data.data?.answers;
      if (!list?.length) throw new Error('No answers from API');
      for (const item of list) {
        const id = item.id || item._id;
        if (!id) continue;
        if (item.type === 'OPEN') { cache.set(id, '📝 Open-ended'); continue; }
        if (item.type === 'MSQ' && Array.isArray(item.answers)) {
          const ans = item.answers.map(a => clean(a.text)).filter(Boolean);
          if (ans.length) cache.set(id, ans);
        } else {
          const ans = clean(item.answers?.[0]?.text);
          if (ans) cache.set(id, ans);
        }
      }
      if (!cache.size) throw new Error('Answer cache empty');
      return true;
    } catch(e) {
      statusEl.textContent = `❌ ${e.message}`;
      statusEl.style.color = '#ff5555';
      return false;
    }
  }

  // ── Question reader ───────────────────────────────────────────────────────
  function getQuestion() {
    const container = $('[data-quesid]');
    if (!container) return null;
    const qid = container.dataset.quesid;
    const options = $$('.option.is-selectable').map(el => ({
      text: clean(el.querySelector('.option-text-inner, .text-container')?.innerText),
      element: el,
    }));
    if (options.length) return { qid, options };
    return null;
  }

  // ── Highlight ─────────────────────────────────────────────────────────────
  function clearHighlights() {
    $$('.option.is-selectable').forEach(el => {
      el.style.removeProperty('outline');
      el.style.removeProperty('outline-offset');
    });
  }

  function highlight() {
    if (!cache.size || !answersVisible) return; // ← respect toggle state
    const q = getQuestion();
    if (!q?.qid) return;
    clearHighlights();
    const ans = cache.get(q.qid);
    if (!ans || (typeof ans === 'string' && ans.startsWith('📝'))) return;
    const targets = Array.isArray(ans) ? ans : [ans];
    targets.forEach(target => {
      const opt = q.options.find(o =>
        o.text.toLowerCase().trim() === target.toLowerCase().trim());
      if (opt) {
        opt.element.style.outline = `3px solid ${outlineColor}`;
        opt.element.style.outlineOffset = '2px';
      }
    });
  }

  function reHighlight() {
    clearHighlights();
    if (answersVisible) highlight();
  }

  // ── Observer ──────────────────────────────────────────────────────────────
  function startObserver() {
    new MutationObserver(() => {
      const qid = $('[data-quesid]')?.dataset.quesid;
      if (qid && qid !== lastQid) {
        lastQid = qid;
        clearHighlights();
        if (answersVisible) setTimeout(highlight, 500);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  createPanel();
  panelEl = $('#_aw-panel');
  panelEl.classList.add('_aw-visible');
  console.log('[AW] Loaded — Ctrl+Shift+Z to toggle panel · Ctrl+Tab to toggle answers');
})();

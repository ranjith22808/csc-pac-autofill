// content_script.js
// Wrapped in an IIFE so injecting it multiple times (manifest + scripting API)
// never collides in the shared isolated world.
(function () {
  'use strict';

  console.log('CSC PAC Autofill driver v3 loaded, top frame:', window.top === window.self);
  window.__pacAutoV3 = true;

  const PAC_GENERATE_URL = 'https://digitalseva.csc.gov.in/services/pac/generate';

  // ============================================================
  // FIELD FILLING
  // ============================================================

  const fillStrategies = [
    { q: "input[id*='client'], input[name*='client'], input[placeholder*='Client']", key: 'clientId' },
    { q: "input[id*='customer'], input[name*='customer'], input[placeholder*='Customer']", key: 'customer' },
    { q: "input[id*='pin'], input[name*='wallet'], input[name*='walletPin'], input[placeholder*='PIN'], input[placeholder*='Wallet']", key: 'pin' }
  ];

  function findByLabelText(textFragment, root) {
    const doc = root || document;
    let labels = Array.from(doc.querySelectorAll('label'));
    for (let lbl of labels) {
      const t = (lbl.innerText || '').trim().toLowerCase();
      if (t.includes(textFragment.toLowerCase())) {
        let forId = lbl.getAttribute('for');
        if (forId) {
          let el = doc.getElementById(forId);
          if (el && (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'select' || el.tagName.toLowerCase() === 'textarea'))
            return el;
        }
        let inside = lbl.querySelector('input,textarea,select');
        if (inside) return inside;
      }
    }
    return null;
  }

  function trySetInput(el, value) {
    if (!el) return false;
    try {
      el.focus?.();
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur?.();
      return true;
    } catch (e) {
      return false;
    }
  }

  function fillAll(data, root) {
    const doc = root || document;
    let results = { client: false, customer: false, pin: false };

    for (let s of fillStrategies) {
      if (!data[s.key]) continue;
      let el = doc.querySelector(s.q);
      if (el) {
        if (trySetInput(el, data[s.key])) {
          if (s.key === 'clientId') results.client = true;
          if (s.key === 'customer') results.customer = true;
          if (s.key === 'pin') results.pin = true;
          continue;
        }
      }
    }

    if (!results.client && data.clientId) {
      let el = findByLabelText('Client', doc) || findByLabelText('Client Operator', doc) || findByLabelText('Client Operator ID', doc) || findByLabelText('Operator ID', doc);
      if (el && trySetInput(el, data.clientId)) results.client = true;
    }
    if (!results.customer && data.customer) {
      let el = findByLabelText('Customer', doc) || findByLabelText('Customer Id', doc) || findByLabelText('Customer ID', doc) || findByLabelText('Customer Name', doc);
      if (el && trySetInput(el, data.customer)) results.customer = true;
    }
    if (!results.pin && data.pin) {
      let el = findByLabelText('Wallet Pin', doc) || findByLabelText('Wallet PIN', doc) || findByLabelText('Enter Wallet Pin', doc) || findByLabelText('PIN', doc);
      if (el && trySetInput(el, data.pin)) results.pin = true;
    }

    if (!results.client || !results.customer || !results.pin) {
      const inputs = Array.from(doc.querySelectorAll('input[type="text"], input:not([type])')).filter(i => { try { return i.offsetParent !== null; } catch (e) { return false; } });
      for (let i of inputs) {
        const ph = (i.placeholder || '').toLowerCase();
        if (!results.client && data.clientId && ph.includes('client')) { if (trySetInput(i, data.clientId)) results.client = true; }
        if (!results.customer && data.customer && ph.includes('customer')) { if (trySetInput(i, data.customer)) results.customer = true; }
      }
      const pw = doc.querySelector('input[type="password"]');
      if (!results.pin && data.pin && pw) {
        if (trySetInput(pw, data.pin)) results.pin = true;
      }
    }

    return results;
  }

  // ============================================================
  // HELPERS (all same-origin frames)
  // ============================================================

  function allDocuments() {
    const docs = [];
    function walk(doc) {
      docs.push(doc);
      for (const f of Array.from(doc.querySelectorAll('iframe, frame'))) {
        try {
          const d = f.contentDocument;
          if (d && !docs.includes(d)) walk(d);
        } catch (e) { /* cross-origin frame */ }
      }
    }
    walk(document);
    return docs;
  }

  function fillAllEverywhere(data) {
    let results = { client: false, customer: false, pin: false };
    for (const d of allDocuments()) {
      const r = fillAll(data, d);
      for (const k of Object.keys(results)) if (r[k]) results[k] = true;
    }
    return results;
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeText(s) {
    return (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================
  // PAC RESULT CAPTURE
  // ============================================================

  function parsePacFromText(rawText) {
    const text = normalizeText(rawText);
    if (!text) return null;
    const m = text.match(/your pac number\s*[:=]?\s*(\d{4,})/i);
    if (!m) return null;
    const pac = m[1];
    const get = (label) => {
      const re = new RegExp(escapeRegExp(label) + '\\s*:?\\s*([^\\s]+)', 'i');
      const r = text.match(re);
      return r ? r[1].trim() : '';
    };
    return {
      pac,
      cscTxn: get('CSC Txn'),
      merchantTxn: get('Merchant Txn'),
      state: get('State'),
      txnDate: get('Transaction Date'),
      txnStatus: get('Transaction Status'),
      mobile: get('Mobile')
    };
  }

  function storePac(record) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ pacRecords: [] }, (res) => {
        const arr = res.pacRecords || [];
        if (arr.some((r) => r.pac === record.pac)) return resolve(false);
        arr.push({
          serial: arr.length + 1,
          pac: record.pac,
          cscTxn: record.cscTxn,
          merchantTxn: record.merchantTxn,
          state: record.state,
          txnDate: record.txnDate,
          txnStatus: record.txnStatus,
          mobile: record.mobile,
          capturedAt: new Date().toLocaleString()
        });
        chrome.storage.local.set({ pacRecords: arr }, () => resolve(true));
      });
    });
  }

  async function scanDocument(doc) {
    if (!doc || !doc.body) return;
    const els = doc.querySelectorAll('body *');
    for (const el of els) {
      const t = normalizeText(el.textContent);
      if (!/pac number/i.test(t) || !/\d{4,}/.test(t)) continue;
      const rec = parsePacFromText(el.textContent);
      if (rec) await storePac(rec);
    }
  }

  async function scanForPac() {
    for (const d of allDocuments()) await scanDocument(d);
  }

  // ============================================================
  // STORAGE HELPERS
  // ============================================================

  function getAutoTask() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ autoTask: null }, (res) => resolve(res.autoTask));
    });
  }

  function setAutoTask(patch) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ autoTask: null }, (res) => {
        const cur = res.autoTask || {};
        chrome.storage.local.set({ autoTask: Object.assign({}, cur, patch) }, resolve);
      });
    });
  }

  function getRecordCount() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ pacRecords: [] }, (res) => resolve((res.pacRecords || []).length));
    });
  }

  // ============================================================
  // OVERLAY
  // ============================================================

  function ensureOverlay(interactive) {
    let d = document.getElementById('pacAutoOverlay');
    if (d) return d;
    d = document.createElement('div');
    d.id = 'pacAutoOverlay';
    d.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999999;background:#1a1a2e;color:#fff;font:13px/1.4 Arial,sans-serif;padding:14px 16px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.45);max-width:320px;text-align:left;';
    if (interactive) {
      d.innerHTML =
        '<div style="font-weight:700;margin-bottom:6px;">PAC Auto-Generate</div>' +
        '<div id="pacAutoProgress" style="margin-bottom:6px;"></div>' +
        '<div id="pacAutoStatus" style="margin-bottom:8px;color:#ccc;white-space:pre-line;"></div>' +
        '<div style="display:flex;gap:8px;">' +
        '<button id="pacAutoStop" style="flex:1;cursor:pointer;padding:6px 8px;background:#fff;color:#111;border:1px solid #888;border-radius:4px;font:bold 13px Arial,sans-serif;line-height:1;">Stop</button>' +
        '<button id="pacAutoRetry" style="flex:1;cursor:pointer;padding:6px 8px;background:#fff;color:#111;border:1px solid #888;border-radius:4px;font:bold 13px Arial,sans-serif;line-height:1;display:none;">Retry</button>' +
        '</div>';
      d.querySelector('#pacAutoStop').addEventListener('click', stopAutoTask);
      d.querySelector('#pacAutoRetry').addEventListener('click', () => {
        d.querySelector('#pacAutoRetry').style.display = 'none';
        runIteration();
      });
    } else {
      d.innerHTML =
        '<div style="font-weight:700;margin-bottom:6px;">PAC Auto-Generate</div>' +
        '<div id="pacAutoProgress" style="margin-bottom:6px;"></div>' +
        '<div id="pacAutoStatus" style="margin-bottom:8px;color:#ccc;white-space:pre-line;"></div>';
    }
    document.body.appendChild(d);
    return d;
  }

  function removeOverlay() {
    const d = document.getElementById('pacAutoOverlay');
    if (d) d.remove();
  }

  function updateOverlay(progress, status) {
    ensureOverlay(true);
    const p = document.getElementById('pacAutoProgress');
    const s = document.getElementById('pacAutoStatus');
    if (p) p.textContent = progress;
    if (s) s.textContent = status;
  }

  // Display-only panel for frames that are not the driver (top) frame.
  function showDisplay(task) {
    ensureOverlay(false);
    const p = document.getElementById('pacAutoProgress');
    const s = document.getElementById('pacAutoStatus');
    if (p) p.textContent = task && task.active ? 'Code ' + (task.done + 1) + ' of ' + task.total : '';
    if (s) s.textContent = task && task.active ? 'Status: ' + task.status : '';
  }

  function showRetry(message) {
    ensureOverlay(true);
    const btn = document.getElementById('pacAutoRetry');
    if (btn) btn.style.display = 'block';
    updateOverlay('', message || 'Click Retry.');
  }

  // ============================================================
  // FORM INTERACTION
  // ============================================================

  function findConsentCheckbox() {
    const candidates = [];
    const disabledCandidates = [];
    for (const d of allDocuments()) {
      const boxes = Array.from(d.querySelectorAll('input[type="checkbox"]')).filter((c) => !c.checked);
      for (const b of boxes) {
        let label = '';
        const parentLabel = b.closest('label');
        if (parentLabel) label += parentLabel.innerText;
        if (b.id) {
          const forLabel = d.querySelector('label[for="' + b.id + '"]');
          if (forLabel) label += forLabel.innerText;
        }
        if (b.parentElement) label += b.parentElement.innerText;
        const target = b.disabled ? disabledCandidates : candidates;
        if (/consent|agree|accept|concern|confirm|declaration|terms|proceed/i.test(label)) return b;
        target.push(b);
      }
      const radios = Array.from(d.querySelectorAll('input[type="radio"]')).filter((r) => !r.checked);
      for (const r of radios) {
        const label = (r.closest('label') ? r.closest('label').innerText : '') + (r.parentElement ? r.parentElement.innerText : '');
        if (/consent|agree|accept|concern|confirm|declaration|terms|proceed/i.test(label)) return r;
      }
    }
    if (candidates.length) return candidates[0];
    if (disabledCandidates.length) return disabledCandidates[0];
    return null;
  }

  function consentDiagnostics() {
    const parts = [];
    for (const d of allDocuments()) {
      const boxes = Array.from(d.querySelectorAll('input[type="checkbox"]'));
      for (const b of boxes) {
        let label = '';
        const parentLabel = b.closest('label');
        if (parentLabel) label += parentLabel.innerText;
        if (b.id) {
          const forLabel = d.querySelector('label[for="' + b.id + '"]');
          if (forLabel) label += forLabel.innerText;
        }
        parts.push((b.checked ? 'checked ' : '') + (b.disabled ? 'disabled ' : '') + normalizeText(label).slice(0, 30) || '(no label)');
      }
    }
    return parts.slice(0, 10).join(' | ') || 'none';
  }

  function tickConsent(box) {
    const b = box || findConsentCheckbox();
    if (!b) return false;
    try {
      if (b.disabled) {
        b.removeAttribute('disabled');
        b.disabled = false;
      }
      if (!b.checked) {
        try { b.click(); } catch (e) {}
        if (!b.checked) {
          // Some frameworks ignore a synthetic click - force the state + events.
          b.checked = true;
          b.dispatchEvent(new Event('change', { bubbles: true }));
          b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      }
      return b.checked;
    } catch (e) {
      return false;
    }
  }

  function collectButtonTexts() {
    const out = [];
    for (const d of allDocuments()) {
      const els = Array.from(d.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'));
      for (const el of els) {
        const t = normalizeText(el.innerText || el.value || el.textContent || '').slice(0, 40);
        if (t) out.push(t + (el.disabled ? ' (disabled)' : ''));
      }
    }
    return out.slice(0, 12);
  }

  function findPayButton() {
    const found = [];
    for (const d of allDocuments()) {
      const els = Array.from(d.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'));
      for (const el of els) {
        const t = normalizeText(el.innerText || el.value || el.textContent || '');
        if (/pay\s*(?:rs\.?|inr|\u20b9)?\s*:?\s*75/i.test(t)) {
          let visible = false;
          try { visible = el.offsetParent !== null || (el.getBoundingClientRect().width + el.getBoundingClientRect().height) > 0; } catch (e) { visible = false; }
          if (visible) found.push(el);
        }
      }
    }
    if (!found.length) return null;
    return found.find((el) => !el.disabled) || found[0];
  }

  // ============================================================
  // AUTO-GENERATE LOOP
  // ============================================================

  window.__pacAutoRunning = window.__pacAutoRunning || false;

  async function waitForConsent() {
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const task = await getAutoTask();
      if (!task || !task.active) { removeOverlay(); return null; }
      const box = findConsentCheckbox();
      if (box) return box;
      await delay(1000);
    }
    return null;
  }

  async function waitForPay() {
    const deadline = Date.now() + 60000;
    let lastBtn = null;
    while (Date.now() < deadline) {
      const task = await getAutoTask();
      if (!task || !task.active) { removeOverlay(); return null; }
      const btn = findPayButton();
      if (btn && !btn.disabled) return btn;
      if (btn) lastBtn = btn;
      await delay(1000);
    }
    // The page's own countdown is broken (countdownSeconds error) and may keep
    // the Pay button disabled forever - force-enable it as a best effort.
    if (lastBtn) {
      try {
        lastBtn.disabled = false;
        console.log('CSC PAC Auto: Pay button was stuck disabled, forced enabled');
        return lastBtn;
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  async function runIteration() {
    if (window.__pacAutoRunning) return;
    window.__pacAutoRunning = true;
    try {
      const task = await getAutoTask();
      if (!task || !task.active) { removeOverlay(); return; }
      const total = task.total || 0;
      const idx = task.done + 1;
      if (idx > total) {
        await setAutoTask({ status: 'done' });
        ensureOverlay(true);
        updateOverlay(total + ' of ' + total + ' codes', 'Done! Downloading Excel...');
        return;
      }
      ensureOverlay();

      await setAutoTask({ status: 'filling', current: idx });
      updateOverlay('Code ' + idx + ' of ' + total, 'Filling form...');
      console.log('CSC PAC Auto: iteration', idx, 'of', total, 'url:', location.href);

      fillAllEverywhere(task.fields || {});
      await delay(1000);

      const consentBox = await waitForConsent();
      const afterConsent = await getAutoTask();
      if (!afterConsent || !afterConsent.active) return; // stopped
      if (!consentBox) {
        await setAutoTask({ status: 'waiting_retry' });
        showRetry('ERROR: consent checkbox not found.\nCheckboxes seen: ' + consentDiagnostics().slice(0, 350) + '\nClick Retry.');
        return;
      }
      const ticked = tickConsent(consentBox);
      console.log('CSC PAC Auto: consent ticked:', ticked, 'checked:', !!consentBox.checked);
      if (!ticked) {
        await setAutoTask({ status: 'waiting_retry' });
        showRetry('ERROR: could not tick the consent checkbox.\nCheckboxes seen: ' + consentDiagnostics().slice(0, 350) + '\nClick Retry.');
        return;
      }
      await delay(700);

      const payBtn = await waitForPay();
      const afterPay = await getAutoTask();
      if (!afterPay || !afterPay.active) return; // stopped
      if (!payBtn) {
        await setAutoTask({ status: 'waiting_retry' });
        const btns = collectButtonTexts().join(' | ');
        showRetry('ERROR: "Pay 75" button not found.\nButtons seen: ' + (btns || 'none').slice(0, 350) + '\nClick Retry.');
        return;
      }

      await setAutoTask({ status: 'waiting_response' });
      updateOverlay('Code ' + idx + ' of ' + total, 'Paid. Waiting for response...');
      const base = await getRecordCount();
      payBtn.click();
      console.log('CSC PAC Auto: Pay 75 clicked');

      const captured = await waitForResponse(base);
      if (captured) await markCapturedAndAdvance();
    } catch (err) {
      console.error('CSC PAC Autofill error:', err);
      showRetry('Unexpected error: ' + (err && err.message ? err.message : err) + '\nClick Retry.');
    } finally {
      window.__pacAutoRunning = false;
    }
  }

  async function waitForResponse(base) {
    const started = Date.now();
    while (Date.now() - started < 90000) {
      const task = await getAutoTask();
      if (!task || !task.active) { removeOverlay(); return false; }
      await scanForPac();
      const count = await getRecordCount();
      if (count > base) {
        // let the final record fully commit to storage before returning
        await scanForPac();
        await delay(1000);
        return true;
      }
      await delay(800);
    }
    await setAutoTask({ status: 'waiting_retry' });
    showRetry('Timeout waiting for response.\nClick Retry.');
    return false;
  }

  async function markCapturedAndAdvance() {
    const task = await getAutoTask();
    if (!task) return;
    const done = task.done + 1;
    const total = task.total || 0;
    await setAutoTask({ done, status: 'reloading' });
    updateOverlay(done + ' of ' + total + ' codes', 'Captured code ' + done + '.');
    console.log('CSC PAC Auto: captured', done, 'of', total);
    await delay(1500);
    if (done >= total) {
      // Final scan so every code is committed before the CSV is generated.
      await scanForPac();
      await delay(1200);
      await setAutoTask({ done, status: 'done' });
      updateOverlay(done + ' of ' + total + ' codes', 'Done! Downloading Excel...');
    } else {
      console.log('CSC PAC Auto: going to PAC Generation form for next code...');
      if (location.href === PAC_GENERATE_URL) {
        location.reload();
      } else {
        location.href = PAC_GENERATE_URL;
      }
    }
  }

  function stopAutoTask() {
    chrome.storage.local.set({
      autoTask: { active: false, status: 'idle', total: 0, done: 0, current: 0, fields: {} }
    });
    removeOverlay();
  }

  async function resumeWait() {
    const base = await getRecordCount();
    const ok = await waitForResponse(base);
    if (ok) await markCapturedAndAdvance();
  }

  function handleTask(task) {
    if (!task || !task.active) return;
    if (window.top !== window.self) {
      // Non-driver frame: mirror a display-only panel so the user can see progress
      // even when the visible content lives inside an iframe.
      showDisplay(task);
      return;
    }
    if (task.status === 'done' || task.status === 'idle') return;

    console.log('CSC PAC Auto: handleTask, status=' + task.status + ', done=' + task.done + '/' + task.total + ', url=' + location.href);
    ensureOverlay(true);
    if (task.status === 'waiting_retry') {
      showRetry('Code ' + (task.done + 1) + ' of ' + task.total + '.\nClick Retry to continue.');
      return;
    }
    if (task.status === 'waiting_response') {
      // page refreshed mid-wait: never re-click Pay. Brief check, then Retry.
      setTimeout(resumeWait, 1500);
      return;
    }
    // 'filling' or 'reloading' -> start next iteration
    setTimeout(runIteration, 1000);
  }

  function driverInit() {
    chrome.storage.local.get({ autoTask: null }, (res) => {
      if (res.autoTask && res.autoTask.active) handleTask(res.autoTask);
    });
  }

  // Auto-start when the popup saves a new task (works even if messaging/injection fails).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.autoTask) return;
    const t = changes.autoTask.newValue;
    if (!t || !t.active) {
      removeOverlay();
      return;
    }
    if (window.top !== window.self) {
      showDisplay(t);
      return;
    }
    // Only react to a fresh start from the popup; ignore the content script's own
    // status writes ('reloading' resumes via driverInit after the actual reload).
    if (t.active && t.status === 'filling' && t.current === 0 && t.done === 0) {
      setTimeout(() => handleTask(t), 300);
    } else if (t.status !== 'idle') {
      showDisplay(t);
    }
  });

  // ============================================================
  // WATCHERS & MESSAGE HANDLERS
  // ============================================================

  let scanTimer = null;
  const pacObserver = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanForPac, 700);
  });
  if (document.body) {
    pacObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  setTimeout(scanForPac, 1200);
  setInterval(scanForPac, 3000);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;
    if (message.action === 'fillFields') {
      const data = message.data || {};
      const res = fillAllEverywhere(data);
      sendResponse({ status: 'client:' + res.client + ', customer:' + res.customer + ', pin:' + res.pin });
    } else if (message.action === 'startAuto') {
      const payload = message.task || null;
      if (payload) {
        chrome.storage.local.set({ autoTask: payload }, () => setTimeout(runIteration, 500));
      } else {
        setTimeout(runIteration, 500);
      }
      sendResponse({ ok: true });
    } else if (message.action === 'stopAuto') {
      stopAutoTask();
      sendResponse({ ok: true });
    } else if (message.action === 'scanPacNow') {
      scanForPac();
      sendResponse({ ok: true });
    }
  });

  // Auto-fill on page load from saved values
  chrome.storage.local.get(['clientId', 'customer', 'pin'], (vals) => {
    const data = { clientId: vals.clientId || '', customer: vals.customer || '', pin: vals.pin || '' };
    if (data.clientId || data.customer || data.pin) {
      setTimeout(() => {
        const result = fillAllEverywhere(data);
        console.log('CSC PAC Autofill auto attempt:', result);
      }, 900);
    }
  });

  driverInit();
})();

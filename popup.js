// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const clientIdInput = document.getElementById('clientId');
  const customerInput = document.getElementById('customer');
  const pinInput = document.getElementById('pin');
  const applyBtn = document.getElementById('applyBtn');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');

  // Load saved
  chrome.storage.local.get(['clientId','customer','pin'], (res) => {
    if (res.clientId) clientIdInput.value = res.clientId;
    if (res.customer) customerInput.value = res.customer;
    if (res.pin) pinInput.value = res.pin;
  });

  // Save values
  saveBtn.addEventListener('click', () => {
    const payload = {
      clientId: clientIdInput.value || '',
      customer: customerInput.value || '',
      pin: pinInput.value || ''
    };
    chrome.storage.local.set(payload, () => {
      alert('Saved locally.');
    });
  });

  // Clear saved
  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['clientId','customer','pin'], () => {
      clientIdInput.value = '';
      customerInput.value = '';
      pinInput.value = '';
      alert('Cleared saved values.');
    });
  });

  // Send values to content script on active tab
  applyBtn.addEventListener('click', async () => {
    const payload = {
      clientId: clientIdInput.value || '',
      customer: customerInput.value || '',
      pin: pinInput.value || ''
    };

    // Save automatically too
    chrome.storage.local.set(payload);

    // Get active tab
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      alert('No active tab found.');
      return;
    }

    // Ensure host is within allowed domain
    const url = tab.url || '';
    if (!url.startsWith('https://digitalseva.csc.gov.in/')) {
      if (!confirm('Active tab is not on digitalseva.csc.gov.in. Continue sending anyway?')) return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'fillFields', data: payload }, (resp) => {
      if (chrome.runtime.lastError) {
        alert('Could not contact content script on this page. Make sure the page is open and matches the host permissions.');
      } else {
        alert(resp && resp.status ? 'Fill attempted: ' + resp.status : 'Message sent.');
      }
    });
  });

  // ===== Auto-Generate =====
  const codeCountInput = document.getElementById('codeCount');
  const startAutoBtn = document.getElementById('startAutoBtn');
  const stopAutoBtn = document.getElementById('stopAutoBtn');

  const idleTask = { active: false, status: 'idle', total: 0, done: 0, current: 0, fields: {} };

  const autoStatus = document.getElementById('autoStatus');

  function refreshAutoStatus() {
    chrome.storage.local.get({ autoTask: null }, (res) => {
      const t = res.autoTask;
      if (t && t.active) {
        if (t.status === 'done') {
          autoStatus.textContent = 'Task: DONE - ' + t.total + ' of ' + t.total + ' codes (downloading)';
        } else {
          autoStatus.textContent = 'Task: RUNNING - code ' + (t.done + 1) + ' of ' + t.total + ' (status: ' + t.status + ')';
        }
        autoStatus.style.color = '#b58900';
      } else {
        autoStatus.textContent = 'Task: not running';
        autoStatus.style.color = '#0a7d1a';
      }
    });
  }
  refreshAutoStatus();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.autoTask) refreshAutoStatus();
  });

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  startAutoBtn.addEventListener('click', async () => {
    try {
      const count = parseInt(codeCountInput.value, 10);
      if (!count || count < 1) { alert('Enter a valid number of codes.'); return; }

      const fields = {
        clientId: clientIdInput.value || '',
        customer: customerInput.value || '',
        pin: pinInput.value || ''
      };
      if (!fields.clientId || !fields.customer || !fields.pin) {
        if (!confirm('Some fields are empty. Continue anyway?')) return;
      }
      chrome.storage.local.set(fields);

      const task = { active: true, total: count, done: 0, current: 0, status: 'filling', fields, startedAt: Date.now() };
      await chrome.storage.local.set({ autoTask: task });

      const tab = await getActiveTab();
      if (!tab) {
        chrome.storage.local.set({ autoTask: idleTask });
        alert('No active tab found. Open the Digital Seva page first, then press Start.');
        return;
      }
      const url = tab.url || '';
      if (!url.startsWith('https://digitalseva.csc.gov.in/')) {
        chrome.storage.local.set({ autoTask: idleTask });
        alert('The active tab is not on digitalseva.csc.gov.in.\n\nSwitch to the Digital Seva PAC page and refresh it (F5), then press Start again.');
        return;
      }

      // Inject a fresh driver into the tab and all its iframes - it reads autoTask
      // from storage and starts. Iframes mirror the progress panel.
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content_script.js']
      });
      // Also nudge the existing content script if present (harmless).
      chrome.tabs.sendMessage(tab.id, { action: 'startAuto', task }, () => {});
      alert('Auto-generate started for ' + count + ' code(s). Watch the panel on the page.');
    } catch (err) {
      alert('Error starting auto-generate: ' + err.message + '\n\nOpen the Digital Seva page first and refresh it (F5).');
    }
  });

  stopAutoBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ autoTask: idleTask });
    const tab = await getActiveTab();
    if (tab) {
      try { chrome.tabs.sendMessage(tab.id, { action: 'stopAuto' }, () => {}); } catch (e) {}
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content_script.js']
        });
      } catch (e) {}
    }
    alert('Auto-generate stopped.');
  });

  // ===== PAC Records / Export =====
  const recordCount = document.getElementById('recordCount');
  const exportBtn = document.getElementById('exportBtn');
  const clearRecordsBtn = document.getElementById('clearRecordsBtn');
  const scanBtn = document.getElementById('scanBtn');
  const debugOut = document.getElementById('debugOut');

  function refreshRecordCount() {
    chrome.storage.local.get({ pacRecords: [] }, (res) => {
      recordCount.textContent = (res.pacRecords || []).length;
    });
  }
  refreshRecordCount();

  function downloadCsv(records) {
    const header = ['Sl No','PAC Number','CSC Txn','Merchant Txn','State','Transaction Date','Transaction Status','Mobile','Captured At'];
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
    const lines = [header].concat(records.map((r) => [r.serial, r.pac, r.cscTxn, r.merchantTxn, r.state, r.txnDate, r.txnStatus, r.mobile, r.capturedAt]));
    const csv = lines.map((row) => row.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    exportBtn.textContent = 'Downloading...';
    exportBtn.disabled = true;

    try {
      if (chrome.downloads && chrome.downloads.download) {
        chrome.downloads.download({
          url: url,
          filename: 'csc_pac_codes.csv',
          conflictAction: 'overwrite',
          saveAs: false
        }, () => {
          if (chrome.runtime.lastError) {
            alert('Download failed: ' + chrome.runtime.lastError.message + '\n\nClose the CSV file in Excel if it is open, then try again.');
          }
          exportBtn.textContent = 'Export to Excel (CSV)';
          exportBtn.disabled = false;
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        });
        return;
      }
    } catch (e) {
      // fall through to anchor method
    }

    // Fallback: standard browser download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'csc_pac_codes.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      exportBtn.textContent = 'Export to Excel (CSV)';
      exportBtn.disabled = false;
      URL.revokeObjectURL(url);
    }, 1000);
  }

  exportBtn.addEventListener('click', () => {
    chrome.storage.local.get({ pacRecords: [] }, (res) => {
      const records = res.pacRecords || [];
      if (!records.length) { alert('No PAC records captured yet.'); return; }
      downloadCsv(records);
    });
  });

  clearRecordsBtn.addEventListener('click', () => {
    if (!confirm('Clear all captured PAC records?')) return;
    chrome.storage.local.set({ pacRecords: [] }, refreshRecordCount);
  });

  scanBtn.addEventListener('click', async () => {
    debugOut.style.display = 'block';
    debugOut.textContent = 'Scanning...';
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { debugOut.textContent = 'No active tab.'; return; }
    debugOut.textContent = 'Tab URL: ' + (tab.url || '(unknown)') + '\n';

    const parsePacInPage = () => {
      const norm = (s) => (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parse = (raw) => {
        const text = norm(raw);
        const m = text.match(/your pac number\s*[:=]?\s*(\d{4,})/i);
        if (!m) return null;
        const get = (label) => {
          const re = new RegExp(esc(label) + '\\s*:?\\s*([^\\s]+)', 'i');
          const r = text.match(re);
          return r ? r[1] : '';
        };
        return { pac: m[1], cscTxn: get('CSC Txn'), merchantTxn: get('Merchant Txn'), state: get('State'), txnDate: get('Transaction Date'), txnStatus: get('Transaction Status'), mobile: get('Mobile') };
      };
      const els = Array.from(document.querySelectorAll('body *'));
      const recs = [];
      let sample = '(No element contains "PAC Number" text.)';
      for (const el of els) {
        const t = norm(el.textContent);
        if (!/pac number/i.test(t) || !/\d{4,}/.test(t)) continue;
        sample = t.slice(0, 600);
        const r = parse(el.textContent);
        if (r) recs.push(r);
      }
      return { recs, sample, url: location.href };
    };

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: parsePacInPage
      });
      const frames = (results || []).map((r) => r && r.result).filter(Boolean);
      if (!frames.length) { debugOut.textContent += '(no frames responded)'; return; }

      let foundAny = false;
      for (const r of frames) {
        if (r.recs && r.recs.length) {
          foundAny = true;
          debugOut.textContent += 'Frame: ' + r.url + '\nParsed ' + r.recs.length + ' record(s):\n' + r.sample + '\n';
          chrome.storage.local.get({ pacRecords: [] }, (res) => {
            let arr = res.pacRecords || [];
            for (const rec of r.recs) {
              if (arr.some((x) => x.pac === rec.pac)) continue;
              arr.push({
                serial: arr.length + 1,
                pac: rec.pac,
                cscTxn: rec.cscTxn,
                merchantTxn: rec.merchantTxn,
                state: rec.state,
                txnDate: rec.txnDate,
                txnStatus: rec.txnStatus,
                mobile: rec.mobile,
                capturedAt: new Date().toLocaleString()
              });
            }
            chrome.storage.local.set({ pacRecords: arr }, refreshRecordCount);
          });
        }
      }
      if (!foundAny) {
        debugOut.textContent += 'No frame contains "PAC Number" text.\nFrames checked (' + frames.length + '):\n' + frames.map((f) => f.url).join('\n');
      }
    } catch (err) {
      debugOut.textContent += 'Script failed: ' + err.message;
    }
  });

  testBtn.addEventListener('click', async () => {
    debugOut.style.display = 'block';
    debugOut.textContent = 'Testing...';
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { debugOut.textContent = 'No active tab.'; return; }
    debugOut.textContent = 'Tab URL: ' + (tab.url || '(unknown)') + '\n';

    const probe = () => {      const q = (sel) => Array.from(document.querySelectorAll(sel));
      const fields = {
        client: q("input[id*='client' i], input[name*='client' i], input[placeholder*='client' i]").length,
        customer: q("input[id*='customer' i], input[name*='customer' i], input[placeholder*='customer' i]").length,
        pin: q("input[id*='pin' i], input[name*='pin' i], input[placeholder*='PIN' i], input[placeholder*='pin' i], input[type='password']").length
      };
      const consent = q("input[type='checkbox']").length;
      const buttons = q('button, a, input[type="submit"], input[type="button"]')
        .map((b) => (b.innerText || b.value || '').replace(/\s+/g, ' ').trim())
        .filter((t) => t && t.length < 30).slice(0, 15);
      const bodyText = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 400);
      const iframes = q('iframe').map((f) => f.src || '(no src)');
      return {
        url: location.href,
        top: window.top === window.self,
        hasV3: !!window.__pacAutoV3,
        bodyText,
        fields,
        consent,
        buttons,
        iframes,
        autoTask: null
      };
    };

    try {
      // First inject the current content_script.js so we can prove whether THIS
      // version on disk loads and runs (independent of the manifest copy).
      debugOut.textContent += 'Injecting current content_script.js...\n';
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content_script.js']
        });
        debugOut.textContent += 'Injection sent.\n';
      } catch (injErr) {
        debugOut.textContent += 'Injection FAILED: ' + injErr.message + '\n';
      }
      await new Promise((r) => setTimeout(r, 500));

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: probe
      });
      const frames = (results || []).map((r) => r && r.result).filter(Boolean);
      if (!frames.length) { debugOut.textContent += '(no frames responded)'; return; }
      for (const f of frames) {
        debugOut.textContent += '\n=== Frame: ' + f.url + ' ===\n' +
          'top frame: ' + f.top + ' | v3 driver: ' + (f.hasV3 ? 'YES' : 'NO') + '\n' +
          'fields -> client:' + f.fields.client + ' customer:' + f.fields.customer + ' pin:' + f.fields.pin + ' | consent checkboxes: ' + f.consent + '\n' +
          'iframes: ' + (f.iframes.join(', ') || 'none') + '\n' +
          'buttons: ' + (f.buttons.join(', ') || 'none') + '\n' +
          'text: ' + f.bodyText;
      }
      chrome.storage.local.get({ autoTask: null }, (res) => {
        const t = res.autoTask;
        debugOut.textContent += '\n=== Task ===\n' + (t && t.active ? (t.status === 'done' ? 'DONE - ' + t.total + ' of ' + t.total : 'RUNNING - code ' + (t.done + 1) + ' of ' + t.total + ' (status: ' + t.status + ')') : 'not running');
      });
    } catch (err) {
      debugOut.textContent += 'Script failed: ' + err.message;
    }
  });
});

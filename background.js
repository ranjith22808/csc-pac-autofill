// background.js
// Watches for auto-generate task completion and downloads the CSV automatically.

function buildCsv(records) {
  const header = ['Sl No','PAC Number','CSC Txn','Merchant Txn','State','Transaction Date','Transaction Status','Mobile','Captured At'];
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
  const lines = [header].concat(records.map((r) => [r.serial, r.pac, r.cscTxn, r.merchantTxn, r.state, r.txnDate, r.txnStatus, r.mobile, r.capturedAt]));
  return lines.map((row) => row.map(esc).join(',')).join('\r\n');
}

function downloadCsv(records) {
  const csv = buildCsv(records);
  const url = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + csv);
  if (!chrome.downloads || !chrome.downloads.download) {
    console.log('CSC PAC Autofill auto-download skipped: chrome.downloads not available. Use Export to Excel in the popup instead.');
    return;
  }
  chrome.downloads.download({
    url: url,
    filename: 'csc_pac_codes.csv',
    conflictAction: 'overwrite',
    saveAs: false
  }, (id) => {
    if (chrome.runtime.lastError) {
      console.log('CSC PAC Autofill auto-download failed:', chrome.runtime.lastError.message);
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const task = changes.autoTask;
  if (!task) return;
  const newTask = task.newValue;
  if (newTask && newTask.status === 'done') {
    chrome.storage.local.get({ pacRecords: [] }, (res) => {
      const records = res.pacRecords || [];
      if (records.length) {
        downloadCsv(records);
        // reset task so a future run starts clean
        chrome.storage.local.set({
          autoTask: { active: false, status: 'idle', total: 0, done: 0, current: 0 }
        });
      }
    });
  }
});

// Re-inject the current content script on every Digital Seva page load, so the
// driver always resumes after the between-codes navigation even if the manifest
// copy on the page is stale.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;
  const url = (tab && tab.url) || '';
  if (!url.startsWith('https://digitalseva.csc.gov.in/')) return;
  chrome.scripting
    .executeScript({ target: { tabId, allFrames: true }, files: ['content_script.js'] })
    .catch(() => {});
});

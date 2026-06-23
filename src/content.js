(function () {
  'use strict';

  if (window.top !== window.self) return;
  if (document.getElementById('cpt-notifier-badge')) return;

  // --- Badge UI ---

  const badge = document.createElement('div');
  badge.id = 'cpt-notifier-badge';
  badge.innerHTML = `
    <div style="font-weight:bold;margin-bottom:6px;font-size:13px;">Canvas Power Tools</div>
    <div style="font-size:11px;color:#888;margin-bottom:6px;">New activity detected</div>
    <div id="cpt-notifier-list" style="font-size:12px;max-height:160px;overflow-y:auto;"></div>
    <button id="cpt-notifier-clear" style="margin-top:10px;width:100%;padding:4px;font-size:11px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f5f5f5;">Dismiss</button>
  `;
  Object.assign(badge.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#ffffff',
    color: '#333',
    padding: '14px',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    zIndex: '2147483647',
    fontFamily: 'sans-serif',
    width: '260px',
    display: 'none',
    borderLeft: '5px solid #E02229',
  });
  document.body.appendChild(badge);

  document.getElementById('cpt-notifier-clear').addEventListener('click', () => {
    badge.style.display = 'none';
  });

  // --- Activity fetch ---

  async function pollActivity() {
    const settings = await getSettings();
    if (!settings.notificationsEnabled) return;

    let data;
    try {
      const res = await fetch('/api/v1/users/self/activity_stream?per_page=50');
      if (!res.ok) return;
      data = await res.json();
    } catch {
      return;
    }

    const storageKey = 'cpt_seen_ids';
    const stored = localStorage.getItem(storageKey);
    let knownIds = stored ? JSON.parse(stored) : null;
    const isFirstRun = knownIds === null;
    if (isFirstRun) knownIds = [];

    const newItems = [];
    data.forEach((item) => {
      if (!knownIds.includes(item.id)) {
        newItems.push(item);
        knownIds.push(item.id);
      }
    });

    // Keep stored list from growing unbounded
    if (knownIds.length > 500) knownIds = knownIds.slice(-500);
    localStorage.setItem(storageKey, JSON.stringify(knownIds));

    if (isFirstRun || newItems.length === 0) return;

    const list = document.getElementById('cpt-notifier-list');
    list.innerHTML = newItems
      .map((item) => {
        const title = item.title || item.type || 'New item';
        const course = item.context_name ? `<span style="color:#888">${item.context_name}</span>` : '';
        return `<div style="padding:4px 0;border-bottom:1px solid #eee;">&bull; ${title}${course ? ' &mdash; ' + course : ''}</div>`;
      })
      .join('');
    badge.style.display = 'block';
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        { notificationsEnabled: true, pollInterval: 1 },
        resolve
      );
    });
  }

  // --- Message listener (triggered by background alarm) ---

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'POLL_ACTIVITY') pollActivity();
  });

  // Run once immediately on page load
  pollActivity();
})();

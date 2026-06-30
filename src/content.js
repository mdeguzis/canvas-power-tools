(function () {
  'use strict';

  if (window.top !== window.self) return;
  if (document.getElementById('cpt-notifier-badge')) return;

  console.log('[CPT] content script loaded', window.location.href);

  let debugMode = true;
  const LOG = (...args) => { if (debugMode) console.log('[CPT]', ...args); };

  // --- Styles (pill color set via CSS variable after settings load) ---

  const style = document.createElement('style');
  style.textContent = `
    .cpt-new-pill {
      background: var(--cpt-pill-bg, #b45309);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 10px;
      z-index: 10;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.55);
      border: 2px solid rgba(0,0,0,0.35);
      user-select: none;
    }
    .cpt-new-pill:hover { filter: brightness(0.88); }

    #cpt-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1e293b;
      color: #f8fafc;
      padding: 12px 14px 12px 16px;
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.35);
      z-index: 2147483647;
      display: none;
      width: 280px;
      border-left: 4px solid var(--cpt-pill-bg, #b45309);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
    }
    #cpt-toast-title { font-weight: 700; margin-bottom: 3px; font-size: 13px; }
    #cpt-toast-body { font-size: 12px; color: #cbd5e1; line-height: 1.4; }
    #cpt-toast-close {
      position: absolute; top: 8px; right: 10px;
      background: none; border: none; color: #94a3b8;
      font-size: 16px; cursor: pointer; line-height: 1; padding: 0;
    }
    #cpt-toast-close:hover { color: #f8fafc; }

    #cpt-popover {
      position: fixed;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      z-index: 2147483647;
      display: none;
      width: 310px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #111;
    }
    .cpt-pop-header {
      padding: 10px 14px 8px;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      border-bottom: 1px solid #f0f0f0;
    }
    .cpt-pop-list { max-height: 210px; overflow-y: auto; padding: 4px 0; }
    .cpt-pop-item {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 6px 14px; cursor: pointer; line-height: 1.35;
    }
    .cpt-pop-item:hover { background: #f9fafb; }
    .cpt-pop-item input[type="checkbox"] { margin-top: 2px; flex-shrink: 0; cursor: pointer; }
    .cpt-pop-item span { cursor: pointer; }
    .cpt-pop-footer {
      padding: 8px 14px; border-top: 1px solid #f0f0f0;
      display: flex; gap: 8px; justify-content: flex-end;
    }
    .cpt-pop-btn {
      padding: 5px 11px; border-radius: 5px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #374151;
    }
    .cpt-pop-btn:hover { background: #f3f4f6; }
    .cpt-pop-btn-primary {
      background: var(--cpt-pill-bg, #b45309);
      color: #fff;
      border-color: var(--cpt-pill-bg, #b45309);
    }
    .cpt-pop-btn-primary:hover { filter: brightness(0.88); }
  `;
  document.head.appendChild(style);

  // --- Activity notification badge ---

  const badge = document.createElement('div');
  badge.id = 'cpt-notifier-badge';
  badge.innerHTML = `
    <div style="font-weight:bold;margin-bottom:6px;font-size:13px;">Canvas Power Tools</div>
    <div style="font-size:11px;color:#888;margin-bottom:6px;">New activity detected</div>
    <div id="cpt-notifier-list" style="font-size:12px;max-height:160px;overflow-y:auto;"></div>
    <button id="cpt-notifier-clear" style="margin-top:10px;width:100%;padding:4px;font-size:11px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f5f5f5;">Dismiss</button>
  `;
  Object.assign(badge.style, {
    position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#ffffff',
    color: '#333', padding: '14px', borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: '2147483647',
    fontFamily: 'sans-serif', width: '260px', display: 'none',
    borderLeft: '5px solid #2563EB',
  });
  document.body.appendChild(badge);
  document.getElementById('cpt-notifier-clear').addEventListener('click', () => {
    badge.style.display = 'none';
  });

  // --- Toast ---

  const toast = document.createElement('div');
  toast.id = 'cpt-toast';
  toast.innerHTML = `
    <button id="cpt-toast-close">&times;</button>
    <div id="cpt-toast-title">New modules for courses:</div>
    <div id="cpt-toast-body"></div>
  `;
  document.body.appendChild(toast);
  document.getElementById('cpt-toast-close').addEventListener('click', () => {
    toast.style.display = 'none';
  });

  let toastTimer = null;
  function showToast(lines) {
    document.getElementById('cpt-toast-body').innerHTML =
      lines.map(l => `<span style="display:block;padding-top:2px">• ${escHtml(l)}</span>`).join('');
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 6000);
  }

  // --- Module popover ---

  const popover = document.createElement('div');
  popover.id = 'cpt-popover';
  document.body.appendChild(popover);

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function markModuleIds(courseId, moduleIds, pill) {
    const stored = localStorage.getItem('cpt_seen_modules');
    const seenMap = stored ? JSON.parse(stored) : {};
    seenMap[courseId] = [...new Set([...(seenMap[courseId] || []), ...moduleIds])];
    localStorage.setItem('cpt_seen_modules', JSON.stringify(seenMap));

    const allModules = JSON.parse(pill.dataset.modules || '[]');
    const remaining = allModules.filter(m => !moduleIds.includes(m.id));
    if (remaining.length === 0) {
      pill.remove();
    } else {
      pill.dataset.modules = JSON.stringify(remaining);
      pill.textContent = remaining.length === 1 ? 'New module (1)' : `New modules (${remaining.length})`;
    }
    updateBadge();
  }

  function showPopover(pill, e) {
    e.stopPropagation();
    const courseId = pill.dataset.courseId;
    const modules = JSON.parse(pill.dataset.modules || '[]');

    popover.innerHTML = `
      <div class="cpt-pop-header">New Modules</div>
      <div class="cpt-pop-list">
        ${modules.map(m => `
          <label class="cpt-pop-item">
            <input type="checkbox" value="${m.id}" />
            <span>${escHtml(m.name)}</span>
          </label>
        `).join('')}
      </div>
      <div class="cpt-pop-footer">
        <button class="cpt-pop-btn" id="cpt-mark-selected">Mark selected as read</button>
        <button class="cpt-pop-btn cpt-pop-btn-primary" id="cpt-mark-all">Mark all as read</button>
      </div>
    `;

    const rect = pill.getBoundingClientRect();
    popover.style.display = 'block';
    popover.style.left = rect.left + 'px';
    popover.style.top = (rect.bottom + 6) + 'px';

    const pr = popover.getBoundingClientRect();
    if (pr.right > window.innerWidth - 8)
      popover.style.left = Math.max(8, window.innerWidth - pr.width - 8) + 'px';
    if (pr.bottom > window.innerHeight - 8)
      popover.style.top = (rect.top - pr.height - 6) + 'px';

    document.getElementById('cpt-mark-selected').addEventListener('click', () => {
      const checked = [...popover.querySelectorAll('input:checked')].map(i => parseInt(i.value));
      if (checked.length === 0) return;
      markModuleIds(courseId, checked, pill);
      popover.style.display = 'none';
    });
    document.getElementById('cpt-mark-all').addEventListener('click', () => {
      markModuleIds(courseId, modules.map(m => m.id), pill);
      popover.style.display = 'none';
    });
  }

  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target)) popover.style.display = 'none';
  });

  // --- Badge count ---

  function updateBadge() {
    const count = document.querySelectorAll('.cpt-new-pill').length;
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--cpt-pill-bg').trim() || '#b45309';
    chrome.runtime.sendMessage({ type: 'SET_BADGE', count, color }).catch(() => {});
  }

  // --- Track right-clicked course for native context menu ---

  let contextMenuCourseId = null;
  document.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.ic-DashboardCard')
      || e.target.closest('[class*="DashboardCard"]');
    if (!card) { contextMenuCourseId = null; return; }
    const link = card.querySelector('a[href*="/courses/"]');
    if (!link) { contextMenuCourseId = null; return; }
    const match = link.getAttribute('href').match(/\/courses\/(\d+)/);
    contextMenuCourseId = match ? match[1] : null;
  }, true);

  // --- Activity fetch ---

  async function pollActivity() {
    const settings = await getSettings();
    if (!settings.notificationsEnabled) return;
    let data;
    try {
      const res = await fetch('/api/v1/users/self/activity_stream?per_page=50');
      if (!res.ok) return;
      data = await res.json();
    } catch { return; }

    const storageKey = 'cpt_seen_ids';
    const stored = localStorage.getItem(storageKey);
    let knownIds = stored ? JSON.parse(stored) : null;
    const isFirstRun = knownIds === null;
    if (isFirstRun) knownIds = [];

    const newItems = [];
    data.forEach((item) => {
      if (!knownIds.includes(item.id)) { newItems.push(item); knownIds.push(item.id); }
    });
    if (knownIds.length > 500) knownIds = knownIds.slice(-500);
    localStorage.setItem(storageKey, JSON.stringify(knownIds));
    if (isFirstRun || newItems.length === 0) return;

    const list = document.getElementById('cpt-notifier-list');
    list.innerHTML = newItems.map((item) => {
      const title = item.title || item.type || 'New item';
      const course = item.context_name ? `<span style="color:#888">${item.context_name}</span>` : '';
      return `<div style="padding:4px 0;border-bottom:1px solid #eee;">&bull; ${title}${course ? ' &mdash; ' + course : ''}</div>`;
    }).join('');
    badge.style.display = 'block';
  }

  // --- Module tracker ---

  function waitForCards(timeoutMs) {
    return new Promise((resolve) => {
      const existing = document.querySelectorAll('.ic-DashboardCard');
      if (existing.length > 0) { LOG('cards found immediately:', existing.length); return resolve(existing); }
      LOG('waiting for cards...');
      const observer = new MutationObserver(() => {
        const found = document.querySelectorAll('.ic-DashboardCard');
        if (found.length > 0) { LOG('cards appeared:', found.length); observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        const final = document.querySelectorAll('.ic-DashboardCard');
        LOG('waitForCards timeout, found:', final.length);
        resolve(final);
      }, timeoutMs);
    });
  }

  function findCardElement(courseId) {
    const link = document.querySelector(`a[href*="/courses/${courseId}"]`);
    if (!link) return null;
    return link.closest('.ic-DashboardCard')
      || link.closest('[class*="DashboardCard"]')
      || link.closest('[class*="card"]')
      || link.parentElement?.parentElement?.parentElement
      || null;
  }

  async function checkNewModules(settings) {
    const path = window.location.pathname;
    if (path !== '/' && !path.startsWith('/dashboard')) return;

    await waitForCards(8000);

    let dashboardCourses;
    try {
      const res = await fetch('/api/v1/dashboard/dashboard_cards');
      if (!res.ok) { LOG('dashboard_cards fetch failed:', res.status); return; }
      dashboardCourses = await res.json();
      LOG('dashboard_cards:', dashboardCourses.length, 'courses');
    } catch (err) { LOG('dashboard_cards error:', err); return; }

    const stored = localStorage.getItem('cpt_seen_modules');
    const seenMap = stored ? JSON.parse(stored) : {};

    const toastLines = [];
    const metaUpdates = {};
    const nameUpdates = {};

    await Promise.all(dashboardCourses.map(async (course) => {
      const courseId = String(course.id);
      const card = findCardElement(courseId);
      if (!card || card.querySelector('.cpt-new-pill')) return;

      let modules;
      try {
        const res = await fetch(`/api/v1/courses/${courseId}/modules?per_page=100`);
        if (!res.ok) return;
        modules = await res.json();
      } catch { return; }

      if (!Array.isArray(modules)) return;

      LOG(`course ${courseId}: ${modules.length} modules:`, modules.map(m => m.name));
      const relevant = modules.filter(m => /module/i.test(m.name));
      LOG(`course ${courseId}: ${relevant.length} match /module/i:`, relevant.map(m => m.name));
      if (relevant.length === 0) return;

      metaUpdates[courseId] = relevant.map(m => ({ id: m.id, name: m.name }));
      nameUpdates[courseId] = course.shortName || course.name || courseId;

      const seenIds = seenMap[courseId] || [];
      const newOnes = relevant.filter(m => !seenIds.includes(m.id));
      LOG(`course ${courseId}: ${newOnes.length} new, ${seenIds.length} seen`);
      if (newOnes.length === 0) return;

      toastLines.push(`${course.shortName || courseId} (${newOnes.length})`);

      const pill = document.createElement('span');
      pill.className = 'cpt-new-pill';
      pill.textContent = newOnes.length === 1 ? 'New module (1)' : `New modules (${newOnes.length})`;
      pill.dataset.courseId = courseId;
      pill.dataset.modules = JSON.stringify(newOnes.map(m => ({ id: m.id, name: m.name })));
      pill.addEventListener('click', (e) => showPopover(pill, e));

      const hero = card.querySelector('.ic-DashboardCard__header_hero')
        || card.querySelector('.ic-DashboardCard__header');
      if (hero) {
        hero.style.position = 'relative';
        Object.assign(pill.style, { position: 'absolute', bottom: '8px', left: '8px' });
        hero.appendChild(pill);
      } else {
        const content = card.querySelector('.ic-DashboardCard__content') || card;
        pill.style.display = 'inline-block';
        content.insertBefore(pill, content.firstChild);
      }
    }));

    if (Object.keys(metaUpdates).length > 0) {
      const existingMeta = JSON.parse(localStorage.getItem('cpt_module_meta') || '{}');
      Object.assign(existingMeta, metaUpdates);
      localStorage.setItem('cpt_module_meta', JSON.stringify(existingMeta));
      const existingNames = JSON.parse(localStorage.getItem('cpt_course_names') || '{}');
      Object.assign(existingNames, nameUpdates);
      localStorage.setItem('cpt_course_names', JSON.stringify(existingNames));
    }

    updateBadge();

    if (settings.toastNotificationsEnabled !== false && toastLines.length > 0) {
      showToast(toastLines);
    }

    LOG('checkNewModules: complete');
  }

  function markAllCoursesUnread() {
    localStorage.removeItem('cpt_seen_modules');
    document.querySelectorAll('.cpt-new-pill').forEach(p => p.remove());
    updateBadge();
    getSettings().then(s => checkNewModules(s));
    LOG('markAllCoursesUnread: done');
  }

  function markCourseUnread(courseId) {
    const stored = localStorage.getItem('cpt_seen_modules');
    const seenMap = stored ? JSON.parse(stored) : {};
    delete seenMap[courseId];
    localStorage.setItem('cpt_seen_modules', JSON.stringify(seenMap));
    const card = findCardElement(courseId);
    if (card) card.querySelector('.cpt-new-pill')?.remove();
    getSettings().then(s => checkNewModules(s));
  }

  async function markModulesRead() {
    document.querySelectorAll('.cpt-new-pill').forEach(p => p.remove());
    updateBadge();
    let dashboardCourses;
    try {
      const res = await fetch('/api/v1/dashboard/dashboard_cards');
      if (!res.ok) return;
      dashboardCourses = await res.json();
    } catch { return; }

    const seenMap = {};
    await Promise.all(dashboardCourses.map(async (course) => {
      const courseId = String(course.id);
      try {
        const res = await fetch(`/api/v1/courses/${courseId}/modules?per_page=100`);
        if (!res.ok) return;
        const modules = await res.json();
        if (!Array.isArray(modules)) return;
        seenMap[courseId] = modules.filter(m => /module/i.test(m.name)).map(m => m.id);
      } catch { return; }
    }));

    localStorage.setItem('cpt_seen_modules', JSON.stringify(seenMap));
    LOG('markModulesRead: done');
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        notificationsEnabled: true,
        pollInterval: 1,
        pillColor: '#b45309',
        toastNotificationsEnabled: true,
        debugLogging: true,
      }, resolve);
    });
  }

  // --- Message listener ---

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'POLL_ACTIVITY') pollActivity();
    if (msg.type === 'MARK_MODULES_READ') markModulesRead();
    if (msg.type === 'CONTEXT_MARK_UNREAD' && contextMenuCourseId) markCourseUnread(contextMenuCourseId);
    if (msg.type === 'CONTEXT_MARK_ALL_UNREAD') markAllCoursesUnread();
    if (msg.type === 'GET_MODULE_STATE') {
      sendResponse({
        seenMap: JSON.parse(localStorage.getItem('cpt_seen_modules') || '{}'),
        moduleMeta: JSON.parse(localStorage.getItem('cpt_module_meta') || '{}'),
        courseNames: JSON.parse(localStorage.getItem('cpt_course_names') || '{}'),
      });
    }
    return true;
  });

  // --- Init ---

  getSettings().then((settings) => {
    debugMode = settings.debugLogging !== false;
    document.documentElement.style.setProperty('--cpt-pill-bg', settings.pillColor || '#b45309');
    pollActivity();
    checkNewModules(settings);
  });
})();

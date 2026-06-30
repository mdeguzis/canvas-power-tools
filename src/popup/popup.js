const manifest = chrome.runtime.getManifest();
document.getElementById('version').textContent = manifest.version;

const fields = {
  notificationsEnabled: document.getElementById('notificationsEnabled'),
  pollInterval: document.getElementById('pollInterval'),
  customDomain: document.getElementById('customDomain'),
  toastNotificationsEnabled: document.getElementById('toastNotificationsEnabled'),
  pillColor: document.getElementById('pillColor'),
  debugLogging: document.getElementById('debugLogging'),
};

chrome.storage.sync.get(
  {
    notificationsEnabled: true,
    pollInterval: 1,
    customDomain: '',
    toastNotificationsEnabled: true,
    pillColor: '#b45309',
    debugLogging: true,
  },
  (settings) => {
    fields.notificationsEnabled.checked = settings.notificationsEnabled;
    fields.pollInterval.value = settings.pollInterval;
    fields.customDomain.value = settings.customDomain;
    fields.toastNotificationsEnabled.checked = settings.toastNotificationsEnabled;
    fields.pillColor.value = settings.pillColor;
    fields.debugLogging.checked = settings.debugLogging;
  }
);

document.getElementById('save').addEventListener('click', () => {
  const newInterval = Math.max(1, Math.min(60, parseInt(fields.pollInterval.value, 10) || 1));
  const settings = {
    notificationsEnabled: fields.notificationsEnabled.checked,
    pollInterval: newInterval,
    customDomain: fields.customDomain.value.trim(),
    toastNotificationsEnabled: fields.toastNotificationsEnabled.checked,
    pillColor: fields.pillColor.value,
    debugLogging: fields.debugLogging.checked,
  };

  chrome.storage.sync.set(settings, () => {
    chrome.runtime.sendMessage({ type: 'RESCHEDULE_ALARM', intervalMinutes: newInterval });
    const msg = document.getElementById('saved-msg');
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 2000);
  });
});

document.getElementById('markModulesRead').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'MARK_MODULES_READ' }, () => {
        void chrome.runtime.lastError;
      });
    }
  });
  const msg = document.getElementById('modules-cleared-msg');
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2000);
});

document.getElementById('markModulesUnread').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'CONTEXT_MARK_ALL_UNREAD' }, () => {
        void chrome.runtime.lastError;
      });
    }
  });
  const msg = document.getElementById('modules-cleared-msg');
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2000);
});

// --- Module details panel ---

let currentFilter = 'unread';

document.getElementById('detailsToggle').addEventListener('click', () => {
  const panel = document.getElementById('moduleDetails');
  const chevron = document.getElementById('detailsChevron');
  const opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  chevron.classList.toggle('open', opening);
  if (opening) loadModuleDetails();
});

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    loadModuleDetails();
  });
});

function loadModuleDetails() {
  const list = document.getElementById('moduleDetailsList');
  list.innerHTML = '<div class="details-loading">Loading...</div>';
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      list.innerHTML = '<div class="details-loading">No active tab found.</div>';
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_MODULE_STATE' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        list.innerHTML = '<div class="details-loading">Open the Canvas dashboard first.</div>';
        return;
      }
      renderModuleDetails(response.seenMap, response.moduleMeta, response.courseNames);
    });
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderModuleDetails(seenMap, moduleMeta, courseNames) {
  const list = document.getElementById('moduleDetailsList');
  const courseIds = Object.keys(moduleMeta);

  if (courseIds.length === 0) {
    list.innerHTML = '<div class="details-loading">No data yet. Visit the Canvas dashboard first.</div>';
    return;
  }

  let html = '';
  courseIds.forEach((courseId) => {
    const allModules = moduleMeta[courseId] || [];
    const seenIds = seenMap[courseId] || [];
    const courseName = courseNames[courseId] || courseId;

    const shown = currentFilter === 'unread'
      ? allModules.filter((m) => !seenIds.includes(m.id))
      : currentFilter === 'read'
        ? allModules.filter((m) => seenIds.includes(m.id))
        : allModules;

    if (shown.length === 0) return;

    html += `<div class="details-course">`;
    html += `<div class="details-course-name">${escHtml(courseName)}</div>`;
    shown.forEach((m) => {
      const isUnread = !seenIds.includes(m.id);
      html += `<div class="details-module-row">
        <span class="details-module-name">${escHtml(m.name)}</span>
        <span class="details-module-status ${isUnread ? 'status-unread' : 'status-read'}">${isUnread ? 'Unread' : 'Read'}</span>
      </div>`;
    });
    html += `</div>`;
  });

  if (!html) {
    const label = currentFilter === 'all' ? '' : currentFilter + ' ';
    list.innerHTML = `<div class="details-loading">No ${label}modules found.</div>`;
  } else {
    list.innerHTML = html;
  }
}

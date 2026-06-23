const manifest = chrome.runtime.getManifest();
document.getElementById('version').textContent = manifest.version;

const fields = {
  notificationsEnabled: document.getElementById('notificationsEnabled'),
  pollInterval: document.getElementById('pollInterval'),
  customDomain: document.getElementById('customDomain'),
};

chrome.storage.sync.get(
  { notificationsEnabled: true, pollInterval: 1, customDomain: '' },
  (settings) => {
    fields.notificationsEnabled.checked = settings.notificationsEnabled;
    fields.pollInterval.value = settings.pollInterval;
    fields.customDomain.value = settings.customDomain;
  }
);

document.getElementById('save').addEventListener('click', () => {
  const newInterval = Math.max(1, Math.min(60, parseInt(fields.pollInterval.value, 10) || 1));
  const settings = {
    notificationsEnabled: fields.notificationsEnabled.checked,
    pollInterval: newInterval,
    customDomain: fields.customDomain.value.trim(),
  };

  chrome.storage.sync.set(settings, () => {
    chrome.runtime.sendMessage({ type: 'RESCHEDULE_ALARM', intervalMinutes: newInterval });
    const msg = document.getElementById('saved-msg');
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 2000);
  });
});

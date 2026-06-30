const ALARM_NAME = 'canvas-activity-poll';
const DEFAULT_INTERVAL_MINUTES = 1;

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'cpt-parent',
      title: 'Canvas Power Tools',
      contexts: ['all'],
      documentUrlPatterns: ['https://*.instructure.com/*'],
    });
    chrome.contextMenus.create({
      id: 'cpt-mark-unread',
      parentId: 'cpt-parent',
      title: 'Mark this course as unread',
      contexts: ['all'],
    });
    chrome.contextMenus.create({
      id: 'cpt-mark-all-unread',
      parentId: 'cpt-parent',
      title: 'Mark all courses as unread',
      contexts: ['all'],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ pollInterval: DEFAULT_INTERVAL_MINUTES }, ({ pollInterval }) => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: pollInterval });
  });
  createContextMenus();
});

// Recreate menus when the service worker restarts (handles dev reloads)
chrome.runtime.onStartup.addListener(createContextMenus);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    chrome.tabs.query({ url: ['https://*.instructure.com/*'] }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: 'POLL_ACTIVITY' }).catch(() => {});
      });
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'cpt-mark-unread') {
    chrome.tabs.sendMessage(tab.id, { type: 'CONTEXT_MARK_UNREAD' }).catch(() => {});
  }
  if (info.menuItemId === 'cpt-mark-all-unread') {
    chrome.tabs.sendMessage(tab.id, { type: 'CONTEXT_MARK_ALL_UNREAD' }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RESCHEDULE_ALARM') {
    chrome.alarms.clear(ALARM_NAME, () => {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: msg.intervalMinutes });
    });
  }
  if (msg.type === 'SET_BADGE') {
    const text = msg.count > 0 ? String(msg.count) : '';
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: msg.color || '#b45309' });
  }
});

const ALARM_NAME = 'canvas-activity-poll';
const DEFAULT_INTERVAL_MINUTES = 1;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ pollInterval: DEFAULT_INTERVAL_MINUTES }, ({ pollInterval }) => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: pollInterval });
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    chrome.tabs.query({ url: ['https://*.instructure.com/*', 'https://canvas.*.edu/*'] }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: 'POLL_ACTIVITY' }).catch(() => {});
      });
    });
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RESCHEDULE_ALARM') {
    chrome.alarms.clear(ALARM_NAME, () => {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: msg.intervalMinutes });
    });
  }
});

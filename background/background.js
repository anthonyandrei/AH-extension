import {
  rebuildAlarmsFromStorage,
  transitionArmedToWatching,
  performKeepalive,
} from '../popup/arming.js';
import {
  handleAlertRepeatAlarm,
  handleNotificationClick,
} from '../popup/reporting.js';

// Top-level service worker initialization (runs on cold start / wake-up)
rebuildAlarmsFromStorage({
  storageApi: chrome.storage.local,
  alarmsApi: chrome.alarms,
  actionApi: chrome.action,
}).catch((err) => {
  console.error('Failed to rebuild alarms on service worker startup:', err);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'vigil_start') {
    const { vigil, plan } = (await chrome.storage.local.get(['vigil', 'plan'])) || {};
    await transitionArmedToWatching({
      vigil,
      plan,
      storageApi: chrome.storage.local,
      alarmsApi: chrome.alarms,
      actionApi: chrome.action,
    });
  } else if (alarm.name === 'vigil_keepalive') {
    await performKeepalive();
  } else if (alarm.name === 'alert_repeat') {
    await handleAlertRepeatAlarm({
      storageApi: chrome.storage.local,
      notificationsApi: chrome.notifications,
      alarmsApi: chrome.alarms,
    });
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  await handleNotificationClick({
    notificationId,
    tabsApi: chrome.tabs,
    windowsApi: chrome.windows,
    actionApi: chrome.action,
    storageApi: chrome.storage.local,
    notificationsApi: chrome.notifications,
  });
});


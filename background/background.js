import {
  rebuildAlarmsFromStorage,
  transitionArmedToWatching,
  performKeepalive,
  checkSession,
} from '../popup/arming.js';
import {
  handleAlertRepeatAlarm,
  handleNotificationClick,
} from '../popup/reporting.js';
import {
  handleOwnedTabReload,
  handleStep2BoundReached,
  handleUnrecognisedAbort,
  handleLoggedOutSuspend,
  handleSessionProbe,
} from '../popup/tab-manager.js';
import {
  executePass,
  stopVigil,
} from '../popup/pass.js';

// Top-level service worker initialization (runs on cold start / wake-up)
rebuildAlarmsFromStorage({
  storageApi: chrome.storage.local,
  alarmsApi: chrome.alarms,
  actionApi: chrome.action,
  tabsApi: chrome.tabs,
  notificationsApi: chrome.notifications,
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
      tabsApi: chrome.tabs,
      notificationsApi: chrome.notifications,
    });
  } else if (alarm.name === 'vigil_keepalive') {
    await performKeepalive();
  } else if (alarm.name === 'alert_repeat') {
    await handleAlertRepeatAlarm({
      storageApi: chrome.storage.local,
      notificationsApi: chrome.notifications,
      alarmsApi: chrome.alarms,
    });
  } else if (alarm.name === 'owned_tab_reload') {
    await handleOwnedTabReload({
      tabsApi: chrome.tabs,
      storageApi: chrome.storage.local,
      alarmsApi: chrome.alarms,
    });
  } else if (alarm.name === 'vigil_pass') {
    await executePass({
      tabsApi: chrome.tabs,
      storageApi: chrome.storage.local,
      alarmsApi: chrome.alarms,
      actionApi: chrome.action,
      notificationsApi: chrome.notifications,
    });
  } else if (alarm.name === 'probe_session') {
    await handleSessionProbe({
      storageApi: chrome.storage.local,
      alarmsApi: chrome.alarms,
      actionApi: chrome.action,
      tabsApi: chrome.tabs,
      notificationsApi: chrome.notifications,
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

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const msgType = typeof message === 'string' ? message : message?.type;

    if (msgType === 'STEP2_BOUND_REACHED') {
      const tabId = sender?.tab?.id;
      handleStep2BoundReached({
        tabId,
        storageApi: chrome.storage.local,
        alarmsApi: chrome.alarms,
      })
        .then((res) => sendResponse({ success: true, ...res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (msgType === 'UNRECOGNISED_STATE') {
      handleUnrecognisedAbort({
        snapshot: message.snapshot || message.domSnapshot,
        storageApi: chrome.storage.local,
        actionApi: chrome.action,
        alarmsApi: chrome.alarms,
        notificationsApi: chrome.notifications,
      })
        .then((res) => sendResponse({ success: true, ...res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (msgType === 'LOGGED_OUT_STATE') {
      handleLoggedOutSuspend({
        storageApi: chrome.storage.local,
        actionApi: chrome.action,
        alarmsApi: chrome.alarms,
        notificationsApi: chrome.notifications,
        tabsApi: chrome.tabs,
      })
        .then((res) => sendResponse({ success: true, ...res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (msgType === 'RUN_PASS') {
      executePass({
        tabsApi: chrome.tabs,
        storageApi: chrome.storage.local,
        alarmsApi: chrome.alarms,
        actionApi: chrome.action,
        notificationsApi: chrome.notifications,
      })
        .then((res) => sendResponse({ success: true, ...res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (msgType === 'STOP_VIGIL') {
      stopVigil({
        storageApi: chrome.storage.local,
        alarmsApi: chrome.alarms,
        actionApi: chrome.action,
        notificationsApi: chrome.notifications,
      })
        .then((res) => sendResponse({ success: true, ...res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    return false;
  });
}



/**
 * Reporting module: badge updates, event ledger, notifications, and pass tail export.
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Formats a timestamp into HH:mm format.
 *
 * @param {number|Date} timestamp
 * @returns {string}
 */
export function formatEventTime(timestamp) {
  if (timestamp === null || timestamp === undefined) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${hh}:${mm}`;
}

/**
 * Filters ledger entries by tier ('all', 'alerts', 'notices') and sorts newest-first.
 *
 * @param {Array<object>} ledger
 * @param {string} [filter='all']
 * @returns {Array<object>}
 */
export function filterLedgerEntries(ledger, filter = 'all') {
  if (!Array.isArray(ledger) || ledger.length === 0) {
    return [];
  }

  let filtered = ledger;
  if (filter === 'alerts') {
    filtered = ledger.filter((e) => e.tier === 'alert');
  } else if (filter === 'notices') {
    filtered = ledger.filter((e) => e.tier === 'notice');
  }

  return [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function sendNotification(notificationsApi, { title, message, priority = 1 }) {
  if (!notificationsApi?.create) return;
  notificationsApi.create({
    type: 'basic',
    iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    title: title || '',
    message: message || title || '',
    priority,
  });
}

/**
 * Appends an entry to the event ledger, updates storage, and dispatches notifications if needed.
 *
 * @param {{
 *   entry: { tier: string, type: string, title: string, cause?: string, timestamp?: number, id?: string },
 *   storageApi?: object,
 *   notificationsApi?: object,
 *   alarmsApi?: object,
 *   now?: number
 * }} params
 * @returns {Promise<Array<object>>} Updated ledger array
 */
export async function appendLedgerEntry({
  entry,
  storageApi,
  notificationsApi,
  alarmsApi,
  now = Date.now(),
}) {
  const currentData = storageApi?.get ? await storageApi.get(['ledger', 'activeAlert']) : {};
  const currentLedger = Array.isArray(currentData?.ledger) ? currentData.ledger : [];
  const currentActiveAlert = currentData?.activeAlert || null;

  const eventTimestamp = typeof entry.timestamp === 'number' ? entry.timestamp : now;
  const newEntry = {
    id: entry.id || `ev_${eventTimestamp}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: eventTimestamp,
    tier: entry.tier || 'ambient',
    type: entry.type || 'unknown',
    title: entry.title || '',
    cause: entry.cause || '',
  };

  const updatedLedger = [...currentLedger, newEntry];

  if (storageApi?.set) {
    await storageApi.set({ ledger: updatedLedger });
  }

  if (newEntry.tier === 'notice') {
    sendNotification(notificationsApi, {
      title: newEntry.title,
      message: newEntry.cause || newEntry.title,
      priority: 1,
    });
  } else if (newEntry.tier === 'alert') {
    const isSameAlertActive = currentActiveAlert && currentActiveAlert.type === newEntry.type;

    if (!isSameAlertActive) {
      const activeAlert = {
        type: newEntry.type,
        timestamp: eventTimestamp,
        repeatCount: 0,
        title: newEntry.title,
        cause: newEntry.cause || '',
      };

      if (storageApi?.set) {
        await storageApi.set({ activeAlert });
      }

      sendNotification(notificationsApi, {
        title: newEntry.title,
        message: newEntry.cause || newEntry.title,
        priority: 2,
      });

      if (alarmsApi?.create) {
        alarmsApi.create('alert_repeat', { delayInMinutes: 30 });
      }
    }
  }

  return updatedLedger;
}

/**
 * Handles the 30-minute alert_repeat alarm tick.
 * Repeats notifications for active unresolved alerts up to 3 times, then stops repeating.
 *
 * @param {{
 *   storageApi?: object,
 *   notificationsApi?: object,
 *   alarmsApi?: object,
 *   now?: number
 * }} params
 * @returns {Promise<{ repeated: boolean, repeatCount?: number, stopped?: boolean }>}
 */
export async function handleAlertRepeatAlarm({
  storageApi,
  notificationsApi,
  alarmsApi,
  now = Date.now(),
}) {
  const currentData = storageApi?.get ? await storageApi.get(['activeAlert']) : {};
  const activeAlert = currentData?.activeAlert;

  if (!activeAlert) {
    if (alarmsApi?.clear) {
      await alarmsApi.clear('alert_repeat');
    }
    return { repeated: false };
  }

  const currentCount = typeof activeAlert.repeatCount === 'number' ? activeAlert.repeatCount : 0;

  if (currentCount >= 3) {
    // Already repeated 3 times. Stop repeating and clear alarm, but keep activeAlert so badge stays lit.
    if (alarmsApi?.clear) {
      await alarmsApi.clear('alert_repeat');
    }
    return { repeated: false, stopped: true };
  }

  const nextRepeatCount = currentCount + 1;
  const updatedActiveAlert = {
    ...activeAlert,
    repeatCount: nextRepeatCount,
    lastRepeatAt: now,
  };

  if (storageApi?.set) {
    await storageApi.set({ activeAlert: updatedActiveAlert });
  }

  sendNotification(notificationsApi, {
    title: activeAlert.title || 'Unresolved Alert',
    message: activeAlert.cause || activeAlert.title || 'Action required',
    priority: 2,
  });

  if (nextRepeatCount < 3) {
    if (alarmsApi?.create) {
      alarmsApi.create('alert_repeat', { delayInMinutes: 30 });
    }
  } else {
    if (alarmsApi?.clear) {
      await alarmsApi.clear('alert_repeat');
    }
  }

  return { repeated: true, repeatCount: nextRepeatCount };
}

/**
 * Resolves the active alert, removing activeAlert from storage and clearing the repeat alarm.
 *
 * @param {{ storageApi?: object, alarmsApi?: object }} params
 */
export async function resolveActiveAlert({ storageApi, alarmsApi }) {
  if (storageApi?.remove) {
    await storageApi.remove(['activeAlert']);
  }
  if (alarmsApi?.clear) {
    await alarmsApi.clear('alert_repeat');
  }
}

/**
 * Exports the pass tail array as a downloaded JSON file using a blob anchor.
 *
 * @param {{
 *   passTail: Array<object>,
 *   filename?: string,
 *   documentImpl?: Document,
 *   urlImpl?: typeof URL
 * }} params
 * @returns {{ success: boolean }}
 */
export function exportPassTail({
  passTail = [],
  filename = 'archershub-pass-tail.json',
  documentImpl = typeof document !== 'undefined' ? document : null,
  urlImpl = typeof URL !== 'undefined' ? URL : null,
} = {}) {
  if (!documentImpl || !urlImpl) {
    return { success: false };
  }

  const jsonStr = JSON.stringify(passTail || [], null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const objectUrl = urlImpl.createObjectURL(blob);

  const anchor = documentImpl.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;

  if (documentImpl.body && documentImpl.body.appendChild) {
    documentImpl.body.appendChild(anchor);
    anchor.click();
    documentImpl.body.removeChild(anchor);
  } else {
    anchor.click();
  }

  urlImpl.revokeObjectURL(objectUrl);
  return { success: true };
}

/**
 * Handles user clicking a chrome.notification.
 * Focuses the Owned Tab if open, otherwise opens the extension popup or creates an ArchersHub tab.
 * Never performs page clicks or drives the page toward Final Submit.
 *
 * @param {{
 *   notificationId: string,
 *   tabsApi?: object,
 *   windowsApi?: object,
 *   actionApi?: object,
 *   storageApi?: object,
 *   notificationsApi?: object
 * }} params
 */
export async function handleNotificationClick({
  notificationId,
  tabsApi = typeof chrome !== 'undefined' ? chrome?.tabs : null,
  windowsApi = typeof chrome !== 'undefined' ? chrome?.windows : null,
  actionApi = typeof chrome !== 'undefined' ? chrome?.action : null,
  storageApi = typeof chrome !== 'undefined' ? chrome?.storage?.local : null,
  notificationsApi = typeof chrome !== 'undefined' ? chrome?.notifications : null,
}) {
  if (notificationId && notificationsApi?.clear) {
    notificationsApi.clear(notificationId);
  }

  if (!tabsApi) return;

  // 1. Try finding Owned Tab by stored ID or by URL match
  let targetTab = null;

  if (storageApi?.get) {
    const data = await storageApi.get(['ownedTabId']);
    if (data?.ownedTabId) {
      try {
        targetTab = await tabsApi.get(data.ownedTabId);
      } catch {
        targetTab = null;
      }
    }
  }

  if (!targetTab && tabsApi.query) {
    const tabs = await tabsApi.query({ url: '*://archershub.dlsu.edu.ph/*' });
    if (Array.isArray(tabs) && tabs.length > 0) {
      targetTab = tabs[0];
    }
  }

  // 2. If tab found: focus tab and window
  if (targetTab && typeof targetTab.id === 'number') {
    if (tabsApi.update) {
      await tabsApi.update(targetTab.id, { active: true });
    }
    if (typeof targetTab.windowId === 'number' && windowsApi?.update) {
      await windowsApi.update(targetTab.windowId, { focused: true });
    }
    return;
  }

  // 3. If no tab found: open extension popup if supported
  if (actionApi?.openPopup) {
    try {
      await actionApi.openPopup();
    } catch {
      // Ignored
    }
  }
}




/**
 * Owned Tab lifecycle manager and state steering coordinator.
 * Implements docs/SPEC.md §6, §9 and Issue #18.
 */

import { PAGE_STATES } from '../content/classifier.js';
import { updateBadge } from './arming.js';
import { appendLedgerEntry } from './reporting.js';

const ENLISTMENT_URL = 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index';

/**
 * Ensures that one Owned Tab is open at the enlistment URL and tracked in storage.
 *
 * @param {{
 *   tabsApi?: object,
 *   storageApi?: object,
 *   baseUrl?: string
 * }} params
 * @returns {Promise<{ tabId: number, created: boolean }>}
 */
export async function ensureOwnedTab({
  tabsApi = typeof chrome !== 'undefined' ? chrome?.tabs : null,
  storageApi = typeof chrome !== 'undefined' ? chrome?.storage?.local : null,
  baseUrl = 'https://archershub.dlsu.edu.ph',
} = {}) {
  if (!tabsApi) {
    return { tabId: null, created: false };
  }

  const storedData = storageApi?.get ? await storageApi.get(['ownedTabId']) : {};
  let currentTabId = storedData?.ownedTabId;

  if (currentTabId) {
    try {
      const tab = await tabsApi.get(currentTabId);
      if (tab && typeof tab.id === 'number') {
        return { tabId: tab.id, created: false };
      }
    } catch (_) {
      currentTabId = null;
    }
  }

  // No tracked Owned Tab exists — create a new distinct Owned Tab
  const newTab = await tabsApi.create({
    url: `${baseUrl}/Enlistment_V2/Index`,
    active: false,
  });

  if (storageApi?.set && typeof newTab.id === 'number') {
    await storageApi.set({ ownedTabId: newTab.id });
  }

  return { tabId: newTab.id, created: true };
}

/**
 * Retrieves the currently tracked Owned Tab object if still open.
 *
 * @param {{ tabsApi?: object, storageApi?: object }} params
 * @returns {Promise<object|null>}
 */
export async function getOwnedTab({
  tabsApi = typeof chrome !== 'undefined' ? chrome?.tabs : null,
  storageApi = typeof chrome !== 'undefined' ? chrome?.storage?.local : null,
} = {}) {
  if (!tabsApi || !storageApi?.get) return null;
  const storedData = await storageApi.get(['ownedTabId']);
  const tabId = storedData?.ownedTabId;
  if (!tabId) return null;

  try {
    return await tabsApi.get(tabId);
  } catch (_) {
    return null;
  }
}

/**
 * Handles Owned Tab reaching Step2Bound: records timestamp and schedules 3-minute reload alarm.
 *
 * @param {{
 *   tabId: number,
 *   storageApi?: object,
 *   alarmsApi?: object,
 *   now?: number
 * }} params
 * @returns {Promise<{ state: string, reloadAlarmScheduled: boolean }>}
 */
export async function handleStep2BoundReached({
  tabId,
  storageApi = typeof chrome !== 'undefined' ? chrome?.storage?.local : null,
  alarmsApi = typeof chrome !== 'undefined' ? chrome?.alarms : null,
  now = Date.now(),
} = {}) {
  if (storageApi?.set) {
    await storageApi.set({ lastBoundAt: now });
  }

  if (alarmsApi?.create) {
    alarmsApi.create('owned_tab_reload', { delayInMinutes: 3 });
  }

  return { state: PAGE_STATES.STEP2_BOUND, reloadAlarmScheduled: true };
}

/**
 * Handles the 3-minute keepalive reload of the Owned Tab.
 * Respects the strikePending flag — never reloads while a strike is in progress.
 *
 * @param {{
 *   tabsApi?: object,
 *   storageApi?: object,
 *   alarmsApi?: object,
 *   baseUrl?: string
 * }} params
 * @returns {Promise<{ reloaded: boolean, tabId?: number, recreated?: boolean, reason?: string }>}
 */
export async function handleOwnedTabReload({
  tabsApi = typeof chrome !== 'undefined' ? chrome?.tabs : null,
  storageApi = typeof chrome !== 'undefined' ? chrome?.storage?.local : null,
  alarmsApi = typeof chrome !== 'undefined' ? chrome?.alarms : null,
  baseUrl = 'https://archershub.dlsu.edu.ph',
} = {}) {
  if (!tabsApi || !storageApi?.get) {
    return { reloaded: false, reason: 'missing_apis' };
  }

  const data = await storageApi.get(['ownedTabId', 'vigil', 'strikePending']);
  const strikePending = Boolean(data?.strikePending);
  const vigil = data?.vigil;
  const ownedTabId = data?.ownedTabId;

  // Never reload or navigate while a strike is pending!
  if (strikePending) {
    return { reloaded: false, reason: 'strike_pending' };
  }

  if (vigil && vigil.state !== 'watching') {
    return { reloaded: false, reason: 'not_watching' };
  }

  if (ownedTabId) {
    try {
      await tabsApi.reload(ownedTabId);
      return { reloaded: true, tabId: ownedTabId };
    } catch (_) {
      // Tab may have been closed; recreate
    }
  }

  const ensured = await ensureOwnedTab({ tabsApi, storageApi, baseUrl });
  return { reloaded: true, recreated: true, tabId: ensured.tabId };
}

/**
 * Handles Unrecognised page state: captures DOM, ends Vigil terminally, raises Alert, leaves Owned Tab open.
 *
 * @param {{
 *   snapshot: object,
 *   storageApi?: object,
 *   actionApi?: object,
 *   alarmsApi?: object,
 *   notificationsApi?: object,
 *   now?: number
 * }} params
 * @returns {Promise<{ state: string, snapshotCaptured: boolean }>}
 */
export async function handleUnrecognisedAbort({
  snapshot,
  storageApi = typeof chrome !== 'undefined' ? chrome?.storage?.local : null,
  actionApi = typeof chrome !== 'undefined' ? chrome?.action : null,
  alarmsApi = typeof chrome !== 'undefined' ? chrome?.alarms : null,
  notificationsApi = typeof chrome !== 'undefined' ? chrome?.notifications : null,
  now = Date.now(),
} = {}) {
  const currentData = storageApi?.get ? await storageApi.get(['vigil']) : {};
  const currentVigil = currentData?.vigil || {};

  const updatedVigil = {
    ...currentVigil,
    state: 'aborted',
    lastChangeAt: now,
  };

  if (storageApi?.set) {
    await storageApi.set({
      vigil: updatedVigil,
      lastAbortedSnapshot: snapshot || null,
    });
  }

  if (alarmsApi?.clear) {
    await alarmsApi.clear('owned_tab_reload');
    await alarmsApi.clear('vigil_start');
    await alarmsApi.clear('vigil_keepalive');
  }

  updateBadge({ state: 'aborted', actionApi });

  await appendLedgerEntry({
    entry: {
      tier: 'alert',
      type: 'aborted',
      title: 'Vigil aborted',
      cause: 'Unrecognised page state',
      timestamp: now,
    },
    storageApi,
    notificationsApi,
    alarmsApi,
    now,
  });

  return { state: 'aborted', snapshotCaptured: true };
}

/**
 * Handles LoggedOut state: suspends Vigil, raises Alert, parks tab, and sets 30s flat probe.
 *
 * @param {{
 *   storageApi?: object,
 *   actionApi?: object,
 *   alarmsApi?: object,
 *   notificationsApi?: object,
 *   tabsApi?: object,
 *   now?: number
 * }} params
 * @returns {Promise<{ state: string }>}
 */
export async function handleLoggedOutSuspend({
  storageApi = typeof chrome !== 'undefined' ? chrome?.storage?.local : null,
  actionApi = typeof chrome !== 'undefined' ? chrome?.action : null,
  alarmsApi = typeof chrome !== 'undefined' ? chrome?.alarms : null,
  notificationsApi = typeof chrome !== 'undefined' ? chrome?.notifications : null,
  tabsApi = typeof chrome !== 'undefined' ? chrome?.tabs : null,
  now = Date.now(),
} = {}) {
  const currentData = storageApi?.get ? await storageApi.get(['vigil', 'ownedTabId']) : {};
  const currentVigil = currentData?.vigil || {};

  const updatedVigil = {
    ...currentVigil,
    state: 'suspended',
    lastChangeAt: now,
  };

  if (storageApi?.set) {
    await storageApi.set({ vigil: updatedVigil });
  }

  if (alarmsApi?.clear) {
    await alarmsApi.clear('owned_tab_reload');
  }

  if (alarmsApi?.create) {
    alarmsApi.create('probe_session', { periodInMinutes: 0.5 });
  }

  updateBadge({ state: 'suspended', actionApi });

  await appendLedgerEntry({
    entry: {
      tier: 'alert',
      type: 'suspended',
      title: 'Vigil suspended',
      cause: 'Session logged out',
      timestamp: now,
    },
    storageApi,
    notificationsApi,
    alarmsApi,
    now,
  });

  return { state: 'suspended' };
}

/**
 * Drives the Owned Tab through the §6 action column to reach Step2Bound.
 *
 * @param {{
 *   tabId: number,
 *   tabsApi?: object,
 *   storageApi?: object,
 *   actionApi?: object,
 *   alarmsApi?: object,
 *   notificationsApi?: object,
 *   baseUrl?: string,
 *   now?: number
 * }} params
 * @returns {Promise<{ action: string, state: string, error?: string }>}
 */
export async function steerOwnedTab({
  tabId,
  tabsApi = typeof chrome !== 'undefined' ? chrome?.tabs : null,
  storageApi = typeof chrome !== 'undefined' ? chrome?.storage?.local : null,
  actionApi = typeof chrome !== 'undefined' ? chrome?.action : null,
  alarmsApi = typeof chrome !== 'undefined' ? chrome?.alarms : null,
  notificationsApi = typeof chrome !== 'undefined' ? chrome?.notifications : null,
  baseUrl = 'https://archershub.dlsu.edu.ph',
  now = Date.now(),
} = {}) {
  if (!tabsApi) {
    return { action: 'error', state: 'unknown', error: 'No tabs API' };
  }

  // Never reload or navigate while a strike is pending!
  if (storageApi?.get) {
    const data = await storageApi.get(['strikePending']);
    if (data?.strikePending) {
      return { action: 'deferred', state: 'unknown', reason: 'strike_pending' };
    }
  }

  let tab = null;
  try {
    tab = await tabsApi.get(tabId);
  } catch (_) {
    const ensured = await ensureOwnedTab({ tabsApi, storageApi, baseUrl });
    return { action: 'opened_new_tab', tabId: ensured.tabId, state: PAGE_STATES.NO_TAB };
  }

  try {
    const response = await tabsApi.sendMessage(tabId, { type: 'STEER_TAB', autoAct: true });

    if (response?.state === PAGE_STATES.STEP2_BOUND) {
      await handleStep2BoundReached({ tabId, storageApi, alarmsApi, now });
      return { action: 'bound', state: PAGE_STATES.STEP2_BOUND };
    }

    if (response?.state === PAGE_STATES.UNRECOGNISED) {
      await handleUnrecognisedAbort({
        snapshot: response.snapshot || response.domSnapshot,
        storageApi,
        actionApi,
        alarmsApi,
        notificationsApi,
        now,
      });
      return { action: 'abort', state: PAGE_STATES.UNRECOGNISED };
    }

    if (response?.state === PAGE_STATES.LOGGED_OUT) {
      await handleLoggedOutSuspend({
        storageApi,
        actionApi,
        alarmsApi,
        notificationsApi,
        tabsApi,
        now,
      });
      return { action: 'suspend', state: PAGE_STATES.LOGGED_OUT };
    }

    if (response?.state === PAGE_STATES.WRONG_PAGE) {
      if (tabsApi.update) {
        await tabsApi.update(tabId, { url: `${baseUrl}/Enlistment_V2/Index` });
      }
      return { action: 'navigate_enlistment', state: PAGE_STATES.WRONG_PAGE };
    }

    return { action: 'steered', state: response?.state || 'unknown' };
  } catch (err) {
    // Content script not answering (NotInjected) -> reload tab to inject and activate
    if (tabsApi.reload) {
      await tabsApi.reload(tabId);
    }
    return { action: 'reloaded_tab', state: PAGE_STATES.NOT_INJECTED, error: err?.message };
  }
}

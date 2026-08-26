/**
 * Arming, Vigil lifecycle, alarm scheduling, and service-worker keepalive helpers.
 */

import { extractShellParams } from './catalogue.js';
import { appendLedgerEntry, pad2 } from './reporting.js';
import { ensureOwnedTab, steerOwnedTab } from './tab-manager.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Creates a Vigil record object conforming to the SPEC storage schema.
 *
 * @param {{ state: string, lastChangeAt?: number, nextFireTime?: number|null, startedAt?: number }} params
 * @returns {{ state: string, lastChangeAt: number, nextFireTime: number|null, startedAt: number }}
 */
export function createVigilRecord({ state = 'armed', lastChangeAt, nextFireTime = null, startedAt }) {
  const ts = Date.now();
  return {
    state,
    lastChangeAt: typeof lastChangeAt === 'number' ? lastChangeAt : ts,
    nextFireTime: nextFireTime !== undefined ? nextFireTime : null,
    startedAt: typeof startedAt === 'number' ? startedAt : ts,
  };
}

/**
 * Evaluates the night-before checklist items based on session liveness.
 *
 * @param {{ loggedIn: boolean }} params
 * @returns {Array<{ title: string, who: string, mark: string, status: string, why: string }>}
 */
export function evaluateChecklist({ loggedIn }) {
  return [
    {
      title: loggedIn ? 'Logged in to ArchersHub' : 'Not logged in to ArchersHub',
      who: 'extension',
      mark: loggedIn ? '✓' : '✗',
      status: loggedIn ? 'yes' : 'no',
      why: loggedIn
        ? 'Checked just now — arming refuses without it'
        : 'Arming is blocked until you fix this one',
    },
    {
      title: 'Mac kept awake, lid open',
      who: 'you',
      mark: '○',
      status: 'you',
      why: 'You do this one. A sleeping Mac watches nothing',
    },
    {
      title: 'Brave left running',
      who: 'you',
      mark: '○',
      status: 'you',
      why: 'A closed browser is a stopped Vigil',
    },
  ];
}

/**
 * Formats a Date or ISO string into display format e.g. "Wed 26 Aug, 07:00".
 *
 * @param {Date|string|number} dateOrString
 * @returns {string}
 */
export function formatDateTimeDisplay(dateOrString) {
  if (!dateOrString) return '';
  const d = new Date(dateOrString);
  if (isNaN(d.getTime())) return String(dateOrString);

  const day = DAYS[d.getDay()];
  const date = d.getDate();
  const month = MONTHS[d.getMonth()];
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());

  return `${day} ${date} ${month}, ${hours}:${minutes}`;
}

/**
 * Computes default start time (next 07:00 AM) in local datetime-local format (YYYY-MM-DDTHH:mm).
 *
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function getDefaultStartTime(now = new Date()) {
  const current = new Date(now);
  const target = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 7, 0, 0, 0);

  if (current.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const yyyy = target.getFullYear();
  const mm = pad2(target.getMonth() + 1);
  const dd = pad2(target.getDate());
  const hh = pad2(target.getHours());
  const min = pad2(target.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Returns dynamic Arm button label.
 *
 * @param {{ startMode: string, startTime?: string|Date|null, isBlocked?: boolean, isRunning?: boolean, subjectCount?: number }} params
 * @returns {string}
 */
export function formatArmLabel({
  startMode = 'at-time',
  startTime = null,
  isBlocked = false,
  isRunning = false,
  subjectCount = 1,
}) {
  if (isRunning) {
    return 'A Vigil is already running';
  }
  if (isBlocked) {
    return 'Arm — blocked, log in first';
  }
  if (subjectCount === 0) {
    return 'Add a subject to arm';
  }
  if (startMode === 'now') {
    return 'Start watching now';
  }
  const formatted = startTime ? formatDateTimeDisplay(startTime) : '';
  return formatted ? `Arm for ${formatted}` : 'Arm for start time';
}

/**
 * Updates extension action badge based on Vigil state.
 *
 * @param {{ state: string, unresolvedCount?: number, actionApi?: object }} params
 */
export function updateBadge({ state, unresolvedCount = 0, actionApi = typeof chrome !== 'undefined' ? chrome?.action : null }) {
  if (!actionApi || typeof actionApi.setBadgeText !== 'function') {
    return;
  }

  switch (state) {
    case 'armed':
      actionApi.setBadgeText({ text: '•' });
      if (actionApi.setBadgeBackgroundColor) {
        actionApi.setBadgeBackgroundColor({ color: '#888888' });
      }
      break;
    case 'watching':
      actionApi.setBadgeText({ text: String(unresolvedCount) });
      if (actionApi.setBadgeBackgroundColor) {
        actionApi.setBadgeBackgroundColor({ color: '#4285F4' });
      }
      break;
    case 'suspended':
      actionApi.setBadgeText({ text: '!' });
      if (actionApi.setBadgeBackgroundColor) {
        actionApi.setBadgeBackgroundColor({ color: '#F59E0B' });
      }
      break;
    case 'stall':
      actionApi.setBadgeText({ text: '!!' });
      if (actionApi.setBadgeBackgroundColor) {
        actionApi.setBadgeBackgroundColor({ color: '#EF4444' });
      }
      break;
    case 'aborted':
      actionApi.setBadgeText({ text: 'X' });
      if (actionApi.setBadgeBackgroundColor) {
        actionApi.setBadgeBackgroundColor({ color: '#991B1B' });
      }
      break;
    case 'complete':
      actionApi.setBadgeText({ text: '✓' });
      if (actionApi.setBadgeBackgroundColor) {
        actionApi.setBadgeBackgroundColor({ color: '#10B981' });
      }
      break;
    case 'stopped':
    case 'none':
    default:
      actionApi.setBadgeText({ text: '' });
      break;
  }
}

/**
 * Transitions Vigil from armed to watching, clearing alarms and updating badge.
 *
 * @param {{
 *   vigil: object,
 *   plan?: object,
 *   storageApi?: object,
 *   alarmsApi?: object,
 *   actionApi?: object,
 *   tabsApi?: object,
 *   notificationsApi?: object,
 *   baseUrl?: string,
 *   now?: number,
 *   cause?: string
 * }} params
 * @returns {Promise<object>} The updated vigil record
 */
export async function transitionArmedToWatching({
  vigil,
  plan,
  storageApi,
  alarmsApi,
  actionApi,
  tabsApi = typeof chrome !== 'undefined' ? chrome?.tabs : null,
  notificationsApi = typeof chrome !== 'undefined' ? chrome?.notifications : null,
  baseUrl = 'https://archershub.dlsu.edu.ph',
  now = Date.now(),
  cause,
}) {
  const updatedVigil = {
    ...(vigil || {}),
    startedAt: typeof vigil?.startedAt === 'number' ? vigil.startedAt : now,
    state: 'watching',
    nextFireTime: null,
    lastChangeAt: now,
  };

  const storagePayload = { vigil: updatedVigil, lastCompletePassAt: now };
  if (plan) {
    storagePayload.plan = plan;
  }

  if (storageApi?.set) {
    await storageApi.set(storagePayload);
  }
  if (alarmsApi?.clear) {
    await alarmsApi.clear('vigil_start');
    await alarmsApi.clear('vigil_keepalive');
  }
  if (alarmsApi?.create) {
    alarmsApi.create('vigil_pass', { delayInMinutes: 0.01 });
  }

  const unresolvedCount = Array.isArray(plan?.subjects) ? plan.subjects.length : 0;
  updateBadge({
    state: 'watching',
    unresolvedCount,
    actionApi,
  });

  const entryCause = cause || (vigil?.state === 'armed'
    ? 'Start time reached'
    : (Array.isArray(plan?.subjects) && plan.subjects.length > 0
        ? `Watching ${plan.subjects.length} subject${plan.subjects.length === 1 ? '' : 's'}`
        : 'Start time reached'));

  await appendLedgerEntry({
    entry: {
      tier: 'ambient',
      type: 'watching',
      title: 'Vigil started',
      cause: entryCause,
    },
    storageApi,
    notificationsApi,
    alarmsApi,
    now,
  });

  if (tabsApi) {
    const ownedTab = await ensureOwnedTab({ tabsApi, storageApi, baseUrl });
    if (ownedTab?.tabId) {
      await steerOwnedTab({
        tabId: ownedTab.tabId,
        tabsApi,
        storageApi,
        actionApi,
        alarmsApi,
        notificationsApi,
        baseUrl,
        now,
      });
    }
  }

  return updatedVigil;
}

/**
 * Runs 1 cheap authenticated GET request to check session liveness.
 *
 * @param {{ fetchImpl?: typeof fetch, baseUrl?: string }} [params]
 * @returns {Promise<{ loggedIn: boolean, academicSessionId?: string, error?: string }>}
 */
export async function checkSession({ fetchImpl = fetch, baseUrl = 'https://archershub.dlsu.edu.ph' } = {}) {
  try {
    const res = await fetchImpl(`${baseUrl}/Enlistment_V2/Index`, {
      credentials: 'include',
    });

    if (!res.ok) {
      return { loggedIn: false };
    }

    const html = await res.text();
    const shellParams = extractShellParams(html);

    if (!shellParams) {
      return { loggedIn: false };
    }

    return {
      loggedIn: true,
      academicSessionId: shellParams.academicSessionId,
    };
  } catch (err) {
    return { loggedIn: false, error: err?.message || 'Network error' };
  }
}

/**
 * Arms the Vigil, persisting records to storage and configuring chrome.alarms.
 *
 * @param {{
 *   plan: { academicSessionId?: string|null, subjects?: Array<object> },
 *   startMode: string,
 *   startTime?: string|number|Date|null,
 *   fetchImpl?: typeof fetch,
 *   baseUrl?: string,
 *   storageApi?: object,
 *   alarmsApi?: object,
 *   actionApi?: object,
 *   tabsApi?: object,
 *   notificationsApi?: object,
 *   now?: number
 * }} params
 * @returns {Promise<{ success: boolean, state?: string, reason?: string, vigil?: object, plan?: object }>}
 */
export async function armVigil({
  plan,
  startMode = 'at-time',
  startTime = null,
  fetchImpl,
  baseUrl = 'https://archershub.dlsu.edu.ph',
  storageApi,
  alarmsApi,
  actionApi,
  tabsApi = typeof chrome !== 'undefined' ? chrome?.tabs : null,
  notificationsApi = typeof chrome !== 'undefined' ? chrome?.notifications : null,
  now = Date.now(),
}) {
  // SPEC §9: Always perform 1 live authenticated GET at arming time to refuse a dead session.
  const sessionRes = await checkSession({ fetchImpl, baseUrl });
  if (!sessionRes || sessionRes.loggedIn !== true) {
    return { success: false, reason: 'logged_out' };
  }

  if (!plan || !Array.isArray(plan.subjects) || plan.subjects.length === 0) {
    return { success: false, reason: 'no_subjects' };
  }

  // Acceptance Criterion 1: arming opens one Owned Tab at /Enlistment_V2/Index
  if (tabsApi) {
    await ensureOwnedTab({ tabsApi, storageApi, baseUrl });
  }

  const nextFireTime = startTime ? new Date(startTime).getTime() : now;

  // If startMode is 'now' OR start time has already passed: start watching immediately (no Armed state in between)
  if (startMode === 'now' || (typeof nextFireTime === 'number' && nextFireTime <= now)) {
    const planToSave = {
      ...plan,
      startMode: 'now',
      startTime: null,
    };

    const initialVigil = createVigilRecord({
      state: 'watching',
      nextFireTime: null,
      lastChangeAt: now,
      startedAt: now,
    });

    const vigil = await transitionArmedToWatching({
      vigil: initialVigil,
      plan: planToSave,
      storageApi,
      alarmsApi,
      actionApi,
      tabsApi,
      notificationsApi,
      baseUrl,
      now,
      cause: `Watching ${plan.subjects.length} subject${plan.subjects.length === 1 ? '' : 's'}`,
    });

    return {
      success: true,
      state: 'watching',
      vigil,
      plan: planToSave,
    };
  }

  // At a set time mode (future start)
  const isoStartTime = startTime ? new Date(startTime).toISOString() : new Date(now).toISOString();

  const vigil = createVigilRecord({
    state: 'armed',
    nextFireTime,
    lastChangeAt: now,
    startedAt: now,
  });
  const planToSave = {
    ...plan,
    startMode: 'at-time',
    startTime: isoStartTime,
  };

  if (storageApi?.set) {
    await storageApi.set({ vigil, plan: planToSave });
  }
  if (alarmsApi?.create) {
    alarmsApi.create('vigil_start', { when: nextFireTime });
    alarmsApi.create('vigil_keepalive', { periodInMinutes: 5 });
  }

  updateBadge({
    state: 'armed',
    actionApi,
  });

  await appendLedgerEntry({
    entry: {
      tier: 'ambient',
      type: 'armed',
      title: 'Vigil armed',
      cause: `Armed for ${formatDateTimeDisplay(startTime || nextFireTime)}`,
    },
    storageApi,
    notificationsApi,
    alarmsApi,
    now,
  });

  return {
    success: true,
    state: 'armed',
    vigil,
    plan: planToSave,
  };
}

/**
 * Rebuilds alarms and badge from stored Vigil and Plan on worker startup or wake-up.
 *
 * @param {{ storageApi: object, alarmsApi: object, actionApi?: object, tabsApi?: object, notificationsApi?: object, now?: number }} params
 * @returns {Promise<{ state: string, vigil?: object, missedStart?: boolean }>}
 */
export async function rebuildAlarmsFromStorage({
  storageApi,
  alarmsApi,
  actionApi,
  tabsApi,
  notificationsApi,
  now = Date.now(),
}) {
  const result = (storageApi?.get ? await storageApi.get(['vigil', 'plan', 'activeAlert', 'lastBoundAt']) : {}) || {};
  const vigil = result.vigil;
  const plan = result.plan;
  const activeAlert = result.activeAlert;

  // Restore alert_repeat alarm if unresolved activeAlert exists and has repeats remaining
  if (activeAlert && typeof activeAlert.repeatCount === 'number' && activeAlert.repeatCount < 3) {
    if (alarmsApi?.get && alarmsApi?.create) {
      const existingAlertAlarm = await alarmsApi.get('alert_repeat');
      if (!existingAlertAlarm) {
        alarmsApi.create('alert_repeat', { delayInMinutes: 30 });
      }
    }
  }

  if (!vigil || vigil.state === 'none' || vigil.state === 'stopped') {
    if (alarmsApi?.clear) {
      await alarmsApi.clear('vigil_start');
      await alarmsApi.clear('vigil_keepalive');
      await alarmsApi.clear('owned_tab_reload');
      await alarmsApi.clear('vigil_pass');
    }
    updateBadge({ state: vigil?.state || 'none', actionApi });
    return { state: vigil?.state || 'none' };
  }

  if (vigil.state === 'armed') {
    if (typeof vigil.nextFireTime === 'number' && now >= vigil.nextFireTime) {
      // Start time passed while Brave was closed: start immediately!
      const updatedVigil = await transitionArmedToWatching({
        vigil,
        plan,
        storageApi,
        alarmsApi,
        actionApi,
        tabsApi,
        notificationsApi,
        now,
      });

      return {
        state: 'watching',
        vigil: updatedVigil,
        missedStart: true,
      };
    }

    // Future start time: re-arm one-shot alarm and keepalive alarm
    if (alarmsApi?.create && typeof vigil.nextFireTime === 'number') {
      alarmsApi.create('vigil_start', { when: vigil.nextFireTime });
      alarmsApi.create('vigil_keepalive', { periodInMinutes: 5 });
    }

    updateBadge({
      state: 'armed',
      actionApi,
    });

    return {
      state: 'armed',
      vigil,
    };
  }

  if (vigil.state === 'watching') {
    const unresolvedCount = Array.isArray(plan?.subjects) ? plan.subjects.length : 0;
    updateBadge({
      state: 'watching',
      unresolvedCount,
      actionApi,
    });

    if (alarmsApi?.get && alarmsApi?.create) {
      const existingReload = await alarmsApi.get('owned_tab_reload');
      if (!existingReload) {
        alarmsApi.create('owned_tab_reload', { delayInMinutes: 3 });
      }
      const existingPass = await alarmsApi.get('vigil_pass');
      if (!existingPass) {
        const remainingMs = (typeof vigil.nextFireTime === 'number' && vigil.nextFireTime > now)
          ? vigil.nextFireTime - now
          : 0;
        alarmsApi.create('vigil_pass', { delayInMinutes: Math.max(0.01, remainingMs / 60000) });
      }
    }

    await appendLedgerEntry({
      entry: {
        tier: 'ambient',
        type: 'resumed',
        title: 'Vigil resumed',
        cause: 'Resumed after browser restart',
        timestamp: now,
      },
      storageApi,
      notificationsApi,
      alarmsApi,
      now,
    });

    return {
      state: 'watching',
      vigil,
    };
  }

  if (vigil.state === 'stall') {
    updateBadge({
      state: 'stall',
      actionApi,
    });
    return {
      state: 'stall',
      vigil,
    };
  }

  if (vigil.state === 'aborted') {
    updateBadge({
      state: 'aborted',
      actionApi,
    });
    return {
      state: 'aborted',
      vigil,
    };
  }

  if (vigil.state === 'suspended') {
    updateBadge({
      state: 'suspended',
      actionApi,
    });
    if (alarmsApi?.get && alarmsApi?.create) {
      const existingProbe = await alarmsApi.get('probe_session');
      if (!existingProbe) {
        alarmsApi.create('probe_session', { periodInMinutes: 0.5 });
      }
    }
    return {
      state: 'suspended',
      vigil,
    };
  }

  updateBadge({
    state: vigil.state,
    actionApi,
  });

  return {
    state: vigil.state,
    vigil,
  };
}

/**
 * Performs cheap authenticated keepalive GET request.
 *
 * @param {{ fetchImpl?: typeof fetch, baseUrl?: string }} [params]
 * @returns {Promise<{ ok: boolean, status?: number, error?: string }>}
 */
export async function performKeepalive({ fetchImpl = fetch, baseUrl = 'https://archershub.dlsu.edu.ph' } = {}) {
  try {
    const res = await fetchImpl(`${baseUrl}/Enlistment_V2/Index`, {
      credentials: 'include',
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

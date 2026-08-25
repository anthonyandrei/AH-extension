/**
 * Arming, Vigil lifecycle, alarm scheduling, and service-worker keepalive helpers.
 */

import { extractShellParams } from './catalogue.js';
import { appendLedgerEntry } from './reporting.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

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
  return formatted ? `Arm for ${formatted}` : 'Arm for scheduled time';
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
 *   now?: number
 * }} params
 * @returns {Promise<object>} The updated vigil record
 */
export async function transitionArmedToWatching({
  vigil,
  plan,
  storageApi,
  alarmsApi,
  actionApi,
  now = Date.now(),
}) {
  const updatedVigil = {
    ...(vigil || {}),
    state: 'watching',
    nextFireTime: null,
    lastChangeAt: now,
  };

  if (storageApi?.set) {
    await storageApi.set({ vigil: updatedVigil });
  }
  if (alarmsApi?.clear) {
    await alarmsApi.clear('vigil_start');
    await alarmsApi.clear('vigil_keepalive');
  }

  const unresolvedCount = Array.isArray(plan?.subjects) ? plan.subjects.length : 0;
  updateBadge({
    state: 'watching',
    unresolvedCount,
    actionApi,
  });

  await appendLedgerEntry({
    entry: {
      tier: 'ambient',
      type: 'watching',
      title: 'Vigil started',
      cause: 'Start time reached',
    },
    storageApi,
    now,
  });

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
 *   catalogue?: { loggedIn: boolean },
 *   fetchImpl?: typeof fetch,
 *   baseUrl?: string,
 *   storageApi?: object,
 *   alarmsApi?: object,
 *   actionApi?: object,
 *   now?: number
 * }} params
 * @returns {Promise<{ success: boolean, state?: string, reason?: string, vigil?: object, plan?: object }>}
 */
export async function armVigil({
  plan,
  startMode = 'at-time',
  startTime = null,
  catalogue,
  fetchImpl,
  baseUrl,
  storageApi,
  alarmsApi,
  actionApi,
  now = Date.now(),
}) {
  // If catalogue was explicitly passed, verify it. Otherwise run 1 authenticated GET check.
  let isAlive = catalogue?.loggedIn;
  if (isAlive === undefined) {
    const sessionRes = await checkSession({ fetchImpl, baseUrl });
    isAlive = sessionRes.loggedIn;
  }

  if (isAlive === false) {
    return { success: false, reason: 'logged_out' };
  }

  if (!plan || !Array.isArray(plan.subjects) || plan.subjects.length === 0) {
    return { success: false, reason: 'no_subjects' };
  }

  const nextFireTime = startTime ? new Date(startTime).getTime() : now;

  // If startMode is 'now' OR start time has already passed: start watching immediately (no Armed state in between)
  if (startMode === 'now' || (typeof nextFireTime === 'number' && nextFireTime <= now)) {
    const vigil = createVigilRecord({
      state: 'watching',
      nextFireTime: null,
      lastChangeAt: now,
      startedAt: now,
    });
    const planToSave = {
      ...plan,
      startMode: 'now',
      startTime: null,
    };

    if (storageApi?.set) {
      await storageApi.set({ vigil, plan: planToSave });
    }
    if (alarmsApi?.clear) {
      await alarmsApi.clear('vigil_start');
      await alarmsApi.clear('vigil_keepalive');
    }

    updateBadge({
      state: 'watching',
      unresolvedCount: plan.subjects.length,
      actionApi,
    });

    await appendLedgerEntry({
      entry: {
        tier: 'ambient',
        type: 'watching',
        title: 'Vigil started',
        cause: `Watching ${plan.subjects.length} subject${plan.subjects.length === 1 ? '' : 's'}`,
      },
      storageApi,
      now,
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
      cause: `Scheduled for ${formatDateTimeDisplay(startTime || nextFireTime)}`,
    },
    storageApi,
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
 * @param {{ storageApi: object, alarmsApi: object, actionApi?: object, now?: number }} params
 * @returns {Promise<{ state: string, vigil?: object, missedStart?: boolean }>}
 */
export async function rebuildAlarmsFromStorage({
  storageApi,
  alarmsApi,
  actionApi,
  now = Date.now(),
}) {
  const result = (storageApi?.get ? await storageApi.get(['vigil', 'plan']) : {}) || {};
  const vigil = result.vigil;
  const plan = result.plan;

  if (!vigil || vigil.state === 'none' || vigil.state === 'stopped') {
    if (alarmsApi?.clearAll) {
      await alarmsApi.clearAll();
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
    return {
      state: 'watching',
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

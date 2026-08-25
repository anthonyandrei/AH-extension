/**
 * Pass loop engine, cadence backoff calculator, 6-disposition reconciliation,
 * rolling pass tail buffer, and Stop semantics for ArchersHub Enlistment Automator.
 * Implements docs/SPEC.md §7, §8, §10, §11, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007.
 */

import { PAGE_STATES } from '../content/classifier.js';
import { readCatalogue } from './catalogue.js';
import { updateBadge } from './arming.js';
import { appendLedgerEntry, resolveActiveAlert } from './reporting.js';
import { steerOwnedTab, handleLoggedOutSuspend } from './tab-manager.js';

export const DISPOSITIONS = Object.freeze({
  ACQUIRE: 'acquire',
  NONE_ABSENT: 'none_absent',
  SATISFIED: 'satisfied',
  UPGRADE: 'upgrade',
  HELD_DIFF_ABSENT: 'held_diff_absent',
  PRESERVE: 'preserve',
});

function idEquals(a, b) {
  return a === b || String(a) === String(b);
}

/**
 * Computes base cadence interval in ms derived purely from stored lastChangeAt.
 * Formula: n = log(1 + elapsed/4) / log(1.5), interval = min(60s, 2s * 1.5^n).
 *
 * @param {{
 *   lastChangeAt?: number,
 *   now?: number,
 *   rateLimited?: boolean
 * }} params
 * @returns {number} Interval in milliseconds
 */
export function computeCadenceInterval({ lastChangeAt, now = Date.now(), rateLimited = false }) {
  if (rateLimited) {
    return 60000;
  }

  const lastChange = typeof lastChangeAt === 'number' ? lastChangeAt : now;
  const elapsedSec = Math.max(0, (now - lastChange) / 1000);

  // n = log(1 + elapsed/4) / log(1.5)
  const n = Math.log(1 + elapsedSec / 4) / Math.log(1.5);
  // interval = min(60s, 2s * 1.5^n)
  const intervalSec = Math.min(60, 2 * Math.pow(1.5, n));

  return Math.round(intervalSec * 1000);
}

/**
 * Applies +/-25% jitter to an interval in milliseconds.
 *
 * @param {number} intervalMs
 * @param {() => number} [randomFn=Math.random]
 * @returns {number} Jittered interval in milliseconds
 */
export function applyJitter(intervalMs, randomFn = Math.random) {
  const factor = 0.75 + randomFn() * 0.5;
  return Math.round(intervalMs * factor);
}

/**
 * Computes the total jittered delay until the next pass.
 *
 * @param {{
 *   lastChangeAt?: number,
 *   now?: number,
 *   rateLimited?: boolean,
 *   randomFn?: () => number
 * }} params
 * @returns {number} Delay in milliseconds
 */
export function computeNextPassDelay({
  lastChangeAt,
  now = Date.now(),
  rateLimited = false,
  randomFn = Math.random,
}) {
  const baseInterval = computeCadenceInterval({ lastChangeAt, now, rateLimited });
  return applyJitter(baseInterval, randomFn);
}

/**
 * Evaluates whether 10 minutes (default 600,000 ms) have elapsed without a complete pass.
 *
 * @param {{
 *   lastCompletePassAt?: number|null,
 *   startedAt?: number|null,
 *   now?: number,
 *   thresholdMs?: number
 * }} params
 * @returns {boolean} True if stalled, false otherwise
 */
export function checkStall({
  lastCompletePassAt,
  startedAt,
  now = Date.now(),
  thresholdMs = 10 * 60 * 1000,
}) {
  const referenceTime = typeof lastCompletePassAt === 'number'
    ? lastCompletePassAt
    : (typeof startedAt === 'number' ? startedAt : now);
  const elapsed = now - referenceTime;
  return elapsed >= thresholdMs;
}

/**
 * Handles a Stall condition: sets vigil state to 'stall', clears vigil_pass alarm,
 * updates badge to '!!' red, appends an Alert entry to the event ledger and pass tail.
 *
 * @param {{
 *   storageApi?: object,
 *   alarmsApi?: object,
 *   actionApi?: object,
 *   notificationsApi?: object,
 *   vigil?: object,
 *   now?: number,
 *   cause?: string,
 *   state?: string
 * }} params
 * @returns {Promise<object>} Updated vigil record
 */
export async function handleStall({
  storageApi,
  alarmsApi,
  actionApi,
  notificationsApi,
  vigil,
  now = Date.now(),
  cause = '10 minutes without a complete pass',
  state = PAGE_STATES.STEP2_BOUND,
}) {
  const updatedVigil = {
    ...(vigil || {}),
    state: 'stall',
    nextFireTime: null,
    lastChangeAt: now,
  };

  if (storageApi?.set) {
    await storageApi.set({ vigil: updatedVigil });
  }

  if (alarmsApi?.clear) {
    await alarmsApi.clear('vigil_pass');
  }

  updateBadge({ state: 'stall', actionApi });

  await appendLedgerEntry({
    entry: {
      tier: 'alert',
      type: 'stall',
      title: 'Stall',
      cause,
      timestamp: now,
    },
    storageApi,
    notificationsApi,
    alarmsApi,
    now,
  });

  const passRecord = {
    id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    state,
    complete: false,
    summary: `Stall: ${cause}`,
  };

  await appendPassTail({ passRecord, storageApi });

  return updatedVigil;
}

/**
 * Detects if any of the three reset conditions occurred for requested subjects:
 * 1. A Saved Slot appeared (previously unheld is now held).
 * 2. A Section appeared in dropdown options.
 * 3. A Section disappeared from dropdown options.
 *
 * @param {{
 *   previousHeldSnapshot?: Record<string|number, number|null>,
 *   currentHeldSnapshot?: Record<string|number, number|null>,
 *   previousSectionsSnapshot?: Record<string|number, Array<number>>,
 *   currentSectionsSnapshot?: Record<string|number, Array<number>>,
 *   requestedCourseIds?: Array<string|number>
 * }} params
 * @returns {{ reset: boolean, reason?: string }}
 */
export function detectResetConditions({
  previousHeldSnapshot = {},
  currentHeldSnapshot = {},
  previousSectionsSnapshot = {},
  currentSectionsSnapshot = {},
  requestedCourseIds = [],
}) {
  const courseIds = requestedCourseIds.map(String);

  for (const cid of courseIds) {
    const prevHeld = previousHeldSnapshot[cid];
    const currHeld = currentHeldSnapshot[cid];

    // Condition 1: Saved slot appeared
    if ((prevHeld === null || prevHeld === undefined) && currHeld !== null && currHeld !== undefined) {
      return { reset: true, reason: 'saved_slot_appeared' };
    }

    // Condition 2 & 3: Section appeared or disappeared from dropdown options
    const prevSecs = new Set(previousSectionsSnapshot[cid] || []);
    const currSecs = new Set(currentSectionsSnapshot[cid] || []);

    if (previousSectionsSnapshot[cid] && currentSectionsSnapshot[cid]) {
      for (const sId of currSecs) {
        if (!prevSecs.has(sId)) {
          return { reset: true, reason: 'section_appeared' };
        }
      }
      for (const sId of prevSecs) {
        if (!currSecs.has(sId)) {
          return { reset: true, reason: 'section_disappeared' };
        }
      }
    }
  }

  return { reset: false };
}

/**
 * Reconciles one plan subject against the live catalogue read per §8 table.
 *
 * @param {{
 *   planSubject: { courseCreationId: string|number, courseCode: string, sectionCreationId: string|number, sectionCode: string },
 *   course?: object
 * }} params
 * @returns {object}
 */
export function reconcileSubject({ planSubject, course }) {
  const wantedId = planSubject.sectionCreationId;
  const wantedCode = planSubject.sectionCode;

  if (!course) {
    return {
      courseCreationId: planSubject.courseCreationId,
      courseCode: planSubject.courseCode,
      wantedSectionCreationId: wantedId,
      wantedSectionCode: wantedCode,
      heldSectionCreationId: null,
      heldSectionCode: null,
      disposition: DISPOSITIONS.NONE_ABSENT,
      status: 'watching',
      isSatisfied: false,
      isWantedPresent: false,
    };
  }

  const heldId = course.heldSectionCreationId !== undefined && course.heldSectionCreationId !== null
    ? course.heldSectionCreationId
    : null;

  const sections = Array.isArray(course.sections) ? course.sections : [];
  const heldSection = heldId !== null ? sections.find((s) => idEquals(s.sectionCreationId, heldId)) : null;
  const heldSectionCode = heldSection ? (heldSection.sectionCode || heldSection.sectionName) : null;

  const wantedSection = sections.find((s) => idEquals(s.sectionCreationId, wantedId));
  const isWantedPresent = Boolean(wantedSection);

  let disposition = DISPOSITIONS.NONE_ABSENT;
  let status = 'watching';
  let isSatisfied = false;

  if (heldId === null) {
    disposition = isWantedPresent ? DISPOSITIONS.ACQUIRE : DISPOSITIONS.NONE_ABSENT;
  } else if (idEquals(heldId, wantedId)) {
    disposition = DISPOSITIONS.SATISFIED;
    status = 'satisfied';
    isSatisfied = true;
  } else if (isWantedPresent) {
    disposition = DISPOSITIONS.UPGRADE;
  } else {
    disposition = DISPOSITIONS.HELD_DIFF_ABSENT;
  }

  return {
    courseCreationId: planSubject.courseCreationId,
    courseCode: planSubject.courseCode,
    wantedSectionCreationId: wantedId,
    wantedSectionCode: wantedCode,
    heldSectionCreationId: heldId,
    heldSectionCode,
    disposition,
    status,
    isSatisfied,
    isWantedPresent,
  };
}

/**
 * Reconciles the full plan and identifies unrequested held courses to preserve.
 *
 * @param {{
 *   plan: { subjects?: Array<object> },
 *   courses?: Array<object>
 * }} params
 * @returns {{
 *   dispositions: Array<object>,
 *   unresolvedCount: number,
 *   allSatisfied: boolean,
 *   hasActionableDispositions: boolean
 * }}
 */
export function reconcilePlan({ plan, courses = [] }) {
  const planSubjects = Array.isArray(plan?.subjects) ? plan.subjects : [];
  const requestedCourseIds = new Set(planSubjects.map((s) => String(s.courseCreationId)));
  const dispositions = [];
  let unresolvedCount = 0;

  // Reconcile requested subjects
  for (const planSubject of planSubjects) {
    const course = courses.find((c) => idEquals(c.courseCreationId, planSubject.courseCreationId));
    const subResult = reconcileSubject({ planSubject, course });
    dispositions.push(subResult);
    if (!subResult.isSatisfied) {
      unresolvedCount++;
    }
  }

  // Preserve held unrequested subjects
  for (const course of courses) {
    if (
      !requestedCourseIds.has(String(course.courseCreationId)) &&
      (course.heldSectionCreationId !== null && course.heldSectionCreationId !== undefined || course.isRegistered === 1)
    ) {
      dispositions.push({
        courseCreationId: course.courseCreationId,
        courseCode: course.courseCode,
        wantedSectionCreationId: null,
        wantedSectionCode: null,
        heldSectionCreationId: course.heldSectionCreationId,
        disposition: DISPOSITIONS.PRESERVE,
        status: 'preserve',
        isSatisfied: true,
        isWantedPresent: false,
      });
    }
  }

  const allSatisfied = planSubjects.length > 0 && unresolvedCount === 0;
  const hasActionableDispositions = dispositions.some(
    (d) => d.disposition === DISPOSITIONS.ACQUIRE || d.disposition === DISPOSITIONS.UPGRADE
  );

  return {
    dispositions,
    unresolvedCount,
    allSatisfied,
    hasActionableDispositions,
  };
}

/**
 * Appends a pass record to the rolling pass tail in storage (capped at 200 rows).
 *
 * @param {{
 *   passRecord: object,
 *   storageApi?: object,
 *   maxTail?: number
 * }} params
 * @returns {Promise<Array<object>>} Updated pass tail array
 */
export async function appendPassTail({ passRecord, storageApi, maxTail = 200 }) {
  const currentData = storageApi?.get ? await storageApi.get(['passTail']) : {};
  const currentTail = Array.isArray(currentData?.passTail) ? currentData.passTail : [];

  let updatedTail = [...currentTail, passRecord];
  if (updatedTail.length > maxTail) {
    updatedTail = updatedTail.slice(-maxTail);
  }

  if (storageApi?.set) {
    await storageApi.set({ passTail: updatedTail });
  }

  return updatedTail;
}

/**
 * Appends a LoggedOut pass record to the pass tail when suspended.
 *
 * @param {{ storageApi?: object, now?: number }} params
 * @returns {Promise<Array<object>>}
 */
export async function recordSuspendedPass({ storageApi, now = Date.now() }) {
  const passRecord = {
    id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    state: PAGE_STATES.LOGGED_OUT,
    complete: false,
    summary: 'Session logged out — Vigil suspended',
  };
  return appendPassTail({ passRecord, storageApi });
}

/**
 * Stops the Vigil: sets state to Stopped, empties badge, clears alarms, and leaves plan intact.
 *
 * @param {{
 *   storageApi?: object,
 *   alarmsApi?: object,
 *   actionApi?: object,
 *   notificationsApi?: object,
 *   now?: number
 * }} params
 * @returns {Promise<{ state: string, vigil: object }>}
 */
export async function stopVigil({
  storageApi,
  alarmsApi,
  actionApi,
  notificationsApi,
  now = Date.now(),
}) {
  const currentData = storageApi?.get ? await storageApi.get(['vigil']) : {};
  const vigil = currentData?.vigil || {};

  const updatedVigil = {
    ...vigil,
    state: 'stopped',
    nextFireTime: null,
    lastChangeAt: now,
  };

  if (storageApi?.set) {
    await storageApi.set({ vigil: updatedVigil });
  }

  await resolveActiveAlert({ storageApi, alarmsApi });

  if (alarmsApi?.clear) {
    await alarmsApi.clear('vigil_pass');
    await alarmsApi.clear('vigil_start');
    await alarmsApi.clear('vigil_keepalive');
    await alarmsApi.clear('owned_tab_reload');
    await alarmsApi.clear('probe_session');
    await alarmsApi.clear('alert_repeat');
  }

  updateBadge({ state: 'stopped', actionApi });

  await appendLedgerEntry({
    entry: {
      tier: 'ambient',
      type: 'stopped',
      title: 'Vigil stopped',
      cause: 'Stopped by student',
      timestamp: now,
    },
    storageApi,
    notificationsApi,
    alarmsApi,
    now,
  });

  return { state: 'stopped', vigil: updatedVigil };
}

/**
 * Diffs the held courses immediately before the strike against the post-write read.
 * Unchanged or grown: normal Pass.
 * Shrunk: Lost Slot (a held course is no longer held).
 *
 * @param {{
 *   preHeldSnapshot: Record<string|number, number|null>,
 *   postHeldSnapshot: Record<string|number, number|null>,
 *   courses?: Array<object>
 * }} params
 * @returns {{
 *   isShrunk: boolean,
 *   lostSlots: Array<{ courseCreationId: string|number, preHeldSectionCreationId: string|number, courseCode?: string }>,
 *   retainedCount: number,
 *   gainedCount: number
 * }}
 */
export function diffHeldCourses({
  preHeldSnapshot = {},
  postHeldSnapshot = {},
  courses = [],
}) {
  const lostSlots = [];
  let retainedCount = 0;
  let gainedCount = 0;

  for (const [cidStr, preSectionId] of Object.entries(preHeldSnapshot)) {
    if (preSectionId !== null && preSectionId !== undefined) {
      const postSectionId = postHeldSnapshot[cidStr];
      if (postSectionId === null || postSectionId === undefined) {
        // Course was held before strike, now NOT held -> Lost Slot!
        const matchedCourse = courses.find((c) => idEquals(c.courseCreationId, cidStr));
        lostSlots.push({
          courseCreationId: cidStr,
          preHeldSectionCreationId: preSectionId,
          courseCode: matchedCourse ? matchedCourse.courseCode : cidStr,
        });
      } else {
        retainedCount++;
      }
    }
  }

  for (const [cidStr, postSectionId] of Object.entries(postHeldSnapshot)) {
    if (postSectionId !== null && postSectionId !== undefined) {
      const preSectionId = preHeldSnapshot[cidStr];
      if (preSectionId === null || preSectionId === undefined) {
        gainedCount++;
      }
    }
  }

  return {
    isShrunk: lostSlots.length > 0,
    lostSlots,
    retainedCount,
    gainedCount,
  };
}

/**
 * Executes a single Pass per SPEC §7, runs reconciliation on Step2Bound, updates storage & badge,
 * appends to passTail, and schedules the next pass tick.
 *
 * @param {{
 *   tabsApi?: object,
 *   storageApi?: object,
 *   alarmsApi?: object,
 *   actionApi?: object,
 *   notificationsApi?: object,
 *   fetchImpl?: typeof fetch,
 *   baseUrl?: string,
 *   now?: number
 * }} params
 * @returns {Promise<object>} Pass result summary
 */
export async function executePass({
  tabsApi = typeof chrome !== 'undefined' ? chrome?.tabs : null,
  storageApi = typeof chrome !== 'undefined' ? chrome?.storage?.local : null,
  alarmsApi = typeof chrome !== 'undefined' ? chrome?.alarms : null,
  actionApi = typeof chrome !== 'undefined' ? chrome?.action : null,
  notificationsApi = typeof chrome !== 'undefined' ? chrome?.notifications : null,
  fetchImpl = fetch,
  baseUrl = 'https://archershub.dlsu.edu.ph',
  now = Date.now(),
} = {}) {
  const data = storageApi?.get
    ? await storageApi.get(['vigil', 'plan', 'ownedTabId', 'lastSectionsSnapshot', 'lastHeldSnapshot', 'lastCompletePassAt'])
    : {};
  const vigil = data?.vigil;
  const plan = data?.plan;
  const ownedTabId = data?.ownedTabId;
  const lastCompletePassAt = data?.lastCompletePassAt;

  if (!vigil || vigil.state !== 'watching') {
    return { isComplete: false, reason: 'not_watching' };
  }

  // 1. Classify Page State via Owned Tab
  let pageState = PAGE_STATES.NO_TAB;
  let tabResponse = null;

  if (tabsApi && ownedTabId) {
    try {
      tabResponse = await tabsApi.sendMessage(ownedTabId, { type: 'CLASSIFY_PAGE' });
      pageState = tabResponse?.state || PAGE_STATES.NOT_INJECTED;
    } catch (_) {
      pageState = PAGE_STATES.NOT_INJECTED;
    }
  }

  // 2. If state is not Step2Bound, steer tab, record incomplete pass, and end pass here
  if (pageState !== PAGE_STATES.STEP2_BOUND) {
    let steerResult = null;
    if (tabsApi && ownedTabId) {
      steerResult = await steerOwnedTab({
        tabId: ownedTabId,
        tabsApi,
        storageApi,
        actionApi,
        alarmsApi,
        notificationsApi,
        baseUrl,
        now,
      });
    }

    if (pageState === PAGE_STATES.LOGGED_OUT || steerResult?.state === PAGE_STATES.LOGGED_OUT || steerResult?.action === 'suspend') {
      await recordSuspendedPass({ storageApi, now });
      return { isComplete: false, state: 'suspended' };
    }

    if (pageState === PAGE_STATES.UNRECOGNISED || steerResult?.state === PAGE_STATES.UNRECOGNISED || steerResult?.action === 'abort') {
      const passRecord = {
        id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: now,
        state: PAGE_STATES.UNRECOGNISED,
        complete: false,
        summary: 'Unrecognised page state — Vigil aborted',
      };
      await appendPassTail({ passRecord, storageApi });
      return { isComplete: false, state: 'aborted' };
    }

    // Check Stall Clock for prolonged non-Step2Bound conditions
    if (checkStall({ lastCompletePassAt, startedAt: vigil.startedAt, now })) {
      await handleStall({
        storageApi,
        alarmsApi,
        actionApi,
        notificationsApi,
        vigil,
        now,
        cause: `Page state ${pageState} — 10 minutes without a complete pass`,
        state: pageState,
      });
      return { isComplete: false, state: 'stall', reason: 'stall' };
    }

    const nextDelay = computeNextPassDelay({
      lastChangeAt: vigil.lastChangeAt,
      now,
      rateLimited: vigil.rateLimited,
    });

    const passRecord = {
      id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      state: pageState,
      complete: false,
      interval: nextDelay,
      summary: `Page state ${pageState} — non-complete pass`,
    };

    await appendPassTail({ passRecord, storageApi });

    if (alarmsApi?.create) {
      alarmsApi.create('vigil_pass', { delayInMinutes: Math.max(0.01, nextDelay / 60000) });
    }

    return { isComplete: false, state: pageState };
  }

  // 3. Step2Bound reached: Read catalogue over HTTP scoped to requested subjects
  let catalogue = null;
  try {
    catalogue = await readCatalogue(fetchImpl, baseUrl);
  } catch (err) {
    catalogue = { loggedIn: false, error: err?.message };
  }

  // Handle HTTP error responses & session loss
  if (!catalogue || catalogue.loggedIn === false) {
    const errorStatus = catalogue?.status;

    if (errorStatus === 429 || errorStatus === 403 || errorStatus === 500) {
      if (checkStall({ lastCompletePassAt, startedAt: vigil.startedAt, now })) {
        await handleStall({
          storageApi,
          alarmsApi,
          actionApi,
          notificationsApi,
          vigil,
          now,
          cause: `HTTP ${errorStatus} response — 10 minutes without a complete pass`,
          state: PAGE_STATES.STEP2_BOUND,
        });
        return { isComplete: false, state: 'stall', error: errorStatus };
      }

      const updatedVigil = { ...vigil };
      if (errorStatus === 429 || errorStatus === 403) {
        updatedVigil.rateLimited = true;
      }

      const nextDelay = computeNextPassDelay({
        lastChangeAt: updatedVigil.lastChangeAt,
        now,
        rateLimited: updatedVigil.rateLimited,
      });

      updatedVigil.nextFireTime = now + nextDelay;

      if (storageApi?.set) {
        await storageApi.set({ vigil: updatedVigil });
      }

      const passRecord = {
        id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: now,
        state: PAGE_STATES.STEP2_BOUND,
        complete: false,
        error: errorStatus,
        interval: nextDelay,
        summary: `HTTP Error ${errorStatus} — treated as ${errorStatus === 500 ? 'no-change' : 'rate-limited'}`,
      };

      await appendPassTail({ passRecord, storageApi });

      if (alarmsApi?.create) {
        alarmsApi.create('vigil_pass', { delayInMinutes: Math.max(0.01, nextDelay / 60000) });
      }

      return { isComplete: false, error: errorStatus };
    }

    if (catalogue?.error) {
      if (checkStall({ lastCompletePassAt, startedAt: vigil.startedAt, now })) {
        await handleStall({
          storageApi,
          alarmsApi,
          actionApi,
          notificationsApi,
          vigil,
          now,
          cause: `Read failed (${catalogue.error}) — 10 minutes without a complete pass`,
          state: PAGE_STATES.STEP2_BOUND,
        });
        return { isComplete: false, state: 'stall', error: catalogue.error };
      }
    }

    // Session logged out mid-Vigil! Suspend the Vigil per SPEC §6, §9
    await handleLoggedOutSuspend({
      storageApi,
      actionApi,
      alarmsApi,
      notificationsApi,
      tabsApi,
      baseUrl,
      now,
    });

    await recordSuspendedPass({ storageApi, now });

    return { isComplete: false, state: 'suspended' };
  }

  // 4. Run Reconciliation against successful read
  const courses = Array.isArray(catalogue.courses) ? catalogue.courses : [];
  const reconciliation = reconcilePlan({ plan, courses });

  // 5. Detect Reset Conditions
  const requestedCourseIds = Array.isArray(plan?.subjects)
    ? plan.subjects.map((s) => s.courseCreationId)
    : [];

  const currentHeldSnapshot = {};
  const currentSectionsSnapshot = {};
  for (const c of courses) {
    currentHeldSnapshot[c.courseCreationId] = c.heldSectionCreationId ?? null;
    currentSectionsSnapshot[c.courseCreationId] = Array.isArray(c.sections)
      ? c.sections.map((s) => s.sectionCreationId)
      : [];
  }

  const resetResult = detectResetConditions({
    previousHeldSnapshot: data?.lastHeldSnapshot || vigil?.previousHeldSnapshot,
    currentHeldSnapshot,
    previousSectionsSnapshot: data?.lastSectionsSnapshot || vigil?.previousSectionsSnapshot,
    currentSectionsSnapshot,
    requestedCourseIds,
  });

  const updatedVigil = {
    ...vigil,
    previousHeldSnapshot: currentHeldSnapshot,
    previousSectionsSnapshot: currentSectionsSnapshot,
  };

  if (resetResult.reset && !updatedVigil.rateLimited) {
    updatedVigil.lastChangeAt = now;
  }

  // 6. Check if Vigil is already Complete (all subjects held at Wanted Section)
  if (reconciliation.allSatisfied) {
    updatedVigil.state = 'complete';
    updatedVigil.nextFireTime = null;
    updatedVigil.lastChangeAt = now;

    if (storageApi?.set) {
      await storageApi.set({
        vigil: updatedVigil,
        lastCompletePassAt: now,
        reconciliation,
        lastHeldSnapshot: currentHeldSnapshot,
        lastSectionsSnapshot: currentSectionsSnapshot,
      });
    }

    if (alarmsApi?.clear) {
      await alarmsApi.clear('vigil_pass');
    }

    updateBadge({ state: 'complete', actionApi });

    await appendLedgerEntry({
      entry: {
        tier: 'notice',
        type: 'complete',
        title: 'Vigil complete',
        cause: 'Every subject holds its Wanted Section',
        timestamp: now,
      },
      storageApi,
      notificationsApi,
      alarmsApi,
      now,
    });

    const passRecord = {
      id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      state: PAGE_STATES.STEP2_BOUND,
      complete: true,
      unresolvedCount: 0,
      allSatisfied: true,
      dispositions: reconciliation.dispositions,
      summary: 'Complete — all subjects satisfied',
    };

    await appendPassTail({ passRecord, storageApi });

    return {
      isComplete: true,
      state: 'complete',
      unresolvedCount: 0,
      allSatisfied: true,
      reconciliation,
    };
  }

  // 7. Check if Actionable Dispositions Exist -> The Strike!
  if (reconciliation.hasActionableDispositions && tabsApi && ownedTabId) {
    if (storageApi?.set) {
      await storageApi.set({ strikePending: true });
    }

    let strikeResponse = null;
    try {
      strikeResponse = await tabsApi.sendMessage(ownedTabId, {
        type: 'EXECUTE_STRIKE',
        dispositions: reconciliation.dispositions,
        heldCourses: courses,
      });
    } catch (err) {
      strikeResponse = { success: false, clicked: false, reason: err?.message };
    } finally {
      if (storageApi?.set) {
        await storageApi.set({ strikePending: false });
      }
    }

    // If Save Gate refused or strike could not click
    if (!strikeResponse?.clicked) {
      // Check Stall Clock for Save Gate refusal
      if (checkStall({ lastCompletePassAt, startedAt: vigil.startedAt, now })) {
        await handleStall({
          storageApi,
          alarmsApi,
          actionApi,
          notificationsApi,
          vigil,
          now,
          cause: `Save Gate refused: ${strikeResponse?.reason || 'unapproved'} — 10 minutes without a complete pass`,
          state: PAGE_STATES.STEP2_BOUND,
        });
        return {
          isComplete: false,
          state: 'stall',
          strikePerformed: false,
          saveGateApproved: false,
          reason: strikeResponse?.reason,
          reconciliation,
        };
      }

      const nextDelay = computeNextPassDelay({
        lastChangeAt: updatedVigil.lastChangeAt,
        now,
        rateLimited: updatedVigil.rateLimited,
      });

      updatedVigil.nextFireTime = now + nextDelay;

      if (storageApi?.set) {
        await storageApi.set({
          vigil: updatedVigil,
          reconciliation,
          lastHeldSnapshot: currentHeldSnapshot,
          lastSectionsSnapshot: currentSectionsSnapshot,
        });
      }

      const passRecord = {
        id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: now,
        state: PAGE_STATES.STEP2_BOUND,
        complete: false,
        interval: nextDelay,
        unresolvedCount: reconciliation.unresolvedCount,
        allSatisfied: false,
        dispositions: reconciliation.dispositions,
        summary: `Save Gate refused: ${strikeResponse?.reason || 'unapproved'}`,
      };

      await appendPassTail({ passRecord, storageApi });

      if (alarmsApi?.create) {
        alarmsApi.create('vigil_pass', { delayInMinutes: Math.max(0.01, nextDelay / 60000) });
      }

      return {
        isComplete: false,
        state: 'watching',
        strikePerformed: false,
        saveGateApproved: false,
        reason: strikeResponse?.reason,
        reconciliation,
      };
    }

    // Strike clicked! #btnEnlistment was clicked once.
    // Post-Write: Re-read catalogue over HTTP and diff held set
    let postCatalogue = null;
    try {
      postCatalogue = await readCatalogue(fetchImpl, baseUrl);
    } catch (err) {
      postCatalogue = { loggedIn: false, error: err?.message };
    }

    const postCourses = Array.isArray(postCatalogue?.courses) ? postCatalogue.courses : courses;
    const postHeldSnapshot = {};
    const postSectionsSnapshot = {};
    for (const c of postCourses) {
      postHeldSnapshot[c.courseCreationId] = c.heldSectionCreationId ?? null;
      postSectionsSnapshot[c.courseCreationId] = Array.isArray(c.sections)
        ? c.sections.map((s) => s.sectionCreationId)
        : [];
    }

    // Diff held set against pre-click snapshot
    const diffResult = diffHeldCourses({
      preHeldSnapshot: currentHeldSnapshot,
      postHeldSnapshot,
      courses: postCourses,
    });

    if (diffResult.isShrunk) {
      // Lost Slot! Tier: Notice (does NOT stop the Vigil)
      for (const lost of diffResult.lostSlots) {
        await appendLedgerEntry({
          entry: {
            tier: 'notice',
            type: 'lost_slot',
            title: 'Lost Slot',
            cause: `Held slot for ${lost.courseCode} was lost during switch`,
            timestamp: now,
          },
          storageApi,
          notificationsApi,
          alarmsApi,
          now,
        });
      }
    }

    // Reconcile against post-write catalogue
    const postReconciliation = reconcilePlan({ plan, courses: postCourses });

    // A write occurred, so reset cadence
    updatedVigil.lastChangeAt = now;
    updatedVigil.previousHeldSnapshot = postHeldSnapshot;
    updatedVigil.previousSectionsSnapshot = postSectionsSnapshot;

    if (postReconciliation.allSatisfied) {
      updatedVigil.state = 'complete';
      updatedVigil.nextFireTime = null;

      if (storageApi?.set) {
        await storageApi.set({
          vigil: updatedVigil,
          lastCompletePassAt: now,
          reconciliation: postReconciliation,
          lastHeldSnapshot: postHeldSnapshot,
          lastSectionsSnapshot: postSectionsSnapshot,
        });
      }

      if (alarmsApi?.clear) {
        await alarmsApi.clear('vigil_pass');
      }

      updateBadge({ state: 'complete', actionApi });

      await appendLedgerEntry({
        entry: {
          tier: 'notice',
          type: 'complete',
          title: 'Vigil complete',
          cause: 'Every subject holds its Wanted Section',
          timestamp: now,
        },
        storageApi,
        notificationsApi,
        alarmsApi,
        now,
      });

      const passRecord = {
        id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: now,
        state: PAGE_STATES.STEP2_BOUND,
        complete: true,
        unresolvedCount: 0,
        allSatisfied: true,
        strikePerformed: true,
        dispositions: postReconciliation.dispositions,
        summary: 'Strike executed: Complete — all subjects satisfied',
      };

      await appendPassTail({ passRecord, storageApi });

      return {
        isComplete: true,
        state: 'complete',
        strikePerformed: true,
        unresolvedCount: 0,
        allSatisfied: true,
        reconciliation: postReconciliation,
      };
    }

    // Strike performed, but still watching some subjects
    const nextDelay = computeNextPassDelay({
      lastChangeAt: updatedVigil.lastChangeAt,
      now,
      rateLimited: updatedVigil.rateLimited,
    });

    updatedVigil.nextFireTime = now + nextDelay;

    if (storageApi?.set) {
      await storageApi.set({
        vigil: updatedVigil,
        lastCompletePassAt: now,
        reconciliation: postReconciliation,
        lastHeldSnapshot: postHeldSnapshot,
        lastSectionsSnapshot: postSectionsSnapshot,
      });
    }

    updateBadge({
      state: 'watching',
      unresolvedCount: postReconciliation.unresolvedCount,
      actionApi,
    });

    const passRecord = {
      id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      state: PAGE_STATES.STEP2_BOUND,
      complete: true,
      strikePerformed: true,
      interval: nextDelay,
      unresolvedCount: postReconciliation.unresolvedCount,
      allSatisfied: false,
      dispositions: postReconciliation.dispositions,
      summary: `Strike executed: ${postReconciliation.unresolvedCount} watching`,
    };

    await appendPassTail({ passRecord, storageApi });

    if (alarmsApi?.create) {
      alarmsApi.create('vigil_pass', { delayInMinutes: Math.max(0.01, nextDelay / 60000) });
    }

    return {
      isComplete: true,
      state: 'watching',
      strikePerformed: true,
      unresolvedCount: postReconciliation.unresolvedCount,
      allSatisfied: false,
      reconciliation: postReconciliation,
    };
  }

  // 8. No Actionable Dispositions (watching, sections still full): Update badge, record pass, schedule next tick
  const nextDelay = computeNextPassDelay({
    lastChangeAt: updatedVigil.lastChangeAt,
    now,
    rateLimited: updatedVigil.rateLimited,
  });

  updatedVigil.nextFireTime = now + nextDelay;

  if (storageApi?.set) {
    await storageApi.set({
      vigil: updatedVigil,
      lastCompletePassAt: now,
      reconciliation,
      lastHeldSnapshot: currentHeldSnapshot,
      lastSectionsSnapshot: currentSectionsSnapshot,
    });
  }

  updateBadge({
    state: 'watching',
    unresolvedCount: reconciliation.unresolvedCount,
    actionApi,
  });

  const passRecord = {
    id: `pass_${now}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    state: PAGE_STATES.STEP2_BOUND,
    complete: true,
    interval: nextDelay,
    unresolvedCount: reconciliation.unresolvedCount,
    allSatisfied: false,
    dispositions: reconciliation.dispositions,
    summary: `Step2Bound: ${reconciliation.unresolvedCount} watching`,
  };

  await appendPassTail({ passRecord, storageApi });

  if (alarmsApi?.create) {
    alarmsApi.create('vigil_pass', { delayInMinutes: Math.max(0.01, nextDelay / 60000) });
  }

  return {
    isComplete: true,
    state: 'watching',
    unresolvedCount: reconciliation.unresolvedCount,
    allSatisfied: false,
    reconciliation,
  };
}


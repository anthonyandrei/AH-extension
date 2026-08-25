/**
 * Page State classifier and inner reclassification loop for ArchersHub enlistment.
 * Implements docs/SPEC.md §6 and ADR-0001 (12 ordered states, first match wins, stateless).
 */

export const PAGE_STATES = Object.freeze({
  NO_TAB: 'NoTab',
  LOGGED_OUT: 'LoggedOut',
  WRONG_PAGE: 'WrongPage',
  NOT_INJECTED: 'NotInjected',
  SETTLING: 'Settling',
  ACTIVITY_CLOSED: 'ActivityClosed',
  STEP1_UNCONFIGURED: 'Step1Unconfigured',
  STEP1_CONFIGURED: 'Step1Configured',
  STEP2_UNBOUND: 'Step2Unbound',
  STEP2_BOUND: 'Step2Bound',
  STEP3_REACHED: 'Step3Reached',
  UNRECOGNISED: 'Unrecognised',
});

export const INNER_LOOP_STATES = new Set([
  PAGE_STATES.SETTLING,
  PAGE_STATES.ACTIVITY_CLOSED,
  PAGE_STATES.STEP1_UNCONFIGURED,
  PAGE_STATES.STEP1_CONFIGURED,
  PAGE_STATES.STEP2_UNBOUND,
]);

/**
 * Safely looks up an element by ID on the document.
 * @param {Document|null} doc
 * @param {string} id
 * @returns {Element|null}
 */
function getById(doc, id) {
  if (!doc) return null;
  return doc.getElementById ? doc.getElementById(id) : (doc.querySelector ? doc.querySelector(`#${id}`) : null);
}

/**
 * Checks if a DOM element is visible without relying on class names or button text.
 * @param {Element|null} element
 * @param {Window|null} win
 * @returns {boolean}
 */
export function isElementVisible(element, win = (typeof window !== 'undefined' ? window : null)) {
  if (!element) return false;

  if (element.hidden === true) return false;

  if (element.style) {
    if (element.style.display === 'none') return false;
    if (element.style.visibility === 'hidden') return false;
    if (element.style.opacity === '0') return false;
  }

  if (win && typeof win.getComputedStyle === 'function') {
    try {
      const computed = win.getComputedStyle(element);
      if (computed) {
        if (computed.display === 'none' || computed.visibility === 'hidden' || Number(computed.opacity) === 0) {
          return false;
        }
      }
    } catch (_) {}
  }

  if (typeof element.getBoundingClientRect === 'function') {
    try {
      const rect = element.getBoundingClientRect();
      if (rect) {
        if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.bottom === 0) {
          if (element.offsetParent === null && !element.matches?.('body, html')) {
            return false;
          }
        }
      }
    } catch (_) {}
  }

  return true;
}

/**
 * Captures a snapshot of the DOM for diagnostic triage on Unrecognised states.
 * @param {Document|null} doc
 * @param {Window|null} win
 * @returns {{ html: string, title: string, url: string, timestamp: number }}
 */
export function captureDomSnapshot(doc, win = (typeof window !== 'undefined' ? window : null)) {
  if (!doc) {
    return { html: '', title: '', url: '', timestamp: Date.now() };
  }
  const html = doc.documentElement
    ? (doc.documentElement.outerHTML || doc.documentElement.innerHTML || '')
    : (doc.body ? doc.body.outerHTML : '');
  const title = doc.title || '';
  const url = (win && win.location && win.location.href) || (doc.location && doc.location.href) || '';
  return {
    html,
    title,
    url,
    timestamp: Date.now(),
  };
}

/**
 * Classifies the given DOM into one of the 12 ordered Page States.
 * Evaluated strictly in order, top to bottom, first match wins.
 *
 * @param {object} options
 * @param {Document} [options.document]
 * @param {Window} [options.window]
 * @param {Location} [options.location]
 * @param {boolean} [options.hasTab]
 * @param {boolean} [options.injected]
 * @returns {{ state: string, timestamp: number, domSnapshot?: string, snapshot?: object }}
 */
export function classifyPageState(options = {}) {
  const doc = options.document !== undefined ? options.document : (typeof document !== 'undefined' ? document : null);
  const win = options.window !== undefined ? options.window : (typeof window !== 'undefined' ? window : null);
  const loc = options.location || (win && win.location) || (doc && doc.location) || null;
  const hasTab = options.hasTab !== undefined ? options.hasTab : (doc !== null);
  const injected = options.injected !== undefined ? options.injected : true;

  // 1. NoTab (Observer: BG)
  if (!hasTab || !doc) {
    return { state: PAGE_STATES.NO_TAB, timestamp: Date.now() };
  }

  // 2. LoggedOut (Observer: BG / CS)
  const title = (doc.title || '').trim().toLowerCase();
  const isLoginTitle = title === 'login' || title.includes('login');
  const divLogin = getById(doc, 'divLogin');
  const isLoginUrl = Boolean(loc && loc.pathname && (loc.pathname === '/' || loc.pathname.toLowerCase().includes('/login') || loc.pathname.toLowerCase().includes('/account/login')));

  if (isLoginTitle || (isLoginUrl && Boolean(divLogin))) {
    return { state: PAGE_STATES.LOGGED_OUT, timestamp: Date.now() };
  }

  // 3. WrongPage (Observer: BG / CS)
  if (loc && loc.hostname && loc.hostname.includes('archershub.dlsu.edu.ph')) {
    const pathname = loc.pathname || '';
    const isEnlistmentPath = /\/Enlistment(_V2)?(\/Index)?/i.test(pathname);
    const hasEnlistmentShell = Boolean(
      getById(doc, 'hdfAcademicSessionId') ||
      getById(doc, 'STEP1') ||
      getById(doc, 'STEP2') ||
      getById(doc, 'STEP3')
    );
    if (!isEnlistmentPath && !hasEnlistmentShell) {
      return { state: PAGE_STATES.WRONG_PAGE, timestamp: Date.now() };
    }
  }

  // 4. NotInjected (Observer: BG)
  if (injected === false) {
    return { state: PAGE_STATES.NOT_INJECTED, timestamp: Date.now() };
  }

  // 5. Settling (Observer: CS)
  const isBodyLoader = Boolean(doc.body && doc.body.classList && doc.body.classList.contains('loader-active'));
  const myLoader = getById(doc, 'MyLoader');
  const isMyLoaderVisible = Boolean(myLoader && isElementVisible(myLoader, win));
  const fullPageLoader = doc.querySelector ? doc.querySelector('.full-page-loader') : null;
  const isFullPageLoaderVisible = Boolean(fullPageLoader && isElementVisible(fullPageLoader, win));

  if (isBodyLoader || isMyLoaderVisible || isFullPageLoaderVisible) {
    return { state: PAGE_STATES.SETTLING, timestamp: Date.now() };
  }

  // 6. ActivityClosed (Observer: CS)
  const divAlertMessage = getById(doc, 'divAlertMessage');
  if (divAlertMessage && isElementVisible(divAlertMessage, win)) {
    return { state: PAGE_STATES.ACTIVITY_CLOSED, timestamp: Date.now() };
  }

  // Helper for strictly scoped step pane active checks
  function isPaneActive(paneId) {
    const pane = getById(doc, paneId);
    return Boolean(pane && pane.classList && pane.classList.contains('active'));
  }

  const isStep1Active = isPaneActive('STEP1');
  const isStep2Active = isPaneActive('STEP2');
  const isStep3Active = isPaneActive('STEP3');

  const btnAdd = getById(doc, 'btnAdd');

  // 7. Step1Unconfigured (Observer: CS)
  if (isStep1Active && btnAdd && isElementVisible(btnAdd, win)) {
    return { state: PAGE_STATES.STEP1_UNCONFIGURED, timestamp: Date.now() };
  }

  // 8. Step1Configured (Observer: CS)
  // DOM signal: #btnAdd present, display: none
  if (btnAdd && !isElementVisible(btnAdd, win)) {
    const computedDisplay = (win && typeof win.getComputedStyle === 'function')
      ? win.getComputedStyle(btnAdd)?.display
      : btnAdd.style?.display;
    if (computedDisplay === 'none' || btnAdd.style?.display === 'none') {
      return { state: PAGE_STATES.STEP1_CONFIGURED, timestamp: Date.now() };
    }
  }

  // 9. Step2Unbound (Observer: CS)
  const tblRegularCourses = getById(doc, 'tblRegularCourses');
  let courseRowsCount = 0;
  if (tblRegularCourses) {
    if (tblRegularCourses.querySelectorAll) {
      const tbodyRows = tblRegularCourses.querySelectorAll('tbody tr');
      if (tbodyRows && tbodyRows.length > 0) {
        courseRowsCount = tbodyRows.length;
      } else {
        const allRows = tblRegularCourses.querySelectorAll('tr');
        courseRowsCount = allRows ? allRows.length : 0;
      }
    } else if (tblRegularCourses.rows) {
      courseRowsCount = tblRegularCourses.rows.length;
    }
  }

  if (isStep2Active && courseRowsCount === 0) {
    return { state: PAGE_STATES.STEP2_UNBOUND, timestamp: Date.now() };
  }

  // 10. Step2Bound (Observer: CS)
  const btnEnlistment = getById(doc, 'btnEnlistment');
  if (isStep2Active && courseRowsCount > 0 && btnEnlistment && isElementVisible(btnEnlistment, win)) {
    return { state: PAGE_STATES.STEP2_BOUND, timestamp: Date.now() };
  }

  // 11. Step3Reached (Observer: CS)
  if (isStep3Active) {
    return { state: PAGE_STATES.STEP3_REACHED, timestamp: Date.now() };
  }

  // 12. Unrecognised (Observer: CS)
  const snapshot = captureDomSnapshot(doc, win);
  return {
    state: PAGE_STATES.UNRECOGNISED,
    timestamp: Date.now(),
    domSnapshot: snapshot.html,
    snapshot,
  };
}

/**
 * Executes the appropriate DOM action for the current Page State per SPEC §6.
 *
 * @param {object} options
 * @param {string} [options.state] - Optional explicit state, otherwise classified fresh
 * @param {Document} [options.document]
 * @param {Window} [options.window]
 * @param {Location} [options.location]
 * @returns {{ success: boolean, action: string, state: string, snapshot?: object }}
 */
export function executeStateAction(options = {}) {
  const doc = options.document !== undefined ? options.document : (typeof document !== 'undefined' ? document : null);
  const win = options.window !== undefined ? options.window : (typeof window !== 'undefined' ? window : null);
  const loc = options.location || (win && win.location) || (doc && doc.location) || null;

  const state = options.state || classifyPageState({ document: doc, window: win, location: loc }).state;

  switch (state) {
    case PAGE_STATES.STEP1_UNCONFIGURED: {
      const rdoOpenSection = getById(doc, 'rdoOpenSection');
      if (rdoOpenSection) {
        if (!rdoOpenSection.checked) {
          rdoOpenSection.checked = true;
          if (typeof rdoOpenSection.dispatchEvent === 'function') {
            try {
              rdoOpenSection.dispatchEvent(new Event('input', { bubbles: true }));
              rdoOpenSection.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (_) {}
          }
        }
        if (typeof rdoOpenSection.click === 'function') {
          rdoOpenSection.click();
        }
      }
      const btnAdd = getById(doc, 'btnAdd');
      if (btnAdd && isElementVisible(btnAdd, win) && !btnAdd.disabled && typeof btnAdd.click === 'function') {
        btnAdd.click();
      }
      return { success: true, action: 'open_section_and_add', state };
    }

    case PAGE_STATES.STEP1_CONFIGURED: {
      const divBind = getById(doc, 'DivBindCourseList');
      if (divBind && typeof divBind.click === 'function') {
        divBind.click();
      }
      return { success: true, action: 'bind_course_list', state };
    }

    case PAGE_STATES.STEP2_UNBOUND: {
      const divBind = getById(doc, 'DivBindCourseList');
      if (divBind && typeof divBind.click === 'function') {
        divBind.click();
      }
      return { success: true, action: 'bind_course_list', state };
    }

    case PAGE_STATES.SETTLING:
      return { success: true, action: 'wait', state };

    case PAGE_STATES.ACTIVITY_CLOSED:
      return { success: true, action: 'wait', state };

    case PAGE_STATES.STEP2_BOUND:
      return { success: true, action: 'bound', state };

    case PAGE_STATES.STEP3_REACHED:
      return { success: true, action: 'step3_reached', state };

    case PAGE_STATES.WRONG_PAGE: {
      if (loc) {
        loc.href = '/Enlistment_V2/Index';
      }
      return { success: true, action: 'navigate', state };
    }

    case PAGE_STATES.LOGGED_OUT:
      return { success: false, action: 'suspend', state };

    case PAGE_STATES.UNRECOGNISED: {
      const snapshot = captureDomSnapshot(doc, win);
      return { success: false, action: 'abort', state, snapshot };
    }

    case PAGE_STATES.NO_TAB:
    case PAGE_STATES.NOT_INJECTED:
    default:
      return { success: false, action: 'bg_handled', state };
  }
}

/**
 * Runs the 250ms inner reclassification loop while in states 5–9.
 * Stops automatically when Step2Bound (or any other state outside 5–9) is reached.
 *
 * @param {object} options
 * @param {Document} [options.document]
 * @param {Window} [options.window]
 * @param {Location} [options.location]
 * @param {boolean} [options.autoAct]
 * @param {number} [options.intervalMs]
 * @param {(result: object) => void} [options.onStateChange]
 * @param {(result: object) => void} [options.onStop]
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @returns {{ stop: () => void, isRunning: () => boolean }}
 */
export function startInnerLoop(options = {}) {
  const intervalMs = options.intervalMs || 250;
  const doc = options.document !== undefined ? options.document : (typeof document !== 'undefined' ? document : null);
  const win = options.window !== undefined ? options.window : (typeof window !== 'undefined' ? window : null);
  const loc = options.location || (win && win.location) || (doc && doc.location) || null;
  const autoAct = options.autoAct !== undefined ? options.autoAct : false;
  const onStateChange = options.onStateChange || (() => {});
  const onStop = options.onStop || (() => {});
  const setTimeoutFn = options.setTimeoutImpl || setTimeout;
  const clearTimeoutFn = options.clearTimeoutImpl || clearTimeout;

  let timerId = null;
  let stopped = false;
  let lastState = null;

  function tick() {
    if (stopped) return;
    const result = classifyPageState({ document: doc, window: win, location: loc });

    if (result.state !== lastState) {
      lastState = result.state;
      onStateChange(result);
    }

    if (autoAct && INNER_LOOP_STATES.has(result.state)) {
      executeStateAction({ state: result.state, document: doc, window: win, location: loc });
    }

    if (INNER_LOOP_STATES.has(result.state)) {
      timerId = setTimeoutFn(tick, intervalMs);
    } else {
      stopped = true;
      timerId = null;
      onStop(result);
    }
  }

  // Initial immediate tick
  tick();

  return {
    stop: () => {
      stopped = true;
      if (timerId !== null) {
        clearTimeoutFn(timerId);
        timerId = null;
      }
    },
    isRunning: () => !stopped,
  };
}

/**
 * Handles incoming runtime messages for the content script.
 * @param {any} message
 * @param {any} sender
 * @param {(response: any) => void} sendResponse
 * @param {object} deps
 * @returns {boolean}
 */
export function handleContentMessage(message, sender, sendResponse, deps = {}) {
  const classifyFn = deps.classifyPageState || classifyPageState;
  const startInnerLoopFn = deps.startInnerLoop || startInnerLoop;
  const executeActionFn = deps.executeStateAction || executeStateAction;

  const msgType = typeof message === 'string' ? message : message?.type;

  if (msgType === 'PING' || msgType === 'ping') {
    sendResponse({ ok: true, pong: true });
    return false;
  }

  if (msgType === 'CLASSIFY_PAGE' || msgType === 'classify') {
    const result = classifyFn({
      document: deps.document,
      window: deps.window,
      location: deps.location,
    });
    sendResponse({ success: true, ...result });
    return false;
  }

  if (msgType === 'EXECUTE_ACTION' || msgType === 'executeAction') {
    const result = executeActionFn({
      state: message?.state,
      document: deps.document,
      window: deps.window,
      location: deps.location,
    });
    sendResponse({ success: true, ...result });
    return false;
  }

  if (msgType === 'STEER_TAB' || msgType === 'START_INNER_LOOP') {
    if (deps.activeLoop && deps.activeLoop.isRunning && deps.activeLoop.isRunning()) {
      deps.activeLoop.stop();
    }
    const autoAct = msgType === 'STEER_TAB' || Boolean(message?.autoAct);
    const loop = startInnerLoopFn({
      document: deps.document,
      window: deps.window,
      location: deps.location,
      autoAct,
      onStateChange: (stateRes) => {
        if (deps.sendMessage) {
          deps.sendMessage({ type: 'PAGE_STATE_CHANGED', ...stateRes });
        }
      },
      onStop: (finalRes) => {
        if (deps.sendMessage) {
          if (finalRes.state === PAGE_STATES.STEP2_BOUND) {
            deps.sendMessage({ type: 'STEP2_BOUND_REACHED', ...finalRes });
          } else if (finalRes.state === PAGE_STATES.UNRECOGNISED) {
            deps.sendMessage({ type: 'UNRECOGNISED_STATE', ...finalRes });
          } else if (finalRes.state === PAGE_STATES.LOGGED_OUT) {
            deps.sendMessage({ type: 'LOGGED_OUT_STATE', ...finalRes });
          } else {
            deps.sendMessage({ type: 'INNER_LOOP_STOPPED', ...finalRes });
          }
        }
      },
    });
    if (deps.setActiveLoop) {
      deps.setActiveLoop(loop);
    }
    sendResponse({ success: true, isRunning: loop.isRunning() });
    return false;
  }

  if (msgType === 'STOP_INNER_LOOP') {
    if (deps.activeLoop && deps.activeLoop.stop) {
      deps.activeLoop.stop();
    }
    sendResponse({ success: true, isRunning: false });
    return false;
  }

  return false;
}


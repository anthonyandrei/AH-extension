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
export function getById(doc, id) {
  if (!doc) return null;
  return doc.getElementById ? doc.getElementById(id) : (doc.querySelector ? doc.querySelector(`#${id}`) : null);
}

/**
 * Locates a course table row inside #tblRegularCourses.
 *
 * @param {Element|null} tbl
 * @param {string|number} courseCreationId
 * @param {string} [courseCode]
 * @returns {Element|null}
 */
export function findCourseRow(tbl, courseCreationId, courseCode = '') {
  if (!tbl) return null;
  const rows = tbl.querySelectorAll
    ? (tbl.querySelectorAll('tbody tr').length > 0 ? tbl.querySelectorAll('tbody tr') : tbl.querySelectorAll('tr'))
    : (tbl.rows || []);

  const cidStr = courseCreationId !== undefined && courseCreationId !== null ? String(courseCreationId).trim() : '';
  const codeStr = courseCode ? String(courseCode).trim().toUpperCase() : '';

  for (const row of rows) {
    // 1. Check data attributes
    const rowCid = row.getAttribute?.('data-course-creation-id') || row.getAttribute?.('data-course-id') || row.dataset?.courseCreationId || row.dataset?.courseId;
    if (cidStr && rowCid && String(rowCid).trim() === cidStr) {
      return row;
    }

    const rowCode = row.getAttribute?.('data-course-code') || row.dataset?.courseCode;
    if (codeStr && rowCode && String(rowCode).trim().toUpperCase() === codeStr) {
      return row;
    }

    // 2. Check hidden inputs in row
    const hiddenCid = row.querySelector?.('input[name*="COURSE_CREATION_ID"], input[name*="CourseCreationId"], input[data-course-creation-id]');
    if (cidStr && hiddenCid && (String(hiddenCid.value).trim() === cidStr || String(hiddenCid.getAttribute?.('data-course-creation-id')).trim() === cidStr)) {
      return row;
    }
  }

  return null;
}

/**
 * Extracts form controls (checkbox, select dropdown, and selected value) from a course table row.
 *
 * @param {Element|null} row
 * @returns {{ checkbox: Element|null, dropdown: Element|null, selectedValue: string }}
 */
export function getCourseRowControls(row) {
  if (!row) {
    return { checkbox: null, dropdown: null, selectedValue: '' };
  }
  const checkbox = row.querySelector ? (row.querySelector('input[type="checkbox"]') || row.querySelector('input')) : null;
  const dropdown = row.querySelector ? (row.querySelector('select') || row.querySelector('.ddlSection')) : null;
  const selectedValue = dropdown ? (dropdown.value !== undefined ? String(dropdown.value).trim() : '') : '';
  return { checkbox, dropdown, selectedValue };
}

/**
 * Evaluates Save Gate conditions per SPEC §8 before clicking #btnEnlistment.
 * Condition 1: Every course HTTP read says is held is present as a row, still checked, carrying a non-null section id.
 * Condition 2: Every subject being acted on carries the section id intended for it and is checked.
 * Condition 3: No checked box has been un-ticked by the automator.
 *
 * @param {object} options
 * @param {Array<object>} [options.heldCourses]
 * @param {Array<object>} [options.actingDispositions]
 * @param {Document} [options.document]
 * @param {Window} [options.window]
 * @param {number} [options.untickedCount]
 * @returns {{ approved: boolean, reason?: string }}
 */
export function evaluateSaveGate(options = {}) {
  const doc = options.document !== undefined ? options.document : (typeof document !== 'undefined' ? document : null);
  const heldCourses = Array.isArray(options.heldCourses) ? options.heldCourses : [];
  const actingDispositions = Array.isArray(options.actingDispositions) ? options.actingDispositions : [];
  const untickedCount = typeof options.untickedCount === 'number' ? options.untickedCount : 0;

  if (!doc) {
    return { approved: false, reason: 'No document available' };
  }

  const tbl = getById(doc, 'tblRegularCourses') || doc.querySelector?.('#tblRegularCourses');
  if (!tbl) {
    return { approved: false, reason: 'Course table #tblRegularCourses not found' };
  }

  // Condition 3: No checked box has been un-ticked by automator
  if (untickedCount > 0) {
    return { approved: false, reason: 'Checked box was un-ticked by automator' };
  }

  // Condition 1: Every course HTTP read says is held is present as a row, still checked, carrying a non-null section id
  for (const held of heldCourses) {
    const isHeld = (held.heldSectionCreationId !== null && held.heldSectionCreationId !== undefined) || held.isRegistered === 1;
    if (!isHeld) continue;

    const row = findCourseRow(tbl, held.courseCreationId, held.courseCode);
    if (!row) {
      return {
        approved: false,
        reason: `Held course ${held.courseCode || held.courseCreationId} row is missing from table`,
      };
    }

    const { checkbox: chk, dropdown: ddl, selectedValue: val } = getCourseRowControls(row);
    if (!chk || !chk.checked) {
      return {
        approved: false,
        reason: `Held course ${held.courseCode || held.courseCreationId} is unchecked`,
      };
    }

    if (!ddl || !val || val === '0' || val === '-1' || val === 'null' || val === 'undefined') {
      return {
        approved: false,
        reason: `Held course ${held.courseCode || held.courseCreationId} has null or empty section id in dropdown`,
      };
    }
  }

  // Condition 2: Every subject being acted on carries the section id intended for it
  for (const act of actingDispositions) {
    const isActing = act.disposition === 'acquire' || act.disposition === 'upgrade';
    if (!isActing) continue;

    const row = findCourseRow(tbl, act.courseCreationId, act.courseCode);
    if (!row) {
      return {
        approved: false,
        reason: `Acting course ${act.courseCode || act.courseCreationId} row is missing from table`,
      };
    }

    const { checkbox: chk, dropdown: ddl, selectedValue: val } = getCourseRowControls(row);
    if (!chk || !chk.checked) {
      return {
        approved: false,
        reason: `Acting course ${act.courseCode || act.courseCreationId} is unchecked`,
      };
    }

    const intendedId = String(act.wantedSectionCreationId ?? '').trim();
    if (!ddl || !val || val !== intendedId) {
      return {
        approved: false,
        reason: `Acting course ${act.courseCode || act.courseCreationId} section id is '${val}', intended '${intendedId}'`,
      };
    }
  }

  return { approved: true };
}

/**
 * Applies reconciliation dispositions to table rows in #tblRegularCourses.
 *
 * @param {object} options
 * @param {Array<object>} options.dispositions
 * @param {Document} [options.document]
 * @param {Window} [options.window]
 * @returns {{ success: boolean, appliedCount: number, reason?: string }}
 */
export function applyDispositionsToDom(options = {}) {
  const doc = options.document !== undefined ? options.document : (typeof document !== 'undefined' ? document : null);
  const dispositions = Array.isArray(options.dispositions) ? options.dispositions : [];

  if (!doc) return { success: false, appliedCount: 0, reason: 'No document' };

  const tbl = getById(doc, 'tblRegularCourses') || doc.querySelector?.('#tblRegularCourses');
  if (!tbl) return { success: false, appliedCount: 0, reason: 'tblRegularCourses not found' };

  let appliedCount = 0;

  for (const disp of dispositions) {
    // Both acquire and upgrade perform the same DOM procedure: ensure checked, select Wanted Section
    if (disp.disposition === 'acquire' || disp.disposition === 'upgrade') {
      const row = findCourseRow(tbl, disp.courseCreationId, disp.courseCode);
      if (!row) continue;

      const { checkbox: chk, dropdown: ddl } = getCourseRowControls(row);

      // 1. Tick the row (never un-tick!)
      if (chk) {
        if (!chk.checked) {
          chk.checked = true;
          if (typeof chk.dispatchEvent === 'function') {
            try {
              chk.dispatchEvent(new Event('input', { bubbles: true }));
              chk.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (_) {}
          }
        }
      }

      // 2. Select the Wanted Section in dropdown
      if (ddl) {
        const wantedIdStr = String(disp.wantedSectionCreationId);
        const wantedCode = (disp.wantedSectionCode || '').trim().toUpperCase();

        let targetValue = wantedIdStr;
        const optionsList = ddl.options ? Array.from(ddl.options) : (ddl.querySelectorAll ? ddl.querySelectorAll('option') : []);
        if (optionsList.length > 0) {
          const match = optionsList.find((opt) => {
            const optVal = String(opt.value || '').trim();
            const optText = (opt.textContent || opt.innerText || '').trim().toUpperCase();
            return optVal === wantedIdStr || (wantedCode && optText.includes(wantedCode));
          });
          if (match && match.value !== undefined) {
            targetValue = String(match.value);
          }
        }

        ddl.value = targetValue;
        if (typeof ddl.dispatchEvent === 'function') {
          try {
            ddl.dispatchEvent(new Event('input', { bubbles: true }));
            ddl.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (_) {}
        }
      }

      appliedCount++;
    }
  }

  return { success: true, appliedCount };
}

/**
 * Executes a Strike on the Owned Tab per SPEC §8.
 * Applies dispositions, evaluates Save Gate, and clicks #btnEnlistment once if approved.
 *
 * @param {object} options
 * @param {Array<object>} options.dispositions
 * @param {Array<object>} options.heldCourses
 * @param {Document} [options.document]
 * @param {Window} [options.window]
 * @returns {{ success: boolean, clicked: boolean, saveGateApproved: boolean, reason?: string, state?: string }}
 */
export function executeStrike(options = {}) {
  const doc = options.document !== undefined ? options.document : (typeof document !== 'undefined' ? document : null);
  const win = options.window !== undefined ? options.window : (typeof window !== 'undefined' ? window : null);
  const dispositions = Array.isArray(options.dispositions) ? options.dispositions : [];
  const heldCourses = Array.isArray(options.heldCourses) ? options.heldCourses : [];

  if (!doc) {
    return { success: false, clicked: false, saveGateApproved: false, reason: 'No document available' };
  }

  // 1. Verify Page State is Step2Bound
  const stateRes = classifyPageState({ document: doc, window: win });
  if (stateRes.state !== PAGE_STATES.STEP2_BOUND) {
    return {
      success: false,
      clicked: false,
      saveGateApproved: false,
      state: stateRes.state,
      reason: `Cannot strike in page state ${stateRes.state}`,
    };
  }

  // 2. Apply dispositions to DOM
  applyDispositionsToDom({ dispositions, document: doc, window: win });

  // 3. Evaluate Save Gate
  const gateRes = evaluateSaveGate({
    heldCourses,
    actingDispositions: dispositions,
    document: doc,
    window: win,
  });

  if (!gateRes.approved) {
    return {
      success: false,
      clicked: false,
      saveGateApproved: false,
      reason: gateRes.reason || 'Save Gate refused',
    };
  }

  // 4. Find #btnEnlistment strictly by ID (never #btnConfirmEnlistment)
  const btnEnlistment = getById(doc, 'btnEnlistment');
  if (!btnEnlistment) {
    return {
      success: false,
      clicked: false,
      saveGateApproved: true,
      reason: '#btnEnlistment not found in DOM',
    };
  }

  if (btnEnlistment.id !== 'btnEnlistment') {
    return {
      success: false,
      clicked: false,
      saveGateApproved: true,
      reason: 'Safety invariant violation: target button is not #btnEnlistment',
    };
  }

  // 5. Click #btnEnlistment exactly once
  if (typeof btnEnlistment.click === 'function') {
    btnEnlistment.click();
  }

  return {
    success: true,
    clicked: true,
    saveGateApproved: true,
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
  const executeStrikeFn = deps.executeStrike || executeStrike;

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

  if (msgType === 'EXECUTE_STRIKE' || msgType === 'STRIKE' || msgType === 'executeStrike') {
    const result = executeStrikeFn({
      dispositions: message?.dispositions,
      heldCourses: message?.heldCourses,
      document: deps.document,
      window: deps.window,
    });
    sendResponse({ success: result.success, ...result });
    return false;
  }

  if (msgType === 'STEER_TAB' || msgType === 'START_INNER_LOOP') {
    if (deps.activeLoop && deps.activeLoop.isRunning && deps.activeLoop.isRunning()) {
      deps.activeLoop.stop();
    }
    const autoAct = msgType === 'STEER_TAB' || Boolean(message?.autoAct);
    if (autoAct) {
      const initialClassification = classifyFn({
        document: deps.document,
        window: deps.window,
        location: deps.location,
      });
      if (initialClassification.state === PAGE_STATES.STEP3_REACHED) {
        executeActionFn({
          state: PAGE_STATES.STEP3_REACHED,
          document: deps.document,
          window: deps.window,
          location: deps.location,
        });
      }
    }
    let latestResult = null;
    const loop = startInnerLoopFn({
      document: deps.document,
      window: deps.window,
      location: deps.location,
      autoAct,
      onStateChange: (stateRes) => {
        latestResult = stateRes;
        if (deps.sendMessage) {
          deps.sendMessage({ type: 'PAGE_STATE_CHANGED', ...stateRes });
        }
      },
      onStop: (finalRes) => {
        latestResult = finalRes;
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
    sendResponse({
      success: true,
      isRunning: loop.isRunning(),
      state: latestResult?.state,
      snapshot: latestResult?.snapshot,
      domSnapshot: latestResult?.domSnapshot,
    });
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
  if (isStep1Active && btnAdd && !isElementVisible(btnAdd, win)) {
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
      courseRowsCount = tbodyRows ? tbodyRows.length : 0;
    } else if (tblRegularCourses.tBodies) {
      for (const tb of tblRegularCourses.tBodies) {
        courseRowsCount += tb.rows ? tb.rows.length : (tb.children ? tb.children.filter(c => c.tagName === 'TR').length : 0);
      }
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

    case PAGE_STATES.STEP1_CONFIGURED:
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

    case PAGE_STATES.STEP3_REACHED: {
      const divBind = getById(doc, 'DivBindCourseList');
      if (divBind && typeof divBind.click === 'function') {
        divBind.click();
        return { success: true, action: 'bind_course_list', state };
      }
      if (loc) {
        loc.href = '/Enlistment_V2/Index';
        return { success: true, action: 'navigate', state };
      }
      return { success: true, action: 'step3_reached', state };
    }

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




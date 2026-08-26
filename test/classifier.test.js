import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_STATES,
  INNER_LOOP_STATES,
  isElementVisible,
  captureDomSnapshot,
  classifyPageState,
  startInnerLoop,
  handleContentMessage,
  executeStateAction,
  findCourseRow,
  getCourseRowControls,
  evaluateSaveGate,
  applyDispositionsToDom,
  executeStrike,
} from '../content/classifier.js';

// Minimal mock DOM node builder for headless Node testing
function createMockElement({
  id = '',
  tagName = 'div',
  classList = [],
  style = {},
  rect = { width: 100, height: 50, top: 0, bottom: 50 },
  children = [],
  innerHTML = '',
  outerHTML = '',
  hidden = false,
  checked = false,
  disabled = false,
  value = '',
  type = '',
  attributes = {},
  dataset = {},
  options = [],
  textContent = '',
  onClick = null,
} = {}) {
  const classes = new Set(classList);
  const events = new Map();
  const attrs = new Map(Object.entries(attributes));
  let clickedCount = 0;
  let currentVal = value;
  let currentChecked = checked;
  let text = textContent;

  const elem = {
    id,
    tagName: tagName.toUpperCase(),
    type: type || (attrs.get('type') || ''),
    disabled,
    dataset: { ...dataset },
    get value() { return currentVal; },
    set value(v) { currentVal = String(v); },
    get checked() { return currentChecked; },
    set checked(c) { currentChecked = Boolean(c); },
    get textContent() { return text || innerHTML || (elem.children.map(c => c.textContent || '').join(' ')); },
    set textContent(t) { text = t; },
    get innerText() { return elem.textContent; },
    set innerText(t) { text = t; },
    get clickCount() { return clickedCount; },
    click: () => {
      clickedCount++;
      if (typeof onClick === 'function') {
        onClick(elem);
      }
    },
    getAttribute: (attr) => attrs.get(attr) ?? null,
    setAttribute: (attr, val) => attrs.set(attr, String(val)),
    hasAttribute: (attr) => attrs.has(attr),
    addEventListener: (type, handler) => {
      if (!events.has(type)) events.set(type, []);
      events.get(type).push(handler);
    },
    dispatchEvent: (event) => {
      const type = event?.type || String(event);
      const handlers = events.get(type) || [];
      for (const h of handlers) {
        h(event);
      }
      return true;
    },
    classList: {
      contains: (cls) => classes.has(cls),
      add: (cls) => classes.add(cls),
      remove: (cls) => classes.delete(cls),
      toggle: (cls) => (classes.has(cls) ? classes.delete(cls) : classes.add(cls)),
      get length() { return classes.size; },
      toString: () => Array.from(classes).join(' '),
    },
    className: Array.from(classes).join(' '),
    style: { ...style },
    hidden,
    children: [...children],
    getBoundingClientRect: () => ({ ...rect }),
    querySelector: (selector) => {
      return findElement(elem, selector);
    },
    querySelectorAll: (selector) => {
      const results = [];
      findAllElements(elem, selector, results);
      return results;
    },
    matches: (selector) => matchesSelector(elem, selector),
  };

  if (tagName.toUpperCase() === 'SELECT') {
    elem.options = options.length > 0 ? options : children.filter((c) => c.tagName === 'OPTION');
  }

  Object.defineProperty(elem, 'innerHTML', {
    get: () => innerHTML || elem.children.map(c => c.outerHTML || '').join(''),
    set: (val) => { innerHTML = val; },
  });

  Object.defineProperty(elem, 'outerHTML', {
    get: () => outerHTML || `<${tagName.toLowerCase()} id="${id}" class="${Array.from(classes).join(' ')}">${elem.innerHTML}</${tagName.toLowerCase()}>`,
    set: (val) => { outerHTML = val; },
  });

  return elem;
}

function matchesSelector(elem, selector) {
  if (!elem || !selector) return false;
  const sel = selector.trim();

  // Comma separated selectors
  if (sel.includes(',')) {
    return sel.split(',').some((s) => matchesSelector(elem, s.trim()));
  }

  if (sel.startsWith('#')) {
    const [idPart, classPart] = sel.slice(1).split('.');
    if (elem.id !== idPart) return false;
    if (classPart && !elem.classList.contains(classPart)) return false;
    return true;
  }
  if (sel.startsWith('.')) {
    return elem.classList.contains(sel.slice(1));
  }
  if (sel === 'input[type="checkbox"]' || sel === "input[type='checkbox']") {
    return elem.tagName === 'INPUT' && (elem.type === 'checkbox' || elem.getAttribute?.('type') === 'checkbox');
  }
  if (sel === 'form[action*="Login"]' || sel === 'form[action*="login"]') {
    return elem.tagName === 'FORM' && (elem.action?.toLowerCase().includes('login') || elem.id?.toLowerCase().includes('login'));
  }
  if (sel.startsWith('select.')) {
    const cls = sel.slice(7);
    return elem.tagName === 'SELECT' && elem.classList.contains(cls);
  }

  const attrMatch = sel.match(/^(?:([a-zA-Z0-9_-]+))?\[([a-zA-Z0-9_-]+)(?:(\*?=|=)?["']?([^"'\]]+)["']?)?\]$/);
  if (attrMatch) {
    const [, tag, attrName, op, attrVal] = attrMatch;
    if (tag && elem.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    const actualVal = elem.getAttribute ? elem.getAttribute(attrName) : elem[attrName];
    if (attrVal === undefined) return actualVal !== null && actualVal !== undefined;
    if (op === '*=') {
      return String(actualVal || '').toLowerCase().includes(String(attrVal).toLowerCase());
    }
    return String(actualVal) === String(attrVal);
  }

  return elem.tagName.toLowerCase() === sel.toLowerCase();
}

function findElement(root, selector) {
  if (!root) return null;
  const sel = selector.trim();

  // Scoped selector: e.g. '#tblRegularCourses tbody tr'
  const segments = sel.split(/\s+/);
  if (segments.length === 2) {
    const [parentSel, childSel] = segments;
    const parent = findElement(root, parentSel);
    return parent ? findElement(parent, childSel) : null;
  }

  for (const child of root.children || []) {
    if (matchesSelector(child, sel)) return child;
    const found = findElement(child, sel);
    if (found) return found;
  }
  return null;
}

function findAllElements(root, selector, results = []) {
  if (!root) return results;
  const sel = selector.trim();

  // Selector like "tbody tr" or "tr"
  const segments = sel.split(/\s+/);
  if (segments.length === 2) {
    const [parentSel, childSel] = segments;
    const parents = [];
    findAllElements(root, parentSel, parents);
    for (const parent of parents) {
      findAllElements(parent, childSel, results);
    }
    return results;
  }

  for (const child of root.children || []) {
    if (matchesSelector(child, sel)) results.push(child);
    findAllElements(child, selector, results);
  }
  return results;
}

function createMockDocument({
  title = 'Enlistment',
  body = null,
  elements = [],
  location = {
    hostname: 'archershub.dlsu.edu.ph',
    pathname: '/Enlistment_V2/Index',
    href: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index',
  },
} = {}) {
  const elementsById = new Map();
  const rootBody = body || createMockElement({ tagName: 'body', children: elements });

  function indexElements(node) {
    if (node.id) {
      elementsById.set(node.id, node);
    }
    for (const child of node.children || []) {
      indexElements(child);
    }
  }
  indexElements(rootBody);

  const doc = {
    title,
    location: { ...location },
    body: rootBody,
    documentElement: {
      get outerHTML() {
        return `<html><head><title>${doc.title}</title></head>${rootBody.outerHTML}</html>`;
      },
    },
    getElementById: (id) => elementsById.get(id) || null,
    querySelector: (selector) => {
      if (selector.startsWith('#') && !selector.includes(' ') && !selector.includes('.')) {
        return elementsById.get(selector.slice(1)) || null;
      }
      return findElement(rootBody, selector);
    },
    querySelectorAll: (selector) => {
      const results = [];
      findAllElements(rootBody, selector, results);
      return results;
    },
  };

  return doc;
}

function createMockWindow({ document = null, location = null } = {}) {
  return {
    document,
    location: location || (document && document.location) || {
      hostname: 'archershub.dlsu.edu.ph',
      pathname: '/Enlistment_V2/Index',
      href: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index',
    },
    getComputedStyle: (elem) => elem?.style || {},
  };
}

describe('classifier module', () => {
  describe('PAGE_STATES and INNER_LOOP_STATES', () => {
    it('defines exactly the 12 named states from SPEC §6', () => {
      const expectedStates = [
        'NoTab',
        'LoggedOut',
        'WrongPage',
        'NotInjected',
        'Settling',
        'ActivityClosed',
        'Step1Unconfigured',
        'Step1Configured',
        'Step2Unbound',
        'Step2Bound',
        'Step3Reached',
        'Unrecognised',
      ];

      assert.equal(Object.values(PAGE_STATES).length, 12);
      for (const st of expectedStates) {
        assert.ok(Object.values(PAGE_STATES).includes(st), `Missing state: ${st}`);
      }
    });

    it('defines INNER_LOOP_STATES containing exactly states 5 through 9', () => {
      const innerArray = Array.from(INNER_LOOP_STATES);
      assert.deepEqual(innerArray.sort(), [
        'ActivityClosed',
        'Settling',
        'Step1Configured',
        'Step1Unconfigured',
        'Step2Unbound',
      ].sort());
    });
  });

  describe('isElementVisible', () => {
    it('returns false for null or undefined element', () => {
      assert.equal(isElementVisible(null), false);
      assert.equal(isElementVisible(undefined), false);
    });

    it('returns false when display is none, visibility is hidden, or opacity is 0', () => {
      const elemNone = createMockElement({ style: { display: 'none' } });
      assert.equal(isElementVisible(elemNone), false);

      const elemHidden = createMockElement({ style: { visibility: 'hidden' } });
      assert.equal(isElementVisible(elemHidden), false);

      const elemOpacity0 = createMockElement({ style: { opacity: '0' } });
      assert.equal(isElementVisible(elemOpacity0), false);
    });

    it('returns false when element has hidden attribute', () => {
      const elem = createMockElement({ hidden: true });
      assert.equal(isElementVisible(elem), false);
    });

    it('returns true when element is visible', () => {
      const elem = createMockElement({ style: { display: 'block', visibility: 'visible', opacity: '1' } });
      assert.equal(isElementVisible(elem), true);
    });
  });

  describe('captureDomSnapshot', () => {
    it('captures full outerHTML, title, url, and timestamp', () => {
      const doc = createMockDocument({
        title: 'ArchersHub - Unknown View',
        elements: [createMockElement({ id: 'lockedContainer', innerHTML: '<p>Enlistment Locked</p>' })],
      });
      const win = createMockWindow({ document: doc });
      const snapshot = captureDomSnapshot(doc, win);

      assert.match(snapshot.html, /Enlistment Locked/);
      assert.equal(snapshot.title, 'ArchersHub - Unknown View');
      assert.equal(snapshot.url, 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index');
      assert.ok(typeof snapshot.timestamp === 'number');
    });
  });

  describe('classifyPageState — 12 Page States', () => {
    it('State 1: NoTab — returns NoTab when document or tab is missing', () => {
      assert.equal(classifyPageState({ hasTab: false }).state, PAGE_STATES.NO_TAB);
      assert.equal(classifyPageState({ document: null, window: null }).state, PAGE_STATES.NO_TAB);
    });

    it('State 2: LoggedOut — detected via login title or login form on tab', () => {
      const docWithTitle = createMockDocument({
        title: 'Login - ArchersHub',
        location: { hostname: 'archershub.dlsu.edu.ph', pathname: '/' },
      });
      const win = createMockWindow({ document: docWithTitle });
      assert.equal(classifyPageState({ document: docWithTitle, window: win }).state, PAGE_STATES.LOGGED_OUT);

      const docWithForm = createMockDocument({
        title: 'ArchersHub Portal',
        location: { hostname: 'archershub.dlsu.edu.ph', pathname: '/Account/Login' },
        elements: [createMockElement({ id: 'divLogin' })],
      });
      assert.equal(classifyPageState({ document: docWithForm, window: createMockWindow({ document: docWithForm }) }).state, PAGE_STATES.LOGGED_OUT);
    });

    it('State 3: WrongPage — on archershub.dlsu.edu.ph but not an enlistment path without enlistment shell', () => {
      const doc = createMockDocument({
        title: 'Student Dashboard',
        location: {
          hostname: 'archershub.dlsu.edu.ph',
          pathname: '/Student/Dashboard',
          href: 'https://archershub.dlsu.edu.ph/Student/Dashboard',
        },
        elements: [createMockElement({ id: 'dashboardWidget' })],
      });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.WRONG_PAGE);
    });

    it('State 4: NotInjected — returns NotInjected when injected flag is explicitly false', () => {
      const doc = createMockDocument();
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win, injected: false }).state, PAGE_STATES.NOT_INJECTED);
    });

    it('State 5: Settling — detected via body.loader-active', () => {
      const body = createMockElement({ tagName: 'body', classList: ['loader-active'] });
      const doc = createMockDocument({ body });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.SETTLING);
    });

    it('State 5: Settling — detected via #MyLoader visible', () => {
      const myLoader = createMockElement({ id: 'MyLoader', style: { display: 'block' } });
      const doc = createMockDocument({ elements: [myLoader] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.SETTLING);
    });

    it('State 5: Settling — detected via .full-page-loader visible', () => {
      const loader = createMockElement({ classList: ['full-page-loader'], style: { display: 'block' } });
      const doc = createMockDocument({ elements: [loader] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.SETTLING);
    });

    it('State 6: ActivityClosed — detected via #divAlertMessage visible', () => {
      const alertMsg = createMockElement({ id: 'divAlertMessage', style: { display: 'block' } });
      const doc = createMockDocument({ elements: [alertMsg] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.ACTIVITY_CLOSED);
    });

    it('State 7: Step1Unconfigured — detected via #STEP1.active and #btnAdd visible', () => {
      const step1 = createMockElement({ id: 'STEP1', classList: ['active'] });
      const btnAdd = createMockElement({ id: 'btnAdd', style: { display: 'inline-block' } });
      const doc = createMockDocument({ elements: [step1, btnAdd] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP1_UNCONFIGURED);
    });

    it('State 8: Step1Configured — detected via #btnAdd present and display: none', () => {
      const step1 = createMockElement({ id: 'STEP1', classList: ['active'] });
      const btnAdd = createMockElement({ id: 'btnAdd', style: { display: 'none' } });
      const doc = createMockDocument({ elements: [step1, btnAdd] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP1_CONFIGURED);
    });

    it('State 9: Step2Unbound — detected via #STEP2.active and #tblRegularCourses empty', () => {
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [] });
      const doc = createMockDocument({ elements: [step2, tbl] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP2_UNBOUND);
    });

    it('State 9: Step2Unbound — detected when #tblRegularCourses has only a thead header row and empty tbody, even if #btnEnlistment is visible', () => {
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const thead = createMockElement({
        tagName: 'thead',
        children: [
          createMockElement({ tagName: 'tr', innerHTML: '<th>Course</th><th>Section</th>' }),
        ],
      });
      const tbody = createMockElement({
        tagName: 'tbody',
        children: [],
      });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [thead, tbody] });
      const btnEnlistment = createMockElement({ id: 'btnEnlistment', style: { display: 'inline-block' } });
      const doc = createMockDocument({ elements: [step2, tbl, btnEnlistment] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP2_UNBOUND);
    });

    it('State 9: Step2Unbound — detected when #tblRegularCourses has only a thead header row and no tbody, even if #btnEnlistment is visible', () => {
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const thead = createMockElement({
        tagName: 'thead',
        children: [
          createMockElement({ tagName: 'tr', innerHTML: '<th>Course</th><th>Section</th>' }),
        ],
      });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [thead] });
      const btnEnlistment = createMockElement({ id: 'btnEnlistment', style: { display: 'inline-block' } });
      const doc = createMockDocument({ elements: [step2, tbl, btnEnlistment] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP2_UNBOUND);
    });

    it('State 10: Step2Bound — detected via #STEP2.active, #tblRegularCourses has rows, #btnEnlistment visible', () => {
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const tbody = createMockElement({
        tagName: 'tbody',
        children: [
          createMockElement({ tagName: 'tr', innerHTML: '<td>MATH101</td>' }),
          createMockElement({ tagName: 'tr', innerHTML: '<td>CS101</td>' }),
        ],
      });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [tbody] });
      const btnEnlistment = createMockElement({ id: 'btnEnlistment', style: { display: 'inline-block' } });
      const doc = createMockDocument({ elements: [step2, tbl, btnEnlistment] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP2_BOUND);
    });

    it('State 10: Step2Bound — detected when #tblRegularCourses has both thead header row and tbody data rows with visible #btnEnlistment', () => {
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const thead = createMockElement({
        tagName: 'thead',
        children: [
          createMockElement({ tagName: 'tr', innerHTML: '<th>Course</th><th>Section</th>' }),
        ],
      });
      const tbody = createMockElement({
        tagName: 'tbody',
        children: [
          createMockElement({ tagName: 'tr', innerHTML: '<td>MATH101</td>' }),
          createMockElement({ tagName: 'tr', innerHTML: '<td>CS101</td>' }),
        ],
      });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [thead, tbody] });
      const btnEnlistment = createMockElement({ id: 'btnEnlistment', style: { display: 'inline-block' } });
      const doc = createMockDocument({ elements: [step2, tbl, btnEnlistment] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP2_BOUND);
    });

    it('State 11: Step3Reached — detected via #STEP3.active', () => {
      const step3 = createMockElement({ id: 'STEP3', classList: ['active'] });
      const doc = createMockDocument({ elements: [step3] });
      const win = createMockWindow({ document: doc });
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP3_REACHED);
    });

    it('State 12: Unrecognised — captures snapshot when no known state matches', () => {
      const unknownDiv = createMockElement({ id: 'unknownModal', innerHTML: '<h3>System Maintenance</h3>' });
      const doc = createMockDocument({ elements: [unknownDiv] });
      const win = createMockWindow({ document: doc });
      const res = classifyPageState({ document: doc, window: win });

      assert.equal(res.state, PAGE_STATES.UNRECOGNISED);
      assert.ok(res.domSnapshot);
      assert.match(res.domSnapshot, /System Maintenance/);
      assert.ok(res.snapshot);
      assert.equal(res.snapshot.title, 'Enlistment');
    });
  });

  describe('Classification safety rules and order precedence', () => {
    it('precedence: Settling loader overlay on Step2Bound page returns Settling', () => {
      const body = createMockElement({ tagName: 'body', classList: ['loader-active'] });
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const tbody = createMockElement({
        tagName: 'tbody',
        children: [createMockElement({ tagName: 'tr' })],
      });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [tbody] });
      const btnEnlistment = createMockElement({ id: 'btnEnlistment', style: { display: 'inline-block' } });

      const doc = createMockDocument({ body, elements: [step2, tbl, btnEnlistment] });
      const win = createMockWindow({ document: doc });

      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.SETTLING);
    });

    it('precedence: LoggedOut title on a page with #STEP1 returns LoggedOut', () => {
      const step1 = createMockElement({ id: 'STEP1', classList: ['active'] });
      const btnAdd = createMockElement({ id: 'btnAdd', style: { display: 'inline-block' } });
      const doc = createMockDocument({
        title: 'Login - ArchersHub',
        elements: [step1, btnAdd],
      });
      const win = createMockWindow({ document: doc });

      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.LOGGED_OUT);
    });

    it('scopes pane checks strictly to #STEP1|2|3 by ID, ignoring PayatCampus / PayatBank / Online with .tab-pane.active', () => {
      // Payment panes also carry .tab-pane.active on ArchersHub
      const payAtCampus = createMockElement({ id: 'PayatCampus', classList: ['tab-pane', 'active'] });
      const payAtBank = createMockElement({ id: 'PayatBank', classList: ['tab-pane', 'active'] });
      const online = createMockElement({ id: 'Online', classList: ['tab-pane', 'active'] });

      const doc = createMockDocument({ elements: [payAtCampus, payAtBank, online] });
      const win = createMockWindow({ document: doc });

      // Should not trigger Step1/2/3, falls to Unrecognised
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.UNRECOGNISED);
    });

    it('addresses buttons strictly by ID, not class (.common-submit-btn) or label ("Save & Next")', () => {
      // Create element with same class as #btnEnlistment (#btnConfirmEnlistment shares .common-submit-btn)
      const fakeBtn = createMockElement({
        id: 'btnConfirmEnlistment',
        classList: ['common-submit-btn'],
        innerHTML: 'Save & Next',
        style: { display: 'inline-block' },
      });
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const tbody = createMockElement({ tagName: 'tbody', children: [createMockElement({ tagName: 'tr' })] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [tbody] });

      // Without #btnEnlistment, should NOT match Step2Bound even though another button has common-submit-btn
      const doc = createMockDocument({ elements: [step2, tbl, fakeBtn] });
      const win = createMockWindow({ document: doc });

      assert.notEqual(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP2_BOUND);
    });

    it('ignores toast elements as state signals', () => {
      const toast = createMockElement({
        id: 'toast-container',
        classList: ['toast', 'toast-success'],
        innerHTML: 'Saved successfully',
        style: { display: 'block' },
      });
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [] });

      const doc = createMockDocument({ elements: [toast, step2, tbl] });
      const win = createMockWindow({ document: doc });

      // Remains Step2Unbound, ignoring toast
      assert.equal(classifyPageState({ document: doc, window: win }).state, PAGE_STATES.STEP2_UNBOUND);
    });
  });

  describe('250ms inner reclassification loop', () => {
    it('runs while in states 5–9 and stops once Step2Bound (state 10) is reached', () => {
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [] }); // Starts unbound (state 9)
      const btnEnlistment = createMockElement({ id: 'btnEnlistment', style: { display: 'inline-block' } });
      const doc = createMockDocument({ elements: [step2, tbl, btnEnlistment] });
      const win = createMockWindow({ document: doc });

      const statesObserved = [];
      let stopCalled = false;
      let finalResult = null;

      // Mock timer to control ticks manually
      const timers = [];
      const mockSetTimeout = (fn, delay) => {
        const id = timers.length + 1;
        timers.push({ id, fn, delay });
        return id;
      };
      const mockClearTimeout = () => {};

      const loop = startInnerLoop({
        document: doc,
        window: win,
        intervalMs: 250,
        setTimeoutImpl: mockSetTimeout,
        clearTimeoutImpl: mockClearTimeout,
        onStateChange: (res) => {
          statesObserved.push(res.state);
        },
        onStop: (res) => {
          stopCalled = true;
          finalResult = res;
        },
      });

      // Initial tick: Step2Unbound (state 9) -> in inner loop
      assert.equal(statesObserved.length, 1);
      assert.equal(statesObserved[0], PAGE_STATES.STEP2_UNBOUND);
      assert.equal(stopCalled, false);
      assert.equal(timers.length, 1);
      assert.equal(timers[0].delay, 250);

      // Tick 2: still Step2Unbound
      const tick1 = timers.shift();
      tick1.fn();
      assert.equal(stopCalled, false);
      assert.equal(timers.length, 1);

      // Mutate DOM to Step2Bound: table gains row
      const tbody = createMockElement({
        tagName: 'tbody',
        children: [createMockElement({ tagName: 'tr' })],
      });
      tbl.children = [tbody];

      // Tick 3: now Step2Bound (state 10) -> loop must stop!
      const tick2 = timers.shift();
      tick2.fn();

      assert.equal(stopCalled, true);
      assert.equal(finalResult.state, PAGE_STATES.STEP2_BOUND);
      assert.equal(statesObserved[statesObserved.length - 1], PAGE_STATES.STEP2_BOUND);
      assert.equal(timers.length, 0); // No more timers scheduled
      assert.equal(loop.isRunning(), false);
    });

    it('stops immediately when Unrecognised state is reached and triggers snapshot capture', () => {
      const alertMsg = createMockElement({ id: 'divAlertMessage', style: { display: 'block' } }); // Starts ActivityClosed (state 6)
      const doc = createMockDocument({ elements: [alertMsg] });
      const win = createMockWindow({ document: doc });

      const statesObserved = [];
      let finalResult = null;

      const timers = [];
      const mockSetTimeout = (fn, delay) => {
        const id = timers.length + 1;
        timers.push({ id, fn, delay });
        return id;
      };

      const loop = startInnerLoop({
        document: doc,
        window: win,
        setTimeoutImpl: mockSetTimeout,
        onStateChange: (res) => statesObserved.push(res.state),
        onStop: (res) => { finalResult = res; },
      });

      assert.equal(statesObserved[0], PAGE_STATES.ACTIVITY_CLOSED);

      // Mutate to an unrecognised state
      alertMsg.style.display = 'none';

      const tick = timers.shift();
      tick.fn();

      assert.equal(finalResult.state, PAGE_STATES.UNRECOGNISED);
      assert.ok(finalResult.domSnapshot);
      assert.equal(loop.isRunning(), false);
    });

    it('STEER_TAB auto-acts on Step3Reached to bind course list', () => {
      let divBindClicked = false;
      const step3 = createMockElement({ id: 'STEP3', classList: ['active'] });
      const divBind = createMockElement({
        id: 'DivBindCourseList',
        tagName: 'a',
        onClick: () => { divBindClicked = true; },
      });
      const doc = createMockDocument({ elements: [step3, divBind] });
      const win = createMockWindow({ document: doc });

      let responsePayload = null;
      handleContentMessage({ type: 'STEER_TAB' }, {}, (res) => {
        responsePayload = res;
      }, {
        document: doc,
        window: win,
        location: doc.location,
      });

      assert.equal(divBindClicked, true, 'STEER_TAB must auto-act on Step3Reached by clicking #DivBindCourseList');
      assert.equal(responsePayload?.success, true);
    });

    it('allows manual stop via returned handle', () => {
      const step1 = createMockElement({ id: 'STEP1', classList: ['active'] });
      const btnAdd = createMockElement({ id: 'btnAdd', style: { display: 'inline-block' } }); // Step1Unconfigured
      const doc = createMockDocument({ elements: [step1, btnAdd] });
      const win = createMockWindow({ document: doc });

      let cleared = false;
      const mockClearTimeout = () => { cleared = true; };
      const mockSetTimeout = () => 123;

      const handle = startInnerLoop({
        document: doc,
        window: win,
        setTimeoutImpl: mockSetTimeout,
        clearTimeoutImpl: mockClearTimeout,
      });

      assert.equal(handle.isRunning(), true);
      handle.stop();
      assert.equal(handle.isRunning(), false);
      assert.equal(cleared, true);
    });
  });

  describe('handleContentMessage', () => {
    it('handles PING message by replying with ok: true, pong: true', () => {
      let response = null;
      handleContentMessage({ type: 'PING' }, {}, (res) => {
        response = res;
      });
      assert.deepEqual(response, { ok: true, pong: true });

      response = null;
      handleContentMessage('ping', {}, (res) => {
        response = res;
      });
      assert.deepEqual(response, { ok: true, pong: true });
    });

    it('handles CLASSIFY_PAGE message by returning classification result', () => {
      const step3 = createMockElement({ id: 'STEP3', classList: ['active'] });
      const doc = createMockDocument({ elements: [step3] });
      const win = createMockWindow({ document: doc });

      let response = null;
      handleContentMessage({ type: 'CLASSIFY_PAGE' }, {}, (res) => {
        response = res;
      }, {
        document: doc,
        window: win,
      });

      assert.equal(response.success, true);
      assert.equal(response.state, PAGE_STATES.STEP3_REACHED);
    });

    it('handles START_INNER_LOOP and STOP_INNER_LOOP messages', () => {
      const step1 = createMockElement({ id: 'STEP1', classList: ['active'] });
      const btnAdd = createMockElement({ id: 'btnAdd', style: { display: 'inline-block' } });
      const doc = createMockDocument({ elements: [step1, btnAdd] });
      const win = createMockWindow({ document: doc });

      let activeLoopRef = null;
      let startResponse = null;

      const sentMessages = [];
      const mockSendMessage = (msg) => sentMessages.push(msg);

      handleContentMessage({ type: 'START_INNER_LOOP' }, {}, (res) => {
        startResponse = res;
      }, {
        document: doc,
        window: win,
        setActiveLoop: (l) => { activeLoopRef = l; },
        sendMessage: mockSendMessage,
      });

      assert.equal(startResponse.success, true);
      assert.equal(startResponse.isRunning, true);
      assert.ok(activeLoopRef);
      assert.ok(sentMessages.length > 0);
      assert.equal(sentMessages[0].state, PAGE_STATES.STEP1_UNCONFIGURED);

      let stopResponse = null;
      handleContentMessage({ type: 'STOP_INNER_LOOP' }, {}, (res) => {
        stopResponse = res;
      }, {
        activeLoop: activeLoopRef,
      });

      assert.equal(stopResponse.success, true);
      assert.equal(stopResponse.isRunning, false);
      assert.equal(activeLoopRef.isRunning(), false);
    });
  });

  describe('executeStateAction — §6 action column execution', () => {
    it('Step1Unconfigured: selects Open Section and clicks #btnAdd', () => {
      let openSectionClicked = false;
      let openSectionEventsFired = 0;
      const rdoOpenSection = createMockElement({
        id: 'rdoOpenSection',
        tagName: 'input',
        checked: false,
        onClick: () => { openSectionClicked = true; },
      });
      rdoOpenSection.addEventListener('change', () => { openSectionEventsFired++; });
      rdoOpenSection.addEventListener('input', () => { openSectionEventsFired++; });

      let btnAddClicked = false;
      const btnAdd = createMockElement({
        id: 'btnAdd',
        style: { display: 'inline-block' },
        onClick: () => { btnAddClicked = true; },
      });

      const step1 = createMockElement({ id: 'STEP1', classList: ['active'] });
      const doc = createMockDocument({ elements: [step1, rdoOpenSection, btnAdd] });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, true);
      assert.equal(result.action, 'open_section_and_add');
      assert.equal(result.state, PAGE_STATES.STEP1_UNCONFIGURED);
      assert.equal(rdoOpenSection.checked, true);
      assert.equal(openSectionClicked, true);
      assert.equal(openSectionEventsFired, 2);
      assert.equal(btnAddClicked, true);
    });

    it('Step1Configured: clicks a#DivBindCourseList', () => {
      let divBindClicked = false;
      const divBind = createMockElement({
        id: 'DivBindCourseList',
        tagName: 'a',
        onClick: () => { divBindClicked = true; },
      });
      const step1 = createMockElement({ id: 'STEP1', classList: ['active'] });
      const btnAdd = createMockElement({ id: 'btnAdd', style: { display: 'none' } });

      const doc = createMockDocument({ elements: [step1, btnAdd, divBind] });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, true);
      assert.equal(result.action, 'bind_course_list');
      assert.equal(result.state, PAGE_STATES.STEP1_CONFIGURED);
      assert.equal(divBindClicked, true);
    });

    it('Step2Unbound: clicks a#DivBindCourseList', () => {
      let divBindClicked = false;
      const divBind = createMockElement({
        id: 'DivBindCourseList',
        tagName: 'a',
        onClick: () => { divBindClicked = true; },
      });
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [] });

      const doc = createMockDocument({ elements: [step2, tbl, divBind] });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, true);
      assert.equal(result.action, 'bind_course_list');
      assert.equal(result.state, PAGE_STATES.STEP2_UNBOUND);
      assert.equal(divBindClicked, true);
    });

    it('Settling: performs no DOM clicks underneath and returns wait action', () => {
      const body = createMockElement({ tagName: 'body', classList: ['loader-active'] });
      const doc = createMockDocument({ body });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, true);
      assert.equal(result.action, 'wait');
      assert.equal(result.state, PAGE_STATES.SETTLING);
    });

    it('Step2Bound: reports bound state reached without clicking', () => {
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const tbody = createMockElement({ tagName: 'tbody', children: [createMockElement({ tagName: 'tr' })] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [tbody] });
      const btnEnlistment = createMockElement({ id: 'btnEnlistment', style: { display: 'inline-block' } });

      const doc = createMockDocument({ elements: [step2, tbl, btnEnlistment] });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, true);
      assert.equal(result.action, 'bound');
      assert.equal(result.state, PAGE_STATES.STEP2_BOUND);
    });

    it('Unrecognised: captures snapshot and returns abort action', () => {
      const unknownElem = createMockElement({ id: 'unknownDialog', innerHTML: '<p>Lock</p>' });
      const doc = createMockDocument({ elements: [unknownElem] });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, false);
      assert.equal(result.action, 'abort');
      assert.equal(result.state, PAGE_STATES.UNRECOGNISED);
      assert.ok(result.snapshot);
      assert.match(result.snapshot.html, /Lock/);
    });

    it('WrongPage: navigates location.href to /Enlistment_V2/Index', () => {
      const doc = createMockDocument({
        location: {
          hostname: 'archershub.dlsu.edu.ph',
          pathname: '/Student/Dashboard',
          href: 'https://archershub.dlsu.edu.ph/Student/Dashboard',
        },
      });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, true);
      assert.equal(result.action, 'navigate');
      assert.equal(result.state, PAGE_STATES.WRONG_PAGE);
      assert.match(doc.location.href, /\/Enlistment_V2\/Index/);
    });

    it('LoggedOut: returns suspend action signal', () => {
      const doc = createMockDocument({
        title: 'Login - ArchersHub',
        location: { hostname: 'archershub.dlsu.edu.ph', pathname: '/' },
      });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, false);
      assert.equal(result.action, 'suspend');
      assert.equal(result.state, PAGE_STATES.LOGGED_OUT);
    });

    it('Step3Reached: clicks a#DivBindCourseList to bind course list and switch back to Step 2', () => {
      let divBindClicked = false;
      const divBind = createMockElement({
        id: 'DivBindCourseList',
        tagName: 'a',
        onClick: () => { divBindClicked = true; },
      });
      const step3 = createMockElement({ id: 'STEP3', classList: ['active'] });
      const doc = createMockDocument({ elements: [step3, divBind] });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, true);
      assert.equal(result.action, 'bind_course_list');
      assert.equal(result.state, PAGE_STATES.STEP3_REACHED);
      assert.equal(divBindClicked, true);
    });

    it('Step3Reached: navigates location.href to /Enlistment_V2/Index when DivBindCourseList is missing', () => {
      const step3 = createMockElement({ id: 'STEP3', classList: ['active'] });
      const doc = createMockDocument({
        elements: [step3],
        location: {
          hostname: 'archershub.dlsu.edu.ph',
          pathname: '/Enlistment_V2/Index',
          href: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index',
        },
      });
      const win = createMockWindow({ document: doc });

      const result = executeStateAction({ document: doc, window: win });

      assert.equal(result.success, true);
      assert.equal(result.action, 'navigate');
      assert.equal(result.state, PAGE_STATES.STEP3_REACHED);
      assert.match(doc.location.href, /\/Enlistment_V2\/Index/);
    });
  });

  describe('findCourseRow', () => {
    it('finds row by data-course-id or data-course-creation-id', () => {
      const row1 = createMockElement({ tagName: 'tr', attributes: { 'data-course-creation-id': '101' } });
      const row2 = createMockElement({ tagName: 'tr', attributes: { 'data-course-id': '102' } });
      const tbody = createMockElement({ tagName: 'tbody', children: [row1, row2] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [tbody] });

      assert.equal(findCourseRow(tbl, 101), row1);
      assert.equal(findCourseRow(tbl, '102'), row2);
      assert.equal(findCourseRow(tbl, 999), null);
    });

    it('finds row by data-course-code or hidden input COURSE_CREATION_ID', () => {
      const hiddenInput = createMockElement({
        tagName: 'input',
        attributes: { name: 'COURSE_CREATION_ID' },
        value: '202',
      });
      const row1 = createMockElement({ tagName: 'tr', attributes: { 'data-course-code': 'CS101' } });
      const row2 = createMockElement({ tagName: 'tr', children: [hiddenInput] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [row1, row2] });

      assert.equal(findCourseRow(tbl, null, 'CS101'), row1);
      assert.equal(findCourseRow(tbl, 202), row2);
      assert.equal(findCourseRow(tbl, 999, 'UNKNOWN'), null);
    });
  });

  describe('getCourseRowControls', () => {
    it('returns empty controls when row is null or undefined', () => {
      assert.deepEqual(getCourseRowControls(null), { checkbox: null, dropdown: null, selectedValue: '' });
      assert.deepEqual(getCourseRowControls(undefined), { checkbox: null, dropdown: null, selectedValue: '' });
    });

    it('extracts checkbox, dropdown, and selectedValue from course row', () => {
      const chk = createMockElement({ tagName: 'input', type: 'checkbox', checked: true });
      const ddl = createMockElement({ tagName: 'select', classList: ['ddlSection'], value: '501' });
      const row = createMockElement({ tagName: 'tr', children: [chk, ddl] });

      const controls = getCourseRowControls(row);
      assert.equal(controls.checkbox, chk);
      assert.equal(controls.dropdown, ddl);
      assert.equal(controls.selectedValue, '501');
    });
  });

  describe('applyDispositionsToDom', () => {
    it('ticks unchecked row and selects Wanted Section for acquire disposition', () => {
      const chk = createMockElement({ tagName: 'input', type: 'checkbox', checked: false });
      const opt1 = createMockElement({ tagName: 'option', value: '501', textContent: 'G01 {Avail: 5}' });
      const opt2 = createMockElement({ tagName: 'option', value: '502', textContent: 'G02 {Avail: 10}' });
      const ddl = createMockElement({ tagName: 'select', classList: ['ddlSection'], children: [opt1, opt2], value: '' });
      const row = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '101' },
        children: [chk, ddl],
      });
      const tbody = createMockElement({ tagName: 'tbody', children: [row] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [tbody] });
      const doc = createMockDocument({ elements: [tbl] });

      const dispositions = [{
        courseCreationId: 101,
        courseCode: 'CS101',
        wantedSectionCreationId: 502,
        wantedSectionCode: 'G02',
        disposition: 'acquire',
      }];

      const res = applyDispositionsToDom({ dispositions, document: doc });
      assert.equal(res.success, true);
      assert.equal(res.appliedCount, 1);
      assert.equal(chk.checked, true); // Row ticked!
      assert.equal(ddl.value, '502'); // Section 502 selected!
    });

    it('sets dropdown on already-checked row for upgrade disposition (switch)', () => {
      const chk = createMockElement({ tagName: 'input', type: 'checkbox', checked: true });
      const opt1 = createMockElement({ tagName: 'option', value: '501', textContent: 'G01' });
      const opt2 = createMockElement({ tagName: 'option', value: '502', textContent: 'G02' });
      const ddl = createMockElement({ tagName: 'select', classList: ['ddlSection'], children: [opt1, opt2], value: '501' });
      const row = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '101' },
        children: [chk, ddl],
      });
      const tbody = createMockElement({ tagName: 'tbody', children: [row] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [tbody] });
      const doc = createMockDocument({ elements: [tbl] });

      const dispositions = [{
        courseCreationId: 101,
        courseCode: 'CS101',
        wantedSectionCreationId: 502,
        wantedSectionCode: 'G02',
        disposition: 'upgrade',
      }];

      const res = applyDispositionsToDom({ dispositions, document: doc });
      assert.equal(res.success, true);
      assert.equal(res.appliedCount, 1);
      assert.equal(chk.checked, true);
      assert.equal(ddl.value, '502'); // Switched to 502!
    });

    it('preserves held unrequested rows and satisfied rows without un-ticking', () => {
      const chkPreserve = createMockElement({ tagName: 'input', type: 'checkbox', checked: true });
      const ddlPreserve = createMockElement({ tagName: 'select', value: '888' });
      const rowPreserve = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '999' },
        children: [chkPreserve, ddlPreserve],
      });

      const tbl = createMockElement({ id: 'tblRegularCourses', children: [rowPreserve] });
      const doc = createMockDocument({ elements: [tbl] });

      const dispositions = [{
        courseCreationId: 999,
        courseCode: 'UNREQUESTED',
        disposition: 'preserve',
      }];

      const res = applyDispositionsToDom({ dispositions, document: doc });
      assert.equal(res.success, true);
      assert.equal(chkPreserve.checked, true); // Still checked!
      assert.equal(ddlPreserve.value, '888'); // Still 888!
    });
  });

  describe('evaluateSaveGate (§8)', () => {
    it('approves when all 3 conditions are satisfied', () => {
      // Row 1: Held & requested (satisfied / upgrade)
      const chk1 = createMockElement({ tagName: 'input', type: 'checkbox', checked: true });
      const ddl1 = createMockElement({ tagName: 'select', value: '502' });
      const row1 = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '101' },
        children: [chk1, ddl1],
      });

      // Row 2: Held unrequested (preserve)
      const chk2 = createMockElement({ tagName: 'input', type: 'checkbox', checked: true });
      const ddl2 = createMockElement({ tagName: 'select', value: '888' });
      const row2 = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '999' },
        children: [chk2, ddl2],
      });

      const tbl = createMockElement({ id: 'tblRegularCourses', children: [row1, row2] });
      const doc = createMockDocument({ elements: [tbl] });

      const heldCourses = [
        { courseCreationId: 101, courseCode: 'CS101', heldSectionCreationId: 501, isRegistered: 1 },
        { courseCreationId: 999, courseCode: 'UNREQ', heldSectionCreationId: 888, isRegistered: 1 },
      ];

      const actingDispositions = [
        { courseCreationId: 101, courseCode: 'CS101', wantedSectionCreationId: 502, disposition: 'upgrade' },
      ];

      const res = evaluateSaveGate({ heldCourses, actingDispositions, document: doc, untickedCount: 0 });
      assert.equal(res.approved, true);
    });

    it('Condition 1 failure: refuses when a held course row is missing from the table', () => {
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [] }); // Table has no rows
      const doc = createMockDocument({ elements: [tbl] });

      const heldCourses = [
        { courseCreationId: 101, courseCode: 'CS101', heldSectionCreationId: 501, isRegistered: 1 },
      ];

      const res = evaluateSaveGate({ heldCourses, actingDispositions: [], document: doc });
      assert.equal(res.approved, false);
      assert.match(res.reason, /missing from table/i);
    });

    it('Condition 1 failure: refuses when a held course is unchecked in DOM', () => {
      const chk = createMockElement({ tagName: 'input', type: 'checkbox', checked: false }); // Unchecked!
      const ddl = createMockElement({ tagName: 'select', value: '501' });
      const row = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '101' },
        children: [chk, ddl],
      });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [row] });
      const doc = createMockDocument({ elements: [tbl] });

      const heldCourses = [
        { courseCreationId: 101, courseCode: 'CS101', heldSectionCreationId: 501, isRegistered: 1 },
      ];

      const res = evaluateSaveGate({ heldCourses, actingDispositions: [], document: doc });
      assert.equal(res.approved, false);
      assert.match(res.reason, /unchecked/i);
    });

    it('Condition 1 failure: refuses when a held course dropdown has null / empty / 0 section id', () => {
      const chk = createMockElement({ tagName: 'input', type: 'checkbox', checked: true });
      const ddl = createMockElement({ tagName: 'select', value: '0' }); // Null section value!
      const row = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '101' },
        children: [chk, ddl],
      });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [row] });
      const doc = createMockDocument({ elements: [tbl] });

      const heldCourses = [
        { courseCreationId: 101, courseCode: 'CS101', heldSectionCreationId: 501, isRegistered: 1 },
      ];

      const res = evaluateSaveGate({ heldCourses, actingDispositions: [], document: doc });
      assert.equal(res.approved, false);
      assert.match(res.reason, /null or empty section id/i);
    });

    it('Condition 2 failure: refuses when an acting subject dropdown does not match intended section id', () => {
      const chk = createMockElement({ tagName: 'input', type: 'checkbox', checked: true });
      const ddl = createMockElement({ tagName: 'select', value: '501' }); // Dropdown still holds 501, not 502
      const row = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '101' },
        children: [chk, ddl],
      });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [row] });
      const doc = createMockDocument({ elements: [tbl] });

      const actingDispositions = [
        { courseCreationId: 101, courseCode: 'CS101', wantedSectionCreationId: 502, disposition: 'upgrade' },
      ];

      const res = evaluateSaveGate({ heldCourses: [], actingDispositions, document: doc });
      assert.equal(res.approved, false);
      assert.match(res.reason, /intended '502'/i);
    });

    it('Condition 3 failure: refuses when an automator uncheck has occurred', () => {
      const chk = createMockElement({ tagName: 'input', type: 'checkbox', checked: true });
      const ddl = createMockElement({ tagName: 'select', value: '502' });
      const row = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '101' },
        children: [chk, ddl],
      });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [row] });
      const doc = createMockDocument({ elements: [tbl] });

      const res = evaluateSaveGate({
        heldCourses: [],
        actingDispositions: [{ courseCreationId: 101, wantedSectionCreationId: 502, disposition: 'acquire' }],
        document: doc,
        untickedCount: 1, // Unticked!
      });
      assert.equal(res.approved, false);
      assert.match(res.reason, /un-ticked/i);
    });
  });

  describe('executeStrike and EXECUTE_STRIKE runtime message', () => {
    it('executes strike: clicks #btnEnlistment exactly once when Save Gate approves', () => {
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      const chk = createMockElement({ tagName: 'input', type: 'checkbox', checked: false });
      const opt = createMockElement({ tagName: 'option', value: '502', textContent: 'G02' });
      const ddl = createMockElement({ tagName: 'select', classList: ['ddlSection'], children: [opt], value: '' });
      const row = createMockElement({
        tagName: 'tr',
        attributes: { 'data-course-creation-id': '101' },
        children: [chk, ddl],
      });
      const tbody = createMockElement({ tagName: 'tbody', children: [row] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [tbody] });

      let enlistmentClicks = 0;
      const btnEnlistment = createMockElement({
        id: 'btnEnlistment',
        style: { display: 'inline-block' },
        onClick: () => { enlistmentClicks++; },
      });

      let confirmClicks = 0;
      const btnConfirmEnlistment = createMockElement({
        id: 'btnConfirmEnlistment',
        style: { display: 'inline-block' },
        onClick: () => { confirmClicks++; },
      });

      const doc = createMockDocument({
        elements: [step2, tbl, btnEnlistment, btnConfirmEnlistment],
      });
      const win = createMockWindow({ document: doc });

      const dispositions = [{
        courseCreationId: 101,
        courseCode: 'CS101',
        wantedSectionCreationId: 502,
        wantedSectionCode: 'G02',
        disposition: 'acquire',
      }];

      const result = executeStrike({
        dispositions,
        heldCourses: [],
        document: doc,
        window: win,
      });

      assert.equal(result.success, true);
      assert.equal(result.clicked, true);
      assert.equal(result.saveGateApproved, true);
      assert.equal(enlistmentClicks, 1); // #btnEnlistment clicked exactly ONCE!
      assert.equal(confirmClicks, 0); // #btnConfirmEnlistment NEVER touched!
    });

    it('refuses to click when Save Gate refuses and leaves #btnEnlistment unclicked', () => {
      const step2 = createMockElement({ id: 'STEP2', classList: ['active'] });
      // Row is missing from table -> Save Gate will refuse
      const tbody = createMockElement({ tagName: 'tbody', children: [createMockElement({ tagName: 'tr' })] });
      const tbl = createMockElement({ id: 'tblRegularCourses', children: [tbody] });

      let enlistmentClicks = 0;
      const btnEnlistment = createMockElement({
        id: 'btnEnlistment',
        style: { display: 'inline-block' },
        onClick: () => { enlistmentClicks++; },
      });

      const doc = createMockDocument({
        elements: [step2, tbl, btnEnlistment],
      });
      const win = createMockWindow({ document: doc });

      const dispositions = [{
        courseCreationId: 101,
        courseCode: 'CS101',
        wantedSectionCreationId: 502,
        disposition: 'acquire',
      }];

      const result = executeStrike({
        dispositions,
        heldCourses: [],
        document: doc,
        window: win,
      });

      assert.equal(result.success, false);
      assert.equal(result.clicked, false);
      assert.equal(result.saveGateApproved, false);
      assert.equal(enlistmentClicks, 0); // NOT clicked!
    });

    it('handleContentMessage answers EXECUTE_STRIKE message', () => {
      let responsePayload = null;
      const sendResponse = (res) => { responsePayload = res; };

      const mockStrike = () => ({ success: true, clicked: true, saveGateApproved: true });

      handleContentMessage(
        { type: 'EXECUTE_STRIKE', dispositions: [], heldCourses: [] },
        {},
        sendResponse,
        { executeStrike: mockStrike }
      );

      assert.ok(responsePayload);
      assert.equal(responsePayload.success, true);
      assert.equal(responsePayload.clicked, true);
    });
  });
});




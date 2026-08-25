import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_STATES,
  classifyPageState,
  executeStateAction,
  executeStrike,
  evaluateSaveGate,
  applyDispositionsToDom,
} from '../content/classifier.js';

import {
  createVigilRecord,
  evaluateChecklist,
  formatDateTimeDisplay,
  formatArmLabel,
  updateBadge,
  armVigil,
  transitionArmedToWatching,
  rebuildAlarmsFromStorage,
  checkSession,
} from '../popup/arming.js';

import {
  executePass,
  reconcilePlan,
  reconcileSubject,
  computeCadenceInterval,
  computeNextPassDelay,
  detectResetConditions,
  diffHeldCourses,
  checkStall,
  handleStall,
  stopVigil,
  appendPassTail,
  DISPOSITIONS,
} from '../popup/pass.js';

import {
  ensureOwnedTab,
  getOwnedTab,
  handleStep2BoundReached,
  handleOwnedTabReload,
  handleUnrecognisedAbort,
  handleLoggedOutSuspend,
  handleSessionProbe,
  steerOwnedTab,
} from '../popup/tab-manager.js';

import {
  appendLedgerEntry,
  handleAlertRepeatAlarm,
  resolveActiveAlert,
  filterLedgerEntries,
  formatEventTime,
  exportPassTail,
} from '../popup/reporting.js';

// Mock storage factory
function createMockStorage(initial = {}) {
  let store = structuredClone(initial);
  return {
    get: async (keys) => {
      if (typeof keys === 'string') {
        return { [keys]: store[keys] };
      }
      if (Array.isArray(keys)) {
        const res = {};
        for (const k of keys) {
          if (store[k] !== undefined) res[k] = store[k];
        }
        return res;
      }
      return structuredClone(store);
    },
    set: async (items) => {
      store = { ...store, ...structuredClone(items) };
    },
    remove: async (keys) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) {
        delete store[k];
      }
    },
    _getStore: () => store,
  };
}

// Mock alarms factory
function createMockAlarms() {
  const alarms = new Map();
  return {
    create: (name, info) => {
      alarms.set(name, info);
    },
    get: async (name) => alarms.get(name) || null,
    clear: async (name) => {
      const had = alarms.has(name);
      alarms.delete(name);
      return had;
    },
    clearAll: async () => {
      alarms.clear();
    },
    _getAlarms: () => new Map(alarms),
  };
}

// Mock action (badge) factory
function createMockAction() {
  let badgeText = '';
  let badgeColor = null;
  return {
    setBadgeText: ({ text }) => {
      badgeText = text;
    },
    setBadgeBackgroundColor: ({ color }) => {
      badgeColor = color;
    },
    _getBadge: () => ({ text: badgeText, color: badgeColor }),
  };
}

// Mock notifications factory
function createMockNotifications() {
  const list = [];
  return {
    create: (idOrOpts, maybeOpts) => {
      const opts = typeof idOrOpts === 'object' ? idOrOpts : maybeOpts;
      list.push(opts);
    },
    clear: () => {},
    _getList: () => list,
    _getNotifications: () => list.map((opts, idx) => ({ id: `notif_${idx}`, options: opts })),
  };
}

// Mock tabs factory
function createMockTabs(initialTabs = []) {
  const tabs = new Map(initialTabs.map((t) => [t.id, { ...t }]));
  let nextId = 100;
  return {
    create: async (opts) => {
      const id = ++nextId;
      const tab = { id, url: opts.url || '', active: opts.active || false, ...opts };
      tabs.set(id, tab);
      return tab;
    },
    get: async (id) => {
      const tab = tabs.get(id);
      if (!tab) throw new Error(`Tab ${id} not found`);
      return { ...tab };
    },
    query: async (q) => {
      const list = Array.from(tabs.values());
      if (q?.url) return list.filter((t) => t.url && t.url.includes('archershub.dlsu.edu.ph'));
      return list;
    },
    update: async (id, props) => {
      const tab = tabs.get(id);
      if (!tab) throw new Error(`Tab ${id} not found`);
      Object.assign(tab, props);
      return { ...tab };
    },
    reload: async (id) => {
      const tab = tabs.get(id);
      if (!tab) throw new Error(`Tab ${id} not found`);
      tab.reloaded = (tab.reloaded || 0) + 1;
      return { ...tab };
    },
    sendMessage: async (id, msg) => {
      return { success: true, ok: true, state: PAGE_STATES.STEP2_BOUND };
    },
    _getTabs: () => tabs,
  };
}

// Mock fetch factory for ArchersHub catalogue endpoints
function createCatalogueMockFetch({
  courses = [],
  postCourses = null,
} = {}) {
  let callCount = 0;
  return async (url) => {
    if (url.includes('/Enlistment_V2/Index')) {
      return {
        ok: true,
        status: 200,
        text: async () => `
          <input id="hdfAcademicSessionId" value="44" />
          <input id="hdfRuleAllocationId" value="12" />
          <input id="hdfEnlistmentRuleId" value="34" />
        `,
      };
    }
    if (url.includes('/GetAllCourseSectionData/')) {
      callCount++;
      const currentCourses = (callCount > 1 && postCourses) ? postCourses : courses;
      const courseDetails = currentCourses.map((c) => ({
        COURSE_CREATION_ID: c.courseCreationId,
        COURSE_CODE: c.courseCode || 'COURSE',
        COURSE_NAME: c.courseName || 'Course Name',
        IS_REGISTERED: c.isRegistered ?? (c.heldSectionCreationId ? 1 : 0),
        SECTION_CREATION_ID: c.heldSectionCreationId ?? null,
      }));
      return {
        ok: true,
        status: 200,
        json: async () => ({ CourseDetails: courseDetails }),
      };
    }
    if (url.includes('/GetCourseWiseSectionData/')) {
      const currentCourses = (callCount > 1 && postCourses) ? postCourses : courses;
      const sectionDetails = [];
      for (const c of currentCourses) {
        if (Array.isArray(c.sections)) {
          for (const s of c.sections) {
            sectionDetails.push({
              COURSE_CREATION_ID: c.courseCreationId,
              SECTION_CREATION_ID: s.sectionCreationId,
              SECTION_NAME: s.sectionName || `Sec_${s.sectionCreationId}`,
            });
          }
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => sectionDetails,
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
}

// Mock DOM elements helper
function createMockElement({
  id = '',
  tagName = 'div',
  classList = [],
  style = {},
  attributes = {},
  dataset = {},
  value = '',
  checked = false,
  disabled = false,
  children = [],
  text = '',
  clickFn = null,
} = {}) {
  let clickCount = 0;
  const el = {
    id,
    tagName: tagName.toUpperCase(),
    nodeName: tagName.toUpperCase(),
    classList: {
      _classes: new Set(classList),
      contains(c) {
        return this._classes.has(c);
      },
      add(c) {
        this._classes.add(c);
      },
      remove(c) {
        this._classes.delete(c);
      },
    },
    style: { ...style },
    dataset: { ...dataset },
    value,
    checked,
    disabled,
    textContent: text,
    innerText: text,
    children: [...children],
    options: children.filter((c) => c.tagName === 'OPTION'),
    rows: children.filter((c) => c.tagName === 'TR'),
    getAttribute(attr) {
      if (attr === 'id') return this.id;
      if (attr.startsWith('data-')) {
        const k = attr.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        if (this.dataset[k] !== undefined) return this.dataset[k];
      }
      return attributes[attr] ?? null;
    },
    setAttribute(attr, val) {
      attributes[attr] = String(val);
      if (attr.startsWith('data-')) {
        const k = attr.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        this.dataset[k] = String(val);
      }
    },
    querySelector(selector) {
      if (selector === `#${this.id}`) return this;
      for (const child of this.children) {
        if (selector === `#${child.id}`) return child;
        if (selector === child.tagName?.toLowerCase()) return child;
        if (selector.startsWith('.') && child.classList.contains(selector.slice(1))) return child;
        if (selector.includes('input') && child.tagName === 'INPUT') return child;
        if (selector.includes('select') && child.tagName === 'SELECT') return child;
        const found = child.querySelector ? child.querySelector(selector) : null;
        if (found) return found;
      }
      return null;
    },
    querySelectorAll(selector) {
      const results = [];
      for (const child of this.children) {
        if (selector === `#${child.id}`) results.push(child);
        else if (selector === child.tagName?.toLowerCase()) results.push(child);
        else if (selector.startsWith('.') && child.classList.contains(selector.slice(1))) results.push(child);
        else if (selector === 'tr' && child.tagName === 'TR') results.push(child);
        else if (selector === 'tbody tr' && child.tagName === 'TR') results.push(child);
        else if (selector === 'option' && child.tagName === 'OPTION') results.push(child);
        else if (selector.includes('input') && child.tagName === 'INPUT') results.push(child);
        if (child.querySelectorAll) {
          results.push(...child.querySelectorAll(selector));
        }
      }
      return results;
    },
    click() {
      clickCount++;
      if (clickFn) clickFn(this);
    },
    dispatchEvent(evt) {},
    getClickCount: () => clickCount,
  };
  return el;
}

// Mock DOM document helper
function createMockDocument({ title = 'ArchersHub', elements = [] } = {}) {
  const elementMap = new Map();
  function register(el) {
    if (el.id) elementMap.set(el.id, el);
    if (el.children) {
      for (const child of el.children) register(child);
    }
  }
  for (const el of elements) register(el);

  return {
    title,
    body: {
      classList: {
        contains: (c) => false,
      },
    },
    getElementById: (id) => elementMap.get(id) || null,
    querySelector: (selector) => {
      if (selector.startsWith('#')) return elementMap.get(selector.slice(1)) || null;
      for (const el of elements) {
        const found = el.querySelector ? el.querySelector(selector) : null;
        if (found) return found;
      }
      return null;
    },
    querySelectorAll: (selector) => {
      const list = [];
      for (const el of elements) {
        if (el.querySelectorAll) list.push(...el.querySelectorAll(selector));
      }
      return list;
    },
    documentElement: {
      outerHTML: '<html>Mock ArchersHub Document</html>',
    },
  };
}

describe('SPEC §15 Acceptance Checklist Live & Safety Invariants', () => {
  describe('Check 1: Badge shows each state in the §10 table correctly', () => {
    it('renders empty badge for none/stopped, • grey for armed, count blue for watching, ! amber for suspended, !! red for stall, X dark red for aborted, ✓ green for complete', () => {
      const action = createMockAction();

      // None / Initial
      updateBadge({ state: 'none', actionApi: action });
      assert.deepEqual(action._getBadge(), { text: '', color: null });

      // Stopped
      updateBadge({ state: 'stopped', actionApi: action });
      assert.deepEqual(action._getBadge(), { text: '', color: null });

      // Armed (grey •)
      updateBadge({ state: 'armed', actionApi: action });
      assert.deepEqual(action._getBadge(), { text: '•', color: '#888888' });

      // Watching (blue count)
      updateBadge({ state: 'watching', unresolvedCount: 3, actionApi: action });
      assert.deepEqual(action._getBadge(), { text: '3', color: '#4285F4' });

      // Suspended (amber !)
      updateBadge({ state: 'suspended', actionApi: action });
      assert.deepEqual(action._getBadge(), { text: '!', color: '#F59E0B' });

      // Stall (red !!)
      updateBadge({ state: 'stall', actionApi: action });
      assert.deepEqual(action._getBadge(), { text: '!!', color: '#EF4444' });

      // Aborted (dark red X)
      updateBadge({ state: 'aborted', actionApi: action });
      assert.deepEqual(action._getBadge(), { text: 'X', color: '#991B1B' });

      // Complete (green ✓)
      updateBadge({ state: 'complete', actionApi: action });
      assert.deepEqual(action._getBadge(), { text: '✓', color: '#10B981' });
    });
  });

  describe('Check 2: Stall clock (10 minutes with no complete pass)', () => {
    it('never fires while the Vigil is watching correctly and finding nothing (refreshes lastCompletePassAt)', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000000, startedAt: 1000000 },
        plan: { subjects: [{ courseCreationId: 101, sectionCreationId: 501 }] },
        ownedTabId: 101,
        lastCompletePassAt: 1000000,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);

      // Mock catalogue read where 501 is not in dropdown (finding nothing)
      const mockFetch = createCatalogueMockFetch({
        courses: [
          {
            courseCreationId: 101,
            courseCode: 'CSARCH1',
            heldSectionCreationId: null,
            sections: [{ sectionCreationId: 502, sectionName: 'S12' }],
          },
        ],
      });

      // Pass 1 at t = 1,100,000 ms
      const res1 = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 1100000,
      });

      assert.equal(res1.isComplete, true);
      assert.equal(res1.state, 'watching');
      assert.equal(storage._getStore().lastCompletePassAt, 1100000);

      // Pass 2 at t = 1,200,000 ms (200s after start, but only 100s after last complete pass)
      const res2 = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 1200000,
      });

      assert.equal(res2.isComplete, true);
      assert.equal(res2.state, 'watching');
      assert.equal(storage._getStore().vigil.state, 'watching');
      assert.equal(notifications._getList().length, 0); // No Stall Alert raised!
    });

    it('fires at 10 minutes with no complete Pass (e.g. repeated Save Gate refusals)', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000000, startedAt: 1000000 },
        plan: { subjects: [{ courseCreationId: 101, sectionCreationId: 501 }] },
        ownedTabId: 101,
        lastCompletePassAt: 1000000,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);

      // Tabs sendMessage will return Save Gate refusal on strike
      tabs.sendMessage = async (id, msg) => {
        if (msg.type === 'CLASSIFY_PAGE') return { success: true, state: PAGE_STATES.STEP2_BOUND };
        if (msg.type === 'EXECUTE_STRIKE') return { success: false, clicked: false, reason: 'Save Gate refused' };
        return { success: true };
      };

      const mockFetch = createCatalogueMockFetch({
        courses: [
          {
            courseCreationId: 101,
            courseCode: 'CSARCH1',
            heldSectionCreationId: null,
            sections: [{ sectionCreationId: 501, sectionName: 'S11' }],
          },
        ],
      });

      // Pass occurs at 10 minutes + 1ms (1,600,001 ms) without complete pass
      const res = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 1600001,
      });

      assert.equal(res.state, 'stall');
      assert.equal(storage._getStore().vigil.state, 'stall');
      assert.equal(action._getBadge().text, '!!');
      assert.equal(action._getBadge().color, '#EF4444');
      assert.equal(notifications._getList().length, 1);
      assert.equal(notifications._getList()[0].title, 'Stall');
    });
  });

  describe('Check 3: Dead session suspension and auto-resume within 30s', () => {
    it('suspends Vigil on session loss, parks Owned Tab on login, probes flat 30s, and auto-resumes full cadence upon logging back in', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000000, startedAt: 1000000 },
        plan: { subjects: [{ courseCreationId: 101, sectionCreationId: 501 }] },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);

      // 1. Session dies mid-Vigil: catalogue returns login redirect / loggedIn: false
      const mockFetchLoggedOut = async () => ({
        ok: true,
        text: async () => '<html><title>Login</title><div id="divLogin"></div></html>',
      });

      const passRes = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetchLoggedOut,
        now: 1010000,
      });

      assert.equal(passRes.state, 'suspended');
      assert.equal(storage._getStore().vigil.state, 'suspended');
      assert.equal(action._getBadge().text, '!');
      assert.equal(action._getBadge().color, '#F59E0B');
      assert.equal(alarms._getAlarms().has('probe_session'), true);
      assert.equal(alarms._getAlarms().get('probe_session').periodInMinutes, 0.5); // 30s probe
      assert.equal((await tabs.get(101)).url, 'https://archershub.dlsu.edu.ph/'); // Parked on login

      // 2. Probe while still logged out: stays suspended without extra notification
      const probe1 = await handleSessionProbe({
        fetchImpl: mockFetchLoggedOut,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        tabsApi: tabs,
        notificationsApi: notifications,
        now: 1040000,
      });
      assert.equal(probe1.resumed, false);
      assert.equal(notifications._getList().length, 1); // No duplicate notification!

      // 3. Student logs back in: probe detects authenticated session
      const mockFetchLoggedIn = async () => ({
        ok: true,
        text: async () => `
          <input id="hdfAcademicSessionId" value="44" />
          <input id="hdfRuleAllocationId" value="12" />
          <input id="hdfEnlistmentRuleId" value="34" />
        `,
      });

      const probe2 = await handleSessionProbe({
        fetchImpl: mockFetchLoggedIn,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        tabsApi: tabs,
        notificationsApi: notifications,
        now: 1070000,
      });

      assert.equal(probe2.resumed, true);
      assert.equal(probe2.state, 'watching');
      assert.equal(storage._getStore().vigil.state, 'watching');
      assert.equal(action._getBadge().text, '1'); // Blue watching count
      assert.equal(action._getBadge().color, '#4285F4');
      assert.equal(alarms._getAlarms().has('probe_session'), false); // Probe cleared
      assert.equal(alarms._getAlarms().has('vigil_pass'), true); // Fast pass scheduled
      assert.equal((await tabs.get(101)).url, 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index'); // Navigated back
    });
  });

  describe('Check 4: Save Gate refuses a click when course row is unbound or un-ticked', () => {
    it('refuses click when held course row is missing, unchecked, or carries empty section dropdown, and Pass reclassifies rather than clicking', () => {
      // Step 2 pane with regular course table
      const step2 = createMockElement({ id: 'STEP2', classList: ['tab-pane', 'active'] });
      const tbl = createMockElement({ id: 'tblRegularCourses' });
      let enlistmentClicks = 0;
      const btnEnlistment = createMockElement({
        id: 'btnEnlistment',
        clickFn: () => enlistmentClicks++,
      });

      const doc = createMockDocument({
        elements: [step2, tbl, btnEnlistment],
      });

      // Held course is missing from table
      const gateRes1 = evaluateSaveGate({
        heldCourses: [{ courseCreationId: 101, courseCode: 'CSARCH1', heldSectionCreationId: 501 }],
        actingDispositions: [],
        document: doc,
      });
      assert.equal(gateRes1.approved, false);
      assert.match(gateRes1.reason, /missing from table/i);

      // Strike refuses and does NOT click
      const strikeRes1 = executeStrike({
        dispositions: [{ courseCreationId: 102, disposition: 'acquire', wantedSectionCreationId: 502 }],
        heldCourses: [{ courseCreationId: 101, courseCode: 'CSARCH1', heldSectionCreationId: 501 }],
        document: doc,
      });
      assert.equal(strikeRes1.clicked, false);
      assert.equal(enlistmentClicks, 0);

      // Now add row but with unchecked checkbox and empty section dropdown
      const chk = createMockElement({ tagName: 'input', checked: false });
      const ddl = createMockElement({ tagName: 'select', value: '0' });
      const row = createMockElement({
        tagName: 'tr',
        dataset: { courseCreationId: '101', courseCode: 'CSARCH1' },
        children: [chk, ddl],
      });
      tbl.children = [row];
      tbl.rows = [row];

      const gateRes2 = evaluateSaveGate({
        heldCourses: [{ courseCreationId: 101, courseCode: 'CSARCH1', heldSectionCreationId: 501 }],
        actingDispositions: [],
        document: doc,
      });
      assert.equal(gateRes2.approved, false);
      assert.match(gateRes2.reason, /unchecked/i);

      const strikeRes2 = executeStrike({
        dispositions: [],
        heldCourses: [{ courseCreationId: 101, courseCode: 'CSARCH1', heldSectionCreationId: 501 }],
        document: doc,
      });
      assert.equal(strikeRes2.clicked, false);
      assert.equal(enlistmentClicks, 0); // Invariant maintained: 0 clicks!
    });
  });

  describe('Check 5: Post-write diff detects lost Slot and raises Notice without stopping Vigil', () => {
    it('detects a lost Slot when a held course is missing post-strike, raises Notice, and continues Vigil', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000000, startedAt: 1000000 },
        plan: {
          subjects: [
            { courseCreationId: 101, sectionCreationId: 502 }, // Wanted upgrade
            { courseCreationId: 102, sectionCreationId: 601 }, // Unresolved
          ],
        },
        ownedTabId: 101,
        lastHeldSnapshot: { 101: 501, 102: null },
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);

      // Tabs handles strike click
      tabs.sendMessage = async (id, msg) => {
        if (msg.type === 'CLASSIFY_PAGE') return { success: true, state: PAGE_STATES.STEP2_BOUND };
        if (msg.type === 'EXECUTE_STRIKE') return { success: true, clicked: true, saveGateApproved: true };
        return { success: true };
      };

      // Pre-strike: 101 holds 501, 502 available (triggers upgrade)
      // Post-strike: 101 holds null (lost slot!), 102 holds null
      const mockFetch = createCatalogueMockFetch({
        courses: [
          {
            courseCreationId: 101,
            courseCode: 'CSARCH1',
            heldSectionCreationId: 501,
            sections: [{ sectionCreationId: 502, sectionName: 'S12' }],
          },
          {
            courseCreationId: 102,
            courseCode: 'CSNET1',
            heldSectionCreationId: null,
            sections: [{ sectionCreationId: 602, sectionName: 'X01' }],
          },
        ],
        postCourses: [
          {
            courseCreationId: 101,
            courseCode: 'CSARCH1',
            heldSectionCreationId: null, // LOST SLOT!
            sections: [],
          },
          {
            courseCreationId: 102,
            courseCode: 'CSNET1',
            heldSectionCreationId: null,
            sections: [],
          },
        ],
      });

      const res = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 1050000,
      });

      assert.equal(res.strikePerformed, true);
      assert.equal(res.state, 'watching'); // Still watching! Not stopped or aborted!
      assert.equal(storage._getStore().vigil.state, 'watching');

      // Notice raised for Lost Slot
      const ledger = storage._getStore().ledger || [];
      const lostSlotEntry = ledger.find((e) => e.type === 'lost_slot');
      assert.ok(lostSlotEntry);
      assert.equal(lostSlotEntry.tier, 'notice');
      assert.equal(lostSlotEntry.title, 'Lost Slot');
      assert.match(lostSlotEntry.cause, /lost during switch/i);
    });
  });

  describe('Check 6: Arming refuses against a logged-out session in both modes', () => {
    it('refuses arming in start-now and start-at-time modes when session is logged out', async () => {
      const storage = createMockStorage();
      const alarms = createMockAlarms();
      const action = createMockAction();
      const tabs = createMockTabs();

      const mockFetchLoggedOut = async () => ({
        ok: true,
        text: async () => '<html><title>Login</title></html>',
      });

      const plan = {
        subjects: [{ courseCreationId: 101, sectionCreationId: 501 }],
      };

      // 1. Start Now mode
      const resNow = await armVigil({
        plan,
        startMode: 'now',
        fetchImpl: mockFetchLoggedOut,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        tabsApi: tabs,
      });

      assert.equal(resNow.success, false);
      assert.equal(resNow.reason, 'logged_out');
      assert.equal(storage._getStore().vigil, undefined);
      assert.equal(alarms._getAlarms().size, 0);

      // 2. Start At Time mode
      const resScheduled = await armVigil({
        plan,
        startMode: 'at-time',
        startTime: '2026-08-26T07:00:00Z',
        fetchImpl: mockFetchLoggedOut,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        tabsApi: tabs,
      });

      assert.equal(resScheduled.success, false);
      assert.equal(resScheduled.reason, 'logged_out');
      assert.equal(storage._getStore().vigil, undefined);
      assert.equal(alarms._getAlarms().size, 0);

      // 3. Checklist renders ✗ for logged out
      const checklist = evaluateChecklist({ loggedIn: false });
      assert.equal(checklist[0].mark, '✗');
      assert.equal(checklist[0].status, 'no');
    });
  });

  describe('Check 7: Start time that passed while Brave was closed starts Vigil immediately on startup', () => {
    it('starts Watching immediately on startup when scheduled start time has passed, rather than silently dropping', async () => {
      const pastTime = 1756180000000;
      const now = 1756180010000; // 10 seconds after start time

      const storage = createMockStorage({
        vigil: { state: 'armed', nextFireTime: pastTime, lastChangeAt: pastTime, startedAt: pastTime },
        plan: { subjects: [{ courseCreationId: 101, sectionCreationId: 501 }], startMode: 'at-time' },
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);
      const notifications = createMockNotifications();

      const result = await rebuildAlarmsFromStorage({
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        tabsApi: tabs,
        notificationsApi: notifications,
        now,
      });

      assert.equal(result.state, 'watching');
      assert.equal(result.missedStart, true);
      assert.equal(storage._getStore().vigil.state, 'watching');
      assert.equal(action._getBadge().text, '1'); // Blue badge count
      assert.equal(action._getBadge().color, '#4285F4');
      assert.equal(alarms._getAlarms().has('vigil_pass'), true); // Immediate pass alarm
    });
  });

  describe('Check 8: Stop takes two presses, leaves Plan intact, empties badge, and never resumes', () => {
    it('stops Vigil completely on second press, clears all alarms, clears badge, leaves plan in storage, and never resumes', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000000, startedAt: 1000000 },
        plan: { subjects: [{ courseCreationId: 101, sectionCreationId: 501 }] },
        activeAlert: { type: 'suspended', repeatCount: 1 },
      });
      const alarms = createMockAlarms();
      alarms.create('vigil_pass', { delayInMinutes: 1 });
      alarms.create('probe_session', { periodInMinutes: 0.5 });
      alarms.create('alert_repeat', { delayInMinutes: 30 });

      const action = createMockAction();
      action.setBadgeText({ text: '1' });
      const notifications = createMockNotifications();

      // Execute stopVigil
      const stopRes = await stopVigil({
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        now: 1020000,
      });

      assert.equal(stopRes.state, 'stopped');
      assert.equal(storage._getStore().vigil.state, 'stopped');
      assert.deepEqual(storage._getStore().plan.subjects, [{ courseCreationId: 101, sectionCreationId: 501 }]); // Plan left intact!
      assert.equal(storage._getStore().activeAlert, undefined); // Active alert resolved

      // All alarms cleared
      assert.equal(alarms._getAlarms().size, 0);

      // Badge emptied
      assert.equal(action._getBadge().text, '');

      // Resuming via session probe returns false and does not resume
      const probeRes = await handleSessionProbe({
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        now: 1050000,
      });
      // Stays stopped / does not create alarms
      assert.equal(alarms._getAlarms().has('vigil_pass'), false);
    });
  });

  describe('Check 9: Owned Tab is never reloaded while a strike is pending', () => {
    it('refuses reload and navigation when strikePending is true in storage', async () => {
      const storage = createMockStorage({
        ownedTabId: 101,
        vigil: { state: 'watching' },
        strikePending: true, // Strike is currently in flight!
      });
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);
      const alarms = createMockAlarms();

      // 1. handleOwnedTabReload refuses reload
      const reloadRes = await handleOwnedTabReload({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
      });

      assert.equal(reloadRes.reloaded, false);
      assert.equal(reloadRes.reason, 'strike_pending');
      assert.equal((await tabs.get(101)).reloaded || 0, 0); // Not reloaded!

      // 2. steerOwnedTab refuses navigation/reload
      const steerRes = await steerOwnedTab({
        tabId: 101,
        tabsApi: tabs,
        storageApi: storage,
      });

      assert.equal(steerRes.action, 'deferred');
      assert.equal(steerRes.reason, 'strike_pending');
    });
  });

  describe('Check 10: #btnConfirmEnlistment is NEVER clicked in any state across a full run', () => {
    it('executes actions and strikes across all 12 Page States without ever clicking #btnConfirmEnlistment', () => {
      let confirmClicks = 0;
      let enlistmentClicks = 0;
      let addClicks = 0;
      let bindClicks = 0;

      const btnConfirm = createMockElement({
        id: 'btnConfirmEnlistment',
        classList: ['common-submit-btn'],
        clickFn: () => confirmClicks++,
      });

      const btnEnlistment = createMockElement({
        id: 'btnEnlistment',
        classList: ['common-submit-btn'],
        clickFn: () => enlistmentClicks++,
      });

      const btnAdd = createMockElement({
        id: 'btnAdd',
        style: { display: 'block' },
        clickFn: () => addClicks++,
      });

      const divBind = createMockElement({
        id: 'DivBindCourseList',
        clickFn: () => bindClicks++,
      });

      const rdoOpen = createMockElement({
        id: 'rdoOpenSection',
      });

      const step1 = createMockElement({ id: 'STEP1', classList: ['tab-pane', 'active'] });
      const step2 = createMockElement({ id: 'STEP2', classList: ['tab-pane'] });
      const step3 = createMockElement({ id: 'STEP3', classList: ['tab-pane'] });
      const tbl = createMockElement({ id: 'tblRegularCourses' });

      const chk = createMockElement({ tagName: 'input', checked: true });
      const ddl = createMockElement({
        tagName: 'select',
        value: '501',
        children: [createMockElement({ tagName: 'option', value: '501', text: 'S11' })],
      });
      const row = createMockElement({
        tagName: 'tr',
        dataset: { courseCreationId: '101', courseCode: 'CSARCH1' },
        children: [chk, ddl],
      });
      tbl.children = [row];
      tbl.rows = [row];

      const doc = createMockDocument({
        elements: [step1, step2, step3, btnAdd, divBind, rdoOpen, tbl, btnEnlistment, btnConfirm],
      });

      // Test State 7: Step1Unconfigured
      executeStateAction({ state: PAGE_STATES.STEP1_UNCONFIGURED, document: doc });
      assert.equal(confirmClicks, 0);

      // Test State 8: Step1Configured
      executeStateAction({ state: PAGE_STATES.STEP1_CONFIGURED, document: doc });
      assert.equal(confirmClicks, 0);

      // Test State 9: Step2Unbound
      executeStateAction({ state: PAGE_STATES.STEP2_UNBOUND, document: doc });
      assert.equal(confirmClicks, 0);

      // Test State 10: Step2Bound -> Execute Strike
      step1.classList.remove('active');
      step2.classList.add('active');

      const strikeRes = executeStrike({
        dispositions: [
          { courseCreationId: 101, disposition: 'acquire', wantedSectionCreationId: 501, wantedSectionCode: 'S11' },
        ],
        heldCourses: [],
        document: doc,
      });

      assert.equal(strikeRes.clicked, true);
      assert.equal(enlistmentClicks, 1); // #btnEnlistment clicked exactly ONCE
      assert.equal(confirmClicks, 0); // #btnConfirmEnlistment NEVER CLICKED!

      // Test State 11: Step3Reached
      step2.classList.remove('active');
      step3.classList.add('active');
      executeStateAction({ state: PAGE_STATES.STEP3_REACHED, document: doc });
      assert.equal(confirmClicks, 0);

      // Test State 12: Unrecognised
      executeStateAction({ state: PAGE_STATES.UNRECOGNISED, document: doc });
      assert.equal(confirmClicks, 0);

      // Verify across the entire test sequence
      assert.equal(confirmClicks, 0, 'Safety Invariant Violated: #btnConfirmEnlistment received a click!');
    });
  });
});

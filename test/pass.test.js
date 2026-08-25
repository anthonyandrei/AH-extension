import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCadenceInterval,
  applyJitter,
  computeNextPassDelay,
  detectResetConditions,
  reconcileSubject,
  reconcilePlan,
  appendPassTail,
  executePass,
  stopVigil,
  diffHeldCourses,
  DISPOSITIONS,
} from '../popup/pass.js';
import { PAGE_STATES } from '../content/classifier.js';

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
    create: (opts) => {
      list.push(opts);
    },
    clear: () => {},
    _getList: () => list,
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

describe('pass module', () => {
  describe('cadence calculation & backoff math', () => {
    it('computes 2s baseline interval when elapsed time is 0', () => {
      const now = 1756180000000;
      const interval = computeCadenceInterval({ lastChangeAt: now, now });
      assert.equal(interval, 2000);
    });

    it('grows interval by 1.5x per no-change pass according to formula', () => {
      const baseTime = 1756180000000;

      // Pass 1: elapsed = 2s -> interval = 2 * 1.5^1 = 3s = 3000ms
      const interval1 = computeCadenceInterval({ lastChangeAt: baseTime, now: baseTime + 2000 });
      assert.equal(Math.round(interval1), 3000);

      // Pass 2: elapsed = 5s (2s + 3s) -> interval = 2 * 1.5^2 = 4.5s = 4500ms
      const interval2 = computeCadenceInterval({ lastChangeAt: baseTime, now: baseTime + 5000 });
      assert.equal(Math.round(interval2), 4500);

      // Pass 3: elapsed = 9.5s (2s + 3s + 4.5s) -> interval = 2 * 1.5^3 = 6.75s = 6750ms
      const interval3 = computeCadenceInterval({ lastChangeAt: baseTime, now: baseTime + 9500 });
      assert.equal(Math.round(interval3), 6750);
    });

    it('caps cadence at 60s ceiling after prolonged no-change period', () => {
      const baseTime = 1756180000000;
      // After 200s (>= 116s), interval is clamped at 60000ms
      const interval = computeCadenceInterval({ lastChangeAt: baseTime, now: baseTime + 200000 });
      assert.equal(interval, 60000);
    });

    it('is demonstrably stateless: identical interval produced from cold restart', () => {
      const baseTime = 1756180000000;
      const now = baseTime + 15000;

      const warmInterval = computeCadenceInterval({ lastChangeAt: baseTime, now });
      // Simulate cold worker restart with fresh call
      const coldInterval = computeCadenceInterval({ lastChangeAt: baseTime, now });

      assert.equal(warmInterval, coldInterval);
    });

    it('jumps directly to 60s ceiling when rateLimited is true regardless of elapsed time', () => {
      const now = 1756180000000;
      // Even if lastChangeAt was 0 seconds ago, rateLimited forces 60s
      const interval = computeCadenceInterval({ lastChangeAt: now, now, rateLimited: true });
      assert.equal(interval, 60000);
    });

    it('applies +/-25% jitter within strict bounds', () => {
      const baseInterval = 10000;

      // Lower bound: random = 0 -> 0.75 * 10000 = 7500
      const minJitter = applyJitter(baseInterval, () => 0);
      assert.equal(minJitter, 7500);

      // Upper bound: random = 1 -> 1.25 * 10000 = 12500
      const maxJitter = applyJitter(baseInterval, () => 1);
      assert.equal(maxJitter, 12500);

      // Midpoint: random = 0.5 -> 1.0 * 10000 = 10000
      const midJitter = applyJitter(baseInterval, () => 0.5);
      assert.equal(midJitter, 10000);
    });

    it('computeNextPassDelay combines base interval and jitter', () => {
      const baseTime = 1756180000000;
      const delay = computeNextPassDelay({
        lastChangeAt: baseTime,
        now: baseTime,
        randomFn: () => 0.5,
      });
      assert.equal(delay, 2000);
    });
  });

  describe('reset condition detection', () => {
    it('detects reset when a Saved Slot appears (previously unheld course is now held)', () => {
      const prevHeld = { 1001: null };
      const currHeld = { 1001: 501 };

      const res = detectResetConditions({
        previousHeldSnapshot: prevHeld,
        currentHeldSnapshot: currHeld,
        previousSectionsSnapshot: {},
        currentSectionsSnapshot: {},
        requestedCourseIds: [1001],
      });

      assert.equal(res.reset, true);
      assert.equal(res.reason, 'saved_slot_appeared');
    });

    it('detects reset when a Section appears in dropdown for requested subjects', () => {
      const prevSecs = { 1001: [501] };
      const currSecs = { 1001: [501, 502] }; // Section 502 appeared

      const res = detectResetConditions({
        previousHeldSnapshot: { 1001: null },
        currentHeldSnapshot: { 1001: null },
        previousSectionsSnapshot: prevSecs,
        currentSectionsSnapshot: currSecs,
        requestedCourseIds: [1001],
      });

      assert.equal(res.reset, true);
      assert.equal(res.reason, 'section_appeared');
    });

    it('detects reset when a Section disappears from dropdown for requested subjects', () => {
      const prevSecs = { 1001: [501, 502] };
      const currSecs = { 1001: [501] }; // Section 502 disappeared

      const res = detectResetConditions({
        previousHeldSnapshot: { 1001: null },
        currentHeldSnapshot: { 1001: null },
        previousSectionsSnapshot: prevSecs,
        currentSectionsSnapshot: currSecs,
        requestedCourseIds: [1001],
      });

      assert.equal(res.reset, true);
      assert.equal(res.reason, 'section_disappeared');
    });

    it('returns reset false when no slots or dropdown sections changed for requested subjects', () => {
      const prevHeld = { 1001: null };
      const currHeld = { 1001: null };
      const prevSecs = { 1001: [501] };
      const currSecs = { 1001: [501] };

      const res = detectResetConditions({
        previousHeldSnapshot: prevHeld,
        currentHeldSnapshot: currHeld,
        previousSectionsSnapshot: prevSecs,
        currentSectionsSnapshot: currSecs,
        requestedCourseIds: [1001],
      });

      assert.equal(res.reset, false);
    });

    it('ignores section changes for unrequested subjects', () => {
      const prevSecs = { 9999: [101] };
      const currSecs = { 9999: [101, 102] }; // Unrequested course 9999 changed

      const res = detectResetConditions({
        previousHeldSnapshot: { 1001: null },
        currentHeldSnapshot: { 1001: null },
        previousSectionsSnapshot: prevSecs,
        currentSectionsSnapshot: currSecs,
        requestedCourseIds: [1001],
      });

      assert.equal(res.reset, false);
    });
  });

  describe('Reconciliation (§8 table)', () => {
    it('classifies none / present as acquire', () => {
      const planSubject = {
        courseCreationId: 101,
        courseCode: 'CS101',
        sectionCreationId: 501,
        sectionCode: 'G01',
      };
      const course = {
        courseCreationId: 101,
        courseCode: 'CS101',
        heldSectionCreationId: null,
        sections: [{ sectionCreationId: 501, sectionCode: 'G01', available: 5 }],
      };

      const result = reconcileSubject({ planSubject, course });
      assert.equal(result.disposition, DISPOSITIONS.ACQUIRE);
      assert.equal(result.status, 'watching');
      assert.equal(result.isSatisfied, false);
    });

    it('classifies none / absent (full) as watching', () => {
      const planSubject = {
        courseCreationId: 101,
        courseCode: 'CS101',
        sectionCreationId: 501,
        sectionCode: 'G01',
      };
      const course = {
        courseCreationId: 101,
        courseCode: 'CS101',
        heldSectionCreationId: null,
        sections: [{ sectionCreationId: 502, sectionCode: 'G02', available: 5 }], // 501 is absent
      };

      const result = reconcileSubject({ planSubject, course });
      assert.equal(result.disposition, DISPOSITIONS.NONE_ABSENT);
      assert.equal(result.status, 'watching');
      assert.equal(result.isSatisfied, false);
    });

    it('classifies held = wanted as satisfied (done)', () => {
      const planSubject = {
        courseCreationId: 101,
        courseCode: 'CS101',
        sectionCreationId: 501,
        sectionCode: 'G01',
      };
      const course = {
        courseCreationId: 101,
        courseCode: 'CS101',
        heldSectionCreationId: 501,
        sections: [{ sectionCreationId: 501, sectionCode: 'G01', available: 0 }],
      };

      const result = reconcileSubject({ planSubject, course });
      assert.equal(result.disposition, DISPOSITIONS.SATISFIED);
      assert.equal(result.status, 'satisfied');
      assert.equal(result.isSatisfied, true);
    });

    it('classifies held != wanted / present as upgrade', () => {
      const planSubject = {
        courseCreationId: 101,
        courseCode: 'CS101',
        sectionCreationId: 501,
        sectionCode: 'G01',
      };
      const course = {
        courseCreationId: 101,
        courseCode: 'CS101',
        heldSectionCreationId: 502, // Holds backup 502
        sections: [{ sectionCreationId: 501, sectionCode: 'G01', available: 2 }],
      };

      const result = reconcileSubject({ planSubject, course });
      assert.equal(result.disposition, DISPOSITIONS.UPGRADE);
      assert.equal(result.status, 'watching');
      assert.equal(result.isSatisfied, false);
      assert.equal(result.heldSectionCreationId, 502);
    });

    it('classifies held != wanted / absent (full) as held_diff_absent', () => {
      const planSubject = {
        courseCreationId: 101,
        courseCode: 'CS101',
        sectionCreationId: 501,
        sectionCode: 'G01',
      };
      const course = {
        courseCreationId: 101,
        courseCode: 'CS101',
        heldSectionCreationId: 502, // Holds backup 502
        sections: [{ sectionCreationId: 502, sectionCode: 'G02', available: 0 }], // 501 is absent
      };

      const result = reconcileSubject({ planSubject, course });
      assert.equal(result.disposition, DISPOSITIONS.HELD_DIFF_ABSENT);
      assert.equal(result.status, 'watching');
      assert.equal(result.isSatisfied, false);
      assert.equal(result.heldSectionCode, 'G02');
    });

    it('reconcilePlan reconciles all subjects and identifies unrequested held courses as preserve', () => {
      const plan = {
        subjects: [
          { courseCreationId: 101, courseCode: 'CS101', sectionCreationId: 501, sectionCode: 'G01' },
          { courseCreationId: 102, courseCode: 'MATH101', sectionCreationId: 601, sectionCode: 'M01' },
        ],
      };
      const courses = [
        {
          courseCreationId: 101,
          courseCode: 'CS101',
          heldSectionCreationId: 501, // Satisfied
          sections: [{ sectionCreationId: 501, sectionCode: 'G01' }],
        },
        {
          courseCreationId: 102,
          courseCode: 'MATH101',
          heldSectionCreationId: null, // None / Absent
          sections: [],
        },
        {
          courseCreationId: 999,
          courseCode: 'UNREQUESTED',
          heldSectionCreationId: 888, // Held, never requested
          sections: [],
        },
      ];

      const reconciliation = reconcilePlan({ plan, courses });

      assert.equal(reconciliation.unresolvedCount, 1);
      assert.equal(reconciliation.allSatisfied, false);
      assert.equal(reconciliation.dispositions.length, 3);

      const cs101 = reconciliation.dispositions.find((d) => d.courseCode === 'CS101');
      assert.equal(cs101.disposition, DISPOSITIONS.SATISFIED);
      assert.equal(cs101.status, 'satisfied');

      const math101 = reconciliation.dispositions.find((d) => d.courseCode === 'MATH101');
      assert.equal(math101.disposition, DISPOSITIONS.NONE_ABSENT);
      assert.equal(math101.status, 'watching');

      const unrequested = reconciliation.dispositions.find((d) => d.courseCode === 'UNREQUESTED');
      assert.equal(unrequested.disposition, DISPOSITIONS.PRESERVE);
      assert.equal(unrequested.status, 'preserve');
    });
  });

  describe('Pass Tail rolling buffer', () => {
    it('appends pass records and caps at 200 rows', async () => {
      const storage = createMockStorage({ passTail: [] });

      for (let i = 1; i <= 205; i++) {
        await appendPassTail({
          passRecord: { passNumber: i, timestamp: i },
          storageApi: storage,
          maxTail: 200,
        });
      }

      const store = storage._getStore();
      assert.equal(store.passTail.length, 200);
      assert.equal(store.passTail[0].passNumber, 6); // First 5 dropped
      assert.equal(store.passTail[199].passNumber, 205);
    });
  });

  describe('stopVigil semantics', () => {
    it('sets vigil to stopped, empties badge, clears alarms, and leaves stored plan unchanged', async () => {
      const storedPlan = {
        academicSessionId: '999',
        subjects: [{ courseCode: 'CS101', sectionCode: 'G01' }],
      };
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: storedPlan,
      });
      const alarms = createMockAlarms();
      alarms.create('vigil_pass', { delayInMinutes: 0.1 });
      alarms.create('owned_tab_reload', { delayInMinutes: 3 });
      const action = createMockAction();
      action.setBadgeText({ text: '1' });
      const notifications = createMockNotifications();

      const result = await stopVigil({
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
      });

      assert.equal(result.state, 'stopped');
      const store = storage._getStore();
      assert.equal(store.vigil.state, 'stopped');
      assert.deepStrictEqual(store.plan, storedPlan); // Plan left unchanged!
      assert.equal(action._getBadge().text, ''); // Badge emptied!
      assert.equal((await alarms.get('vigil_pass')), null); // Alarms cleared!
      assert.equal((await alarms.get('owned_tab_reload')), null);
    });
  });

  describe('executePass coordinator', () => {
    it('on non-Step2Bound state: steers tab, records incomplete pass, and does not update lastCompletePassAt', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: { subjects: [{ courseCreationId: 101, sectionCreationId: 501 }] },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);

      // Mock tabs.sendMessage to return Settling
      tabs.sendMessage = async () => ({ success: true, state: PAGE_STATES.SETTLING });

      const result = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        now: 5000,
      });

      assert.equal(result.isComplete, false);
      assert.equal(result.state, PAGE_STATES.SETTLING);

      const store = storage._getStore();
      assert.equal(store.passTail.length, 1);
      assert.equal(store.passTail[0].complete, false);
      assert.equal(store.lastCompletePassAt, undefined); // Incomplete pass does not update stall clock
    });

    it('on 500 error: treats as no-change, grows interval, records pass, no alert', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: { subjects: [{ courseCreationId: 101, sectionCreationId: 501 }] },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);
      tabs.sendMessage = async () => ({ success: true, state: PAGE_STATES.STEP2_BOUND });

      // Mock fetchImpl to return 500
      const mockFetch = async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 5000,
      });

      assert.equal(result.isComplete, false);
      assert.equal(result.error, 500);

      const store = storage._getStore();
      assert.equal(store.vigil.rateLimited, undefined); // 500 does NOT set rateLimited
      assert.equal(store.vigil.lastChangeAt, 1000); // lastChangeAt NOT reset -> interval grows
      assert.equal(notifications._getList().length, 0); // No alert!
      assert.equal(store.passTail.length, 1);
      assert.equal(store.passTail[0].error, 500);
    });

    it('on 429/403 error: sets rateLimited to true, jumps interval to 60s, records pass', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: { subjects: [{ courseCreationId: 101, sectionCreationId: 501 }] },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);
      tabs.sendMessage = async () => ({ success: true, state: PAGE_STATES.STEP2_BOUND });

      // Mock fetchImpl to return 429
      const mockFetch = async () => ({
        ok: false,
        status: 429,
        text: async () => 'Too Many Requests',
      });

      const result = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 5000,
      });

      assert.equal(result.isComplete, false);
      assert.equal(result.error, 429);

      const store = storage._getStore();
      assert.equal(store.vigil.rateLimited, true); // Sets rateLimited true
      assert.equal(store.passTail[0].error, 429);
    });

    it('on Step2Bound with active watching subjects: reconciles, updates badge, records complete pass', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: {
          subjects: [
            { courseCreationId: 101, courseCode: 'CS101', sectionCreationId: 501, sectionCode: 'G01' },
            { courseCreationId: 102, courseCode: 'MATH101', sectionCreationId: 601, sectionCode: 'M01' },
          ],
        },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);
      tabs.sendMessage = async () => ({ success: true, state: PAGE_STATES.STEP2_BOUND });

      // Mock catalogue fetch returning CS101 satisfied, MATH101 watching (absent)
      const mockFetch = async (url) => {
        if (url.includes('/Enlistment_V2/Index')) {
          return {
            ok: true,
            status: 200,
            text: async () => `
              <input id="hdfAcademicSessionId" value="10" />
              <input id="hdfRuleAllocationId" value="20" />
              <input id="hdfEnlistmentRuleId" value="30" />
            `,
          };
        }
        if (url.includes('/GetAllCourseSectionData/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              CourseDetails: [
                { COURSE_CREATION_ID: 101, COURSE_CODE: 'CS101', SECTION_CREATION_ID: 501, IS_REGISTERED: 1 },
                { COURSE_CREATION_ID: 102, COURSE_CODE: 'MATH101', SECTION_CREATION_ID: null, IS_REGISTERED: 0 },
              ],
            }),
          };
        }
        if (url.includes('/GetCourseWiseSectionData/')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { COURSE_CREATION_ID: 101, SECTION_CREATION_ID: 501, SECTION_NAME: 'G01 {Avail. Slots: 10}' },
            ],
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const result = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 5000,
      });

      assert.equal(result.isComplete, true);
      assert.equal(result.unresolvedCount, 1);
      assert.equal(result.allSatisfied, false);

      const store = storage._getStore();
      assert.equal(store.lastCompletePassAt, 5000);
      assert.equal(store.passTail.length, 1);
      assert.equal(store.passTail[0].complete, true);
      assert.equal(action._getBadge().text, '1'); // Blue badge showing 1 unresolved subject
    });

    it('on Step2Bound when all subjects are satisfied: transitions to complete, sets badge to ✓ green, logs Notice', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: {
          subjects: [
            { courseCreationId: 101, courseCode: 'CS101', sectionCreationId: 501, sectionCode: 'G01' },
          ],
        },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);
      tabs.sendMessage = async () => ({ success: true, state: PAGE_STATES.STEP2_BOUND });

      const mockFetch = async (url) => {
        if (url.includes('/Enlistment_V2/Index')) {
          return {
            ok: true,
            status: 200,
            text: async () => `
              <input id="hdfAcademicSessionId" value="10" />
              <input id="hdfRuleAllocationId" value="20" />
              <input id="hdfEnlistmentRuleId" value="30" />
            `,
          };
        }
        if (url.includes('/GetAllCourseSectionData/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              CourseDetails: [
                { COURSE_CREATION_ID: 101, COURSE_CODE: 'CS101', SECTION_CREATION_ID: 501, IS_REGISTERED: 1 },
              ],
            }),
          };
        }
        if (url.includes('/GetCourseWiseSectionData/')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { COURSE_CREATION_ID: 101, SECTION_CREATION_ID: 501, SECTION_NAME: 'G01 {Avail. Slots: 10}' },
            ],
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const result = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 5000,
      });

      assert.equal(result.isComplete, true);
      assert.equal(result.unresolvedCount, 0);
      assert.equal(result.allSatisfied, true);

      const store = storage._getStore();
      assert.equal(store.vigil.state, 'complete');
      assert.equal(action._getBadge().text, '✓');
      assert.equal(action._getBadge().color, '#10B981'); // Green badge

      // Notice ledger entry logged and notification fired
      const ledger = store.ledger || [];
      const completeEntry = ledger.find((e) => e.type === 'complete');
      assert.ok(completeEntry);
      assert.equal(completeEntry.tier, 'notice');
    });

    it('on actionable dispositions when Save Gate refuses: does not click, records incomplete pass, schedules next pass', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: {
          subjects: [
            { courseCreationId: 101, courseCode: 'CS101', sectionCreationId: 502, sectionCode: 'G02' },
          ],
        },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);

      // Mock classify -> STEP2_BOUND; mock strike -> Save Gate refused
      tabs.sendMessage = async (id, msg) => {
        if (msg.type === 'CLASSIFY_PAGE') {
          return { success: true, state: PAGE_STATES.STEP2_BOUND };
        }
        if (msg.type === 'EXECUTE_STRIKE') {
          return { success: false, clicked: false, saveGateApproved: false, reason: 'Held course CS101 is unchecked' };
        }
        return { success: true };
      };

      const mockFetch = async (url) => {
        if (url.includes('/Enlistment_V2/Index')) {
          return {
            ok: true,
            status: 200,
            text: async () => `
              <input id="hdfAcademicSessionId" value="10" />
              <input id="hdfRuleAllocationId" value="20" />
              <input id="hdfEnlistmentRuleId" value="30" />
            `,
          };
        }
        if (url.includes('/GetAllCourseSectionData/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              CourseDetails: [
                { COURSE_CREATION_ID: 101, COURSE_CODE: 'CS101', SECTION_CREATION_ID: 501, IS_REGISTERED: 1 },
              ],
            }),
          };
        }
        if (url.includes('/GetCourseWiseSectionData/')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { COURSE_CREATION_ID: 101, SECTION_CREATION_ID: 502, SECTION_NAME: 'G02 {Avail. Slots: 5}' },
            ],
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const result = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 5000,
      });

      assert.equal(result.isComplete, false);
      assert.equal(result.strikePerformed, false);
      assert.equal(result.saveGateApproved, false);
      assert.match(result.reason, /unchecked/);

      const store = storage._getStore();
      assert.equal(store.strikePending, false); // strikePending cleared!
      assert.equal(store.passTail.length, 1);
      assert.equal(store.passTail[0].complete, false);
      assert.match(store.passTail[0].summary, /Save Gate refused/);
      assert.ok((await alarms.get('vigil_pass'))); // Next pass scheduled!
    });

    it('on actionable dispositions when strike clicks: sets strikePending during strike, re-reads catalogue, and transitions to complete if all satisfied', async () => {
      let strikePendingObservedDuringStrike = null;
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: {
          subjects: [
            { courseCreationId: 101, courseCode: 'CS101', sectionCreationId: 502, sectionCode: 'G02' },
          ],
        },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);

      tabs.sendMessage = async (id, msg) => {
        if (msg.type === 'CLASSIFY_PAGE') {
          return { success: true, state: PAGE_STATES.STEP2_BOUND };
        }
        if (msg.type === 'EXECUTE_STRIKE') {
          const storeDuringStrike = storage._getStore();
          strikePendingObservedDuringStrike = storeDuringStrike.strikePending;
          return { success: true, clicked: true, saveGateApproved: true };
        }
        return { success: true };
      };

      let fetchCallCount = 0;
      const mockFetch = async (url) => {
        if (url.includes('/Enlistment_V2/Index')) {
          return {
            ok: true,
            status: 200,
            text: async () => `
              <input id="hdfAcademicSessionId" value="10" />
              <input id="hdfRuleAllocationId" value="20" />
              <input id="hdfEnlistmentRuleId" value="30" />
            `,
          };
        }
        if (url.includes('/GetAllCourseSectionData/')) {
          fetchCallCount++;
          // First read before strike: CS101 held at 501
          // Second read after strike: CS101 held at 502 (satisfied!)
          const heldSec = fetchCallCount === 1 ? 501 : 502;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              CourseDetails: [
                { COURSE_CREATION_ID: 101, COURSE_CODE: 'CS101', SECTION_CREATION_ID: heldSec, IS_REGISTERED: 1 },
              ],
            }),
          };
        }
        if (url.includes('/GetCourseWiseSectionData/')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { COURSE_CREATION_ID: 101, SECTION_CREATION_ID: 502, SECTION_NAME: 'G02 {Avail. Slots: 5}' },
            ],
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const result = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 5000,
      });

      assert.equal(strikePendingObservedDuringStrike, true); // strikePending was true during strike!
      assert.equal(result.isComplete, true);
      assert.equal(result.strikePerformed, true);
      assert.equal(result.state, 'complete');
      assert.equal(result.allSatisfied, true);

      const store = storage._getStore();
      assert.equal(store.strikePending, false); // strikePending cleared after strike!
      assert.equal(store.vigil.state, 'complete');
      assert.equal(action._getBadge().text, '✓');
      assert.equal(action._getBadge().color, '#10B981');
    });

    it('on post-write shrink (Lost Slot): produces Notice notification and ledger entry without stopping the Vigil', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: {
          subjects: [
            { courseCreationId: 101, courseCode: 'CS101', sectionCreationId: 502, sectionCode: 'G02' },
          ],
        },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);

      tabs.sendMessage = async (id, msg) => {
        if (msg.type === 'CLASSIFY_PAGE') {
          return { success: true, state: PAGE_STATES.STEP2_BOUND };
        }
        if (msg.type === 'EXECUTE_STRIKE') {
          return { success: true, clicked: true, saveGateApproved: true };
        }
        return { success: true };
      };

      let fetchCallCount = 0;
      const mockFetch = async (url) => {
        if (url.includes('/Enlistment_V2/Index')) {
          return {
            ok: true,
            status: 200,
            text: async () => `
              <input id="hdfAcademicSessionId" value="10" />
              <input id="hdfRuleAllocationId" value="20" />
              <input id="hdfEnlistmentRuleId" value="30" />
            `,
          };
        }
        if (url.includes('/GetAllCourseSectionData/')) {
          fetchCallCount++;
          // First read before strike: CS101 held at 501
          // Second read after strike: CS101 held is NULL! (Lost Slot)
          const heldSec = fetchCallCount === 1 ? 501 : null;
          const isReg = fetchCallCount === 1 ? 1 : 0;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              CourseDetails: [
                { COURSE_CREATION_ID: 101, COURSE_CODE: 'CS101', SECTION_CREATION_ID: heldSec, IS_REGISTERED: isReg },
              ],
            }),
          };
        }
        if (url.includes('/GetCourseWiseSectionData/')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { COURSE_CREATION_ID: 101, SECTION_CREATION_ID: 502, SECTION_NAME: 'G02 {Avail. Slots: 0}' },
            ],
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const result = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 5000,
      });

      assert.equal(result.isComplete, true);
      assert.equal(result.strikePerformed, true);
      assert.equal(result.state, 'watching'); // Vigil continues watching!
      assert.equal(result.unresolvedCount, 1);

      const store = storage._getStore();
      assert.equal(store.vigil.state, 'watching'); // State remains watching!

      // Notice logged for Lost Slot
      const ledger = store.ledger || [];
      const lostEntry = ledger.find((e) => e.type === 'lost_slot');
      assert.ok(lostEntry);
      assert.equal(lostEntry.tier, 'notice');
      assert.match(lostEntry.cause, /CS101/);

      // Notification fired for Lost Slot
      const notifs = notifications._getList();
      assert.ok(notifs.length >= 1);
      assert.match(notifs[0].title, /Lost Slot/);

      // Vigil pass alarm scheduled to continue chasing Wanted Section
      assert.ok((await alarms.get('vigil_pass')));
    });

    it('held-but-never-requested Section survives across strike and post-write diff', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching', lastChangeAt: 1000 },
        plan: {
          subjects: [
            { courseCreationId: 101, courseCode: 'CS101', sectionCreationId: 502, sectionCode: 'G02' },
          ],
        },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();
      const tabs = createMockTabs([{ id: 101, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }]);

      let passedDispositions = null;
      tabs.sendMessage = async (id, msg) => {
        if (msg.type === 'CLASSIFY_PAGE') {
          return { success: true, state: PAGE_STATES.STEP2_BOUND };
        }
        if (msg.type === 'EXECUTE_STRIKE') {
          passedDispositions = msg.dispositions;
          return { success: true, clicked: true, saveGateApproved: true };
        }
        return { success: true };
      };

      let fetchCallCount = 0;
      const mockFetch = async (url) => {
        if (url.includes('/Enlistment_V2/Index')) {
          return {
            ok: true,
            status: 200,
            text: async () => `
              <input id="hdfAcademicSessionId" value="10" />
              <input id="hdfRuleAllocationId" value="20" />
              <input id="hdfEnlistmentRuleId" value="30" />
            `,
          };
        }
        if (url.includes('/GetAllCourseSectionData/')) {
          fetchCallCount++;
          const cs101Sec = fetchCallCount === 1 ? 501 : 502;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              CourseDetails: [
                { COURSE_CREATION_ID: 101, COURSE_CODE: 'CS101', SECTION_CREATION_ID: cs101Sec, IS_REGISTERED: 1 },
                // Unrequested course 999 is held at 888 before and after strike
                { COURSE_CREATION_ID: 999, COURSE_CODE: 'UNREQ', SECTION_CREATION_ID: 888, IS_REGISTERED: 1 },
              ],
            }),
          };
        }
        if (url.includes('/GetCourseWiseSectionData/')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { COURSE_CREATION_ID: 101, SECTION_CREATION_ID: 502, SECTION_NAME: 'G02 {Avail. Slots: 5}' },
            ],
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const result = await executePass({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        notificationsApi: notifications,
        fetchImpl: mockFetch,
        now: 5000,
      });

      assert.equal(result.isComplete, true);
      assert.equal(result.allSatisfied, true);

      // Verify unrequested course was passed as 'preserve' disposition to strike
      assert.ok(passedDispositions);
      const unreqDisp = passedDispositions.find((d) => d.courseCreationId === 999 || d.courseCode === 'UNREQ');
      assert.ok(unreqDisp);
      assert.equal(unreqDisp.disposition, DISPOSITIONS.PRESERVE);

      // Post-write snapshot includes unrequested course preserved
      const store = storage._getStore();
      assert.equal(store.lastHeldSnapshot[999], 888);
    });
  });

  describe('diffHeldCourses', () => {
    it('returns isShrunk false when held courses are unchanged or gained', () => {
      const preHeld = { 101: 501, 102: 601 };
      const postHeld = { 101: 502, 102: 601, 103: 701 }; // 101 upgraded, 102 retained, 103 gained

      const result = diffHeldCourses({
        preHeldSnapshot: preHeld,
        postHeldSnapshot: postHeld,
        courses: [{ courseCreationId: 101, courseCode: 'CS101' }],
      });

      assert.equal(result.isShrunk, false);
      assert.equal(result.lostSlots.length, 0);
      assert.equal(result.retainedCount, 2);
      assert.equal(result.gainedCount, 1);
    });

    it('returns isShrunk true with lost slot details when a held course is no longer held', () => {
      const preHeld = { 101: 501, 102: 601 };
      const postHeld = { 101: null, 102: 601 }; // 101 was lost!

      const result = diffHeldCourses({
        preHeldSnapshot: preHeld,
        postHeldSnapshot: postHeld,
        courses: [{ courseCreationId: 101, courseCode: 'CS101' }],
      });

      assert.equal(result.isShrunk, true);
      assert.equal(result.lostSlots.length, 1);
      assert.equal(result.lostSlots[0].courseCreationId, '101');
      assert.equal(result.lostSlots[0].courseCode, 'CS101');
      assert.equal(result.lostSlots[0].preHeldSectionCreationId, 501);
    });
  });
});


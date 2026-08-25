import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createVigilRecord,
  evaluateChecklist,
  formatArmLabel,
  formatDateTimeDisplay,
  getDefaultStartTime,
  armVigil,
  rebuildAlarmsFromStorage,
  transitionArmedToWatching,
  checkSession,
  performKeepalive,
  updateBadge,
} from '../popup/arming.js';

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

describe('arming module', () => {
  describe('createVigilRecord', () => {
    it('creates a vigil record with required schema fields', () => {
      const now = 1756180000000;
      const vigil = createVigilRecord({
        state: 'armed',
        lastChangeAt: now,
        nextFireTime: now + 3600000,
        startedAt: now,
      });

      assert.deepStrictEqual(vigil, {
        state: 'armed',
        lastChangeAt: now,
        nextFireTime: now + 3600000,
        startedAt: now,
      });
    });

    it('defaults nextFireTime to null when not provided', () => {
      const now = 1756180000000;
      const vigil = createVigilRecord({
        state: 'watching',
        lastChangeAt: now,
      });

      assert.equal(vigil.state, 'watching');
      assert.equal(vigil.nextFireTime, null);
    });
  });

  describe('evaluateChecklist', () => {
    it('returns checklist with logged-in mark ✓ and live status when logged in', () => {
      const list = evaluateChecklist({ loggedIn: true });
      assert.equal(list.length, 3);
      assert.equal(list[0].mark, '✓');
      assert.equal(list[0].status, 'yes');
      assert.equal(list[0].title, 'Logged in to ArchersHub');
      assert.equal(list[1].mark, '○');
      assert.equal(list[2].mark, '○');
    });

    it('returns checklist with logged-out failure mark ✗ and blocked status when logged out', () => {
      const list = evaluateChecklist({ loggedIn: false });
      assert.equal(list.length, 3);
      assert.equal(list[0].mark, '✗');
      assert.equal(list[0].status, 'no');
      assert.equal(list[0].title, 'Not logged in to ArchersHub');
    });
  });

  describe('formatArmLabel', () => {
    it('returns blocked message when isBlocked is true', () => {
      assert.equal(
        formatArmLabel({ startMode: 'now', isBlocked: true }),
        'Arm — blocked, log in first'
      );
      assert.equal(
        formatArmLabel({ startMode: 'at-time', isBlocked: true }),
        'Arm — blocked, log in first'
      );
    });

    it('returns running message when isRunning is true', () => {
      assert.equal(
        formatArmLabel({ startMode: 'now', isRunning: true }),
        'A Vigil is already running'
      );
    });

    it('returns prompt to add subjects if subjectCount is 0', () => {
      assert.equal(
        formatArmLabel({ startMode: 'now', subjectCount: 0 }),
        'Add a subject to arm'
      );
    });

    it('returns "Start watching now" when startMode is now', () => {
      assert.equal(
        formatArmLabel({ startMode: 'now', subjectCount: 2 }),
        'Start watching now'
      );
    });

    it('returns "Arm for <time>" when startMode is at-time', () => {
      const label = formatArmLabel({
        startMode: 'at-time',
        startTime: '2026-08-26T07:00:00.000Z',
        subjectCount: 2,
      });
      assert.match(label, /^Arm for /);
    });
  });

  describe('getDefaultStartTime', () => {
    it('returns next 07:00 AM in local time ISO format (YYYY-MM-DDTHH:mm)', () => {
      const now = new Date('2026-08-25T14:30:00');
      const defTime = getDefaultStartTime(now);
      assert.match(defTime, /^\d{4}-\d{2}-\d{2}T07:00$/);
      const parsed = new Date(defTime);
      assert.ok(parsed.getTime() > now.getTime());
    });
  });

  describe('updateBadge', () => {
    it('sets grey • for armed state', () => {
      const action = createMockAction();
      updateBadge({ state: 'armed', actionApi: action });
      const badge = action._getBadge();
      assert.equal(badge.text, '•');
      assert.equal(badge.color, '#888888');
    });

    it('sets blue unresolved count for watching state', () => {
      const action = createMockAction();
      updateBadge({ state: 'watching', unresolvedCount: 3, actionApi: action });
      const badge = action._getBadge();
      assert.equal(badge.text, '3');
      assert.equal(badge.color, '#4285F4');
    });

    it('clears badge for stopped or none state', () => {
      const action = createMockAction();
      updateBadge({ state: 'stopped', actionApi: action });
      assert.equal(action._getBadge().text, '');

      updateBadge({ state: 'none', actionApi: action });
      assert.equal(action._getBadge().text, '');
    });
  });

  describe('checkSession', () => {
    it('returns loggedIn: true when shell params are extracted from GET /Enlistment_V2/Index', async () => {
      const mockFetch = async () => ({
        ok: true,
        text: async () => `
          <input type="hidden" id="hdfAcademicSessionId" value="2025-T1" />
          <input type="hidden" id="hdfRuleAllocationId" value="123" />
          <input type="hidden" id="hdfEnlistmentRuleId" value="456" />
        `,
      });

      const res = await checkSession({ fetchImpl: mockFetch });
      assert.equal(res.loggedIn, true);
      assert.equal(res.academicSessionId, '2025-T1');
    });

    it('returns loggedIn: false when shell params are missing or non-200 response', async () => {
      const mockFetch = async () => ({
        ok: true,
        text: async () => `<html><title>Login</title></html>`,
      });

      const res = await checkSession({ fetchImpl: mockFetch });
      assert.equal(res.loggedIn, false);
    });
  });

  describe('transitionArmedToWatching', () => {
    it('updates vigil record in storage, clears alarms, and updates badge to watching count', async () => {
      const storage = createMockStorage();
      const alarms = createMockAlarms();
      alarms.create('vigil_start', { when: 12345 });
      alarms.create('vigil_keepalive', { periodInMinutes: 5 });
      const action = createMockAction();
      const now = 1756180000000;

      const plan = {
        subjects: [{ courseCreationId: 'c1' }, { courseCreationId: 'c2' }],
      };

      const updated = await transitionArmedToWatching({
        vigil: { state: 'armed', nextFireTime: 12345 },
        plan,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        now,
      });

      assert.equal(updated.state, 'watching');
      assert.equal(updated.nextFireTime, null);
      assert.equal(updated.lastChangeAt, now);

      assert.equal(storage._getStore().vigil.state, 'watching');
      assert.equal(alarms._getAlarms().has('vigil_start'), false);
      assert.equal(alarms._getAlarms().has('vigil_keepalive'), false);
      assert.equal(action._getBadge().text, '2');
      assert.equal(action._getBadge().color, '#4285F4');
    });
  });

  describe('armVigil', () => {
    const validPlan = {
      academicSessionId: '2025-T1',
      subjects: [
        { courseCreationId: 'c1', courseCode: 'MATH101', sectionCreationId: 's1', sectionCode: 'M1' },
      ],
    };

    it('refuses to arm against a logged-out session and does NOT write an armed record', async () => {
      const storage = createMockStorage();
      const alarms = createMockAlarms();
      const action = createMockAction();

      const result = await armVigil({
        plan: validPlan,
        startMode: 'now',
        catalogue: { loggedIn: false },
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
      });

      assert.equal(result.success, false);
      assert.equal(result.reason, 'logged_out');
      assert.equal(storage._getStore().vigil, undefined);
      assert.equal(alarms._getAlarms().size, 0);
    });

    it('refuses to arm when plan has 0 subjects', async () => {
      const storage = createMockStorage();
      const alarms = createMockAlarms();
      const action = createMockAction();

      const result = await armVigil({
        plan: { academicSessionId: '2025-T1', subjects: [] },
        startMode: 'now',
        catalogue: { loggedIn: true },
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
      });

      assert.equal(result.success, false);
      assert.equal(result.reason, 'no_subjects');
      assert.equal(storage._getStore().vigil, undefined);
    });

    it('choosing "Now" arms the Vigil directly in "watching" state with no Armed state in between', async () => {
      const storage = createMockStorage();
      const alarms = createMockAlarms();
      const action = createMockAction();
      const now = 1756180000000;

      const result = await armVigil({
        plan: validPlan,
        startMode: 'now',
        catalogue: { loggedIn: true },
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        now,
      });

      assert.equal(result.success, true);
      assert.equal(result.state, 'watching');

      const savedVigil = storage._getStore().vigil;
      assert.equal(savedVigil.state, 'watching');
      assert.equal(savedVigil.nextFireTime, null);
      assert.equal(savedVigil.lastChangeAt, now);

      const savedPlan = storage._getStore().plan;
      assert.equal(savedPlan.startMode, 'now');

      // No scheduled start alarm
      assert.equal(alarms._getAlarms().has('vigil_start'), false);

      // Badge updated to watching (1 subject)
      assert.equal(action._getBadge().text, '1');
      assert.equal(action._getBadge().color, '#4285F4');
    });

    it('choosing "At a set time" in the future writes Vigil record as Armed and schedules one-shot alarm + keepalive alarm', async () => {
      const storage = createMockStorage();
      const alarms = createMockAlarms();
      const action = createMockAction();
      const now = 1756180000000;
      const startTime = '2026-08-26T07:00:00.000Z';
      const startTimeMs = new Date(startTime).getTime();

      const result = await armVigil({
        plan: validPlan,
        startMode: 'at-time',
        startTime,
        catalogue: { loggedIn: true },
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        now,
      });

      assert.equal(result.success, true);
      assert.equal(result.state, 'armed');

      const savedVigil = storage._getStore().vigil;
      assert.equal(savedVigil.state, 'armed');
      assert.equal(savedVigil.nextFireTime, startTimeMs);

      const savedPlan = storage._getStore().plan;
      assert.equal(savedPlan.startMode, 'at-time');
      assert.equal(savedPlan.startTime, startTime);

      // Alarms scheduled
      const startAlarm = alarms._getAlarms().get('vigil_start');
      assert.ok(startAlarm);
      assert.equal(startAlarm.when, startTimeMs);

      const keepaliveAlarm = alarms._getAlarms().get('vigil_keepalive');
      assert.ok(keepaliveAlarm);
      assert.equal(keepaliveAlarm.periodInMinutes, 5);

      // Badge set to grey •
      assert.equal(action._getBadge().text, '•');
      assert.equal(action._getBadge().color, '#888888');
    });

    it('choosing "At a set time" with a past timestamp starts watching immediately', async () => {
      const storage = createMockStorage();
      const alarms = createMockAlarms();
      const action = createMockAction();
      const now = 1756180000000;
      const pastStartTime = new Date(now - 10000).toISOString();

      const result = await armVigil({
        plan: validPlan,
        startMode: 'at-time',
        startTime: pastStartTime,
        catalogue: { loggedIn: true },
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        now,
      });

      assert.equal(result.success, true);
      assert.equal(result.state, 'watching');
      assert.equal(storage._getStore().vigil.state, 'watching');
      assert.equal(alarms._getAlarms().has('vigil_start'), false);
    });
  });

  describe('rebuildAlarmsFromStorage', () => {
    it('rebuilds alarms from storage on startup with Vigil record intact when start time is in future', async () => {
      const now = 1756180000000;
      const nextFireTime = now + 1000000;
      const storage = createMockStorage({
        vigil: {
          state: 'armed',
          lastChangeAt: now,
          nextFireTime,
          startedAt: now,
        },
        plan: {
          academicSessionId: '2025-T1',
          subjects: [{ courseCreationId: 'c1', courseCode: 'MATH101', sectionCreationId: 's1', sectionCode: 'M1' }],
          startMode: 'at-time',
          startTime: new Date(nextFireTime).toISOString(),
        },
      });
      const alarms = createMockAlarms();
      const action = createMockAction();

      const result = await rebuildAlarmsFromStorage({
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        now,
      });

      assert.equal(result.state, 'armed');
      assert.equal(alarms._getAlarms().get('vigil_start')?.when, nextFireTime);
      assert.equal(alarms._getAlarms().get('vigil_keepalive')?.periodInMinutes, 5);
      assert.equal(action._getBadge().text, '•');
    });

    it('a start time that passed while browser was closed starts Vigil immediately on next startup', async () => {
      const now = 1756180000000;
      const pastStartTime = now - 5000; // 5 seconds in the past
      const storage = createMockStorage({
        vigil: {
          state: 'armed',
          lastChangeAt: now - 3600000,
          nextFireTime: pastStartTime,
          startedAt: now - 3600000,
        },
        plan: {
          academicSessionId: '2025-T1',
          subjects: [{ courseCreationId: 'c1', courseCode: 'MATH101', sectionCreationId: 's1', sectionCode: 'M1' }],
          startMode: 'at-time',
          startTime: new Date(pastStartTime).toISOString(),
        },
      });
      const alarms = createMockAlarms();
      const action = createMockAction();

      const result = await rebuildAlarmsFromStorage({
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
        now,
      });

      assert.equal(result.state, 'watching');
      assert.equal(result.missedStart, true);

      // Vigil record updated in storage
      const savedVigil = storage._getStore().vigil;
      assert.equal(savedVigil.state, 'watching');
      assert.equal(savedVigil.nextFireTime, null);

      // Alarms cleared
      assert.equal(alarms._getAlarms().has('vigil_start'), false);

      // Badge updated to watching (blue count 1)
      assert.equal(action._getBadge().text, '1');
      assert.equal(action._getBadge().color, '#4285F4');
    });
  });

  describe('formatDateTimeDisplay', () => {
    it('returns empty string for null or undefined input', () => {
      assert.equal(formatDateTimeDisplay(null), '');
      assert.equal(formatDateTimeDisplay(undefined), '');
      assert.equal(formatDateTimeDisplay(''), '');
    });

    it('returns string unchanged if invalid date', () => {
      assert.equal(formatDateTimeDisplay('not-a-date'), 'not-a-date');
    });

    it('formats valid date correctly into "Day Date Month, HH:mm"', () => {
      const d = new Date(2026, 7, 26, 7, 0); // Aug 26 2026 07:00
      const formatted = formatDateTimeDisplay(d);
      assert.match(formatted, /^Wed 26 Aug, 07:00$/);
    });
  });

  describe('performKeepalive', () => {
    it('runs cheap GET request without erroring', async () => {
      let requestedUrl = null;
      let requestedOpts = null;
      const mockFetch = async (url, opts) => {
        requestedUrl = url;
        requestedOpts = opts;
        return {
          ok: true,
          status: 200,
          text: async () => '<html>shell</html>',
        };
      };

      const res = await performKeepalive({ fetchImpl: mockFetch });
      assert.equal(res.ok, true);
      assert.equal(requestedUrl, 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index');
      assert.equal(requestedOpts.credentials, 'include');
    });

    it('handles network errors gracefully without throwing', async () => {
      const mockFetch = async () => {
        throw new Error('Network timeout');
      };

      const res = await performKeepalive({ fetchImpl: mockFetch });
      assert.equal(res.ok, false);
      assert.equal(res.error, 'Network timeout');
    });
  });
});

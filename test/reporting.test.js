import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatEventTime,
  filterLedgerEntries,
  appendLedgerEntry,
  handleAlertRepeatAlarm,
  resolveActiveAlert,
  exportPassTail,
  handleNotificationClick,
} from '../popup/reporting.js';

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

function createMockNotifications() {
  const notifications = [];
  let idCounter = 0;
  return {
    create: (idOrOptions, maybeOptions, maybeCallback) => {
      let id = typeof idOrOptions === 'string' ? idOrOptions : `notif_${++idCounter}`;
      let options = typeof idOrOptions === 'string' ? maybeOptions : idOrOptions;
      let callback = typeof maybeOptions === 'function' ? maybeOptions : maybeCallback;
      const notif = { id, options };
      notifications.push(notif);
      if (callback) callback(id);
      return id;
    },
    clear: (id, callback) => {
      const idx = notifications.findIndex((n) => n.id === id);
      if (idx !== -1) notifications.splice(idx, 1);
      if (callback) callback(true);
    },
    _getNotifications: () => [...notifications],
  };
}

describe('reporting module', () => {
  describe('formatEventTime', () => {
    it('formats a timestamp into HH:mm format with zero padding', () => {
      const d = new Date(2026, 7, 25, 7, 5, 0);
      assert.equal(formatEventTime(d.getTime()), '07:05');
      
      const d2 = new Date(2026, 7, 25, 14, 30, 0);
      assert.equal(formatEventTime(d2.getTime()), '14:30');
    });

    it('returns empty string for invalid or missing timestamp', () => {
      assert.equal(formatEventTime(null), '');
      assert.equal(formatEventTime(undefined), '');
      assert.equal(formatEventTime('invalid'), '');
    });
  });

  describe('filterLedgerEntries', () => {
    const sampleEntries = [
      { id: '1', timestamp: 1000, tier: 'ambient', type: 'armed', title: 'Vigil armed' },
      { id: '2', timestamp: 3000, tier: 'alert', type: 'suspended', title: 'Suspended' },
      { id: '3', timestamp: 2000, tier: 'notice', type: 'complete', title: 'Complete' },
      { id: '4', timestamp: 4000, tier: 'ambient', type: 'watching', title: 'Watching' },
      { id: '5', timestamp: 5000, tier: 'alert', type: 'stall', title: 'Stall' },
    ];

    it('returns all entries sorted newest-first when filter is "all" or omitted', () => {
      const filtered = filterLedgerEntries(sampleEntries, 'all');
      assert.equal(filtered.length, 5);
      assert.deepStrictEqual(filtered.map((e) => e.id), ['5', '4', '2', '3', '1']);

      const defaultFiltered = filterLedgerEntries(sampleEntries);
      assert.deepStrictEqual(defaultFiltered.map((e) => e.id), ['5', '4', '2', '3', '1']);
    });

    it('filters for only alert tier entries, sorted newest-first', () => {
      const filtered = filterLedgerEntries(sampleEntries, 'alerts');
      assert.equal(filtered.length, 2);
      assert.deepStrictEqual(filtered.map((e) => e.id), ['5', '2']);
    });

    it('filters for only notice tier entries, sorted newest-first', () => {
      const filtered = filterLedgerEntries(sampleEntries, 'notices');
      assert.equal(filtered.length, 1);
      assert.deepStrictEqual(filtered.map((e) => e.id), ['3']);
    });

    it('returns empty array when ledger is null or empty', () => {
      assert.deepStrictEqual(filterLedgerEntries(null), []);
      assert.deepStrictEqual(filterLedgerEntries([]), []);
    });
  });

  describe('appendLedgerEntry', () => {
    it('appends ambient entry to storage without creating notification or alarm', async () => {
      const storage = createMockStorage({ ledger: [] });
      const notifications = createMockNotifications();
      const alarms = createMockAlarms();
      const now = 1756180000000;

      const updatedLedger = await appendLedgerEntry({
        entry: {
          tier: 'ambient',
          type: 'armed',
          title: 'Vigil armed',
          cause: 'Scheduled for Wed 26 Aug, 07:00',
        },
        storageApi: storage,
        notificationsApi: notifications,
        alarmsApi: alarms,
        now,
      });

      assert.equal(updatedLedger.length, 1);
      assert.equal(updatedLedger[0].tier, 'ambient');
      assert.equal(updatedLedger[0].title, 'Vigil armed');
      assert.equal(updatedLedger[0].timestamp, now);
      assert.ok(updatedLedger[0].id);

      assert.deepStrictEqual(storage._getStore().ledger, updatedLedger);
      assert.equal(notifications._getNotifications().length, 0);
      assert.equal(alarms._getAlarms().size, 0);
    });

    it('appends notice entry and produces exactly one notification without repeat alarm', async () => {
      const storage = createMockStorage({ ledger: [] });
      const notifications = createMockNotifications();
      const alarms = createMockAlarms();
      const now = 1756180000000;

      const updatedLedger = await appendLedgerEntry({
        entry: {
          tier: 'notice',
          type: 'complete',
          title: 'Complete',
          cause: 'All 3 subjects secured at Pending',
        },
        storageApi: storage,
        notificationsApi: notifications,
        alarmsApi: alarms,
        now,
      });

      assert.equal(updatedLedger.length, 1);
      assert.equal(updatedLedger[0].tier, 'notice');

      const notifs = notifications._getNotifications();
      assert.equal(notifs.length, 1);
      assert.equal(notifs[0].options.title, 'Complete');
      assert.equal(notifs[0].options.message, 'All 3 subjects secured at Pending');

      assert.equal(alarms._getAlarms().has('alert_repeat'), false);
    });

    it('appends alert entry on transition, fires notification, and sets 30-min repeat alarm', async () => {
      const storage = createMockStorage({ ledger: [] });
      const notifications = createMockNotifications();
      const alarms = createMockAlarms();
      const now = 1756180000000;

      const updatedLedger = await appendLedgerEntry({
        entry: {
          tier: 'alert',
          type: 'suspended',
          title: 'Suspended',
          cause: 'Session died mid-Vigil',
        },
        storageApi: storage,
        notificationsApi: notifications,
        alarmsApi: alarms,
        now,
      });

      assert.equal(updatedLedger.length, 1);
      assert.equal(updatedLedger[0].tier, 'alert');

      const notifs = notifications._getNotifications();
      assert.equal(notifs.length, 1);
      assert.equal(notifs[0].options.title, 'Suspended');

      const activeAlert = storage._getStore().activeAlert;
      assert.deepStrictEqual(activeAlert, {
        type: 'suspended',
        timestamp: now,
        repeatCount: 0,
        title: 'Suspended',
        cause: 'Session died mid-Vigil',
      });

      const repeatAlarm = alarms._getAlarms().get('alert_repeat');
      assert.ok(repeatAlarm);
      assert.equal(repeatAlarm.delayInMinutes, 30);
    });

    it('does NOT fire duplicate notification when subsequent poll logs the same held alert state', async () => {
      const now = 1756180000000;
      const initialAlert = {
        type: 'suspended',
        timestamp: now - 60000,
        repeatCount: 0,
        title: 'Suspended',
        cause: 'Session died mid-Vigil',
      };
      const storage = createMockStorage({
        ledger: [
          { id: '1', timestamp: now - 60000, tier: 'alert', type: 'suspended', title: 'Suspended' },
        ],
        activeAlert: initialAlert,
      });
      const notifications = createMockNotifications();
      const alarms = createMockAlarms();
      alarms.create('alert_repeat', { delayInMinutes: 29 });

      const updatedLedger = await appendLedgerEntry({
        entry: {
          tier: 'alert',
          type: 'suspended',
          title: 'Suspended',
          cause: 'Session died mid-Vigil',
        },
        storageApi: storage,
        notificationsApi: notifications,
        alarmsApi: alarms,
        now,
      });

      assert.equal(updatedLedger.length, 2);
      // No duplicate notification fired for held state
      assert.equal(notifications._getNotifications().length, 0);
      // Active alert repeatCount remains unchanged
      assert.equal(storage._getStore().activeAlert.repeatCount, 0);
    });
  });

  describe('handleAlertRepeatAlarm', () => {
    it('repeats notification and increments repeatCount for unresolved alert when repeatCount < 3', async () => {
      const now = 1756180000000;
      const storage = createMockStorage({
        activeAlert: {
          type: 'suspended',
          timestamp: now - 1800000,
          repeatCount: 0,
          title: 'Suspended',
          cause: 'Session died mid-Vigil',
        },
      });
      const notifications = createMockNotifications();
      const alarms = createMockAlarms();

      const result = await handleAlertRepeatAlarm({
        storageApi: storage,
        notificationsApi: notifications,
        alarmsApi: alarms,
        now,
      });

      assert.equal(result.repeated, true);
      assert.equal(result.repeatCount, 1);
      assert.equal(notifications._getNotifications().length, 1);
      assert.equal(notifications._getNotifications()[0].options.title, 'Suspended');

      assert.equal(storage._getStore().activeAlert.repeatCount, 1);
      assert.equal(alarms._getAlarms().get('alert_repeat')?.delayInMinutes, 30);
    });

    it('stops repeating after 3 repeats (repeatCount >= 3) and clears alarm without deleting activeAlert', async () => {
      const now = 1756180000000;
      const storage = createMockStorage({
        activeAlert: {
          type: 'suspended',
          timestamp: now - 5400000,
          repeatCount: 3, // Already repeated 3 times!
          title: 'Suspended',
          cause: 'Session died mid-Vigil',
        },
      });
      const notifications = createMockNotifications();
      const alarms = createMockAlarms();
      alarms.create('alert_repeat', { delayInMinutes: 30 });

      const result = await handleAlertRepeatAlarm({
        storageApi: storage,
        notificationsApi: notifications,
        alarmsApi: alarms,
        now,
      });

      assert.equal(result.repeated, false);
      assert.equal(result.stopped, true);
      // No notification sent on 4th check
      assert.equal(notifications._getNotifications().length, 0);
      // Alarm is cleared
      assert.equal(alarms._getAlarms().has('alert_repeat'), false);
      // Active alert stays in storage so badge/state is preserved
      assert.ok(storage._getStore().activeAlert);
      assert.equal(storage._getStore().activeAlert.repeatCount, 3);
    });

    it('clears alarm and does nothing if no active alert exists in storage', async () => {
      const storage = createMockStorage({});
      const notifications = createMockNotifications();
      const alarms = createMockAlarms();
      alarms.create('alert_repeat', { delayInMinutes: 30 });

      const result = await handleAlertRepeatAlarm({
        storageApi: storage,
        notificationsApi: notifications,
        alarmsApi: alarms,
      });

      assert.equal(result.repeated, false);
      assert.equal(notifications._getNotifications().length, 0);
      assert.equal(alarms._getAlarms().has('alert_repeat'), false);
    });
  });

  describe('resolveActiveAlert', () => {
    it('clears activeAlert from storage and removes alert_repeat alarm', async () => {
      const storage = createMockStorage({
        activeAlert: {
          type: 'suspended',
          timestamp: 1756180000000,
          repeatCount: 1,
        },
      });
      const alarms = createMockAlarms();
      alarms.create('alert_repeat', { delayInMinutes: 30 });

      await resolveActiveAlert({
        storageApi: storage,
        alarmsApi: alarms,
      });

      assert.equal(storage._getStore().activeAlert, undefined);
      assert.equal(alarms._getAlarms().has('alert_repeat'), false);
    });
  });

  describe('exportPassTail', () => {
    it('creates blob anchor, triggers download, and revokes object URL without chrome.downloads', () => {
      let createdUrl = null;
      let revokedUrl = null;
      let clicked = false;
      let attachedToBody = false;
      let removedFromBody = false;

      const mockUrl = {
        createObjectURL: (blob) => {
          createdUrl = `blob:test-${Date.now()}`;
          return createdUrl;
        },
        revokeObjectURL: (url) => {
          revokedUrl = url;
        },
      };

      const mockAnchor = {
        href: '',
        download: '',
        click: () => {
          clicked = true;
        },
      };

      const mockDoc = {
        createElement: (tag) => {
          if (tag === 'a') return mockAnchor;
          return {};
        },
        body: {
          appendChild: (el) => {
            if (el === mockAnchor) attachedToBody = true;
          },
          removeChild: (el) => {
            if (el === mockAnchor) removedFromBody = true;
          },
        },
      };

      const passTail = [{ passNumber: 1, state: 'Step2Bound', outcome: 'no_change' }];
      const result = exportPassTail({
        passTail,
        filename: 'custom-export.json',
        documentImpl: mockDoc,
        urlImpl: mockUrl,
      });

      assert.equal(result.success, true);
      assert.equal(mockAnchor.download, 'custom-export.json');
      assert.equal(mockAnchor.href, createdUrl);
      assert.equal(clicked, true);
      assert.equal(attachedToBody, true);
      assert.equal(removedFromBody, true);
      assert.equal(revokedUrl, createdUrl);
    });
  });

  describe('handleNotificationClick', () => {
    it('focuses existing Owned Tab and window when tab is found', async () => {
      let tabUpdated = null;
      let windowUpdated = null;
      let clearedNotifId = null;

      const mockTabs = {
        query: async (queryInfo) => {
          return [{ id: 42, windowId: 7, url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' }];
        },
        update: async (tabId, updateProps) => {
          tabUpdated = { tabId, updateProps };
          return tabUpdated;
        },
      };

      const mockWindows = {
        update: async (windowId, updateProps) => {
          windowUpdated = { windowId, updateProps };
          return windowUpdated;
        },
      };

      const mockNotifications = {
        clear: (id, cb) => {
          clearedNotifId = id;
          if (cb) cb(true);
        },
      };

      await handleNotificationClick({
        notificationId: 'notif_123',
        tabsApi: mockTabs,
        windowsApi: mockWindows,
        notificationsApi: mockNotifications,
      });

      assert.deepStrictEqual(tabUpdated, { tabId: 42, updateProps: { active: true } });
      assert.deepStrictEqual(windowUpdated, { windowId: 7, updateProps: { focused: true } });
      assert.equal(clearedNotifId, 'notif_123');
    });

    it('opens popup or creates tab when no Owned Tab is currently open', async () => {
      let popupOpened = false;
      let clearedNotifId = null;

      const mockTabs = {
        query: async () => [],
      };

      const mockAction = {
        openPopup: async () => {
          popupOpened = true;
        },
      };

      const mockNotifications = {
        clear: (id, cb) => {
          clearedNotifId = id;
          if (cb) cb(true);
        },
      };

      await handleNotificationClick({
        notificationId: 'notif_456',
        tabsApi: mockTabs,
        actionApi: mockAction,
        notificationsApi: mockNotifications,
      });

      assert.equal(popupOpened, true);
      assert.equal(clearedNotifId, 'notif_456');
    });
  });
});




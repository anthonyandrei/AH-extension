import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureOwnedTab,
  getOwnedTab,
  steerOwnedTab,
  handleStep2BoundReached,
  handleOwnedTabReload,
  handleUnrecognisedAbort,
  handleLoggedOutSuspend,
} from '../popup/tab-manager.js';
import { PAGE_STATES } from '../content/classifier.js';

// Mock storage helper
function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    get: async (keys) => {
      if (typeof keys === 'string') return { [keys]: store[keys] };
      if (Array.isArray(keys)) {
        const res = {};
        for (const k of keys) {
          if (store[k] !== undefined) res[k] = store[k];
        }
        return res;
      }
      return { ...store };
    },
    set: async (items) => {
      Object.assign(store, items);
    },
    remove: async (keys) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) delete store[k];
    },
    _getStore: () => store,
  };
}

// Mock chrome.tabs API
function createMockTabs(initialTabs = []) {
  const tabs = new Map(initialTabs.map((t) => [t.id, { ...t }]));
  let nextId = 100;

  return {
    create: async (opts) => {
      const id = ++nextId;
      const tab = {
        id,
        url: opts.url || 'about:blank',
        active: opts.active || false,
        windowId: 1,
        ...opts,
      };
      tabs.set(id, tab);
      return tab;
    },
    get: async (id) => {
      const tab = tabs.get(id);
      if (!tab) throw new Error(`Tab ${id} not found`);
      return { ...tab };
    },
    query: async (queryInfo) => {
      const list = Array.from(tabs.values());
      if (queryInfo?.url) {
        return list.filter((t) => t.url && t.url.includes('archershub.dlsu.edu.ph'));
      }
      return list;
    },
    update: async (id, updateProps) => {
      const tab = tabs.get(id);
      if (!tab) throw new Error(`Tab ${id} not found`);
      Object.assign(tab, updateProps);
      return { ...tab };
    },
    reload: async (id) => {
      const tab = tabs.get(id);
      if (!tab) throw new Error(`Tab ${id} not found`);
      tab.reloaded = (tab.reloaded || 0) + 1;
      return { ...tab };
    },
    sendMessage: async (id, msg) => {
      const tab = tabs.get(id);
      if (!tab) throw new Error(`Tab ${id} not found`);
      if (tab.messageHandler) {
        return tab.messageHandler(msg);
      }
      return { ok: true, pong: true };
    },
    _getTabs: () => tabs,
  };
}

// Mock alarms API
function createMockAlarms() {
  const alarms = new Map();
  return {
    create: (name, alarmInfo) => {
      alarms.set(name, alarmInfo);
    },
    get: async (name) => alarms.get(name) || null,
    clear: async (name) => {
      const existed = alarms.has(name);
      alarms.delete(name);
      return existed;
    },
    clearAll: async () => {
      alarms.clear();
      return true;
    },
    _getAlarms: () => alarms,
  };
}

// Mock action badge API
function createMockAction() {
  let badgeText = '';
  let badgeColor = '';
  return {
    setBadgeText: ({ text }) => { badgeText = text; },
    setBadgeBackgroundColor: ({ color }) => { badgeColor = color; },
    _getBadge: () => ({ text: badgeText, color: badgeColor }),
  };
}

// Mock notifications API
function createMockNotifications() {
  const notifications = [];
  return {
    create: (opts) => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      notifications.push({ id, ...opts });
      return id;
    },
    clear: (id) => {
      const idx = notifications.findIndex((n) => n.id === id);
      if (idx >= 0) notifications.splice(idx, 1);
    },
    _getNotifications: () => notifications,
  };
}

describe('tab-manager module', () => {
  describe('ensureOwnedTab', () => {
    it('opens one Owned Tab at /Enlistment_V2/Index and stores ownedTabId when no tab is open', async () => {
      const storage = createMockStorage();
      const tabs = createMockTabs();

      const result = await ensureOwnedTab({ tabsApi: tabs, storageApi: storage });

      assert.equal(result.created, true);
      assert.ok(result.tabId);
      assert.equal(storage._getStore().ownedTabId, result.tabId);

      const createdTab = await tabs.get(result.tabId);
      assert.equal(createdTab.url, 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index');
    });

    it('reuses existing Owned Tab if already open and alive without opening duplicate', async () => {
      const tabs = createMockTabs();
      const existingTab = await tabs.create({ url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' });
      const storage = createMockStorage({ ownedTabId: existingTab.id });

      const result = await ensureOwnedTab({ tabsApi: tabs, storageApi: storage });

      assert.equal(result.created, false);
      assert.equal(result.tabId, existingTab.id);
      assert.equal(tabs._getTabs().size, 1); // No new tab created
    });

    it('re-creates Owned Tab if stored ownedTabId points to a closed tab', async () => {
      const tabs = createMockTabs();
      const storage = createMockStorage({ ownedTabId: 999 }); // Non-existent tab

      const result = await ensureOwnedTab({ tabsApi: tabs, storageApi: storage });

      assert.equal(result.created, true);
      assert.notEqual(result.tabId, 999);
      assert.equal(storage._getStore().ownedTabId, result.tabId);
    });
  });

  describe('handleStep2BoundReached & 3-minute keepalive reload', () => {
    it('schedules 3-minute reload alarm and saves lastBoundAt timestamp when reaching Step2Bound', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching' },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const now = 1756180000000;

      const result = await handleStep2BoundReached({
        tabId: 101,
        storageApi: storage,
        alarmsApi: alarms,
        now,
      });

      assert.equal(result.state, PAGE_STATES.STEP2_BOUND);
      assert.equal(result.reloadAlarmScheduled, true);
      assert.equal(storage._getStore().lastBoundAt, now);

      const reloadAlarm = alarms._getAlarms().get('owned_tab_reload');
      assert.ok(reloadAlarm);
      assert.equal(reloadAlarm.delayInMinutes, 3);
    });

    it('handleOwnedTabReload reloads the Owned Tab when strike is not pending', async () => {
      const tabs = createMockTabs();
      const tab = await tabs.create({ url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' });
      const storage = createMockStorage({
        vigil: { state: 'watching' },
        ownedTabId: tab.id,
        strikePending: false,
      });
      const alarms = createMockAlarms();

      const result = await handleOwnedTabReload({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
      });

      assert.equal(result.reloaded, true);
      assert.equal(result.tabId, tab.id);
      const updatedTab = await tabs.get(tab.id);
      assert.equal(updatedTab.reloaded, 1);
    });

    it('handleOwnedTabReload refuses to reload or navigate when strikePending is true', async () => {
      const tabs = createMockTabs();
      const tab = await tabs.create({ url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' });
      const storage = createMockStorage({
        vigil: { state: 'watching' },
        ownedTabId: tab.id,
        strikePending: true, // Strike is in flight!
      });
      const alarms = createMockAlarms();

      const result = await handleOwnedTabReload({
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
      });

      assert.equal(result.reloaded, false);
      assert.equal(result.reason, 'strike_pending');
      const updatedTab = await tabs.get(tab.id);
      assert.equal(updatedTab.reloaded || 0, 0); // Not reloaded!
    });
  });

  describe('handleUnrecognisedAbort — terminal abort on unknown DOM', () => {
    it('sets vigil to aborted, saves snapshot, sets badge to X dark red, raises Alert, and leaves tab open', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching' },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      alarms.create('owned_tab_reload', { delayInMinutes: 3 });
      const action = createMockAction();
      const notifications = createMockNotifications();

      const snapshot = {
        html: '<html><body><div id="unknownError">Critical Lock</div></body></html>',
        title: 'Error - ArchersHub',
        url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index',
        timestamp: 1756180000000,
      };

      const result = await handleUnrecognisedAbort({
        snapshot,
        storageApi: storage,
        actionApi: action,
        alarmsApi: alarms,
        notificationsApi: notifications,
        now: 1756180000000,
      });

      assert.equal(result.state, 'aborted');
      assert.equal(storage._getStore().vigil.state, 'aborted');
      assert.deepEqual(storage._getStore().lastAbortedSnapshot, snapshot);

      // Reload alarm cleared
      assert.equal(alarms._getAlarms().has('owned_tab_reload'), false);

      // Badge set to X dark red (#991B1B)
      assert.equal(action._getBadge().text, 'X');
      assert.equal(action._getBadge().color, '#991B1B');

      // Alert tier ledger entry created
      const ledger = storage._getStore().ledger || [];
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0].tier, 'alert');
      assert.equal(ledger[0].type, 'aborted');

      // Notification sent
      assert.equal(notifications._getNotifications().length, 1);
      assert.match(notifications._getNotifications()[0].title, /aborted/i);
    });
  });

  describe('handleLoggedOutSuspend — suspend on session loss', () => {
    it('sets vigil to suspended, sets badge to ! amber, raises Alert, and sets 30s session probe', async () => {
      const storage = createMockStorage({
        vigil: { state: 'watching' },
        ownedTabId: 101,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();
      const notifications = createMockNotifications();

      const result = await handleLoggedOutSuspend({
        storageApi: storage,
        actionApi: action,
        alarmsApi: alarms,
        notificationsApi: notifications,
        now: 1756180000000,
      });

      assert.equal(result.state, 'suspended');
      assert.equal(storage._getStore().vigil.state, 'suspended');

      // Badge set to ! amber (#F59E0B)
      assert.equal(action._getBadge().text, '!');
      assert.equal(action._getBadge().color, '#F59E0B');

      // 30s probe alarm created
      const probeAlarm = alarms._getAlarms().get('probe_session');
      assert.ok(probeAlarm);

      // Alert tier ledger entry created
      const ledger = storage._getStore().ledger || [];
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0].tier, 'alert');
      assert.equal(ledger[0].type, 'suspended');
    });
  });

  describe('steerOwnedTab — state transitions to Step2Bound', () => {
    it('NotInjected: reloads the tab to ensure content script is injected', async () => {
      const tabs = createMockTabs();
      const tab = await tabs.create({ url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' });
      // Mock content script not responding (throws connection error)
      tab.messageHandler = () => {
        throw new Error('Could not establish connection. Receiving end does not exist.');
      };

      const storage = createMockStorage({ vigil: { state: 'watching' }, ownedTabId: tab.id });
      const alarms = createMockAlarms();
      const action = createMockAction();

      const result = await steerOwnedTab({
        tabId: tab.id,
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
      });

      assert.equal(result.action, 'reloaded_tab');
      assert.equal(result.state, PAGE_STATES.NOT_INJECTED);
      const updatedTab = await tabs.get(tab.id);
      assert.equal(updatedTab.reloaded, 1);
    });

    it('WrongPage: navigates the tab to /Enlistment_V2/Index', async () => {
      const tabs = createMockTabs();
      const tab = await tabs.create({ url: 'https://archershub.dlsu.edu.ph/Student/Dashboard' });
      tab.messageHandler = () => ({ success: true, state: PAGE_STATES.WRONG_PAGE });

      const storage = createMockStorage({ vigil: { state: 'watching' }, ownedTabId: tab.id });
      const alarms = createMockAlarms();
      const action = createMockAction();

      const result = await steerOwnedTab({
        tabId: tab.id,
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
      });

      assert.equal(result.action, 'navigate_enlistment');
      assert.equal(result.state, PAGE_STATES.WRONG_PAGE);
      const updatedTab = await tabs.get(tab.id);
      assert.equal(updatedTab.url, 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index');
    });

    it('Step2Bound reached: triggers handleStep2BoundReached and schedules 3-minute reload', async () => {
      const tabs = createMockTabs();
      const tab = await tabs.create({ url: 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index' });
      tab.messageHandler = (msg) => {
        if (msg.type === 'STEER_TAB' || msg.type === 'CLASSIFY_PAGE') {
          return { success: true, state: PAGE_STATES.STEP2_BOUND };
        }
        return { ok: true };
      };

      const storage = createMockStorage({ vigil: { state: 'watching' }, ownedTabId: tab.id });
      const alarms = createMockAlarms();
      const action = createMockAction();

      const result = await steerOwnedTab({
        tabId: tab.id,
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
      });

      assert.equal(result.state, PAGE_STATES.STEP2_BOUND);
      assert.equal(alarms._getAlarms().has('owned_tab_reload'), true);
    });

    it('steerOwnedTab defers without navigating or reloading when strikePending is true', async () => {
      const tabs = createMockTabs();
      const tab = await tabs.create({ url: 'https://archershub.dlsu.edu.ph/Student/Dashboard' });
      const storage = createMockStorage({
        vigil: { state: 'watching' },
        ownedTabId: tab.id,
        strikePending: true,
      });
      const alarms = createMockAlarms();
      const action = createMockAction();

      const result = await steerOwnedTab({
        tabId: tab.id,
        tabsApi: tabs,
        storageApi: storage,
        alarmsApi: alarms,
        actionApi: action,
      });

      assert.equal(result.action, 'deferred');
      assert.equal(result.reason, 'strike_pending');
      const updatedTab = await tabs.get(tab.id);
      assert.equal(updatedTab.url, 'https://archershub.dlsu.edu.ph/Student/Dashboard'); // URL unchanged!
      assert.equal(updatedTab.reloaded || 0, 0); // Not reloaded!
    });
  });
});


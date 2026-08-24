// Storage keys
const SCHEDULE_KEY = 'scheduledExecution';
const SUBJECTS_KEY = 'enlistedSubjects';
const ALARM_NAME = 'enlistmentAlarm';
const SCHEDULE_SESSION_HEARTBEAT_ALARM = 'scheduledSessionHeartbeat';
const ARCHERSHUB_BASE_URL = 'https://archershub.dlsu.edu.ph';
const DASHBOARD_URL = `${ARCHERSHUB_BASE_URL}/StudentDashboard`;
const ENLISTMENT_STEP2_URL = `${ARCHERSHUB_BASE_URL}/Enlistment_V2/Index/2`;

function normalizeSubjectEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const subject = String(entry.subject || '').trim().toUpperCase();
    const section = String(entry.section || '').trim().toUpperCase();

    if (!subject || !section) {
        return null;
    }

    return { subject, section };
}

function dedupeSubjectsBySubject(subjects) {
    const uniqueSubjects = [];
    const seenSubjects = new Set();

    subjects.forEach((entry) => {
        const normalized = normalizeSubjectEntry(entry);
        if (!normalized) {
            return;
        }

        if (!seenSubjects.has(normalized.subject)) {
            seenSubjects.add(normalized.subject);
            uniqueSubjects.push(normalized);
        }
    });

    return uniqueSubjects;
}

// Initialize service worker
chrome.runtime.onInstalled.addListener(() => {
    console.log('ArchersHub Enlistment Automator installed');
    
    // Set up periodic check (every minute)
    chrome.alarms.create('checkSchedule', { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
    syncScheduledSessionHeartbeat();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'scheduleExecution') {
        const scheduledTime = new Date(request.scheduledTime);
        const now = new Date();
        const delayMs = scheduledTime.getTime() - now.getTime();
        
        if (delayMs <= 0) {
            sendResponse({ success: false, error: 'Scheduled time is in the past' });
            return;
        }
        
        // Chrome alarms work with minutes from now, max 24 hours
        const delayMinutes = Math.ceil(delayMs / 60000);
        
        // Remove old alarm if exists
        chrome.alarms.clear(ALARM_NAME, () => {
            // Create new alarm
            chrome.alarms.create(ALARM_NAME, {
                when: scheduledTime.getTime()
            });

            startScheduledSessionHeartbeat();
            
            console.log(`Alarm set for ${scheduledTime.toLocaleString()}`);
            sendResponse({ success: true });
        });
        
        return true; // Keep channel open for async response
    }
    
    if (request.type === 'clearSchedule') {
        chrome.alarms.clear(ALARM_NAME, () => {
            stopScheduledSessionHeartbeat();
            console.log('Alarm cleared');
            sendResponse({ success: true });
        });
        return true;
    }
});

// Listen for alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        console.log('Enlistment alarm triggered!');
        executeEnlistment();
    } else if (alarm.name === SCHEDULE_SESSION_HEARTBEAT_ALARM) {
        runScheduledSessionHeartbeat();
    } else if (alarm.name === 'checkSchedule') {
        checkScheduledExecution();
    }
});

// Check if enlistment should be executed based on schedule
function checkScheduledExecution() {
    chrome.storage.local.get([SCHEDULE_KEY, SUBJECTS_KEY], (result) => {
        const schedule = result[SCHEDULE_KEY];
        const rawSubjects = result[SUBJECTS_KEY] || [];
        const subjects = dedupeSubjectsBySubject(rawSubjects);

        if (subjects.length !== rawSubjects.length) {
            chrome.storage.local.set({ [SUBJECTS_KEY]: subjects });
        }
        
        if (!schedule || !schedule.enabled || subjects.length === 0) {
            return;
        }
        
        const scheduledTime = new Date(schedule.dateTime);
        const now = new Date();
        
        // Execute if within 1 minute of scheduled time
        if (now >= scheduledTime && (now.getTime() - scheduledTime.getTime()) < 60000) {
            console.log('Executing scheduled enlistment');
            executeEnlistment();
            stopScheduledSessionHeartbeat();
        }
    });
}

function syncScheduledSessionHeartbeat() {
    chrome.storage.local.get([SCHEDULE_KEY], (result) => {
        const schedule = result[SCHEDULE_KEY];
        if (!schedule || !schedule.enabled) {
            stopScheduledSessionHeartbeat();
            return;
        }

        const scheduledTime = new Date(schedule.dateTime);
        if (scheduledTime <= new Date()) {
            stopScheduledSessionHeartbeat();
            return;
        }

        startScheduledSessionHeartbeat();
    });
}

function startScheduledSessionHeartbeat() {
    chrome.alarms.create(SCHEDULE_SESSION_HEARTBEAT_ALARM, {
        periodInMinutes: 5
    });
}

function stopScheduledSessionHeartbeat() {
    chrome.alarms.clear(SCHEDULE_SESSION_HEARTBEAT_ALARM);
}

function runScheduledSessionHeartbeat() {
    chrome.storage.local.get([SCHEDULE_KEY], (result) => {
        const schedule = result[SCHEDULE_KEY];
        if (!schedule || !schedule.enabled) {
            stopScheduledSessionHeartbeat();
            return;
        }

        const scheduledTime = new Date(schedule.dateTime);
        if (scheduledTime <= new Date()) {
            stopScheduledSessionHeartbeat();
            return;
        }

        bounceEnlistmentSessionTab();
    });
}

function bounceEnlistmentSessionTab() {
    chrome.tabs.query({ url: 'https://archershub.dlsu.edu.ph/*' }, (tabs) => {
        if (!tabs || tabs.length === 0) {
            console.log('Heartbeat skipped: no ArchersHub tab found');
            return;
        }

        const targetTab = tabs.find((tab) => tab.url && (tab.url.includes('/Enlistment_V2/') || tab.url.includes('/Enlistment/'))) || tabs[0];
        if (!targetTab || !targetTab.id) {
            return;
        }

        chrome.tabs.update(targetTab.id, { url: DASHBOARD_URL }, () => {
            if (chrome.runtime.lastError) {
                console.warn('Heartbeat dashboard navigation failed:', chrome.runtime.lastError.message);
                return;
            }

            setTimeout(() => {
                chrome.tabs.update(targetTab.id, { url: ENLISTMENT_STEP2_URL }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('Heartbeat enlistment navigation failed:', chrome.runtime.lastError.message);
                        return;
                    }

                    console.log('Scheduled heartbeat refreshed session via dashboard -> enlistment step 2');
                });
            }, 1500);
        });
    });
}

// Execute enlistment on the ArchersHub tab
function executeEnlistment() {
    chrome.tabs.query({ url: 'https://archershub.dlsu.edu.ph/*' }, (tabs) => {
        const enlistmentTabs = (tabs || []).filter(tab => tab.url && (tab.url.includes('/Enlistment_V2/') || tab.url.includes('/Enlistment/')));
        if (enlistmentTabs.length === 0) {
            console.log('No ArchersHub enlistment tab found');
            notifyPopup({
                type: 'executionStatus',
                status: 'error',
                message: 'Enlistment page tab not found. Open ArchersHub enlistment page and log in first.'
            });
            return;
        }
        
        // Find the enlistment page tab
        const enlistmentTab = enlistmentTabs.find(tab => 
            tab.url.includes('/Enlistment_V2/Index') || tab.url.includes('/Enlistment/Index')
        ) || enlistmentTabs[0];
        
        chrome.storage.local.get([SUBJECTS_KEY], (result) => {
            const rawSubjects = result[SUBJECTS_KEY] || [];
            const subjects = dedupeSubjectsBySubject(rawSubjects);

            if (subjects.length !== rawSubjects.length) {
                chrome.storage.local.set({ [SUBJECTS_KEY]: subjects });
            }
            
            // Send message to content script on the enlistment page
            chrome.tabs.sendMessage(enlistmentTab.id, {
                type: 'executeEnlistment',
                subjects: subjects,
                isScheduled: true
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    notifyPopup({
                        type: 'executionStatus',
                        status: 'error',
                        message: 'Failed to contact content script. Reload enlistment page and try again.'
                    });
                    return;
                }
                
                if (response && response.success) {
                    console.log('Enlistment completed successfully');
                    notifyPopup({
                        type: 'executionStatus',
                        status: 'completed'
                    });
                } else if (response && response.error) {
                    console.error('Enlistment error:', response.error);
                    notifyPopup({
                        type: 'executionStatus',
                        status: 'error',
                        message: response.error
                    });
                }
            });
        });
    });
}

// Notify popup of execution status
function notifyPopup(message) {
    chrome.runtime.sendMessage(message).catch(() => {
        // Popup might not be open, ignore error
    });
}

// Keep service worker alive periodically
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
        console.log('Service worker keep-alive');
    }
});

// Create a keep-alive alarm (every 5 minutes)
chrome.alarms.create('keepAlive', { periodInMinutes: 5 });

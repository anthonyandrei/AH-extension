// DOM Elements
const subjectInput = document.getElementById('subjectInput');
const sectionInput = document.getElementById('sectionInput');
const addBtn = document.getElementById('addBtn');
const runBtn = document.getElementById('runBtn');
const scheduleBtn = document.getElementById('scheduleBtn');
const clearScheduleBtn = document.getElementById('clearScheduleBtn');
const subjectsList = document.getElementById('subjectsList');
const addError = document.getElementById('addError');
const scheduleError = document.getElementById('scheduleError');
const statusText = document.getElementById('statusText');
const statusDiv = document.getElementById('status');
const executionDate = document.getElementById('executionDate');
const executionTime = document.getElementById('executionTime');
const executionLog = document.getElementById('executionLog');
const scheduledTimeContainer = document.getElementById('scheduledTimeContainer');
const scheduleTypeRadios = document.querySelectorAll('input[name="scheduleType"]');

// Storage keys
const SUBJECTS_KEY = 'enlistedSubjects';
const SCHEDULE_KEY = 'scheduledExecution';
const LOG_KEY = 'executionLog';

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

// Initialize popup on open
document.addEventListener('DOMContentLoaded', () => {
    loadSubjects();
    loadScheduledTime();
    loadExecutionLog();
    updateStatus();
    setupEventListeners();
    setDefaultDate();
});

// Event Listeners
addBtn.addEventListener('click', addSubject);
runBtn.addEventListener('click', runEnlistment);
scheduleBtn.addEventListener('click', saveSchedule);
clearScheduleBtn.addEventListener('click', clearSchedule);

subjectInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSubject();
});

sectionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSubject();
});

scheduleTypeRadios.forEach(radio => {
    radio.addEventListener('change', updateScheduleUI);
});

// Set default date to today
function setDefaultDate() {
    const today = new Date();
    executionDate.valueAsDate = today;
    executionTime.value = '08:00';
}

// Update Schedule UI based on selection
function updateScheduleUI() {
    const scheduleType = document.querySelector('input[name="scheduleType"]:checked').value;
    
    if (scheduleType === 'scheduled') {
        scheduledTimeContainer.classList.remove('hidden');
        scheduleBtn.classList.remove('hidden');
        clearScheduleBtn.classList.remove('hidden');
    } else {
        scheduledTimeContainer.classList.add('hidden');
        scheduleBtn.classList.add('hidden');
        clearScheduleBtn.classList.add('hidden');
    }
}

// Add subject to list
function addSubject() {
    const subject = subjectInput.value.trim().toUpperCase();
    const section = sectionInput.value.trim().toUpperCase();
    
    addError.textContent = '';
    
    if (!subject || !section) {
        addError.textContent = 'Both subject and section are required.';
        return;
    }
    
    if (subject.length > 7 || section.length > 4) {
        addError.textContent = 'Inputs must be 7 characters for subject and 4 characters for section or less.';
        return;
    }
    
    chrome.storage.local.get([SUBJECTS_KEY], (result) => {
        let subjects = dedupeSubjectsBySubject(result[SUBJECTS_KEY] || []);
        
        // Prevent duplicate subject codes.
        const isDuplicate = subjects.some(s => s.subject === subject);
        if (isDuplicate) {
            addError.textContent = 'This subject is already in the list.';
            return;
        }
        
        subjects.push({ subject, section });
        chrome.storage.local.set({ [SUBJECTS_KEY]: subjects }, () => {
            subjectInput.value = '';
            sectionInput.value = '';
            loadSubjects();
            addLog(`Added ${subject} - ${section}`, 'info');
        });
    });
}

// Remove subject from list
function removeSubject(subject, section) {
    chrome.storage.local.get([SUBJECTS_KEY], (result) => {
        let subjects = dedupeSubjectsBySubject(result[SUBJECTS_KEY] || []);
        subjects = subjects.filter(s => !(s.subject === subject && s.section === section));
        chrome.storage.local.set({ [SUBJECTS_KEY]: subjects }, () => {
            loadSubjects();
            addLog(`Removed ${subject} - ${section}`, 'info');
        });
    });
}

// Load subjects from storage
function loadSubjects() {
    chrome.storage.local.get([SUBJECTS_KEY], (result) => {
        const rawSubjects = result[SUBJECTS_KEY] || [];
        const subjects = dedupeSubjectsBySubject(rawSubjects);

        if (subjects.length !== rawSubjects.length) {
            chrome.storage.local.set({ [SUBJECTS_KEY]: subjects });
        }
        
        if (subjects.length === 0) {
            subjectsList.innerHTML = '<p class="empty-message">No subjects added yet</p>';
            return;
        }
        
        subjectsList.innerHTML = subjects
            .map(({ subject, section }) => `
                <div class="subject-item">
                    <div class="subject-info">
                        <span class="subject-code">${subject}</span>
                        <span class="subject-section">${section}</span>
                    </div>
                    <button
                        class="btn btn-danger delete-subject-btn"
                        data-subject="${encodeURIComponent(subject)}"
                        data-section="${encodeURIComponent(section)}"
                    >Delete</button>
                </div>
            `)
            .join('');
    });
}

// Save scheduled time
function saveSchedule() {
    const date = executionDate.value;
    const time = executionTime.value;
    
    scheduleError.textContent = '';
    
    if (!date || !time) {
        scheduleError.textContent = 'Please select both date and time.';
        return;
    }
    
    const scheduledDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    
    if (scheduledDateTime <= now) {
        scheduleError.textContent = 'Scheduled time must be in the future.';
        return;
    }
    
    chrome.storage.local.set({ 
        [SCHEDULE_KEY]: { 
            dateTime: scheduledDateTime.toISOString(),
            enabled: true
        } 
    }, () => {
        addLog(`Scheduled enlistment for ${scheduledDateTime.toLocaleString()}`, 'info');
        updateStatus();
        
        // Update schedule in background worker
        chrome.runtime.sendMessage({ 
            type: 'scheduleExecution', 
            scheduledTime: scheduledDateTime.toISOString() 
        });
    });
}

// Clear scheduled time
function clearSchedule() {
    chrome.storage.local.set({ [SCHEDULE_KEY]: null }, () => {
        addLog('Schedule cleared', 'info');
        document.querySelector('input[name="scheduleType"][value="immediate"]').checked = true;
        updateScheduleUI();
        updateStatus();
        
        chrome.runtime.sendMessage({ type: 'clearSchedule' });
    });
}

// Load scheduled time from storage
function loadScheduledTime() {
    chrome.storage.local.get([SCHEDULE_KEY], (result) => {
        const schedule = result[SCHEDULE_KEY];
        
        if (schedule && schedule.enabled) {
            const scheduledDateTime = new Date(schedule.dateTime);
            const dateStr = scheduledDateTime.toISOString().split('T')[0];
            const timeStr = scheduledDateTime.toTimeString().substring(0, 5);
            
            executionDate.value = dateStr;
            executionTime.value = timeStr;
            
            document.querySelector('input[name="scheduleType"][value="scheduled"]').checked = true;
            updateScheduleUI();
        }
    });
}

// Run enlistment immediately
function runEnlistment() {
    chrome.storage.local.get([SUBJECTS_KEY], (result) => {
        const subjects = dedupeSubjectsBySubject(result[SUBJECTS_KEY] || []);

        if ((result[SUBJECTS_KEY] || []).length !== subjects.length) {
            chrome.storage.local.set({ [SUBJECTS_KEY]: subjects });
        }
        
        if (subjects.length === 0) {
            addError.textContent = 'Please add at least one subject before running.';
            return;
        }
        
        addLog('Starting enlistment...', 'info');
        updateStatus('running');
        
        chrome.tabs.query({ url: 'https://archershub.dlsu.edu.ph/*' }, (tabs) => {
            if (tabs.length === 0) {
                addLog('ArchersHub tab not found. Open ArchersHub in your browser first.', 'error');
                updateStatus('error');
                return;
            }

            const enlistmentUrl = 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index/2';
            const enlistmentTab = tabs.find((t) => t.url && (t.url.includes('/Enlistment_V2/Index') || t.url.includes('/Enlistment/Index'))) || tabs[0];
            const sendRunRequest = (tabId) => {
                chrome.tabs.sendMessage(tabId, {
                    type: 'executeEnlistment',
                    subjects: subjects
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        addLog('Error: Unable to connect to enlistment page. Reload the tab and try again.', 'error');
                        updateStatus('error');
                        return;
                    }

                    if (response && response.success) {
                        addLog('Enlistment completed successfully!', 'success');
                        updateStatus('not-running');
                    } else if (response && response.error) {
                        addLog('Enlistment failed: ' + response.error, 'error');
                        updateStatus('error');
                    }
                });
            };

            if (enlistmentTab.url && (enlistmentTab.url.includes('/Enlistment_V2/Index') || enlistmentTab.url.includes('/Enlistment/Index'))) {
                sendRunRequest(enlistmentTab.id);
                return;
            }

            chrome.tabs.update(enlistmentTab.id, { url: enlistmentUrl }, (updatedTab) => {
                if (chrome.runtime.lastError || !updatedTab) {
                    addLog('Unable to open the enlistment page. Please try again after opening ArchersHub.', 'error');
                    updateStatus('error');
                    return;
                }

                let handshakeComplete = false;
                let handshakeTimeoutId = null;
                const waitForContentScript = setInterval(() => {
                    chrome.tabs.sendMessage(updatedTab.id, { type: 'ping' }, () => {
                        if (chrome.runtime.lastError) {
                            return;
                        }

                        handshakeComplete = true;
                        clearInterval(waitForContentScript);
                        if (handshakeTimeoutId) {
                            clearTimeout(handshakeTimeoutId);
                        }
                        sendRunRequest(updatedTab.id);
                    });
                }, 500);

                handshakeTimeoutId = setTimeout(() => {
                    if (handshakeComplete) {
                        return;
                    }

                    clearInterval(waitForContentScript);
                    addLog('Timed out waiting for the enlistment page to load.', 'error');
                    updateStatus('error');
                }, 15000);
            });
        });
    });
}

// Update status display
function updateStatus(status = null) {
    if (status) {
        statusDiv.className = 'status ' + status;
        
        if (status === 'running') {
            statusText.textContent = '🔄 Running Enlistment...';
        } else if (status === 'error') {
            statusText.textContent = '❌ Error Occurred';
        } else {
            statusText.textContent = '✓ Ready';
        }
    } else {
        // Check if scheduled
        chrome.storage.local.get([SCHEDULE_KEY], (result) => {
            const schedule = result[SCHEDULE_KEY];
            
            if (schedule && schedule.enabled) {
                const scheduledDateTime = new Date(schedule.dateTime);
                statusDiv.className = 'status scheduled';
                statusText.textContent = `⏰ Scheduled for ${scheduledDateTime.toLocaleString()}`;
            } else {
                statusDiv.className = 'status not-running';
                statusText.textContent = '✓ Not Scheduled';
            }
        });
    }
}

// Execution log management
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    executionLog.insertBefore(logEntry, executionLog.firstChild);
    
    // Keep only last 20 entries
    while (executionLog.children.length > 20) {
        executionLog.removeChild(executionLog.lastChild);
    }
    
    // Save to storage
    chrome.storage.local.get([LOG_KEY], (result) => {
        let logs = result[LOG_KEY] || [];
        logs.unshift({ message, type, timestamp });
        logs = logs.slice(0, 50); // Keep last 50
        chrome.storage.local.set({ [LOG_KEY]: logs });
    });
}

// Load execution log from storage
function loadExecutionLog() {
    chrome.storage.local.get([LOG_KEY], (result) => {
        const logs = result[LOG_KEY] || [];
        executionLog.innerHTML = '';
        
        if (logs.length === 0) {
            addLog('Ready to enlist. Please log in first on ArchersHub.', 'info');
            return;
        }
        
        logs.forEach(({ message, type, timestamp }) => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}`;
            logEntry.textContent = `[${timestamp}] ${message}`;
            executionLog.appendChild(logEntry);
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    // Handle dynamic delete buttons via event delegation.
    subjectsList.addEventListener('click', (event) => {
        const deleteBtn = event.target.closest('.delete-subject-btn');
        if (!deleteBtn) {
            return;
        }

        const subject = decodeURIComponent(deleteBtn.dataset.subject || '');
        const section = decodeURIComponent(deleteBtn.dataset.section || '');

        if (!subject || !section) {
            addLog('Unable to delete subject: missing subject/section data.', 'error');
            return;
        }

        removeSubject(subject, section);
    });

    // Listen for messages from background worker
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'executionStatus') {
            if (request.status === 'completed') {
                addLog('Enlistment completed!', 'success');
                updateStatus('not-running');
            } else if (request.status === 'error') {
                addLog(`Error: ${request.message}`, 'error');
                updateStatus('error');
            }
        }
    });
    
    // Update status every second when popup is open
    setInterval(updateStatus, 1000);
}

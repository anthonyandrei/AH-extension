// DOM Elements
const subjectInput = document.getElementById('subjectInput');
const sectionInput = document.getElementById('sectionInput');
const addBtn = document.getElementById('addBtn');
const subjectsList = document.getElementById('subjectsList');
const addError = document.getElementById('addError');
const executionLog = document.getElementById('executionLog');

// Storage keys
const SUBJECTS_KEY = 'enlistedSubjects';
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
    loadExecutionLog();
    setupEventListeners();
});

// Event Listeners
addBtn.addEventListener('click', addSubject);

subjectInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSubject();
});

sectionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSubject();
});

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
}

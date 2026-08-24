// Content script for ArchersHub Enlistment automation
// Injects directly into the page and automates the enlistment process

// Configuration
const MAX_WAIT_TIME = 300000; // 5 minutes
const CHECK_INTERVAL = 100; // 100ms for DOM checks
const STEP_WAIT_TIME = 30000; // 30 seconds between steps
const STEP_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;
const TOAST_WAIT_TIME = 5000;

// Listen for messages from popup and background worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ping') {
        sendResponse({ success: true });
        return false;
    }

    if (request.type === 'executeEnlistment') {
        console.log('Received executeEnlistment message', request);
        executeEnlistment(request.subjects)
            .then(result => {
                if (result.success) {
                    sendResponse({ success: true, result });
                } else {
                    sendResponse({ success: false, error: result.message, result });
                }
            })
            .catch(error => {
                console.error('Enlistment error:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        // Return true to indicate we'll send response asynchronously
        return true;
    }
});

/**
 * Main enlistment execution function
 */
async function executeEnlistment(subjects) {
    const summary = {
        step1: { success: false, attempts: 0, error: null },
        step2: { success: false, attempts: 0, error: null },
        submit: { success: false, attempts: 0, error: null, skipped: false },
        step3: { success: false, attempts: 0, error: null },
        subjects: { total: subjects.length, selected: 0, failed: [] }
    };

    try {
        console.log('Starting enlistment with subjects:', subjects);
        
        // Verify we're on the enlistment page
        if (!window.location.href.includes('/Enlistment_V2/Index') && !window.location.href.includes('/Enlistment/Index')) {
            throw new Error('Not on the enlistment page. Please navigate to the enlistment page first.');
        }
        
        // Wait for page to stabilize
        await waitForLoadingToDisappear();
        ensureEnlistmentActivityAvailable();
        console.log('Page loaded');
        
        // Enlistment Step 1
        console.log('Proceeding to Step 1...');
        const step1Result = await runWithRetries('Step 1', executeStep1);
        summary.step1 = {
            success: step1Result.success,
            attempts: step1Result.attempts,
            error: step1Result.error
        };
        if (!step1Result.success) {
            console.warn('Step 1 failed after retries. Continuing with remaining steps.');
        }
        
        // Enlistment Step 2
        console.log('Proceeding to Step 2...');
        await waitForLoadingToDisappear();
        ensureEnlistmentActivityAvailable();
        const step2Result = await runWithRetries('Step 2', () => executeStep2(subjects));
        summary.step2 = {
            success: step2Result.success,
            attempts: step2Result.attempts,
            error: step2Result.error
        };

        if (step2Result.success && step2Result.result) {
            summary.subjects.selected = step2Result.result.successCount;
            summary.subjects.failed = step2Result.result.failed;
        }
        
        // Submit Step 2
        console.log('Submitting Step 2...');
        if (summary.subjects.selected > 0) {
            ensureEnlistmentActivityAvailable();
            const submitResult = await runWithRetries('Step 2 Submit', submitStep2);
            summary.submit = {
                success: submitResult.success,
                attempts: submitResult.attempts,
                error: submitResult.error,
                skipped: false
            };
        } else {
            summary.submit = {
                success: false,
                attempts: 0,
                error: 'Skipped submit because no subjects were selected.',
                skipped: true
            };
            console.warn(summary.submit.error);
        }
        
        // Verify Step 3
        console.log('Verifying Step 3...');
        await waitForLoadingToDisappear();
        ensureEnlistmentActivityAvailable();
        const step3Result = await runWithRetries('Step 3 Verify', verifyStep3);
        summary.step3 = {
            success: step3Result.success,
            attempts: step3Result.attempts,
            error: step3Result.error
        };

        const overallSuccess = summary.step3.success;
        const message = overallSuccess
            ? `Enlistment completed. Selected ${summary.subjects.selected}/${summary.subjects.total} subject(s).`
            : 'Enlistment finished with errors. Check console logs for step-by-step details.';

        console.log(message, summary);
        return { success: overallSuccess, message, summary };
        
    } catch (error) {
        console.error('Error during enlistment:', error);
        return {
            success: false,
            message: `Enlistment terminated unexpectedly: ${error.message}`,
            summary
        };
    }
}

/**
 * Wait for loading indicators to disappear
 */
async function waitForLoadingToDisappear(timeout = MAX_WAIT_TIME) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        // Explicitly handle EnlistmentScript full-page loader state.
        if (isFullPageLoaderVisible()) {
            await sleep(CHECK_INTERVAL);
            continue;
        }

        // Check for loading dialogs
        const loadingDialog = document.querySelector('[role="dialog"]');
        if (loadingDialog && loadingDialog.offsetParent !== null) {
            await sleep(CHECK_INTERVAL);
            continue;
        }
        
        // Check for loading spinner/overlay
        const spinner = document.querySelector('.spinner, .loader, .loader-area, .loader-2, [class*="spinner"]');
        if (spinner && spinner.offsetParent !== null) {
            await sleep(CHECK_INTERVAL);
            continue;
        }
        
        // Page appears to be loaded
        await sleep(500); // Small delay to ensure full load
        return true;
    }
    
    console.warn('Timeout waiting for page to load');
    return true;
}

function isFullPageLoaderVisible() {
    if (document.body && document.body.classList.contains('loader-active')) {
        return true;
    }

    const myLoader = document.querySelector('#MyLoader');
    if (!myLoader) {
        return false;
    }

    if (isElementVisible(myLoader)) {
        return true;
    }

    const fullPageLoader = myLoader.querySelector('.full-page-loader');
    return isElementVisible(fullPageLoader);
}

/**
 * Execute Step 1: Select open sections and click Add
 */
async function executeStep1() {
    try {
        await ensureStepActive(1);
        
        // Explicitly use the Open Section radio from the page markup.
        const openSectionRadio = document.querySelector('#rdoOpenSection');
        if (!openSectionRadio) {
            throw new Error('Open Section radio button (#rdoOpenSection) not found');
        }

        // Some UIs bind handlers on the label/wrapper; click label first if present.
        const openSectionLabel = openSectionRadio.closest('label');
        if (openSectionLabel && isElementVisible(openSectionLabel)) {
            openSectionLabel.click();
        } else {
            openSectionRadio.click();
        }

        openSectionRadio.checked = true;
        openSectionRadio.dispatchEvent(new Event('input', { bubbles: true }));
        openSectionRadio.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Step 1 uses #btnAdd which is labelled "Save & Next".
        const addButton = await waitForStep1NextButton();
        if (!addButton) {
            throw new Error('Step 1 Save & Next button (#btnAdd) not found or not visible');
        }

        const step1ToastPromise = waitForToast({ timeout: TOAST_WAIT_TIME, includeExisting: false });
        addButton.click();

        const step1Toast = await step1ToastPromise;
        if (step1Toast && (step1Toast.type === 'warning' || step1Toast.type === 'error')) {
            throw new Error(`Step 1 toast ${step1Toast.type}: ${step1Toast.text || 'Unknown message'}`);
        }

        await waitForLoadingToDisappear();
        
        console.log('Step 1 completed');
        return true;
        
    } catch (error) {
        throw new Error(`Step 1 failed: ${error.message}`);
    }
}

/**
 * Execute Step 2: Select subjects and sections
 */
async function executeStep2(subjects) {
    try {
        await ensureStepActive(2);
        
        // Select each subject/section combination
        const results = [];
        for (const { subject, section } of subjects) {
            const result = selectSubjectSection(subject, section);
            results.push(result);
            await sleep(500); // Small delay between selections
        }
        
        const successCount = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success);
        console.log(`Step 2: Selected ${successCount}/${subjects.length} subjects`);

        return { successCount, failed, results };
        
    } catch (error) {
        throw new Error(`Step 2 failed: ${error.message}`);
    }
}

/**
 * Select a specific subject and section
 */
function selectSubjectSection(subject, section) {
    try {
        // Find the row containing this subject
        const rows = document.querySelectorAll('tbody tr, table tr');
        let targetRow = null;
        
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            const rowText = row.innerText.toUpperCase();
            
            if (rowText.includes(subject)) {
                targetRow = row;
                break;
            }
        }
        
        if (!targetRow) {
            console.warn(`Subject '${subject}' not found in the table`);
            return { success: false, subject, section, reason: 'Subject not found' };
        }
        
        // Find and check the checkbox in this row
        const checkbox = targetRow.querySelector('input[type="checkbox"]');
        if (!checkbox) {
            console.warn(`No checkbox found for subject '${subject}'`);
            return { success: false, subject, section, reason: 'No checkbox found' };
        }
        
        if (!checkbox.checked) {
            checkbox.click();
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Find and select the section dropdown
        const dropdown = targetRow.querySelector('select');
        if (!dropdown) {
            console.warn(`No dropdown found for subject '${subject}'`);
            return { success: false, subject, section, reason: 'No dropdown found' };
        }
        
        // Try to find the option with matching label or value
        let option = Array.from(dropdown.querySelectorAll('option')).find(opt => 
            opt.textContent.trim().toUpperCase().includes(section) || 
            opt.value.toUpperCase().includes(section)
        );
        
        if (!option) {
            console.warn(`Section '${section}' not found for subject '${subject}'`);
            return { success: false, subject, section, reason: 'Section not found' };
        }
        
        dropdown.value = option.value;
        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`Successfully selected ${subject} - ${section}`);
        return { success: true, subject, section };
        
    } catch (error) {
        console.error(`Error selecting ${subject} - ${section}:`, error);
        return { success: false, subject, section, reason: error.message };
    }
}

/**
 * Submit Step 2 (Save & Next button)
 */
async function submitStep2() {
    try {
        const saveButton = await waitForStep2NextButton();
        if (!saveButton) {
            throw new Error('Step 2 Save & Next button not found');
        }

        const step2ToastPromise = waitForToast({ timeout: TOAST_WAIT_TIME, includeExisting: false });
        saveButton.click();

        const step2Toast = await step2ToastPromise;
        if (step2Toast && (step2Toast.type === 'warning' || step2Toast.type === 'error')) {
            throw new Error(`Step 2 submit toast ${step2Toast.type}: ${step2Toast.text || 'Unknown message'}`);
        }

        await waitForLoadingToDisappear();
        
        console.log('Step 2 submitted');
        return true;
        
    } catch (error) {
        throw new Error(`Failed to submit Step 2: ${error.message}`);
    }
}

/**
 * Verify Step 3 is reached
 */
async function verifyStep3() {
    try {
        const step3State = getStepState(3);
        if (!step3State.navLink && !step3State.panel) {
            throw new Error('Step 3 indicators not found (nav and panel missing)');
        }

        if (!step3State.navActive && !step3State.panelActive) {
            throw new Error('Step 3 is not active in nav or panel - enlistment may have failed');
        }
        
        console.log('Step 3 verified - enlistment successful');
        return true;
        
    } catch (error) {
        throw new Error(`Step 3 verification failed: ${error.message}`);
    }
}

/**
 * Find a navigation link by text
 */
function findNavLink(text) {
    const links = document.querySelectorAll('a.nav-link, a[class*="nav"], a[class*="tab"]');
    for (const link of links) {
        if (link.innerText.includes(text)) {
            return link;
        }
    }
    return null;
}

function getStepState(stepNumber) {
    const stepLabel = `STEP ${stepNumber}`;
    const navLink = findNavLink(stepLabel);
    const panel = document.querySelector(`#STEP${stepNumber}`);

    return {
        navLink,
        panel,
        navActive: Boolean(navLink && navLink.classList.contains('active')),
        panelActive: Boolean(panel && panel.classList.contains('active'))
    };
}

function ensureEnlistmentActivityAvailable() {
    const alertMessage = document.querySelector('#divAlertMessage');
    const activityMessage = document.querySelector('#divActivityMessage');

    if (!alertMessage || !isElementVisible(alertMessage)) {
        return;
    }

    const alertText = activityMessage ? activityMessage.textContent.trim() : 'Enlistment activity unavailable.';
    throw new Error(alertText || 'Enlistment activity unavailable.');
}

async function ensureStepActive(stepNumber, timeout = STEP_WAIT_TIME) {
    let state = getStepState(stepNumber);

    if (state.navActive || state.panelActive) {
        return;
    }

    if (!state.navLink) {
        throw new Error(`Step ${stepNumber} nav link not found and panel is not active`);
    }

    state.navLink.click();
    await waitForStepActive(stepNumber, timeout);
    await waitForLoadingToDisappear();
}

async function waitForStepActive(stepNumber, timeout = STEP_WAIT_TIME) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const state = getStepState(stepNumber);
        if (state.navActive || state.panelActive) {
            return true;
        }

        await sleep(CHECK_INTERVAL);
    }

    throw new Error(`Timed out waiting for Step ${stepNumber} to become active`);
}

/**
 * Find a button by text content
 */
function findButtonByText(text) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
        if (btn.innerText.includes(text)) {
            return btn;
        }
    }
    
    // Also check input buttons
    const inputButtons = document.querySelectorAll('input[type="button"], input[type="submit"]');
    for (const btn of inputButtons) {
        if (btn.value.includes(text)) {
            return btn;
        }
    }
    
    return null;
}

/**
 * Run a step with retries instead of failing immediately.
 */
async function runWithRetries(stepName, operation, attempts = STEP_RETRY_ATTEMPTS) {
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const result = await operation();
            return { success: true, attempts: attempt, result, error: null };
        } catch (error) {
            lastError = error;
            console.warn(`${stepName} attempt ${attempt}/${attempts} failed: ${error.message}`);

            if (attempt < attempts) {
                await waitForLoadingToDisappear();
                await sleep(RETRY_DELAY_MS);
            }
        }
    }

    return {
        success: false,
        attempts,
        result: null,
        error: lastError ? lastError.message : `${stepName} failed with unknown error`
    };
}

/**
 * Wait for Step 1 Save & Next (#btnAdd) to be visible and clickable.
 */
async function waitForStep1NextButton(timeout = STEP_WAIT_TIME) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const button =
            document.querySelector('#btnAdd') ||
            findButtonByText('Save & Next');

        if (button && isElementVisible(button) && !button.disabled) {
            return button;
        }

        await sleep(CHECK_INTERVAL);
    }

    return null;
}

/**
 * Wait for Step 2 Save & Next button to be visible and clickable.
 */
async function waitForStep2NextButton(timeout = STEP_WAIT_TIME) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        const button =
            document.querySelector('#btnEnlistment') ||
            findButtonByText('Save & Next');

        if (button && isElementVisible(button) && !button.disabled) {
            return button;
        }

        await sleep(CHECK_INTERVAL);
    }

    return null;
}

async function waitForToast({ timeout = TOAST_WAIT_TIME, includeExisting = true } = {}) {
    const selectors = [
        '.iziToast',
        '.iziToast-message',
        '.toast',
        '.toast-message',
        '[class*="toast"]'
    ];

    if (includeExisting) {
        const existingToast = getVisibleToastNode(selectors);
        if (existingToast) {
            return extractToastInfo(existingToast);
        }
    }

    return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
            const toastNode = getVisibleToastNode(selectors);
            if (!toastNode) {
                return;
            }

            observer.disconnect();
            clearTimeout(timer);
            resolve(extractToastInfo(toastNode));
        });

        observer.observe(document.body, { childList: true, subtree: true });

        const timer = setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

function getVisibleToastNode(selectors) {
    const selector = selectors.join(',');
    const candidates = Array.from(document.querySelectorAll(selector));

    for (const candidate of candidates) {
        if (isElementVisible(candidate)) {
            return candidate;
        }
    }

    return null;
}

function extractToastInfo(node) {
    const toastRoot = node.closest('.iziToast, .toast') || node;
    const toastClass = toastRoot.className || '';

    let type = 'info';
    if (/error|danger|fail/i.test(toastClass)) {
        type = 'error';
    } else if (/warning|warn/i.test(toastClass)) {
        type = 'warning';
    } else if (/success/i.test(toastClass)) {
        type = 'success';
    }

    const messageNode =
        toastRoot.querySelector('.iziToast-message') ||
        toastRoot.querySelector('.toast-message') ||
        toastRoot;

    const text = (messageNode.textContent || '').trim().replace(/\s+/g, ' ');
    return { type, text };
}

function isElementVisible(element) {
    if (!element) {
        return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

/**
 * Sleep utility function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('ArchersHub Enlistment Automator content script loaded');

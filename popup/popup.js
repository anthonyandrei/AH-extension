import { readCatalogue } from "./catalogue.js";
import { emptyPlan, addSubject, removeSubject, setWantedSection, rehydrate, renderPlanRows } from "./plan.js";
import {
  checkSession,
  evaluateChecklist,
  formatArmLabel,
  formatDateTimeDisplay,
  getDefaultStartTime,
  armVigil,
} from "./arming.js";
import { filterLedgerEntries, formatEventTime, exportPassTail } from "./reporting.js";
import { stopVigil } from "./pass.js";

// DOM Elements helper
const getEl = (id) => (typeof document !== "undefined" ? document.getElementById(id) : null);

const tabPlan = getEl("tabPlan");
const tabRun = getEl("tabRun");
const tabReport = getEl("tabReport");

const panelPlan = getEl("panelPlan");
const panelRun = getEl("panelRun");
const panelReport = getEl("panelReport");

const vigilChip = getEl("vigilChip");
const vigilChipLabel = getEl("vigilChipLabel");

const planRows = getEl("planRows");
const addCourse = getEl("addCourse");
const addBtn = getEl("addBtn");
const planRefusal = getEl("planRefusal");

const startNowBtn = getEl("startNowBtn");
const startAtTimeBtn = getEl("startAtTimeBtn");
const startTimeInput = getEl("startTimeInput");
const startNowDescription = getEl("startNowDescription");
const armBtn = getEl("armBtn");

const checklistDetails = getEl("checklistDetails");
const checklistSummary = getEl("checklistSummary");
const checklistItems = getEl("checklistItems");

const planStatus = getEl("planStatus");

const filterAll = getEl("filterAll");
const filterAlerts = getEl("filterAlerts");
const filterNotices = getEl("filterNotices");
const exportBtn = getEl("exportBtn");
const reportList = getEl("reportList");

// State
let currentPlan = emptyPlan();
let catalogueData = null;
let vigilData = null;
let ledgerData = [];
let passTailData = [];
let reconciliationData = null;
let isStopConfirming = false;
let stopConfirmTimer = null;
let reportFilter = "all";
let startMode = "at-time";
let isRefused = false;

// Storage helpers
function storageGet(keys) {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome?.storage?.local?.get) {
      chrome.storage.local.get(keys, (res) => {
        if (chrome.runtime?.lastError) {
          resolve({});
        } else {
          resolve(res || {});
        }
      });
    } else {
      resolve({});
    }
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome?.storage?.local?.set) {
      chrome.storage.local.set(items, () => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome?.storage?.local?.remove) {
      chrome.storage.local.remove(keys, () => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function savePlan(plan) {
  await storageSet({ plan });
}

// Tab Switching
async function selectTab(selectedButton) {
  const tabs = [
    { button: tabPlan, panel: panelPlan },
    { button: tabRun, panel: panelRun },
    { button: tabReport, panel: panelReport },
  ];

  for (const { button, panel } of tabs) {
    if (!button || !panel) continue;
    const isSelected = button === selectedButton;
    button.setAttribute("aria-selected", String(isSelected));
    if (isSelected) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
    }
  }

  if (selectedButton === tabReport) {
    const storageResult = await storageGet(["ledger", "passTail"]);
    ledgerData = storageResult.ledger || [];
    passTailData = storageResult.passTail || [];
    renderReportPanel();
  }
}

function setupTabs() {
  const tabs = [tabPlan, tabRun, tabReport];
  for (const button of tabs) {
    if (button) {
      button.addEventListener("click", () => selectTab(button));
    }
  }
}

// URL / Navigation helpers
export function openExternalUrl(url) {
  if (typeof chrome !== "undefined" && chrome?.tabs?.create) {
    chrome.tabs.create({ url });
  } else if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank");
  }
}

/**
 * Consolidates presentation descriptors (tones, labels, titles, subtitles, stop visibility) for Vigil states.
 *
 * @param {{ vigil?: object|null, plan?: object|null, reconciliation?: object|null }} [params]
 * @returns {{
 *   state: string,
 *   isRunning: boolean,
 *   isRunTabState: boolean,
 *   chipVisible: boolean,
 *   chipTone: string|null,
 *   chipLabel: string|null,
 *   runTitle: string,
 *   runSubtitle: string,
 *   showStopButton: boolean,
 *   isSuspended: boolean
 * }}
 */
export function getVigilPresentation({ vigil, plan, reconciliation } = {}) {
  const state = vigil?.state || "none";
  const isRunning = state === "watching" || state === "armed";
  const isRunTabState = ["watching", "armed", "suspended", "complete", "stall", "aborted"].includes(state);
  const subjectCount = plan?.subjects?.length || 0;

  let chipVisible = false;
  let chipTone = null;
  let chipLabel = null;
  let title = "Watching";
  let subtitle = `${subjectCount} subjects watching`;
  let showStopButton = false;
  let isSuspended = false;

  switch (state) {
    case "armed":
      chipVisible = true;
      chipTone = "armed";
      chipLabel = `starts ${formatDateTimeDisplay(vigil?.nextFireTime)}`;
      title = `Armed for ${formatDateTimeDisplay(vigil?.nextFireTime)}`;
      subtitle = "Armed. Pre-start keepalive active.";
      showStopButton = true;
      break;
    case "watching":
      chipVisible = true;
      chipTone = "live";
      chipLabel = "watching";
      if (reconciliation) {
        const satisfiedCount = (reconciliation.dispositions || []).filter(
          (d) => d.isSatisfied && d.wantedSectionCode !== null
        ).length;
        subtitle = `${reconciliation.unresolvedCount} watching, ${satisfiedCount} satisfied`;
      }
      showStopButton = true;
      break;
    case "suspended":
      chipVisible = true;
      chipTone = "warn";
      chipLabel = "suspended";
      title = "Suspended";
      subtitle = "You have to log back in, nothing else";
      showStopButton = true;
      isSuspended = true;
      break;
    case "stall":
      chipVisible = true;
      chipTone = "bad";
      chipLabel = "stall";
      title = "Stall";
      subtitle = "10 minutes without a complete pass";
      showStopButton = true;
      break;
    case "aborted":
      chipVisible = true;
      chipTone = "bad";
      chipLabel = "aborted";
      title = "Aborted";
      subtitle = "Unrecognised page state";
      break;
    case "complete":
      chipVisible = true;
      chipTone = "done";
      chipLabel = "complete";
      title = "Complete";
      subtitle = "Every subject holds its Wanted Section";
      break;
    case "stopped":
    case "none":
    default:
      break;
  }

  return {
    state,
    isRunning,
    isRunTabState,
    chipVisible,
    chipTone,
    chipLabel,
    runTitle: title,
    runSubtitle: subtitle,
    title,
    subtitle,
    showStopButton,
    isSuspended,
  };
}

// Render Functions
function renderChip() {
  if (!vigilChip || !vigilChipLabel) return;

  const presentation = getVigilPresentation({ vigil: vigilData, plan: currentPlan, reconciliation: reconciliationData });
  if (!presentation.chipVisible) {
    vigilChip.hidden = true;
    return;
  }

  vigilChip.hidden = false;
  vigilChip.dataset.tone = presentation.chipTone;
  vigilChipLabel.textContent = presentation.chipLabel;
}

function renderChecklist() {
  if (!checklistItems) return;
  checklistItems.replaceChildren();

  const loggedIn = catalogueData ? catalogueData.loggedIn !== false && !isRefused : !isRefused;
  const items = evaluateChecklist({ loggedIn });

  if (checklistSummary) {
    checklistSummary.textContent = startMode === "now" ? "Checklist" : "Night-before checklist";
  }

  for (const item of items) {
    const li = document.createElement("li");

    const mark = document.createElement("span");
    mark.className = `mark ${item.status === "yes" ? "" : item.status === "no" ? "bad" : "no"}`;
    mark.textContent = item.mark;
    li.appendChild(mark);

    const textWrap = document.createElement("span");
    textWrap.appendChild(document.createTextNode(item.title));
    textWrap.appendChild(document.createElement("br"));

    const why = document.createElement("span");
    why.className = "muted";
    why.textContent = item.why;
    textWrap.appendChild(why);

    li.appendChild(textWrap);
    checklistItems.appendChild(li);
  }
}

function renderRefusal() {
  if (!planRefusal) return;
  planRefusal.replaceChildren();

  if (isRefused) {
    const note = document.createElement("div");
    note.className = "note";
    note.dataset.tone = "bad";
    note.style.marginTop = "12px";

    const title = document.createElement("b");
    title.className = "note-t";
    title.textContent = "Cannot arm — you are logged out";
    note.appendChild(title);

    const desc = document.createElement("div");
    desc.textContent = "Arming checks the session first, so a Vigil is never armed against a login it does not have.";
    note.appendChild(desc);

    const btnWrap = document.createElement("div");
    btnWrap.style.marginTop = "8px";
    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-ghost";
    openBtn.style.fontSize = "11.5px";
    openBtn.style.padding = "6px 10px";
    openBtn.textContent = "Open ArchersHub";
    openBtn.addEventListener("click", () => {
      openExternalUrl("https://archershub.dlsu.edu.ph/Enlistment_V2/Index");
    });
    btnWrap.appendChild(openBtn);
    note.appendChild(btnWrap);

    planRefusal.appendChild(note);
  }
}

function renderStartControl() {
  const isNow = startMode === "now";
  if (startNowBtn) startNowBtn.setAttribute("aria-pressed", String(isNow));
  if (startAtTimeBtn) startAtTimeBtn.setAttribute("aria-pressed", String(!isNow));

  if (startTimeInput) {
    startTimeInput.style.display = isNow ? "none" : "block";
    if (!startTimeInput.value) {
      startTimeInput.value = getDefaultStartTime();
    }
  }

  if (startNowDescription) {
    startNowDescription.style.display = isNow ? "block" : "none";
  }
}

function renderArmButton() {
  if (!armBtn) return;

  const isBlocked = isRefused || catalogueData?.loggedIn === false;
  const presentation = getVigilPresentation({ vigil: vigilData, plan: currentPlan, reconciliation: reconciliationData });
  const subjectCount = currentPlan?.subjects?.length || 0;

  const label = formatArmLabel({
    startMode,
    startTime: startTimeInput?.value,
    isBlocked,
    isRunning: presentation.isRunning,
    subjectCount,
  });

  armBtn.textContent = label;
  armBtn.disabled = isBlocked || presentation.isRunning || subjectCount === 0;
}

function populateAddCourse() {
  if (!addCourse) return;
  addCourse.replaceChildren(new Option("Add a subject…", ""));

  if (!catalogueData || !Array.isArray(catalogueData.courses)) {
    return;
  }

  const existingSubjectIds = new Set(
    (currentPlan?.subjects || []).map((s) => String(s.courseCreationId))
  );

  for (const course of catalogueData.courses) {
    if (!existingSubjectIds.has(String(course.courseCreationId))) {
      addCourse.appendChild(new Option(course.courseCode, String(course.courseCreationId)));
    }
  }
}

function renderRunPanel() {
  if (!panelRun) return;

  if (!vigilData || vigilData.state === "none") {
    panelRun.innerHTML = `<p class="empty">Nothing is running.<br><span style="font-size: 11px;">Arm a Vigil on the Plan tab.</span></p>`;
    return;
  }

  const state = vigilData.state;

  if (state === "stopped") {
    panelRun.innerHTML = `
      <div style="padding: 12px 0 10px;">
        <p style="font-size: 14px; font-weight: 600; letter-spacing: -0.01em;">Stopped</p>
        <p class="muted" style="font-size: 11.5px; margin-top: 2px;">It will not resume</p>
      </div>
      <div style="margin-top: 14px;">
        <button type="button" id="armAgainBtn" class="btn btn-primary btn-block">Arm again</button>
      </div>
    `;
    const armAgainBtn = panelRun.querySelector("#armAgainBtn");
    if (armAgainBtn) {
      armAgainBtn.addEventListener("click", () => selectTab(tabPlan));
    }
    return;
  }

  const presentation = getVigilPresentation({ vigil: vigilData, plan: currentPlan, reconciliation: reconciliationData });

  const subjectsHtml = (currentPlan?.subjects || [])
    .map((s) => {
      const disp = (reconciliationData?.dispositions || []).find(
        (d) => String(d.courseCreationId) === String(s.courseCreationId)
      );
      const isSatisfied = disp ? disp.isSatisfied : false;
      const heldSectionCode = disp?.heldSectionCode || null;
      const arrowText = heldSectionCode ? `${heldSectionCode} → ` : "— → ";

      return `<tr>
        <td style="font-weight: 600;">${s.courseCode}</td>
        <td class="k muted">${arrowText}<span style="color: var(--ink-2);">${s.sectionCode}</span></td>
        <td style="text-align: right;">
          <span class="subj-status ${isSatisfied ? 'st-done' : 'st-wait'}">
            ${isSatisfied ? 'satisfied' : 'watching'}
          </span>
        </td>
      </tr>`;
    })
    .join("");

  const stopButtonHtml = presentation.showStopButton
    ? `<div style="margin-top: 16px;">
        <button type="button" id="stopVigilBtn" class="btn ${isStopConfirming ? 'btn-danger' : 'btn-ghost'} btn-block">
          ${isStopConfirming ? 'Stop Vigil? Click again to confirm' : 'Stop Vigil'}
        </button>
      </div>`
    : "";

  const warnHtml = presentation.isSuspended
    ? `<div class="note" data-tone="warn" style="margin-top: 8px; margin-bottom: 10px;">
        <b class="note-t">Session lost</b>
        <div>The Vigil is suspended and checking every 30s. Log back in to ArchersHub in any tab and the Vigil will resume on its own.</div>
        <div style="margin-top: 8px;">
          <button type="button" id="openArchersHubRunBtn" class="btn btn-ghost btn-xs">Open ArchersHub</button>
        </div>
      </div>`
    : "";

  panelRun.innerHTML = `
    <div style="padding: 12px 0 10px;">
      <p style="font-size: 14px; font-weight: 600; letter-spacing: -0.01em;">${presentation.runTitle}</p>
      <p class="muted" style="font-size: 11.5px; margin-top: 2px;">${presentation.runSubtitle}</p>
    </div>
    ${warnHtml}
    <div class="sec-h" style="margin-top: 4px;"><span>Subjects</span></div>
    <table class="b-plan"><tbody>${subjectsHtml}</tbody></table>
    ${stopButtonHtml}
  `;

  const openArchersHubRunBtn = panelRun.querySelector("#openArchersHubRunBtn");
  if (openArchersHubRunBtn) {
    openArchersHubRunBtn.addEventListener("click", () => {
      openExternalUrl("https://archershub.dlsu.edu.ph/");
    });
  }

  const stopBtn = panelRun.querySelector("#stopVigilBtn");
  if (stopBtn) {
    stopBtn.addEventListener("click", async () => {
      if (!isStopConfirming) {
        isStopConfirming = true;
        renderRunPanel();
        if (stopConfirmTimer) clearTimeout(stopConfirmTimer);
        stopConfirmTimer = setTimeout(() => {
          isStopConfirming = false;
          renderRunPanel();
        }, 5000);
      } else {
        if (stopConfirmTimer) clearTimeout(stopConfirmTimer);
        isStopConfirming = false;
        await stopVigil({
          storageApi: { set: storageSet, get: storageGet },
          alarmsApi: typeof chrome !== "undefined" ? chrome?.alarms : null,
          actionApi: typeof chrome !== "undefined" ? chrome?.action : null,
          notificationsApi: typeof chrome !== "undefined" ? chrome?.notifications : null,
        });
        vigilData = { ...(vigilData || {}), state: "stopped" };
        render();
      }
    });
  }
}

function renderReportPanel() {
  if (filterAll) filterAll.setAttribute("aria-pressed", String(reportFilter === "all"));
  if (filterAlerts) filterAlerts.setAttribute("aria-pressed", String(reportFilter === "alerts"));
  if (filterNotices) filterNotices.setAttribute("aria-pressed", String(reportFilter === "notices"));

  if (!reportList) return;
  reportList.replaceChildren();

  if (!ledgerData || ledgerData.length === 0) {
    reportList.innerHTML = '<p class="empty">No events recorded yet.</p>';
    return;
  }

  const entries = filterLedgerEntries(ledgerData, reportFilter);
  if (entries.length === 0) {
    reportList.innerHTML = '<p class="empty">No matching events.</p>';
    return;
  }

  for (const entry of entries) {
    const evDiv = document.createElement("div");
    evDiv.className = "ev";
    evDiv.dataset.tier = entry.tier || "ambient";

    const timeEl = document.createElement("time");
    timeEl.textContent = formatEventTime(entry.timestamp);
    evDiv.appendChild(timeEl);

    const contentDiv = document.createElement("div");
    const titleDiv = document.createElement("div");
    titleDiv.className = "t";
    titleDiv.textContent = entry.title || "";
    contentDiv.appendChild(titleDiv);

    if (entry.cause) {
      const causeDiv = document.createElement("div");
      causeDiv.className = "c";
      causeDiv.textContent = entry.cause;
      contentDiv.appendChild(causeDiv);
    }

    evDiv.appendChild(contentDiv);
    reportList.appendChild(evDiv);
  }
}

function render() {
  if (addCourse) addCourse.disabled = false;
  if (addBtn) addBtn.disabled = false;

  const addRow = addCourse?.closest(".add-row");
  if (addRow) {
    addRow.hidden = false;
  }

  if (planStatus) {
    planStatus.replaceChildren();
  }

  if (planRows) {
    renderPlanRows({
      planRowsElement: planRows,
      plan: currentPlan,
      catalogue: catalogueData,
      onPlanChange: async (newPlan) => {
        currentPlan = newPlan;
        await savePlan(currentPlan);
        render();
      },
    });
  }

  populateAddCourse();
  renderStartControl();
  renderRefusal();
  renderArmButton();
  renderChecklist();
  renderChip();
  renderRunPanel();
  renderReportPanel();
}

// Report Filters & Export Handlers
for (const [btn, filter] of [
  [filterAll, "all"],
  [filterAlerts, "alerts"],
  [filterNotices, "notices"],
]) {
  if (btn) {
    btn.addEventListener("click", () => {
      reportFilter = filter;
      renderReportPanel();
    });
  }
}

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    exportPassTail({ passTail: passTailData });
  });
}

// Add Course Event Handler
if (addBtn) {
  addBtn.addEventListener("click", async () => {
    const selectedCourseId = addCourse?.value;
    if (!selectedCourseId || !catalogueData?.courses) {
      return;
    }

    const course = catalogueData.courses.find(
      (c) => String(c.courseCreationId) === String(selectedCourseId)
    );
    if (!course || !Array.isArray(course.sections) || course.sections.length === 0) {
      return;
    }

    const firstSection = course.sections[0];
    if (!firstSection || firstSection.sectionCreationId === undefined || firstSection.sectionCreationId === null) {
      return;
    }

    currentPlan = addSubject(
      currentPlan,
      { courseCreationId: course.courseCreationId, courseCode: course.courseCode },
      { sectionCreationId: firstSection.sectionCreationId, sectionCode: firstSection.sectionCode }
    );

    await savePlan(currentPlan);
    render();
  });
}

// Start Mode Segmented Control Handlers
if (startNowBtn) {
  startNowBtn.addEventListener("click", async () => {
    startMode = "now";
    currentPlan.startMode = "now";
    await savePlan(currentPlan);
    renderStartControl();
    renderArmButton();
    renderChecklist();
  });
}

if (startAtTimeBtn) {
  startAtTimeBtn.addEventListener("click", async () => {
    startMode = "at-time";
    currentPlan.startMode = "at-time";
    await savePlan(currentPlan);
    renderStartControl();
    renderArmButton();
    renderChecklist();
  });
}

if (startTimeInput) {
  startTimeInput.addEventListener("input", async () => {
    currentPlan.startTime = startTimeInput.value;
    await savePlan(currentPlan);
    renderArmButton();
  });
}

// Arm Button Handler
if (armBtn) {
  armBtn.addEventListener("click", async () => {
    armBtn.disabled = true;
    armBtn.textContent = "Checking session…";

    try {
      // 1. Check session liveness over 1 cheap authenticated GET
      const sessionCheck = await checkSession();
      if (!sessionCheck || sessionCheck.loggedIn === false) {
        isRefused = true;
        if (catalogueData) catalogueData.loggedIn = false;
        render();
        return;
      }

      isRefused = false;
      if (catalogueData) catalogueData.loggedIn = true;

      // 2. Perform Arming
      const result = await armVigil({
        plan: currentPlan,
        startMode,
        startTime: startTimeInput?.value,
        storageApi: { set: storageSet, get: storageGet },
        alarmsApi: typeof chrome !== "undefined" ? chrome?.alarms : null,
        actionApi: typeof chrome !== "undefined" ? chrome?.action : null,
      });

      if (result.success) {
        vigilData = result.vigil;
        currentPlan = result.plan;
        selectTab(tabRun);
        render();
      } else {
        if (result.reason === "logged_out") {
          isRefused = true;
        }
        render();
      }
    } catch (err) {
      console.error("Arming failed:", err);
      render();
    }
  });
}

// Main Load Sequence
async function load() {
  try {
    if (planStatus) planStatus.replaceChildren();

    // Remove legacy keys and load stored plan & vigil & reporting state
    await storageRemove(["enlistedSubjects", "executionLog"]);
    const storageResult = await storageGet(["plan", "vigil", "ledger", "passTail", "reconciliation"]);
    currentPlan = storageResult.plan || emptyPlan();
    if (!Array.isArray(currentPlan.subjects)) {
      currentPlan = emptyPlan();
    }

    vigilData = storageResult.vigil || null;
    ledgerData = storageResult.ledger || [];
    passTailData = storageResult.passTail || [];
    reconciliationData = storageResult.reconciliation || null;

    if (currentPlan.startMode) {
      startMode = currentPlan.startMode;
    }
    if (currentPlan.startTime && startTimeInput) {
      startTimeInput.value = currentPlan.startTime.slice(0, 16);
    } else if (startTimeInput && !startTimeInput.value) {
      startTimeInput.value = getDefaultStartTime();
    }

    // Read live catalogue
    const catalogue = await readCatalogue();
    catalogueData = catalogue;

    if (!catalogue || catalogue.loggedIn === false) {
      isRefused = true;
    } else {
      isRefused = false;
      if (catalogue.academicSessionId && currentPlan.academicSessionId !== catalogue.academicSessionId) {
        currentPlan.academicSessionId = catalogue.academicSessionId;
        await savePlan(currentPlan);
      }
    }

    const presentation = getVigilPresentation({ vigil: vigilData, plan: currentPlan, reconciliation: reconciliationData });
    if (presentation.isRunTabState) {
      selectTab(tabRun);
    } else {
      selectTab(tabPlan);
    }

    render();
  } catch (err) {
    console.error("Load failed:", err);
    render();
  }
}

// Live update listener when storage changes in the background
if (typeof chrome !== "undefined" && chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.plan) currentPlan = changes.plan.newValue || emptyPlan();
      if (changes.vigil) vigilData = changes.vigil.newValue || null;
      if (changes.ledger) ledgerData = changes.ledger.newValue || [];
      if (changes.passTail) passTailData = changes.passTail.newValue || [];
      if (changes.reconciliation) reconciliationData = changes.reconciliation.newValue || null;
      render();
    }
  });
}

// Initialize on load
if (typeof document !== "undefined") {
  setupTabs();
  load();
}

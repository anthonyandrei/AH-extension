import { readCatalogue } from "./catalogue.js";
import { emptyPlan, addSubject, removeSubject, setWantedSection, rehydrate } from "./plan.js";

// DOM Elements
const tabPlan = document.getElementById("tabPlan");
const tabRun = document.getElementById("tabRun");
const tabReport = document.getElementById("tabReport");

const panelPlan = document.getElementById("panelPlan");
const panelRun = document.getElementById("panelRun");
const panelReport = document.getElementById("panelReport");

const planRows = document.getElementById("planRows");
const addCourse = document.getElementById("addCourse");
const addBtn = document.getElementById("addBtn");
const planStatus = document.getElementById("planStatus");

// State
let currentPlan = emptyPlan();
let catalogueData = null;

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
function setupTabs() {
  const tabs = [
    { button: tabPlan, panel: panelPlan },
    { button: tabRun, panel: panelRun },
    { button: tabReport, panel: panelReport },
  ];

  function selectTab(selectedButton) {
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
  }

  for (const { button } of tabs) {
    if (button) {
      button.addEventListener("click", () => selectTab(button));
    }
  }

  selectTab(tabPlan);
}

// Render Functions
function renderStatusBanner({ tone, message, buttonText, onButtonClick }) {
  if (planRows) planRows.replaceChildren();
  if (addCourse) addCourse.disabled = true;
  if (addBtn) addBtn.disabled = true;

  const addRow = addCourse?.closest(".add-row");
  if (addRow) {
    addRow.hidden = true;
  }

  if (planStatus) {
    planStatus.replaceChildren();

    const note = document.createElement("div");
    note.className = "note";
    note.dataset.tone = tone;

    const msg = document.createElement("div");
    msg.textContent = message;
    note.appendChild(msg);

    if (buttonText && onButtonClick) {
      const btn = document.createElement("button");
      btn.className = "btn btn-ghost";
      btn.style.marginTop = "8px";
      btn.textContent = buttonText;
      btn.addEventListener("click", onButtonClick);
      note.appendChild(btn);
    }

    planStatus.appendChild(note);
  }
}

function renderLoggedOut() {
  renderStatusBanner({
    tone: "warn",
    message: "You are logged out. Please log in to ArchersHub first.",
    buttonText: "Open ArchersHub",
    onButtonClick: () => {
      if (typeof chrome !== "undefined" && chrome?.tabs?.create) {
        chrome.tabs.create({ url: "https://archershub.dlsu.edu.ph/Enlistment_V2/Index" });
      } else {
        window.open("https://archershub.dlsu.edu.ph/Enlistment_V2/Index", "_blank");
      }
    },
  });
}

function renderError(err) {
  renderStatusBanner({
    tone: "bad",
    message: `Failed to load catalogue: ${err?.message || "Network error"}`,
    buttonText: "Retry",
    onButtonClick: () => {
      load();
    },
  });
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

  if (!planRows) return;
  planRows.replaceChildren();

  const rows = rehydrate(currentPlan, catalogueData);

  for (const row of rows) {
    const tr = document.createElement("tr");

    // 1. Subject code (plain text)
    const tdSubject = document.createElement("td");
    tdSubject.textContent = row.courseCode;
    tr.appendChild(tdSubject);

    // 2. Wanted Section dropdown
    const tdSection = document.createElement("td");
    const select = document.createElement("select");
    select.className = "b-sel";
    select.setAttribute("aria-label", `Wanted section for ${row.courseCode}`);

    if (row.full) {
      const fullOption = new Option(row.sectionCode, String(row.sectionCreationId));
      fullOption.disabled = true;
      fullOption.selected = true;
      select.appendChild(fullOption);
    }

    for (const opt of row.options) {
      const optionEl = new Option(opt.sectionName, String(opt.sectionCreationId));
      optionEl.dataset.sectionCode = opt.sectionCode;
      if (opt.available !== undefined && opt.available !== null) {
        optionEl.dataset.available = String(opt.available);
      }
      if (!row.full && String(opt.sectionCreationId) === String(row.sectionCreationId)) {
        optionEl.selected = true;
      }
      select.appendChild(optionEl);
    }

    if (!row.full && row.sectionCreationId !== undefined && row.sectionCreationId !== null) {
      select.value = String(row.sectionCreationId);
    }

    select.addEventListener("change", async () => {
      const chosenOption = select.options[select.selectedIndex];
      if (!chosenOption) return;
      const sectionCreationId = chosenOption.value;
      const sectionCode = chosenOption.dataset.sectionCode || chosenOption.textContent;
      currentPlan = setWantedSection(currentPlan, row.courseCreationId, {
        sectionCreationId,
        sectionCode,
      });
      await savePlan(currentPlan);
      render();
    });

    tdSection.appendChild(select);
    tr.appendChild(tdSection);

    // 3. Availability text
    const tdAvail = document.createElement("td");
    let availText = "";
    if (row.full) {
      availText = "full now";
    } else {
      const selectedOpt = row.options.find(
        (opt) => String(opt.sectionCreationId) === String(row.sectionCreationId)
      );
      if (selectedOpt) {
        if (selectedOpt.available === 0) {
          availText = "full now";
        } else if (typeof selectedOpt.available === "number") {
          availText = `${selectedOpt.available} left`;
        }
      }
    }
    tdAvail.textContent = availText;
    tr.appendChild(tdAvail);

    // 4. Remove button
    const tdRemove = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.className = "b-x";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove ${row.courseCode}`);
    removeBtn.addEventListener("click", async () => {
      currentPlan = removeSubject(currentPlan, row.courseCreationId);
      await savePlan(currentPlan);
      render();
    });
    tdRemove.appendChild(removeBtn);
    tr.appendChild(tdRemove);

    planRows.appendChild(tr);
  }

  populateAddCourse();
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

// Main Load Sequence
async function load() {
  try {
    if (planStatus) planStatus.replaceChildren();

    // Remove legacy keys and load stored plan
    await storageRemove(["enlistedSubjects", "executionLog"]);
    const storageResult = await storageGet(["plan"]);
    currentPlan = storageResult.plan || emptyPlan();
    if (!Array.isArray(currentPlan.subjects)) {
      currentPlan = emptyPlan();
    }

    // Read live catalogue
    const catalogue = await readCatalogue();
    catalogueData = catalogue;

    if (!catalogue || catalogue.loggedIn === false) {
      renderLoggedOut();
      return;
    }

    if (catalogue.academicSessionId && !currentPlan.academicSessionId) {
      currentPlan.academicSessionId = catalogue.academicSessionId;
      await savePlan(currentPlan);
    }

    render();
  } catch (err) {
    renderError(err);
  }
}

// Initialize on load
setupTabs();
load();


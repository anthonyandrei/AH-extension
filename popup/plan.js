export function idEquals(a, b) {
  return a === b || String(a) === String(b);
}

/**
 * Returns a fresh empty Plan object.
 *
 * @returns {{ academicSessionId: string|null, subjects: Array, startMode: string, startTime: string|null }}
 */
export function emptyPlan() {
  return {
    academicSessionId: null,
    subjects: [],
    startMode: 'at-time',
    startTime: null,
  };
}

/**
 * Normalizes a Plan object with guaranteed field defaults.
 *
 * @param {{ academicSessionId?: string|null, subjects?: Array, startMode?: string, startTime?: string|null }|null|undefined} plan
 * @returns {{ academicSessionId: string|null, subjects: Array, startMode: string, startTime: string|null }}
 */
export function normalizePlan(plan) {
  const currentPlan = plan || emptyPlan();
  return {
    academicSessionId: currentPlan.academicSessionId ?? null,
    subjects: Array.isArray(currentPlan.subjects) ? currentPlan.subjects : [],
    startMode: currentPlan.startMode !== undefined ? currentPlan.startMode : 'at-time',
    startTime: currentPlan.startTime !== undefined ? currentPlan.startTime : null,
  };
}

/**
 * Appends a new subject row to the plan if not already present.
 *
 * @param {{ academicSessionId?: string|null, subjects?: Array, startMode?: string, startTime?: string|null }} plan
 * @param {{ courseCreationId: string|number, courseCode: string }} course
 * @param {{ sectionCreationId: string|number, sectionCode: string }} section
 * @returns {{ academicSessionId: string|null, subjects: Array, startMode: string, startTime: string|null }}
 */
export function addSubject(plan, course, section) {
  const normalized = normalizePlan(plan);
  const subjects = [...normalized.subjects];

  if (
    !course ||
    course.courseCreationId === undefined ||
    course.courseCreationId === null ||
    !section ||
    section.sectionCreationId === undefined ||
    section.sectionCreationId === null
  ) {
    return { ...normalized, subjects };
  }

  const exists = subjects.some((s) => idEquals(s.courseCreationId, course.courseCreationId));

  if (exists) {
    return { ...normalized, subjects };
  }

  const newSubject = {
    courseCreationId: course.courseCreationId,
    courseCode: course.courseCode,
    sectionCreationId: section.sectionCreationId,
    sectionCode: section.sectionCode,
  };

  return {
    ...normalized,
    subjects: [...subjects, newSubject],
  };
}

/**
 * Returns a new plan with the specified subject removed.
 *
 * @param {{ academicSessionId?: string|null, subjects?: Array, startMode?: string, startTime?: string|null }} plan
 * @param {string|number} courseCreationId
 * @returns {{ academicSessionId: string|null, subjects: Array, startMode: string, startTime: string|null }}
 */
export function removeSubject(plan, courseCreationId) {
  const normalized = normalizePlan(plan);
  return {
    ...normalized,
    subjects: normalized.subjects.filter((s) => !idEquals(s.courseCreationId, courseCreationId)),
  };
}

/**
 * Returns a new plan with the Wanted Section replaced for the matching subject row.
 *
 * @param {{ academicSessionId?: string|null, subjects?: Array, startMode?: string, startTime?: string|null }} plan
 * @param {string|number} courseCreationId
 * @param {{ sectionCreationId: string|number, sectionCode: string }} section
 * @returns {{ academicSessionId: string|null, subjects: Array, startMode: string, startTime: string|null }}
 */
export function setWantedSection(plan, courseCreationId, section) {
  const normalized = normalizePlan(plan);
  return {
    ...normalized,
    subjects: normalized.subjects.map((s) => {
      if (idEquals(s.courseCreationId, courseCreationId)) {
        return {
          ...s,
          sectionCreationId: section.sectionCreationId,
          sectionCode: section.sectionCode,
        };
      }
      return { ...s };
    }),
  };
}

/**
 * Rehydrates a stored Plan against a live catalogue into view-model rows.
 *
 * @param {{ academicSessionId?: string|null, subjects?: Array }} storedPlan
 * @param {{ courses?: Array }} catalogue
 * @returns {Array<object>}
 */
export function rehydrate(storedPlan, catalogue) {
  if (!storedPlan || !Array.isArray(storedPlan.subjects)) {
    return [];
  }

  const courses = Array.isArray(catalogue?.courses) ? catalogue.courses : [];

  return storedPlan.subjects.map((subject) => {
    const course = courses.find((c) => idEquals(c.courseCreationId, subject.courseCreationId));

    if (!course) {
      return {
        courseCode: subject.courseCode,
        courseCreationId: subject.courseCreationId,
        sectionCreationId: subject.sectionCreationId,
        sectionCode: subject.sectionCode,
        options: [],
        full: false,
        courseOffered: false,
      };
    }

    const sections = Array.isArray(course.sections) ? course.sections : [];
    const hasSection = sections.some((s) => idEquals(s.sectionCreationId, subject.sectionCreationId));

    return {
      courseCode: subject.courseCode,
      courseCreationId: subject.courseCreationId,
      sectionCreationId: subject.sectionCreationId,
      sectionCode: subject.sectionCode,
      options: sections,
      full: !hasSection,
      courseOffered: true,
    };
  });
}

/**
 * Computes availability display text for a rehydrated plan row.
 * E.g. "full now" for full sections, "X left" for open sections with count, or "" when unknown.
 *
 * @param {object} row
 * @returns {string}
 */
export function computeAvailabilityText(row) {
  if (!row) return "";
  if (row.full) return "full now";

  const selectedOpt = Array.isArray(row.options)
    ? row.options.find((opt) => idEquals(opt.sectionCreationId, row.sectionCreationId))
    : null;

  if (selectedOpt) {
    if (selectedOpt.available === 0) {
      return "full now";
    }
    if (typeof selectedOpt.available === "number") {
      return `${selectedOpt.available} left`;
    }
  }

  return "";
}

/**
 * Renders plan rows into the tbody element.
 *
 * @param {{
 *   planRowsElement: object,
 *   plan: object,
 *   catalogue: object,
 *   onPlanChange?: (newPlan: object) => void,
 *   onRemoveSubject?: (courseCreationId: string|number) => void,
 *   documentImpl?: object,
 *   OptionImpl?: typeof Option
 * }} params
 */
export function renderPlanRows({
  planRowsElement,
  plan,
  catalogue,
  onPlanChange,
  onRemoveSubject,
  documentImpl = typeof document !== "undefined" ? document : null,
  OptionImpl = typeof Option !== "undefined" ? Option : null,
}) {
  if (!planRowsElement || !documentImpl || !OptionImpl) return;

  planRowsElement.replaceChildren();
  const rows = rehydrate(plan, catalogue);

  for (const row of rows) {
    const tr = documentImpl.createElement("tr");

    // 1. Subject code
    const tdSubject = documentImpl.createElement("td");
    tdSubject.textContent = row.courseCode;
    tr.appendChild(tdSubject);

    // 2. Wanted Section dropdown
    const tdSection = documentImpl.createElement("td");
    const select = documentImpl.createElement("select");
    select.className = "b-sel";
    select.setAttribute("aria-label", `Wanted section for ${row.courseCode}`);

    // If section went full (absent from live catalogue), include it as an enabled option
    if (row.full) {
      const fullOption = new OptionImpl(row.sectionCode, String(row.sectionCreationId));
      fullOption.dataset.sectionCode = row.sectionCode;
      fullOption.disabled = false;
      fullOption.selected = true;
      select.appendChild(fullOption);
    }

    for (const opt of row.options) {
      const optionEl = new OptionImpl(opt.sectionName, String(opt.sectionCreationId));
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

    select.addEventListener("change", () => {
      const chosenOption = select.options[select.selectedIndex];
      if (!chosenOption) return;
      const sectionCreationId = chosenOption.value;
      const sectionCode = chosenOption.dataset.sectionCode || chosenOption.textContent;
      const updatedPlan = setWantedSection(plan, row.courseCreationId, {
        sectionCreationId,
        sectionCode,
      });
      if (typeof onPlanChange === "function") {
        onPlanChange(updatedPlan);
      }
    });

    tdSection.appendChild(select);
    tr.appendChild(tdSection);

    // 3. Availability text
    const tdAvail = documentImpl.createElement("td");
    tdAvail.textContent = computeAvailabilityText(row);
    tr.appendChild(tdAvail);

    // 4. Remove button
    const tdRemove = documentImpl.createElement("td");
    const removeBtn = documentImpl.createElement("button");
    removeBtn.className = "b-x";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove ${row.courseCode}`);
    removeBtn.addEventListener("click", () => {
      if (typeof onRemoveSubject === "function") {
        onRemoveSubject(row.courseCreationId);
      } else if (typeof onPlanChange === "function") {
        const updatedPlan = removeSubject(plan, row.courseCreationId);
        onPlanChange(updatedPlan);
      }
    });
    tdRemove.appendChild(removeBtn);
    tr.appendChild(tdRemove);

    planRowsElement.appendChild(tr);
  }
}


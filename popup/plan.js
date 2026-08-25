function idEquals(a, b) {
  return a === b || String(a) === String(b);
}

/**
 * Returns a fresh empty Plan object.
 *
 * @returns {{ academicSessionId: string|null, subjects: Array }}
 */
export function emptyPlan() {
  return {
    academicSessionId: null,
    subjects: [],
  };
}

/**
 * Appends a new subject row to the plan if not already present.
 *
 * @param {{ academicSessionId?: string|null, subjects?: Array }} plan
 * @param {{ courseCreationId: string|number, courseCode: string }} course
 * @param {{ sectionCreationId: string|number, sectionCode: string }} section
 * @returns {{ academicSessionId: string|null, subjects: Array }}
 */
export function addSubject(plan, course, section) {
  const currentPlan = plan || emptyPlan();
  const subjects = Array.isArray(currentPlan.subjects) ? currentPlan.subjects : [];

  if (
    !course ||
    course.courseCreationId === undefined ||
    course.courseCreationId === null ||
    !section ||
    section.sectionCreationId === undefined ||
    section.sectionCreationId === null
  ) {
    return {
      academicSessionId: currentPlan.academicSessionId ?? null,
      subjects: [...subjects],
    };
  }

  const exists = subjects.some((s) => idEquals(s.courseCreationId, course.courseCreationId));

  if (exists) {
    return {
      academicSessionId: currentPlan.academicSessionId ?? null,
      subjects: [...subjects],
    };
  }

  const newSubject = {
    courseCreationId: course.courseCreationId,
    courseCode: course.courseCode,
    sectionCreationId: section.sectionCreationId,
    sectionCode: section.sectionCode,
  };

  return {
    academicSessionId: currentPlan.academicSessionId ?? null,
    subjects: [...subjects, newSubject],
  };
}

/**
 * Returns a new plan with the specified subject removed.
 *
 * @param {{ academicSessionId?: string|null, subjects?: Array }} plan
 * @param {string|number} courseCreationId
 * @returns {{ academicSessionId: string|null, subjects: Array }}
 */
export function removeSubject(plan, courseCreationId) {
  const currentPlan = plan || emptyPlan();
  const subjects = Array.isArray(currentPlan.subjects) ? currentPlan.subjects : [];

  return {
    academicSessionId: currentPlan.academicSessionId ?? null,
    subjects: subjects.filter((s) => !idEquals(s.courseCreationId, courseCreationId)),
  };
}

/**
 * Returns a new plan with the Wanted Section replaced for the matching subject row.
 *
 * @param {{ academicSessionId?: string|null, subjects?: Array }} plan
 * @param {string|number} courseCreationId
 * @param {{ sectionCreationId: string|number, sectionCode: string }} section
 * @returns {{ academicSessionId: string|null, subjects: Array }}
 */
export function setWantedSection(plan, courseCreationId, section) {
  const currentPlan = plan || emptyPlan();
  const subjects = Array.isArray(currentPlan.subjects) ? currentPlan.subjects : [];

  return {
    academicSessionId: currentPlan.academicSessionId ?? null,
    subjects: subjects.map((s) => {
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

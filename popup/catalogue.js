/**
 * ArchersHub course and section catalogue reader for extension popup.
 */

const CATEGORIES = [
  { key: 'CourseDetails', gridType: 0 },
  { key: 'ElectiveCourseDetails', gridType: 0 },
  { key: 'GlobelElectiveCourseDetails', gridType: 1 },
  { key: 'GetRestudyCourseDetails', gridType: 2 },
  { key: 'GetMinorMajorCourseDetails', gridType: 3 },
  { key: 'SpecialCourseDetails', gridType: 4 },
  { key: 'NotEnlistedCourseDetails', gridType: 5 }
];

/**
 * Extracts hidden shell parameters from HTML string of /Enlistment_V2/Index.
 * Returns null if any parameter is missing or HTML is invalid.
 *
 * @param {string} html
 * @returns {{ academicSessionId: string, ruleAllocationId: string, enlistmentRuleId: string } | null}
 */
export function extractShellParams(html) {
  if (typeof html !== 'string' || !html.trim()) {
    return null;
  }

  const academicSessionId = extractInputValueById(html, 'hdfAcademicSessionId');
  const ruleAllocationId = extractInputValueById(html, 'hdfRuleAllocationId');
  const enlistmentRuleId = extractInputValueById(html, 'hdfEnlistmentRuleId');

  if (academicSessionId === null || ruleAllocationId === null || enlistmentRuleId === null) {
    return null;
  }

  return {
    academicSessionId,
    ruleAllocationId,
    enlistmentRuleId
  };
}

function extractInputValueById(html, targetId) {
  const inputTags = html.match(/<input\b[^>]*>/gi);
  if (!inputTags) {
    return null;
  }

  const targetRegex = new RegExp(`\\bid\\s*=\\s*(?:'${targetId}'|"${targetId}"|${targetId}(?=[\\s>]))`, 'i');

  for (const tag of inputTags) {
    if (targetRegex.test(tag)) {
      const valMatch = tag.match(/\bvalue\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/i);
      if (valMatch) {
        return valMatch[1] ?? valMatch[2] ?? valMatch[3];
      }
    }
  }

  return null;
}

/**
 * Parses section name string with optional embedded available slots.
 * E.g. "G01 {Avail. Slots: 38}" -> { sectionCode: "G01", available: 38 }
 * E.g. "G01" -> { sectionCode: "G01", available: null }
 *
 * @param {string} name
 * @returns {{ sectionCode: string, available: number | null }}
 */
export function parseSectionName(name) {
  if (typeof name !== 'string') {
    return { sectionCode: '', available: null };
  }

  const trimmed = name.trim();
  const match = trimmed.match(/^(.*?)\s*\{Avail\.\s*Slots:\s*(\d+)\}\s*$/i);
  if (match) {
    return {
      sectionCode: match[1].trim(),
      available: parseInt(match[2], 10)
    };
  }

  return {
    sectionCode: trimmed,
    available: null
  };
}

/**
 * Builds CourseList array for section requests from GetAllCourseSectionData response.
 *
 * @param {object} allCourseData
 * @returns {Array<{ COURSE_CREATION_ID: number, CROSS_OFFER: number, GRID_TYPE: number }>}
 */
export function buildCourseList(allCourseData) {
  if (!allCourseData || typeof allCourseData !== 'object') {
    return [];
  }

  const courseList = [];
  const seen = new Set();

  for (const { key, gridType } of CATEGORIES) {
    const items = allCourseData[key];
    if (Array.isArray(items)) {
      for (const course of items) {
        if (!course || course.COURSE_CREATION_ID === undefined || course.COURSE_CREATION_ID === null) {
          continue;
        }
        if (seen.has(course.COURSE_CREATION_ID)) {
          continue;
        }
        seen.add(course.COURSE_CREATION_ID);

        let crossOffer;
        if (gridType > 0) {
          crossOffer = 1;
        } else if (course.IS_ONE_WAY_TWO_WAY === 1) {
          crossOffer = 1;
        } else {
          crossOffer = course.CROSS_OFFER !== undefined && course.CROSS_OFFER !== null ? course.CROSS_OFFER : 0;
        }

        courseList.push({
          COURSE_CREATION_ID: course.COURSE_CREATION_ID,
          CROSS_OFFER: crossOffer,
          GRID_TYPE: gridType
        });
      }
    }
  }

  return courseList;
}

/**
 * Serializes courseList and academicSessionId to form-encoded request body.
 *
 * @param {Array<{ COURSE_CREATION_ID: number, CROSS_OFFER: number, GRID_TYPE: number }>} courseList
 * @param {string} academicSessionId
 * @returns {string}
 */
export function sectionRequestBody(courseList, academicSessionId) {
  const params = new URLSearchParams();
  if (academicSessionId !== undefined && academicSessionId !== null) {
    params.set('academicSessionId', String(academicSessionId));
  }
  if (Array.isArray(courseList)) {
    courseList.forEach((course, index) => {
      params.set(`CourseList[${index}][COURSE_CREATION_ID]`, String(course.COURSE_CREATION_ID));
      params.set(`CourseList[${index}][CROSS_OFFER]`, String(course.CROSS_OFFER));
      params.set(`CourseList[${index}][GRID_TYPE]`, String(course.GRID_TYPE));
    });
  }
  return params.toString();
}

/**
 * Reads catalogue data by fetching shell, courses, and section data sequentially.
 *
 * @param {typeof fetch} [fetchImpl=fetch]
 * @returns {Promise<{ loggedIn: boolean, academicSessionId?: string, courses?: Array<object> }>}
 */
export async function readCatalogue(fetchImpl = fetch) {
  const shellResponse = await fetchImpl('/Enlistment_V2/Index', {
    credentials: 'include'
  });

  const html = await shellResponse.text();
  const shellParams = extractShellParams(html);

  if (!shellParams) {
    return { loggedIn: false };
  }

  const allCourseParams = new URLSearchParams({
    academicSessionId: shellParams.academicSessionId,
    ruleAllocationId: shellParams.ruleAllocationId,
    enlistmentRuleId: shellParams.enlistmentRuleId
  });

  const allCourseResponse = await fetchImpl('/Enlistment_V2/GetAllCourseSectionData/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: allCourseParams.toString()
  });

  const allCourseData = await allCourseResponse.json();
  const courseList = buildCourseList(allCourseData);

  const sectionBody = sectionRequestBody(courseList, shellParams.academicSessionId);

  const sectionResponse = await fetchImpl('/Enlistment_V2/GetCourseWiseSectionData/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    body: sectionBody
  });

  const sectionData = await sectionResponse.json();

  const sectionsByCourse = new Map();
  if (Array.isArray(sectionData)) {
    for (const s of sectionData) {
      if (!s) continue;
      const courseId = s.COURSE_CREATION_ID;
      if (!sectionsByCourse.has(courseId)) {
        sectionsByCourse.set(courseId, []);
      }
      const parsed = parseSectionName(s.SECTION_NAME);
      sectionsByCourse.get(courseId).push({
        sectionCreationId: s.SECTION_CREATION_ID,
        sectionName: s.SECTION_NAME,
        sectionCode: parsed.sectionCode,
        available: parsed.available
      });
    }
  }

  const rawCourses = [];
  const seenIds = new Set();

  for (const { key } of CATEGORIES) {
    const items = allCourseData?.[key];
    if (Array.isArray(items)) {
      for (const c of items) {
        if (
          c &&
          c.COURSE_CREATION_ID !== undefined &&
          c.COURSE_CREATION_ID !== null &&
          !seenIds.has(c.COURSE_CREATION_ID)
        ) {
          seenIds.add(c.COURSE_CREATION_ID);
          rawCourses.push(c);
        }
      }
    }
  }

  const courses = rawCourses.map((c) => ({
    courseCreationId: c.COURSE_CREATION_ID,
    courseCode: c.COURSE_CODE,
    courseName: c.COURSE_NAME,
    isRegistered: c.IS_REGISTERED !== undefined && c.IS_REGISTERED !== null ? c.IS_REGISTERED : 0,
    heldSectionCreationId:
      c.SECTION_CREATION_ID !== undefined && c.SECTION_CREATION_ID !== null ? c.SECTION_CREATION_ID : null,
    sections: sectionsByCourse.get(c.COURSE_CREATION_ID) || []
  }));

  return {
    loggedIn: true,
    academicSessionId: shellParams.academicSessionId,
    courses
  };
}

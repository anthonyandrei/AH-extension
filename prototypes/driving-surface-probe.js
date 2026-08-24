// PROTOTYPE — throwaway. Answers #3: DOM automation or HTTP endpoints?
// Paste into the console of a logged-in https://archershub.dlsu.edu.ph/Enlistment_V2/Index
// READ-ONLY. Issues only the two GET-shaped endpoints the page fires on every bind.
// It never touches /Enlistment_V2/SaveEnlistmentData/ — see FINDINGS.md for why.

async function probeReadPath() {
  const v = id => (document.querySelector(id) || {}).value;
  const asid = v('#hdfAcademicSessionId');

  // 1. Course list + what the student already holds.
  const all = await (await fetch('/Enlistment_V2/GetAllCourseSectionData/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: new URLSearchParams({
      academicSessionId: asid,
      ruleAllocationId: v('#hdfRuleAllocationId'),
      enlistmentRuleId: v('#hdfEnlistmentRuleId'),
    }),
  })).json();

  const courses = [...all.CourseDetails, ...all.ElectiveCourseDetails];

  // 2. Sections per course, with live availability in SECTION_NAME.
  const body = new URLSearchParams();
  courses
    .map(c => ({ COURSE_CREATION_ID: c.COURSE_CREATION_ID, CROSS_OFFER: c.CROSS_OFFER ?? 0, GRID_TYPE: 0 }))
    .forEach((o, i) => Object.entries(o).forEach(([k, val]) => body.append(`CourseList[${i}][${k}]`, val)));
  body.append('academicSessionId', asid);

  const secData = await (await fetch('/Enlistment_V2/GetCourseWiseSectionData/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body,
  })).json();

  const byCourse = {};
  secData.SectionDetails.forEach(s => (byCourse[s.COURSE_CREATION_ID] ||= []).push(s));

  // Surface the state (prototype rule 5).
  console.table(courses.map(c => ({
    course: c.COURSE_CODE,
    held: c.IS_REGISTERED == 1,
    heldSection: (byCourse[c.COURSE_CREATION_ID] || [])
      .find(s => s.SECTION_CREATION_ID == c.SECTION_CREATION_ID)?.SECTION_NAME ?? '',
    sectionsOffered: (byCourse[c.COURSE_CREATION_ID] || []).length,
  })));

  console.log('DOM rows bound right now:', document.querySelectorAll('#tblRegularCourses tbody tr').length);
  return { all, secData, byCourse, courses };
}

probeReadPath();

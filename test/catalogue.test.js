import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractShellParams,
  parseSectionName,
  buildCourseList,
  sectionRequestBody,
  readCatalogue,
  ARCHERSHUB_BASE_URL,
  extractUniqueCourses
} from '../popup/catalogue.js';

describe('extractShellParams', () => {
  it('extracts academicSessionId, ruleAllocationId, and enlistmentRuleId from standard HTML with id before value', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Enlistment</title></head>
        <body>
          <input type="hidden" id="hdfAcademicSessionId" value="84" />
          <input type="hidden" id="hdfRuleAllocationId" value="1052" />
          <input type="hidden" id="hdfEnlistmentRuleId" value="3041" />
        </body>
      </html>
    `;
    const params = extractShellParams(html);
    assert.deepEqual(params, {
      academicSessionId: '84',
      ruleAllocationId: '1052',
      enlistmentRuleId: '3041'
    });
  });

  it('extracts parameters regardless of attribute order (e.g. value before id)', () => {
    const html = `
      <div>
        <input name="academicSession" value="99" id="hdfAcademicSessionId" />
        <input value="2001" name="ruleAlloc" type="hidden" id="hdfRuleAllocationId" />
        <input type="hidden" value="4002" id="hdfEnlistmentRuleId" class="hidden-field" />
      </div>
    `;
    const params = extractShellParams(html);
    assert.deepEqual(params, {
      academicSessionId: '99',
      ruleAllocationId: '2001',
      enlistmentRuleId: '4002'
    });
  });

  it('handles single quotes, double quotes, and extra whitespace in attributes', () => {
    const html = `
      <input   id = 'hdfAcademicSessionId'   value = '123'  />
      <input   value="456"   id="hdfRuleAllocationId"   />
      <input id='hdfEnlistmentRuleId' value="789" />
    `;
    const params = extractShellParams(html);
    assert.deepEqual(params, {
      academicSessionId: '123',
      ruleAllocationId: '456',
      enlistmentRuleId: '789'
    });
  });

  it('returns null if any of the three required hidden fields is missing', () => {
    const missingEnlistmentRule = `
      <input id="hdfAcademicSessionId" value="84" />
      <input id="hdfRuleAllocationId" value="1052" />
    `;
    assert.equal(extractShellParams(missingEnlistmentRule), null);

    const missingRuleAllocation = `
      <input id="hdfAcademicSessionId" value="84" />
      <input id="hdfEnlistmentRuleId" value="3041" />
    `;
    assert.equal(extractShellParams(missingRuleAllocation), null);

    const missingAcademicSession = `
      <input id="hdfRuleAllocationId" value="1052" />
      <input id="hdfEnlistmentRuleId" value="3041" />
    `;
    assert.equal(extractShellParams(missingAcademicSession), null);
  });

  it('returns null when given login page HTML lacking enlistment fields', () => {
    const loginHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <form action="/Account/Login" method="post">
            <input type="text" id="UserName" name="UserName" />
            <input type="password" id="Password" name="Password" />
            <button type="submit">Log in</button>
          </form>
        </body>
      </html>
    `;
    assert.equal(extractShellParams(loginHtml), null);
  });

  it('returns null for empty or non-string input', () => {
    assert.equal(extractShellParams(''), null);
    assert.equal(extractShellParams(null), null);
    assert.equal(extractShellParams(undefined), null);
  });
});

describe('parseSectionName', () => {
  it('parses standard section name with positive available slots', () => {
    const result = parseSectionName('G01 {Avail. Slots: 38}');
    assert.deepEqual(result, {
      sectionCode: 'G01',
      available: 38
    });
  });

  it('parses section name with 0 available slots to available: 0 (not null or dropped)', () => {
    const result = parseSectionName('Z18 {Avail. Slots: 0}');
    assert.deepEqual(result, {
      sectionCode: 'Z18',
      available: 0
    });
    assert.equal(result.available, 0);
  });

  it('parses section name with no braces to available: null', () => {
    const result = parseSectionName('G01');
    assert.deepEqual(result, {
      sectionCode: 'G01',
      available: null
    });
  });

  it('parses various section code formats and trims whitespace', () => {
    const result1 = parseSectionName('  S11 {Avail. Slots: 5}  ');
    assert.deepEqual(result1, {
      sectionCode: 'S11',
      available: 5
    });

    const result2 = parseSectionName('EK');
    assert.deepEqual(result2, {
      sectionCode: 'EK',
      available: null
    });

    const result3 = parseSectionName('C33 {Avail. Slots: 100}');
    assert.deepEqual(result3, {
      sectionCode: 'C33',
      available: 100
    });
  });
});

describe('buildCourseList', () => {
  it('assigns correct GRID_TYPE for all 7 course detail categories', () => {
    const allCourseData = {
      CourseDetails: [{ COURSE_CREATION_ID: 101, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }],
      ElectiveCourseDetails: [{ COURSE_CREATION_ID: 102, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }],
      GlobelElectiveCourseDetails: [{ COURSE_CREATION_ID: 103, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }],
      GetRestudyCourseDetails: [{ COURSE_CREATION_ID: 104, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }],
      GetMinorMajorCourseDetails: [{ COURSE_CREATION_ID: 105, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }],
      SpecialCourseDetails: [{ COURSE_CREATION_ID: 106, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }],
      NotEnlistedCourseDetails: [{ COURSE_CREATION_ID: 107, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }]
    };

    const courseList = buildCourseList(allCourseData);

    assert.deepEqual(courseList, [
      { COURSE_CREATION_ID: 101, CROSS_OFFER: 0, GRID_TYPE: 0 },
      { COURSE_CREATION_ID: 102, CROSS_OFFER: 0, GRID_TYPE: 0 },
      { COURSE_CREATION_ID: 103, CROSS_OFFER: 1, GRID_TYPE: 1 },
      { COURSE_CREATION_ID: 104, CROSS_OFFER: 1, GRID_TYPE: 2 },
      { COURSE_CREATION_ID: 105, CROSS_OFFER: 1, GRID_TYPE: 3 },
      { COURSE_CREATION_ID: 106, CROSS_OFFER: 1, GRID_TYPE: 4 },
      { COURSE_CREATION_ID: 107, CROSS_OFFER: 1, GRID_TYPE: 5 }
    ]);
  });

  it('sets CROSS_OFFER to 1 when GRID_TYPE > 0 even if course CROSS_OFFER is 0', () => {
    const allCourseData = {
      GlobelElectiveCourseDetails: [{ COURSE_CREATION_ID: 201, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }],
      SpecialCourseDetails: [{ COURSE_CREATION_ID: 202, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }]
    };

    const courseList = buildCourseList(allCourseData);

    assert.deepEqual(courseList, [
      { COURSE_CREATION_ID: 201, CROSS_OFFER: 1, GRID_TYPE: 1 },
      { COURSE_CREATION_ID: 202, CROSS_OFFER: 1, GRID_TYPE: 4 }
    ]);
  });

  it('sets CROSS_OFFER to 1 when GRID_TYPE is 0 and IS_ONE_WAY_TWO_WAY is 1', () => {
    const allCourseData = {
      CourseDetails: [
        { COURSE_CREATION_ID: 301, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 1 }
      ],
      ElectiveCourseDetails: [
        { COURSE_CREATION_ID: 302, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 1 }
      ]
    };

    const courseList = buildCourseList(allCourseData);

    assert.deepEqual(courseList, [
      { COURSE_CREATION_ID: 301, CROSS_OFFER: 1, GRID_TYPE: 0 },
      { COURSE_CREATION_ID: 302, CROSS_OFFER: 1, GRID_TYPE: 0 }
    ]);
  });

  it('preserves course CROSS_OFFER when GRID_TYPE is 0 and IS_ONE_WAY_TWO_WAY is not 1', () => {
    const allCourseData = {
      CourseDetails: [
        { COURSE_CREATION_ID: 401, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 },
        { COURSE_CREATION_ID: 402, CROSS_OFFER: 1, IS_ONE_WAY_TWO_WAY: 0 }
      ],
      ElectiveCourseDetails: [
        { COURSE_CREATION_ID: 403, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }
      ]
    };

    const courseList = buildCourseList(allCourseData);

    assert.deepEqual(courseList, [
      { COURSE_CREATION_ID: 401, CROSS_OFFER: 0, GRID_TYPE: 0 },
      { COURSE_CREATION_ID: 402, CROSS_OFFER: 1, GRID_TYPE: 0 },
      { COURSE_CREATION_ID: 403, CROSS_OFFER: 0, GRID_TYPE: 0 }
    ]);
  });

  it('deduplicates courses so each COURSE_CREATION_ID appears exactly once', () => {
    const allCourseData = {
      CourseDetails: [
        { COURSE_CREATION_ID: 501, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 },
        { COURSE_CREATION_ID: 501, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }
      ],
      NotEnlistedCourseDetails: [
        { COURSE_CREATION_ID: 501, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 },
        { COURSE_CREATION_ID: 502, CROSS_OFFER: 0, IS_ONE_WAY_TWO_WAY: 0 }
      ]
    };

    const courseList = buildCourseList(allCourseData);

    assert.equal(courseList.length, 2);
    assert.equal(courseList[0].COURSE_CREATION_ID, 501);
    assert.equal(courseList[1].COURSE_CREATION_ID, 502);
  });

  it('handles empty or missing course category arrays gracefully', () => {
    assert.deepEqual(buildCourseList({}), []);
    assert.deepEqual(buildCourseList({ CourseDetails: [] }), []);
  });
});

describe('sectionRequestBody', () => {
  it('builds request body with indexed CourseList parameters and academicSessionId', () => {
    const courseList = [
      { COURSE_CREATION_ID: 101, CROSS_OFFER: 0, GRID_TYPE: 0 },
      { COURSE_CREATION_ID: 102, CROSS_OFFER: 1, GRID_TYPE: 2 }
    ];
    const academicSessionId = '84';

    const body = sectionRequestBody(courseList, academicSessionId);
    const params = new URLSearchParams(body);

    assert.equal(params.get('academicSessionId'), '84');
    assert.equal(params.get('CourseList[0][COURSE_CREATION_ID]'), '101');
    assert.equal(params.get('CourseList[0][CROSS_OFFER]'), '0');
    assert.equal(params.get('CourseList[0][GRID_TYPE]'), '0');
    assert.equal(params.get('CourseList[1][COURSE_CREATION_ID]'), '102');
    assert.equal(params.get('CourseList[1][CROSS_OFFER]'), '1');
    assert.equal(params.get('CourseList[1][GRID_TYPE]'), '2');
  });

  it('builds request body for empty course list with academicSessionId', () => {
    const body = sectionRequestBody([], '84');
    const params = new URLSearchParams(body);

    assert.equal(params.get('academicSessionId'), '84');
    assert.equal(params.get('CourseList[0][COURSE_CREATION_ID]'), null);
  });
});

describe('readCatalogue', () => {
  it('returns { loggedIn: false } and aborts further calls when shell params are missing', async () => {
    const calls = [];
    const fakeFetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        status: 200,
        text: async () => '<html><body><form action="/Account/Login"></form></body></html>',
        json: async () => ({})
      };
    };

    const result = await readCatalogue(fakeFetch);

    assert.deepEqual(result, { loggedIn: false });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/Enlistment_V2\/Index/);
  });

  it('executes 3 sequential requests with credentials: "include" and form-encoded bodies on success', async () => {
    const calls = [];
    const fakeFetch = async (url, options) => {
      calls.push({ url: String(url), options });

      if (url.includes('/Enlistment_V2/Index')) {
        return {
          ok: true,
          status: 200,
          text: async () => `
            <input id="hdfAcademicSessionId" value="84" />
            <input id="hdfRuleAllocationId" value="1052" />
            <input id="hdfEnlistmentRuleId" value="3041" />
          `,
          json: async () => ({})
        };
      }

      if (url.includes('GetAllCourseSectionData')) {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => ({
            CourseDetails: [
              {
                COURSE_CREATION_ID: 1001,
                COURSE_CODE: 'CCPROG1',
                COURSE_NAME: 'Prog 1',
                IS_REGISTERED: 1,
                SECTION_CREATION_ID: 1,
                CROSS_OFFER: 0,
                IS_ONE_WAY_TWO_WAY: 0
              },
              {
                COURSE_CREATION_ID: 1002,
                COURSE_CODE: 'BASMATH',
                COURSE_NAME: 'Math 1',
                IS_REGISTERED: 0,
                SECTION_CREATION_ID: null,
                CROSS_OFFER: 0,
                IS_ONE_WAY_TWO_WAY: 0
              }
            ],
            ElectiveCourseDetails: [],
            GlobelElectiveCourseDetails: [],
            GetMinorMajorCourseDetails: [],
            GetRestudyCourseDetails: [],
            SpecialCourseDetails: [],
            NotEnlistedCourseDetails: []
          })
        };
      }

      if (url.includes('GetCourseWiseSectionData')) {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => [
            { COURSE_CREATION_ID: 1001, SECTION_CREATION_ID: 1, SECTION_NAME: 'S11 {Avail. Slots: 10}' },
            { COURSE_CREATION_ID: 1001, SECTION_CREATION_ID: 2, SECTION_NAME: 'S12 {Avail. Slots: 5}' },
            { COURSE_CREATION_ID: 1002, SECTION_CREATION_ID: 3, SECTION_NAME: 'G01 {Avail. Slots: 20}' }
          ]
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await readCatalogue(fakeFetch);

    assert.equal(calls.length, 3);

    // Call 1: Shell GET
    assert.match(calls[0].url, /\/Enlistment_V2\/Index/);

    // Call 2: GetAllCourseSectionData POST with credentials: 'include' and form body
    assert.match(calls[1].url, /GetAllCourseSectionData/);
    assert.equal(calls[1].options.credentials, 'include');
    assert.ok(calls[1].options.body !== undefined);

    // Call 3: GetCourseWiseSectionData POST with credentials: 'include' and form body
    assert.match(calls[2].url, /GetCourseWiseSectionData/);
    assert.equal(calls[2].options.credentials, 'include');
    assert.ok(calls[2].options.body !== undefined);

    // Returned result format in camelCase
    assert.equal(result.loggedIn, true);
    assert.equal(result.academicSessionId, '84');
    assert.equal(result.courses.length, 2);

    assert.equal(result.courses[0].courseCreationId, 1001);
    assert.equal(result.courses[0].courseCode, 'CCPROG1');
    assert.equal(result.courses[0].courseName, 'Prog 1');
    assert.equal(result.courses[0].isRegistered, 1);
    assert.equal(result.courses[0].heldSectionCreationId, 1);
    assert.equal(result.courses[0].sections.length, 2);
    assert.deepEqual(result.courses[0].sections[0], {
      sectionCreationId: 1,
      sectionName: 'S11 {Avail. Slots: 10}',
      sectionCode: 'S11',
      available: 10
    });
    assert.deepEqual(result.courses[0].sections[1], {
      sectionCreationId: 2,
      sectionName: 'S12 {Avail. Slots: 5}',
      sectionCode: 'S12',
      available: 5
    });

    assert.equal(result.courses[1].courseCreationId, 1002);
    assert.equal(result.courses[1].courseCode, 'BASMATH');
    assert.equal(result.courses[1].courseName, 'Math 1');
    assert.equal(result.courses[1].isRegistered, 0);
    assert.equal(result.courses[1].heldSectionCreationId, null);
    assert.equal(result.courses[1].sections.length, 1);
    assert.deepEqual(result.courses[1].sections[0], {
      sectionCreationId: 3,
      sectionName: 'G01 {Avail. Slots: 20}',
      sectionCode: 'G01',
      available: 20
    });
  });

  it('preserves sections with 0 available slots like "Z18 {Avail. Slots: 0}" without dropping them', async () => {
    const fakeFetch = async (url) => {
      if (url.includes('/Enlistment_V2/Index')) {
        return {
          ok: true,
          status: 200,
          text: async () => `
            <input id="hdfAcademicSessionId" value="84" />
            <input id="hdfRuleAllocationId" value="1052" />
            <input id="hdfEnlistmentRuleId" value="3041" />
          `,
          json: async () => ({})
        };
      }

      if (url.includes('GetAllCourseSectionData')) {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => ({
            CourseDetails: [
              {
                COURSE_CREATION_ID: 999,
                COURSE_CODE: 'TEST101',
                COURSE_NAME: 'Testing',
                IS_REGISTERED: 0,
                SECTION_CREATION_ID: null,
                CROSS_OFFER: 0,
                IS_ONE_WAY_TWO_WAY: 0
              }
            ],
            ElectiveCourseDetails: [],
            GlobelElectiveCourseDetails: [],
            GetMinorMajorCourseDetails: [],
            GetRestudyCourseDetails: [],
            SpecialCourseDetails: [],
            NotEnlistedCourseDetails: []
          })
        };
      }

      if (url.includes('GetCourseWiseSectionData')) {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => [
            { COURSE_CREATION_ID: 999, SECTION_CREATION_ID: 88, SECTION_NAME: 'Z18 {Avail. Slots: 0}' },
            { COURSE_CREATION_ID: 999, SECTION_CREATION_ID: 89, SECTION_NAME: 'Z19 {Avail. Slots: 12}' }
          ]
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await readCatalogue(fakeFetch);

    assert.equal(result.loggedIn, true);
    assert.equal(result.academicSessionId, '84');
    assert.equal(result.courses.length, 1);
    assert.equal(result.courses[0].courseCreationId, 999);
    assert.equal(result.courses[0].courseCode, 'TEST101');
    assert.equal(result.courses[0].courseName, 'Testing');

    const sections = result.courses[0].sections;
    assert.equal(sections.length, 2);

    const zeroSlotSection = sections.find((s) => s.sectionName === 'Z18 {Avail. Slots: 0}');
    assert.ok(zeroSlotSection !== undefined, 'Section "Z18 {Avail. Slots: 0}" must be present in output sections array');
    assert.equal(zeroSlotSection.sectionCreationId, 88);
    assert.equal(zeroSlotSection.sectionName, 'Z18 {Avail. Slots: 0}');
    assert.equal(zeroSlotSection.sectionCode, 'Z18');
    assert.equal(zeroSlotSection.available, 0);

    const positiveSlotSection = sections.find((s) => s.sectionName === 'Z19 {Avail. Slots: 12}');
    assert.ok(positiveSlotSection !== undefined, 'Section "Z19 {Avail. Slots: 12}" must be present in output sections array');
    assert.equal(positiveSlotSection.sectionCreationId, 89);
    assert.equal(positiveSlotSection.sectionName, 'Z19 {Avail. Slots: 12}');
    assert.equal(positiveSlotSection.sectionCode, 'Z19');
    assert.equal(positiveSlotSection.available, 12);
  });

  it('maintains original section order from GetCourseWiseSectionData response and handles courses with no sections', async () => {
    const fakeFetch = async (url) => {
      if (url.includes('/Enlistment_V2/Index')) {
        return {
          ok: true,
          status: 200,
          text: async () => `
            <input id="hdfAcademicSessionId" value="84" />
            <input id="hdfRuleAllocationId" value="1052" />
            <input id="hdfEnlistmentRuleId" value="3041" />
          `,
          json: async () => ({})
        };
      }

      if (url.includes('GetAllCourseSectionData')) {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => ({
            CourseDetails: [
              {
                COURSE_CREATION_ID: 701,
                COURSE_CODE: 'C1',
                COURSE_NAME: 'Course 1',
                IS_REGISTERED: 0,
                SECTION_CREATION_ID: null,
                CROSS_OFFER: 0,
                IS_ONE_WAY_TWO_WAY: 0
              },
              {
                COURSE_CREATION_ID: 702,
                COURSE_CODE: 'C2',
                COURSE_NAME: 'Course 2',
                IS_REGISTERED: 0,
                SECTION_CREATION_ID: null,
                CROSS_OFFER: 0,
                IS_ONE_WAY_TWO_WAY: 0
              }
            ],
            ElectiveCourseDetails: [],
            GlobelElectiveCourseDetails: [],
            GetMinorMajorCourseDetails: [],
            GetRestudyCourseDetails: [],
            SpecialCourseDetails: [],
            NotEnlistedCourseDetails: []
          })
        };
      }

      if (url.includes('GetCourseWiseSectionData')) {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => [
            { COURSE_CREATION_ID: 701, SECTION_CREATION_ID: 3, SECTION_NAME: 'Sec Gamma {Avail. Slots: 5}' },
            { COURSE_CREATION_ID: 701, SECTION_CREATION_ID: 1, SECTION_NAME: 'Sec Alpha {Avail. Slots: 12}' },
            { COURSE_CREATION_ID: 701, SECTION_CREATION_ID: 2, SECTION_NAME: 'Sec Beta {Avail. Slots: 0}' }
          ]
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await readCatalogue(fakeFetch);

    assert.equal(result.loggedIn, true);
    assert.equal(result.academicSessionId, '84');
    assert.equal(result.courses.length, 2);

    const c1 = result.courses.find((c) => c.courseCreationId === 701);
    const c2 = result.courses.find((c) => c.courseCreationId === 702);

    assert.ok(c1 !== undefined);
    assert.ok(c2 !== undefined);

    assert.equal(c1.courseCode, 'C1');
    assert.equal(c2.courseCode, 'C2');

    assert.deepEqual(
      c1.sections.map((s) => s.sectionName),
      ['Sec Gamma {Avail. Slots: 5}', 'Sec Alpha {Avail. Slots: 12}', 'Sec Beta {Avail. Slots: 0}']
    );
    assert.deepEqual(
      c1.sections.map((s) => s.sectionCreationId),
      [3, 1, 2]
    );
    assert.deepEqual(
      c1.sections.map((s) => s.sectionCode),
      ['Sec Gamma', 'Sec Alpha', 'Sec Beta']
    );
    assert.deepEqual(
      c1.sections.map((s) => s.available),
      [5, 12, 0]
    );
    assert.deepEqual(c2.sections, []);
  });

  it('uses ARCHERSHUB_BASE_URL (https://archershub.dlsu.edu.ph) as default and supports custom baseUrl', async () => {
    assert.equal(ARCHERSHUB_BASE_URL, 'https://archershub.dlsu.edu.ph');

    const defaultUrls = [];
    const fakeDefaultFetch = async (url) => {
      defaultUrls.push(String(url));
      return {
        ok: true,
        status: 200,
        text: async () => '<input id="hdfAcademicSessionId" value="1" /><input id="hdfRuleAllocationId" value="2" /><input id="hdfEnlistmentRuleId" value="3" />',
        json: async () => ({})
      };
    };

    await readCatalogue(fakeDefaultFetch);
    assert.ok(defaultUrls.length >= 1);
    assert.equal(defaultUrls[0], 'https://archershub.dlsu.edu.ph/Enlistment_V2/Index');

    const customUrls = [];
    const fakeCustomFetch = async (url) => {
      customUrls.push(String(url));
      return {
        ok: true,
        status: 200,
        text: async () => '<input id="hdfAcademicSessionId" value="1" /><input id="hdfRuleAllocationId" value="2" /><input id="hdfEnlistmentRuleId" value="3" />',
        json: async () => ({})
      };
    };

    await readCatalogue(fakeCustomFetch, 'https://test.archershub.local');
    assert.ok(customUrls.length >= 1);
    assert.equal(customUrls[0], 'https://test.archershub.local/Enlistment_V2/Index');
  });
});

describe('extractUniqueCourses', () => {
  it('extracts unique courses across categories and preserves gridType', () => {
    const allCourseData = {
      CourseDetails: [
        { COURSE_CREATION_ID: 10, COURSE_CODE: 'CS1' },
        { COURSE_CREATION_ID: 20, COURSE_CODE: 'CS2' }
      ],
      ElectiveCourseDetails: [
        { COURSE_CREATION_ID: 20, COURSE_CODE: 'CS2' }, // duplicate
        { COURSE_CREATION_ID: 30, COURSE_CODE: 'CS3' }
      ],
      GlobelElectiveCourseDetails: [
        { COURSE_CREATION_ID: 40, COURSE_CODE: 'CS4' }
      ]
    };

    const unique = extractUniqueCourses(allCourseData);

    assert.equal(unique.length, 4);
    assert.deepEqual(unique[0], { course: { COURSE_CREATION_ID: 10, COURSE_CODE: 'CS1' }, gridType: 0 });
    assert.deepEqual(unique[1], { course: { COURSE_CREATION_ID: 20, COURSE_CODE: 'CS2' }, gridType: 0 });
    assert.deepEqual(unique[2], { course: { COURSE_CREATION_ID: 30, COURSE_CODE: 'CS3' }, gridType: 0 });
    assert.deepEqual(unique[3], { course: { COURSE_CREATION_ID: 40, COURSE_CODE: 'CS4' }, gridType: 1 });
  });

  it('returns empty array for invalid or empty input', () => {
    assert.deepEqual(extractUniqueCourses(null), []);
    assert.deepEqual(extractUniqueCourses(undefined), []);
    assert.deepEqual(extractUniqueCourses({}), []);
  });
});

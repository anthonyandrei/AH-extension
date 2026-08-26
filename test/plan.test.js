import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  idEquals,
  emptyPlan,
  normalizePlan,
  addSubject,
  removeSubject,
  setWantedSection,
  rehydrate,
  computeAvailabilityText,
  renderPlanRows,
} from '../popup/plan.js';
import { getVigilPresentation, openExternalUrl } from '../popup/popup.js';

describe('plan module', () => {
  describe('idEquals', () => {
    it('returns true when values are strictly equal', () => {
      assert.equal(idEquals('123', '123'), true);
      assert.equal(idEquals(123, 123), true);
    });

    it('returns true when numeric and string representations match', () => {
      assert.equal(idEquals(123, '123'), true);
      assert.equal(idEquals('123', 123), true);
    });

    it('returns false when values differ', () => {
      assert.equal(idEquals('123', '456'), false);
      assert.equal(idEquals(123, 456), false);
    });
  });

  describe('emptyPlan', () => {
    it('returns a fresh empty plan object shaped { academicSessionId: null, subjects: [], startMode: "at-time", startTime: null }', () => {
      const plan = emptyPlan();
      assert.deepStrictEqual(plan, {
        academicSessionId: null,
        subjects: [],
        startMode: 'at-time',
        startTime: null,
      });
    });

    it('returns a new object instance on subsequent calls', () => {
      const plan1 = emptyPlan();
      const plan2 = emptyPlan();
      assert.deepStrictEqual(plan1, plan2);
      assert.notEqual(plan1, plan2);
      assert.notEqual(plan1.subjects, plan2.subjects);
    });
  });

  describe('normalizePlan', () => {
    it('normalizes null or undefined into empty plan shape', () => {
      assert.deepStrictEqual(normalizePlan(null), {
        academicSessionId: null,
        subjects: [],
        startMode: 'at-time',
        startTime: null,
      });
      assert.deepStrictEqual(normalizePlan(undefined), {
        academicSessionId: null,
        subjects: [],
        startMode: 'at-time',
        startTime: null,
      });
    });

    it('normalizes partial plan objects preserving provided values and defaulting missing fields', () => {
      const partial = {
        academicSessionId: '2026-T1',
        subjects: [{ courseCreationId: 'c1', sectionCreationId: 's1' }],
      };
      assert.deepStrictEqual(normalizePlan(partial), {
        academicSessionId: '2026-T1',
        subjects: [{ courseCreationId: 'c1', sectionCreationId: 's1' }],
        startMode: 'at-time',
        startTime: null,
      });
    });

    it('handles non-array subjects by defaulting to empty array', () => {
      const invalid = { subjects: 'not-an-array', startMode: 'now' };
      assert.deepStrictEqual(normalizePlan(invalid), {
        academicSessionId: null,
        subjects: [],
        startMode: 'now',
        startTime: null,
      });
    });
  });

  describe('addSubject', () => {
    it('appends a new subject row derived from course and section objects and preserves default startMode and startTime', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [],
        startMode: 'at-time',
        startTime: null,
      };
      const course = {
        courseCreationId: 'c101',
        courseCode: 'CS101',
      };
      const section = {
        sectionCreationId: 's101',
        sectionCode: 'S11',
      };

      const updatedPlan = addSubject(initialPlan, course, section);

      assert.deepStrictEqual(updatedPlan, {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
        ],
        startMode: 'at-time',
        startTime: null,
      });
    });

    it('preserves custom startMode and startTime when adding a subject', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      };
      const course = {
        courseCreationId: 'c101',
        courseCode: 'CS101',
      };
      const section = {
        sectionCreationId: 's101',
        sectionCode: 'S11',
      };

      const updatedPlan = addSubject(initialPlan, course, section);

      assert.deepStrictEqual(updatedPlan, {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      });
    });

    it('appends new subject to existing subjects maintaining order and retaining start settings', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
        ],
        startMode: 'at-time',
        startTime: '2026-08-26T07:00:00.000Z',
      };
      const course2 = {
        courseCreationId: 'c102',
        courseCode: 'CS102',
      };
      const section2 = {
        sectionCreationId: 's102',
        sectionCode: 'S12',
      };

      const updatedPlan = addSubject(initialPlan, course2, section2);

      assert.equal(updatedPlan.subjects.length, 2);
      assert.deepStrictEqual(updatedPlan.subjects[1], {
        courseCreationId: 'c102',
        courseCode: 'CS102',
        sectionCreationId: 's102',
        sectionCode: 'S12',
      });
      assert.equal(updatedPlan.startMode, 'at-time');
      assert.equal(updatedPlan.startTime, '2026-08-26T07:00:00.000Z');
    });

    it('returns plan with preserved startMode and startTime if courseCreationId already exists (no duplicates)', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      };
      const course = {
        courseCreationId: 'c101',
        courseCode: 'CS101',
      };
      const sectionA = {
        sectionCreationId: 's101',
        sectionCode: 'S11',
      };
      const sectionB = {
        sectionCreationId: 's102',
        sectionCode: 'S12',
      };

      const planWithOne = addSubject(initialPlan, course, sectionA);
      const planWithDuplicate = addSubject(planWithOne, course, sectionB);

      assert.equal(planWithDuplicate.subjects.length, 1);
      assert.deepStrictEqual(planWithDuplicate.subjects, [
        {
          courseCreationId: 'c101',
          courseCode: 'CS101',
          sectionCreationId: 's101',
          sectionCode: 'S11',
        },
      ]);
      assert.equal(planWithDuplicate.startMode, 'now');
      assert.equal(planWithDuplicate.startTime, '2026-08-26T07:00:00.000Z');
    });

    it('does not mutate the original input plan argument', () => {
      const originalPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c100',
            courseCode: 'CS100',
            sectionCreationId: 's100',
            sectionCode: 'S10',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      };
      const pristineClone = structuredClone(originalPlan);
      const course = { courseCreationId: 'c101', courseCode: 'CS101' };
      const section = { sectionCreationId: 's101', sectionCode: 'S11' };

      const result = addSubject(originalPlan, course, section);

      assert.deepStrictEqual(originalPlan, pristineClone);
      assert.notEqual(result, originalPlan);
    });

    it('returns plan unchanged with startMode and startTime preserved if course or section is invalid or missing IDs', () => {
      const plan = { academicSessionId: '2025-T1', subjects: [], startMode: 'now', startTime: '2026-08-26T07:00:00.000Z' };
      assert.deepStrictEqual(addSubject(plan, null, { sectionCreationId: 's1', sectionCode: 'S1' }), plan);
      assert.deepStrictEqual(addSubject(plan, { courseCode: 'C1' }, { sectionCreationId: 's1', sectionCode: 'S1' }), plan);
      assert.deepStrictEqual(addSubject(plan, { courseCreationId: 'c1', courseCode: 'C1' }, null), plan);
      assert.deepStrictEqual(addSubject(plan, { courseCreationId: 'c1', courseCode: 'C1' }, { sectionCode: 'S1' }), plan);
      assert.deepStrictEqual(addSubject(plan, { courseCreationId: 'c1', courseCode: 'C1' }, { sectionCreationId: null, sectionCode: null }), plan);
    });
  });

  describe('removeSubject', () => {
    it('returns a new plan with only that row removed, other rows untouched, and default startMode and startTime', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
          {
            courseCreationId: 'c102',
            courseCode: 'CS102',
            sectionCreationId: 's102',
            sectionCode: 'S12',
          },
          {
            courseCreationId: 'c103',
            courseCode: 'CS103',
            sectionCreationId: 's103',
            sectionCode: 'S13',
          },
        ],
        startMode: 'at-time',
        startTime: null,
      };

      const updatedPlan = removeSubject(initialPlan, 'c102');

      assert.deepStrictEqual(updatedPlan, {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
          {
            courseCreationId: 'c103',
            courseCode: 'CS103',
            sectionCreationId: 's103',
            sectionCode: 'S13',
          },
        ],
        startMode: 'at-time',
        startTime: null,
      });
    });

    it('preserves custom startMode and startTime when removing a subject', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
          {
            courseCreationId: 'c102',
            courseCode: 'CS102',
            sectionCreationId: 's102',
            sectionCode: 'S12',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      };

      const updatedPlan = removeSubject(initialPlan, 'c101');

      assert.deepStrictEqual(updatedPlan, {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c102',
            courseCode: 'CS102',
            sectionCreationId: 's102',
            sectionCode: 'S12',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      });
    });

    it('returns a plan with identical subjects, startMode, and startTime if courseCreationId is not found', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      };

      const updatedPlan = removeSubject(initialPlan, 'c999');
      assert.deepStrictEqual(updatedPlan.subjects, initialPlan.subjects);
      assert.equal(updatedPlan.startMode, 'now');
      assert.equal(updatedPlan.startTime, '2026-08-26T07:00:00.000Z');
    });

    it('does not mutate the original input plan argument', () => {
      const originalPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
          {
            courseCreationId: 'c102',
            courseCode: 'CS102',
            sectionCreationId: 's102',
            sectionCode: 'S12',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      };
      const pristineClone = structuredClone(originalPlan);

      const result = removeSubject(originalPlan, 'c101');

      assert.deepStrictEqual(originalPlan, pristineClone);
      assert.notEqual(result, originalPlan);
    });
  });

  describe('setWantedSection', () => {
    it('returns a new plan where only the matching row has its section replaced and default startMode and startTime are preserved', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
          {
            courseCreationId: 'c102',
            courseCode: 'CS102',
            sectionCreationId: 's102',
            sectionCode: 'S12',
          },
        ],
        startMode: 'at-time',
        startTime: null,
      };
      const newSection = {
        sectionCreationId: 's999',
        sectionCode: 'S99',
      };

      const updatedPlan = setWantedSection(initialPlan, 'c101', newSection);

      assert.deepStrictEqual(updatedPlan, {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's999',
            sectionCode: 'S99',
          },
          {
            courseCreationId: 'c102',
            courseCode: 'CS102',
            sectionCreationId: 's102',
            sectionCode: 'S12',
          },
        ],
        startMode: 'at-time',
        startTime: null,
      });
    });

    it('preserves custom startMode and startTime when setting a wanted section', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      };
      const newSection = {
        sectionCreationId: 's200',
        sectionCode: 'S20',
      };

      const updatedPlan = setWantedSection(initialPlan, 'c101', newSection);

      assert.deepStrictEqual(updatedPlan, {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's200',
            sectionCode: 'S20',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      });
    });

    it('preserves startMode and startTime when courseCreationId is not found in setWantedSection', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      };
      const newSection = {
        sectionCreationId: 's200',
        sectionCode: 'S20',
      };

      const updatedPlan = setWantedSection(initialPlan, 'c999', newSection);

      assert.deepStrictEqual(updatedPlan.subjects, initialPlan.subjects);
      assert.equal(updatedPlan.startMode, 'now');
      assert.equal(updatedPlan.startTime, '2026-08-26T07:00:00.000Z');
    });

    it('does not mutate the original input plan argument', () => {
      const originalPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
        ],
        startMode: 'now',
        startTime: '2026-08-26T07:00:00.000Z',
      };
      const pristineClone = structuredClone(originalPlan);
      const newSection = {
        sectionCreationId: 's200',
        sectionCode: 'S20',
      };

      const result = setWantedSection(originalPlan, 'c101', newSection);

      assert.deepStrictEqual(originalPlan, pristineClone);
      assert.notEqual(result, originalPlan);
    });
  });

  describe('rehydrate', () => {
    it('returns row view-objects in stored order for normal rows', () => {
      const storedPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's101',
            sectionCode: 'S11',
          },
          {
            courseCreationId: 'c102',
            courseCode: 'CS102',
            sectionCreationId: 's201',
            sectionCode: 'S21',
          },
        ],
      };

      const catalogue = {
        courses: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sections: [
              {
                sectionCreationId: 's101',
                sectionCode: 'S11',
                sectionName: 'CS101 - S11',
                available: 15,
              },
              {
                sectionCreationId: 's102',
                sectionCode: 'S12',
                sectionName: 'CS101 - S12',
                available: 10,
              },
            ],
          },
          {
            courseCreationId: 'c102',
            courseCode: 'CS102',
            sections: [
              {
                sectionCreationId: 's201',
                sectionCode: 'S21',
                sectionName: 'CS102 - S21',
                available: 5,
              },
            ],
          },
        ],
      };

      const rows = rehydrate(storedPlan, catalogue);

      assert.equal(rows.length, 2);
      assert.deepStrictEqual(rows[0], {
        courseCode: 'CS101',
        courseCreationId: 'c101',
        sectionCreationId: 's101',
        sectionCode: 'S11',
        options: catalogue.courses[0].sections,
        full: false,
        courseOffered: true,
      });
      assert.deepStrictEqual(rows[1], {
        courseCode: 'CS102',
        courseCreationId: 'c102',
        sectionCreationId: 's201',
        sectionCode: 'S21',
        options: catalogue.courses[1].sections,
        full: false,
        courseOffered: true,
      });
    });

    it('handles a row whose stored section is absent from catalogue (section went full)', () => {
      const storedPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sectionCreationId: 's_full',
            sectionCode: 'SFULL',
          },
        ],
      };

      const catalogue = {
        courses: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sections: [
              {
                sectionCreationId: 's_open',
                sectionCode: 'SOPEN',
                sectionName: 'CS101 - SOPEN',
                available: 5,
              },
            ],
          },
        ],
      };

      const rows = rehydrate(storedPlan, catalogue);

      assert.equal(rows.length, 1);
      const row = rows[0];

      // Row must still be returned (not dropped)
      assert.equal(row.courseCreationId, 'c101');
      assert.equal(row.courseCode, 'CS101');
      // sectionCreationId and sectionCode must remain the stored values (never reset)
      assert.equal(row.sectionCreationId, 's_full');
      assert.equal(row.sectionCode, 'SFULL');
      // full must be true
      assert.equal(row.full, true);
      // courseOffered must be true
      assert.equal(row.courseOffered, true);
      // options must strictly contain live catalogue sections (no dummy synthesis)
      assert.deepStrictEqual(row.options, catalogue.courses[0].sections);
    });

    it('handles a row whose stored course is not present in catalogue (course no longer offered) without throwing', () => {
      const storedPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c_missing',
            courseCode: 'CS999',
            sectionCreationId: 's999',
            sectionCode: 'S99',
          },
        ],
      };

      const catalogue = {
        courses: [
          {
            courseCreationId: 'c101',
            courseCode: 'CS101',
            sections: [],
          },
        ],
      };

      assert.doesNotThrow(() => {
        const rows = rehydrate(storedPlan, catalogue);
        assert.equal(rows.length, 1);
        const row = rows[0];
        assert.equal(row.courseCreationId, 'c_missing');
        assert.equal(row.courseCode, 'CS999');
        assert.equal(row.sectionCreationId, 's999');
        assert.equal(row.sectionCode, 'S99');
        assert.equal(row.courseOffered, false);
      });
    });

    it('rehydrates mixed rows preserving exact stored order and correctly tagging states', () => {
      const storedPlan = {
        academicSessionId: '2025-T1',
        subjects: [
          {
            courseCreationId: 'c1',
            courseCode: 'MATH101',
            sectionCreationId: 's1_full',
            sectionCode: 'M1',
          },
          {
            courseCreationId: 'c2',
            courseCode: 'ENG101',
            sectionCreationId: 's2_open',
            sectionCode: 'E1',
          },
          {
            courseCreationId: 'c3',
            courseCode: 'HIST101',
            sectionCreationId: 's3_gone',
            sectionCode: 'H1',
          },
        ],
      };

      const catalogue = {
        courses: [
          {
            courseCreationId: 'c2',
            courseCode: 'ENG101',
            sections: [
              {
                sectionCreationId: 's2_open',
                sectionCode: 'E1',
                sectionName: 'ENG101 - E1',
                available: 20,
              },
            ],
          },
          {
            courseCreationId: 'c1',
            courseCode: 'MATH101',
            sections: [
              {
                sectionCreationId: 's1_other',
                sectionCode: 'M2',
                sectionName: 'MATH101 - M2',
                available: 12,
              },
            ],
          },
        ],
      };

      const rows = rehydrate(storedPlan, catalogue);

      assert.equal(rows.length, 3);

      // Row 1: MATH101 (c1), section went full
      assert.equal(rows[0].courseCreationId, 'c1');
      assert.equal(rows[0].courseCode, 'MATH101');
      assert.equal(rows[0].sectionCreationId, 's1_full');
      assert.equal(rows[0].sectionCode, 'M1');
      assert.equal(rows[0].full, true);
      assert.equal(rows[0].courseOffered, true);
      assert.deepStrictEqual(rows[0].options, catalogue.courses[1].sections);

      // Row 2: ENG101 (c2), normal section available
      assert.equal(rows[1].courseCreationId, 'c2');
      assert.equal(rows[1].courseCode, 'ENG101');
      assert.equal(rows[1].sectionCreationId, 's2_open');
      assert.equal(rows[1].sectionCode, 'E1');
      assert.equal(rows[1].full, false);
      assert.equal(rows[1].courseOffered, true);
      assert.deepStrictEqual(rows[1].options, catalogue.courses[0].sections);

      // Row 3: HIST101 (c3), course not in catalogue
      assert.equal(rows[2].courseCreationId, 'c3');
      assert.equal(rows[2].courseCode, 'HIST101');
      assert.equal(rows[2].sectionCreationId, 's3_gone');
      assert.equal(rows[2].sectionCode, 'H1');
      assert.equal(rows[2].courseOffered, false);
    });
  });

  describe('computeAvailabilityText', () => {
    it('returns "full now" when row.full is true', () => {
      const row = { full: true, options: [], sectionCreationId: 's1' };
      assert.equal(computeAvailabilityText(row), 'full now');
    });

    it('returns "full now" when selected section has available === 0', () => {
      const row = {
        full: false,
        sectionCreationId: 's1',
        options: [{ sectionCreationId: 's1', available: 0 }],
      };
      assert.equal(computeAvailabilityText(row), 'full now');
    });

    it('returns "X left" when selected section has available > 0', () => {
      const row = {
        full: false,
        sectionCreationId: 's1',
        options: [{ sectionCreationId: 's1', available: 14 }],
      };
      assert.equal(computeAvailabilityText(row), '14 left');
    });

    it('returns empty string when available is null or section is not found', () => {
      const row1 = {
        full: false,
        sectionCreationId: 's1',
        options: [{ sectionCreationId: 's1', available: null }],
      };
      assert.equal(computeAvailabilityText(row1), '');

      const row2 = {
        full: false,
        sectionCreationId: 's2',
        options: [{ sectionCreationId: 's1', available: 5 }],
      };
      assert.equal(computeAvailabilityText(row2), '');
    });
  });

  describe('renderPlanRows', () => {
    // Helper to create mock DOM elements for plan row rendering tests
    function createMockDom() {
      const createdElements = [];

      class MockElement {
        constructor(tagName) {
          this.tagName = tagName.toUpperCase();
          this.nodeName = tagName.toUpperCase();
          this.children = [];
          this.dataset = {};
          this.attributes = {};
          this.style = {};
          this.textContent = '';
          this.value = '';
          this.disabled = false;
          this.selected = false;
          this._eventListeners = {};
          createdElements.push(this);
        }

        appendChild(child) {
          this.children.push(child);
          return child;
        }

        replaceChildren(...newChildren) {
          this.children = [...newChildren];
        }

        setAttribute(attr, val) {
          this.attributes[attr] = String(val);
        }

        getAttribute(attr) {
          return this.attributes[attr] || null;
        }

        addEventListener(event, handler) {
          if (!this._eventListeners[event]) this._eventListeners[event] = [];
          this._eventListeners[event].push(handler);
        }

        trigger(event) {
          const handlers = this._eventListeners[event] || [];
          for (const h of handlers) h();
        }

        querySelector(selector) {
          const lower = selector.toLowerCase();
          for (const child of this.children) {
            if (child.tagName.toLowerCase() === lower) return child;
            const found = child.querySelector ? child.querySelector(selector) : null;
            if (found) return found;
          }
          return null;
        }

        get options() {
          return this.children.filter((c) => c.tagName === 'OPTION');
        }

        get selectedIndex() {
          const opts = this.options;
          const idx = opts.findIndex((o) => o.selected);
          return idx >= 0 ? idx : 0;
        }
      }

      class MockOption extends MockElement {
        constructor(text = '', value = '') {
          super('option');
          this.textContent = text;
          this.value = value;
        }
      }

      const documentMock = {
        createElement: (tag) => new MockElement(tag),
      };

      return { documentMock, MockOption, MockElement };
    }

    it('renders full section option enabled (not disabled) and marked selected', () => {
      const { documentMock, MockOption, MockElement } = createMockDom();
      const planRowsEl = new MockElement('tbody');

      const plan = {
        academicSessionId: '44',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CSARCH1',
            sectionCreationId: 's_full',
            sectionCode: 'S11',
          },
        ],
      };

      const catalogue = {
        courses: [
          {
            courseCreationId: 'c101',
            courseCode: 'CSARCH1',
            sections: [
              {
                sectionCreationId: 's_open',
                sectionCode: 'S12',
                sectionName: 'S12 {Avail. Slots: 10}',
                available: 10,
              },
            ],
          },
        ],
      };

      renderPlanRows({
        planRowsElement: planRowsEl,
        plan,
        catalogue,
        documentImpl: documentMock,
        OptionImpl: MockOption,
      });

      assert.equal(planRowsEl.children.length, 1);
      const tr = planRowsEl.children[0];

      // TD 1: Subject code
      assert.equal(tr.children[0].textContent, 'CSARCH1');

      // TD 2: Wanted Section select dropdown
      const select = tr.querySelector('select');
      assert.ok(select);
      assert.equal(select.options.length, 2);

      // Option 1: Full section (absent from catalogue)
      const fullOpt = select.options[0];
      assert.equal(fullOpt.value, 's_full');
      assert.equal(fullOpt.textContent, 'S11');
      assert.equal(fullOpt.disabled, false, 'Full section option must NOT be disabled');
      assert.equal(fullOpt.selected, true, 'Full section option must be selected');
      assert.equal(fullOpt.dataset.sectionCode, 'S11');

      // Option 2: Live open section from catalogue
      const openOpt = select.options[1];
      assert.equal(openOpt.value, 's_open');
      assert.equal(openOpt.disabled, false);

      // TD 3: Availability column displays "full now"
      const tdAvail = tr.children[2];
      assert.equal(tdAvail.textContent, 'full now');
    });

    it('renders sections with available === 0 as enabled in dropdown and displays "full now" in availability column', () => {
      const { documentMock, MockOption, MockElement } = createMockDom();
      const planRowsEl = new MockElement('tbody');

      const plan = {
        academicSessionId: '44',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CSARCH1',
            sectionCreationId: 's_zero',
            sectionCode: 'S11',
          },
        ],
      };

      const catalogue = {
        courses: [
          {
            courseCreationId: 'c101',
            courseCode: 'CSARCH1',
            sections: [
              {
                sectionCreationId: 's_zero',
                sectionCode: 'S11',
                sectionName: 'S11 {Avail. Slots: 0}',
                available: 0,
              },
              {
                sectionCreationId: 's_open',
                sectionCode: 'S12',
                sectionName: 'S12 {Avail. Slots: 5}',
                available: 5,
              },
            ],
          },
        ],
      };

      renderPlanRows({
        planRowsElement: planRowsEl,
        plan,
        catalogue,
        documentImpl: documentMock,
        OptionImpl: MockOption,
      });

      const tr = planRowsEl.children[0];
      const select = tr.querySelector('select');
      assert.ok(select);
      const zeroOpt = select.options[0];

      assert.equal(zeroOpt.value, 's_zero');
      assert.equal(zeroOpt.disabled, false, '0-slot section must NOT be disabled');
      assert.equal(zeroOpt.selected, true);

      const tdAvail = tr.children[2];
      assert.equal(tdAvail.textContent, 'full now');
    });

    it('allows changing wanted section and calls onPlanChange with updated plan', async () => {
      const { documentMock, MockOption, MockElement } = createMockDom();
      const planRowsEl = new MockElement('tbody');

      const plan = {
        academicSessionId: '44',
        subjects: [
          {
            courseCreationId: 'c101',
            courseCode: 'CSARCH1',
            sectionCreationId: 's_open',
            sectionCode: 'S12',
          },
        ],
      };

      const catalogue = {
        courses: [
          {
            courseCreationId: 'c101',
            courseCode: 'CSARCH1',
            sections: [
              {
                sectionCreationId: 's_zero',
                sectionCode: 'S11',
                sectionName: 'S11 {Avail. Slots: 0}',
                available: 0,
              },
              {
                sectionCreationId: 's_open',
                sectionCode: 'S12',
                sectionName: 'S12 {Avail. Slots: 5}',
                available: 5,
              },
            ],
          },
        ],
      };

      let changedPlan = null;

      renderPlanRows({
        planRowsElement: planRowsEl,
        plan,
        catalogue,
        onPlanChange: (updated) => {
          changedPlan = updated;
        },
        documentImpl: documentMock,
        OptionImpl: MockOption,
      });

      const tr = planRowsEl.children[0];
      const select = tr.querySelector('select');
      assert.ok(select);

      // Switch selection to s_zero (full section)
      select.options[0].selected = true;
      select.options[1].selected = false;
      select.trigger('change');

      assert.ok(changedPlan);
      assert.equal(changedPlan.subjects[0].sectionCreationId, 's_zero');
      assert.equal(changedPlan.subjects[0].sectionCode, 'S11');
    });
  });

  describe('getVigilPresentation', () => {
    it('returns default presentation when vigil is null or none', () => {
      const res = getVigilPresentation();
      assert.equal(res.state, 'none');
      assert.equal(res.isRunning, false);
      assert.equal(res.chipVisible, false);
      assert.equal(res.showStopButton, false);
    });

    it('returns armed presentation with start time', () => {
      const date = new Date('2026-08-26T07:00:00Z').getTime();
      const res = getVigilPresentation({ vigil: { state: 'armed', nextFireTime: date } });
      assert.equal(res.state, 'armed');
      assert.equal(res.isRunning, true);
      assert.equal(res.chipVisible, true);
      assert.equal(res.chipTone, 'armed');
      assert.ok(res.chipLabel.startsWith('starts '));
      assert.ok(res.runTitle.startsWith('Armed for '));
      assert.equal(res.showStopButton, true);
      assert.equal(res.isRunTabState, true);
    });

    it('returns watching presentation with reconciliation counts', () => {
      const res = getVigilPresentation({
        vigil: { state: 'watching' },
        plan: { subjects: [{ courseCode: 'CS101' }, { courseCode: 'CS102' }] },
        reconciliation: {
          unresolvedCount: 1,
          dispositions: [
            { isSatisfied: true, wantedSectionCode: 'S11' },
            { isSatisfied: false, wantedSectionCode: 'S12' },
          ],
        },
      });
      assert.equal(res.state, 'watching');
      assert.equal(res.isRunning, true);
      assert.equal(res.chipTone, 'live');
      assert.equal(res.chipLabel, 'watching');
      assert.equal(res.runSubtitle, '1 watching, 1 satisfied');
      assert.equal(res.showStopButton, true);
    });

    it('returns suspended presentation with warning tone', () => {
      const res = getVigilPresentation({ vigil: { state: 'suspended' } });
      assert.equal(res.state, 'suspended');
      assert.equal(res.chipTone, 'warn');
      assert.equal(res.chipLabel, 'suspended');
      assert.equal(res.runTitle, 'Suspended');
      assert.equal(res.isSuspended, true);
      assert.equal(res.showStopButton, true);
    });

    it('returns complete presentation with done tone', () => {
      const res = getVigilPresentation({ vigil: { state: 'complete' } });
      assert.equal(res.state, 'complete');
      assert.equal(res.chipTone, 'done');
      assert.equal(res.chipLabel, 'complete');
      assert.equal(res.runTitle, 'Complete');
      assert.equal(res.showStopButton, false);
    });

    it('returns stall and aborted presentations with bad tone', () => {
      const stall = getVigilPresentation({ vigil: { state: 'stall' } });
      assert.equal(stall.chipTone, 'bad');
      assert.equal(stall.chipLabel, 'stall');
      assert.equal(stall.runTitle, 'Stall');

      const aborted = getVigilPresentation({ vigil: { state: 'aborted' } });
      assert.equal(aborted.chipTone, 'bad');
      assert.equal(aborted.chipLabel, 'aborted');
      assert.equal(aborted.runTitle, 'Aborted');
    });
  });

  describe('openExternalUrl', () => {
    it('calls chrome.tabs.create if chrome API is available', () => {
      let createdUrl = null;
      globalThis.chrome = {
        tabs: {
          create: ({ url }) => {
            createdUrl = url;
          },
        },
      };
      openExternalUrl('https://example.com');
      assert.equal(createdUrl, 'https://example.com');
      delete globalThis.chrome;
    });
  });
});

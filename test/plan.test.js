import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyPlan,
  addSubject,
  removeSubject,
  setWantedSection,
  rehydrate,
} from '../popup/plan.js';

describe('plan module', () => {
  describe('emptyPlan', () => {
    it('returns a fresh empty plan object shaped { academicSessionId: null, subjects: [] }', () => {
      const plan = emptyPlan();
      assert.deepStrictEqual(plan, {
        academicSessionId: null,
        subjects: [],
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

  describe('addSubject', () => {
    it('appends a new subject row derived from course and section objects', () => {
      const initialPlan = {
        academicSessionId: '2025-T1',
        subjects: [],
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
      });
    });

    it('appends new subject to existing subjects maintaining order', () => {
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
    });

    it('returns plan unchanged if courseCreationId already exists (no duplicates)', () => {
      const initialPlan = emptyPlan();
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
      };
      const pristineClone = structuredClone(originalPlan);
      const course = { courseCreationId: 'c101', courseCode: 'CS101' };
      const section = { sectionCreationId: 's101', sectionCode: 'S11' };

      const result = addSubject(originalPlan, course, section);

      assert.deepStrictEqual(originalPlan, pristineClone);
      assert.notEqual(result, originalPlan);
    });
  });

  describe('removeSubject', () => {
    it('returns a new plan with only that row removed and other rows untouched', () => {
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
      });
    });

    it('returns a plan with identical subjects if courseCreationId is not found', () => {
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
      };

      const updatedPlan = removeSubject(initialPlan, 'c999');
      assert.deepStrictEqual(updatedPlan.subjects, initialPlan.subjects);
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
      };
      const pristineClone = structuredClone(originalPlan);

      const result = removeSubject(originalPlan, 'c101');

      assert.deepStrictEqual(originalPlan, pristineClone);
      assert.notEqual(result, originalPlan);
    });
  });

  describe('setWantedSection', () => {
    it('returns a new plan where only the matching row has its section replaced', () => {
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
      });
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
      // stored section must appear as the FIRST entry in options
      assert.equal(row.options[0].sectionCreationId, 's_full');
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
      assert.equal(rows[0].options[0].sectionCreationId, 's1_full');

      // Row 2: ENG101 (c2), normal section available
      assert.equal(rows[1].courseCreationId, 'c2');
      assert.equal(rows[1].courseCode, 'ENG101');
      assert.equal(rows[1].sectionCreationId, 's2_open');
      assert.equal(rows[1].sectionCode, 'E1');
      assert.equal(rows[1].full, false);
      assert.equal(rows[1].courseOffered, true);

      // Row 3: HIST101 (c3), course not in catalogue
      assert.equal(rows[2].courseCreationId, 'c3');
      assert.equal(rows[2].courseCode, 'HIST101');
      assert.equal(rows[2].sectionCreationId, 's3_gone');
      assert.equal(rows[2].sectionCode, 'H1');
      assert.equal(rows[2].courseOffered, false);
    });
  });
});

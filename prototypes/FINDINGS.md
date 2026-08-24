# Findings — driving surface probe (#3)

Captured live 2026-08-24 against Anthony's logged-in ArchersHub session. Read-only:
no request was issued to `/Enlistment_V2/SaveEnlistmentData/`.

Primary source: `probe-output/Enlistment_V2.source.js` — the page's own
`Scripts/Enlistment_V2.js`, 9,295 lines, unminified, with the original authors'
comments intact. Line numbers below refer to it.

## The read path works with zero DOM

Both endpoints answered while `#tblRegularCourses` held **0 rows** — no tab click,
no Select2, no lazy bind, no page reload.

| Endpoint | Method | Status | Latency | Returns |
|---|---|---|---|---|
| `/Enlistment_V2/GetAllCourseSectionData/` | POST form | 200 | 235ms | 16 courses, `IS_REGISTERED`, `SECTION_CREATION_ID`, `CREDITS`, requisite flags |
| `/Enlistment_V2/GetCourseWiseSectionData/` | POST form | 200 | 536ms | 102 sections, availability embedded in `SECTION_NAME` |

Params come from hidden fields on the page shell (`#hdfAcademicSessionId`,
`#hdfRuleAllocationId`, `#hdfEnlistmentRuleId`) — present at document load, before
any binding.

`SECTION_NAME` carries availability as text, e.g. `"G01 {Avail. Slots: 36}"` — the
same string the DOM `<option>` shows, because the DOM is built from this response.

**The read path reproduced the known ground truth exactly**: CSC612M (G01),
GERIZAL (Z18, `Avail. Slots:  0`), MSLABS2 (GS6) — the three Saved Slots recorded
in the map's Notes, with `IS_REGISTERED: 1` and the held `SECTION_CREATION_ID`.
Map fact 11 reconfirmed: the held section reads 0.

So the read path alone supplies every input Reconciliation needs — what is held,
which section, how many seats remain — without the DOM existing.

## The write path exists, and it is the same endpoint as Final Submit

`/Enlistment_V2/SaveEnlistmentData/`, POST, `application/json`, **no anti-forgery
token** (no `ajaxSetup`, no `__RequestVerificationToken` anywhere in the file).
Cookie auth only.

The decisive fact: **`#btnEnlistment` and `#btnConfirmEnlistment` call the same
function.** Both reach `SubmitEnlistment()` (L3289) and POST the same payload to
the same URL. The only difference between reserving a slot and irreversibly
committing the enlistment is one integer field:

```js
IS_FINAL_CONFIRM: FinalConfimSubmit,   // L3307
```

- `#btnEnlistment` → `FinalConfimSubmit = 0` (L3269, L3275)
- `#btnConfirmEnlistment` → `FinalConfimSubmit = 1` (L1879, L1885)

Payload shape (L3290–3310), per selected course in `CourseSelectionList`:

```js
{ STUDENT_ID, COURSE_CREATION_ID, SECTION_CREATION_ID, ACTIVE,
  ENROLLMENT_SEMESTER_ID, ENLISTMENT_TYPE: 0, CURRICULUM_CREATION_ID,
  COURSE_CATEGORY_ID }
```

Every field is available from the two read endpoints, so a forged write needs no
DOM at all. Mechanically, HTTP writing is easy. That is the problem, not the
recommendation.

## What the click handler does that a forged POST would skip

`$('#btnEnlistment').click(...)` (L1910) runs ~1,400 lines of client-side
validation before it posts: prerequisite and co-requisite locks, mandatory-course
checks, one-way/two-way equivalence rules, an elective-group minimum, a credit
ceiling, and schedule-clash detection. It also refuses to post at all when a
selected row has no section chosen.

Whether the server re-validates all of this is **unknown and untested** — finding
out costs a live write against a real enlistment record.

## Bearing on the rest of the map

- **Map fact 10 stands and is now decisive.** The DOM binds once per page load, so
  refreshing slot data via the DOM costs a full reload, which destroys the content
  script. `fetch()` refreshes in ~0.8s with the content script alive throughout.
- Map fact 8's endpoint list is confirmed and extended: the full inventory is in
  the primary source (26 `url:` call sites).
- `STUDENT_ENLIST_STATUS: 1` is returned by the read path — a candidate
  surface-independent signal for the state model.

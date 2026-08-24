# ArchersHub Enlistment Automation

A browser extension that reserves course slots for a student on DLSU's ArchersHub at a
scheduled moment, unattended. It reserves; it never commits.

## Language

### Enlistment

**Enlistment Activity**:
The registrar-opened window during which a student may select courses. Outside it, the
enlistment page renders but refuses selection.
_Avoid_: enlistment period, registration window

**Slot**:
A seat in one Section of one Course Offering. Finite and contested — students race for
them the moment the Enlistment Activity opens.
_Avoid_: seat, place

**Course Selection**:
The complete set of subjects and Sections the student is declaring for the term. It is declared
whole, never amended in parts: saving it states the entire set, so a subject left out of it is a
subject given up.
_Avoid_: the course list (that is what the page renders), basket, cart

**Saved Slot**:
A Slot reserved for the student by saving their Course Selection. Reversible, and the
only outcome the automator pursues.
_Avoid_: enlisted course, booked slot, registered course

**Held Section**:
The Section a Saved Slot is in. A subject has at most one.

**Wanted Section**:
The Section the student asked for in a subject. Distinct from the Held Section, which is
what they hold right now. The run is finished with a subject only when the two are the same,
so a backup Section leaves that subject unresolved.
_Avoid_: preferred section, target section

**Final Submit**:
The irreversible act that commits every Saved Slot and locks all further edits. Performed
by the student alone; the automator never performs it under any circumstance.
_Avoid_: submit, confirm, finalise (as bare verbs — always say Final Submit)

**Pending**:
The enlistment status meaning Slots are saved but Final Submit has not happened. The
normal resting state for a successful automated run, not an error.

### Page State

**Page State**:
The single classification of the enlistment page at one instant, derived only from what
is observable right now. Never inferred from what the automator did previously — a page
reload destroys all memory, so history is not a source of truth.
_Avoid_: step, phase, mode

**Classify**:
To derive the current Page State by observation. The run loop classifies, acts once, and
classifies again; it never predicts what the page will do next.

**Settling**:
The Page State meaning the page has not finished loading and no other state is yet
knowable. Distinct from a broken page: the correct response is to look again, not to fail.

**Unrecognised**:
The Page State meaning no known state matches. The run aborts and captures the DOM, on the
principle that an unknown page is never safe to act on. A locked post-Final-Submit page is
expected to land here, having never been observed.

**Reconciliation**:
Comparing what the student asked for against what they currently hold, per subject, to
decide what to do about that subject. Distinct from Page State: Page State answers
*where am I*, Reconciliation answers *what should happen here*.

### Driving

**Driving Surface**:
The interface the automator acts through, chosen separately for reading and writing. Slot data
is **read over HTTP** (`GetAllCourseSectionData`, `GetCourseWiseSectionData`); the Course
Selection is **written through the DOM** by clicking `#btnEnlistment`. The save endpoint exists
and is deliberately never called (ADR-0002).
_Avoid_: scraping (reading is a direct JSON call, not parsing rendered HTML)

### Running

**Pass**:
One cycle of the run loop: Classify the Page State, do Reconciliation for every requested
subject, then save the Course Selection once. The unit of retry — the page saves the whole
Course Selection together, so a single subject can never be retried on its own.
_Avoid_: attempt, iteration, cycle

**Save Gate**:
The check a Pass must pass before it is allowed to save: every Slot the student holds is present
and accounted for in the Course Selection about to be declared. A Pass that cannot satisfy it does
not save at all. It exists because the Course Selection is declared whole — an incomplete one
gives up Slots that nobody meant to give up.
_Avoid_: validation (ArchersHub runs its own, and this is not it)

**Vigil**:
A run with no deadline and no attempt cap. It continues until every subject's Held Section is
its Wanted Section, or until the student stops it. A full Section is hidden rather than shown
as full, so the only way to learn that a Slot opened is to keep looking.
_Avoid_: retry loop, polling loop

### Liveness

**Armed**:
A Vigil that has been scheduled but has not started watching yet. Arming requires a live
session — a Vigil cannot be armed against a logged-out student, because the one precondition
only they can satisfy is being logged in.
_Avoid_: scheduled, pending (Pending means the enlistment status, never the run)

**Suspended**:
A Vigil that has stopped watching because the session is gone, and will resume on its own the
moment it returns. Distinct from a Vigil the student stopped, which does not resume, and from
an abort, which is what an Unrecognised page causes.

**Owned Tab**:
The enlistment tab the automator opens and maintains for itself, as opposed to any tab the
student has open. It is the surface the Course Selection is written through, and it is
disposable: it holds no authentication of its own, since the session lives in the browser
profile and is shared by every tab.
_Avoid_: the enlistment tab (ambiguous — say whose)

### Reporting

**Alert**:
An event the automator raises because the Vigil cannot proceed and only the student can
unstick it: a Suspended session, an abort, or a Stall. Distinct from an event merely worth
knowing — an Alert is a claim on the student's attention, so what qualifies is deliberately
short.
_Avoid_: warning, error (an error is a thing that happened; an Alert is a decision to interrupt)

**Stall**:
A Vigil that is alive but achieving nothing: ten minutes have passed with no complete Pass.
A Pass is complete when it classifies the page, reads what is held, and either satisfies the
Save Gate and saves or correctly finds nothing to do. Distinct from a Vigil that is watching
correctly and finding nothing, which is the normal state of a Vigil and never an Alert.
_Avoid_: hang, stuck, timeout

**Run Report**:
The persisted record of a Vigil, written for the student and read by nobody else. It holds
every notable event with its time and cause, plus a rolling tail of recent Passes. It is never
an input to the run — Reconciliation reads the page, every Pass — so no decision can ever come
to depend on it.
_Avoid_: log (the popup log is a different thing and does not survive the popup closing),
history, audit trail

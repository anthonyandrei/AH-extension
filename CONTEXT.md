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

**Saved Slot**:
A Slot reserved for the student by saving their Course Selection. Reversible, and the
only outcome the automator pursues.
_Avoid_: enlisted course, booked slot, registered course

**Held Section**:
The Section a Saved Slot is in. A subject has at most one.

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

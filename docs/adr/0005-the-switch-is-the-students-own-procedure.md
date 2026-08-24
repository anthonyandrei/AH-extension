# The switch is the student's own procedure, and the Save Gate is what protects the Slot

ADR-0003 left one thing manual on purpose. When a Wanted Section reappears, the Pass was to stop
and tell the student rather than perform the swap, because nobody knew whether changing the
dropdown on a saved row swaps atomically or releases the Held Section first. The student's
invariant is non-negotiable: *never give up a Slot without the other Slot assured.*

Reading ArchersHub's own `Scripts/Enlistment_V2.js` (9,295 lines, unminified) narrowed the
question but did not answer it, and turned up something more dangerous on the way.

**Save & Next posts the whole Course Selection, declaratively.** `EnlistmentArray` is rebuilt
from scratch on every click by walking all seven course tables and pushing every checked row
with that row's current `ddlSection` value (L1979–2013), deduped by `COURSE_CREATION_ID`. One
POST, `COMMAND_TYPE: "INSERT_UPDATE_STUDENT_ENLISTMENT"`.

**There is no drop endpoint anywhere in the file.** `SaveEnlistmentData` is the only write. So
dropping a course can only be expressed by *omitting it from the list*, which means the server
reconciles the posted list against stored state. A submission is a declaration of the whole
desired set, and **a short list is a drop instruction.**

**Holding two Sections of one Course is not expressible.** The dedupe by `COURSE_CREATION_ID`
means one row per course, so "acquire the new Slot, then release the old one" is not an ordering
the page offers. A switch is inherently a replace. The invariant cannot be satisfied by
sequencing — only by trusting the server, or by never switching automatically.

**The server has a dedicated code for the failure.** `data == "4"` renders
*'Section capacity is full !'* (L3568). It is scalar for the whole submission and does not say
which course. Notably, the `4` branch does not refresh course data, where the generic error
branch calls `GetAllCourseSectionData`. The proc's own header comment calls the return
`r_out return value 1 or more`, and `4` sits alongside `1` as a positive guard code, which
*suggests* validate-then-write. That is inference, not proof.

## Decision

**The automator performs exactly the procedure a student performs: set the section dropdown to
the Wanted Section, click `#btnEnlistment`. Nothing more.** Whether that swap is atomic is
ArchersHub's guarantee to make, not ours to discover. We deliberately did not test it.

The invariant is honoured in the only sense available: the automator takes the same risk a human
takes doing the same thing, and adds none of its own. The alternative reading — that we must
*prove* atomicity before automating — would require deliberately provoking a capacity failure
against a live enlistment record, and the student declined that.

**One Wanted Section per subject. No ranked list.** The automator pursues exactly one Section and
never settles for another. It follows that **the automator never takes a backup** — GERIZAL at
Z18 was the student's own hand, and any future backup will be too. Acquire and upgrade are
therefore the same operation stated once: *make the Held Section the Wanted Section.*

**What actually protects the Slot is the Save Gate, not the switch logic.** Given the declarative
POST, the real hazard is a Pass that clicks while the page is incompletely bound and submits a
list that is missing a course. Before every click, all of the following must hold:

- every course the HTTP read says is held is present as a row, still checked, and carrying a
  non-null section id;
- every subject being acted on carries the section id intended for it;
- no checked box has been un-ticked by us — ever.

Any mismatch and the Pass does not click. It reclassifies and tries again, per ADR-0001. This
protects every subject on every Pass, not merely the one being switched, and it is free: the
HTTP read is already happening.

**Every submission is verified against reality afterwards.** Whatever the response, re-read
`GetAllCourseSectionData` and diff the held set against what it was before the click. Unchanged
means a no-change Pass and the interval grows per ADR-0003. A Slot *lost* raises a loud alert —
and **the Vigil keeps running**, because if a Slot has just been released the automator is the
fastest thing available at taking it back, and halting only guarantees it stays lost until the
student wakes up. Note that what it will pursue is the Wanted Section, not the lost backup.

### The Reconciliation table

Fact 13 collapsed "Section does not exist yet" into "Section is full", so five conditions become
six dispositions and none of them are ambiguous:

| Held Section | Wanted Section in the read | Disposition |
|---|---|---|
| none | present | tick the row, select it, save |
| none | absent (full) | nothing; keep watching |
| = Wanted | — | done; leave the row exactly as it is |
| ≠ Wanted | present | set the dropdown to it, save — *the switch* |
| ≠ Wanted | absent (full) | nothing; leave the backup untouched, keep watching |
| held, never requested | — | preserve verbatim in the posted list; never un-tick |

## Considered Options

**Test atomicity on a throwaway subject.** Add a course the student does not want, let it save,
then switch *that* row to a Section known to be full (injected into its dropdown, since full
Sections are hidden) and observe whether the old row survives. Structurally identical to the
GERIZAL case at a fraction of the stakes. Rejected by the student: it mutates a live enlistment
record and briefly consumes a seat someone else may want, to answer a question that is the
system's to answer. The prerequisite and credit-ceiling validation might also have refused an
arbitrary addition, making a negative result uninformative.

**Test atomicity on GERIZAL directly.** The same experiment with the real Slot at risk. Never
seriously in contention.

**Keep the switch manual forever.** ADR-0003's condition made permanent: alert the student and
let them swap by hand. Rejected because it makes the Vigil worthless for the case that motivated
it — a Section that reappears at 03:00 and is gone by 03:02 does not wait for someone to wake up,
and the notification path (issue #9) cannot close a two-minute window reliably.

**Wait until after the term to test.** The answer arrives long after the decision is needed.

**A ranked list of acceptable Sections per subject.** Would unify acquire and upgrade by letting
the automator take a backup itself and climb. Rejected: it asks the student to enumerate
preferences they do not have, and "acceptable" is a judgement they would rather make in the
moment than in a config file written the night before. The cost is real and accepted — if the
Wanted Section is full at the strike moment, the automator holds nothing for that subject and
keeps watching, and taking a backup in the meantime is a manual act.

## Consequences

1. **ADR-0003's manual-switch condition lifts.** The Pass performs the swap; it no longer stops
   to ask.
2. **The Save Gate becomes a precondition of every Pass**, and the most safety-critical code in
   the run. It is what the spec (#7) must specify most carefully.
3. **A `4` response is a no-change Pass**, treated exactly like a Pass that changed nothing —
   with the post-write verification as the backstop, since `4` names no course.
4. **The subject configuration is one Wanted Section per subject**, and the popup (#7, and the
   fog entry on the map) has to collect exactly that.
5. **The automator's write vocabulary is one sentence**: set a section dropdown, click
   `#btnEnlistment`. It never un-ticks, never drops, never Final Submits.
6. **If a switch does lose a Slot, the student finds out immediately and the Vigil is already
   chasing the Wanted Section.** It will not re-take the backup, because the backup was never
   something the automator knew to want.

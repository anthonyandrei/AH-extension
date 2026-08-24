# The popup is Plan, Run and Report, and the Plan is built from ArchersHub's own catalogue

The popup this extension shipped with is a subject list, a datetime picker, and a log that exists
only while the popup is open. Four decisions outgrew all three of them. ADR-0005 fixed the
configuration at **one Wanted Section per subject**. ADR-0004 made the popup the place a Vigil is
**Armed** — and the place arming is **refused**. ADR-0006 made it the renderer of the **Run
Report**, and moved *is it alive* out to the badge, which answers that question from the toolbar
without the popup being opened at all.

So the popup is no longer the status surface. It is the surface where a Vigil is **planned and
armed**, and the surface where you find out **what happened** while you were asleep.

Three shapes were built and driven in all eleven Vigil states before choosing: a state-led single
column with no navigation, three tabs, and a CI-style event feed. They are kept on
`prototype/popup-shape`.

## Decision

### Three tabs: Plan, Run, Report

The popup opens on the tab the current state makes relevant, and all three stay reachable.

- **Plan** — the subjects, each with one Wanted Section, and when to start.
- **Run** — what the Vigil is doing now, the per-subject roster, and **Stop**.
- **Report** — the event ledger, newest first, filterable to Alerts and Notices.

The alternative that came closest had no navigation at all: the Vigil's state picked the screen,
so opening it at 7 a.m. put the answer in the first line and nothing else. It reads better in the
states it was designed for and worse everywhere else — a plan cannot be edited while a Vigil runs
without inventing a way back, which is a tab wearing a disguise. The feed-first shape needed two
structural patches the other two did not: an action row, because a feed reports and offers nothing
to do, and a redirect to its plan screen, because a feed has nothing to be before a run exists.

### Both Plan columns are dropdowns off ArchersHub's own catalogue

Subject and Wanted Section are both chosen from lists the extension reads over HTTP, never typed.
`GetAllCourseSectionData` returns **16 courses** for this student's rule allocation;
`GetCourseWiseSectionData` returns **102 Sections**, with availability embedded in `SECTION_NAME`
as the same `"G01 {Avail. Slots: 36}"` string the DOM `<option>` shows, because the DOM is built
from that response. Both are small enough to put in a `<select>` without apology.

The parameters come from three hidden fields on the page shell, present at document load before
any binding, so a plain `GET` of `/Enlistment_V2/Index` yields them — the same request ADR-0004
already makes to check the session at arming time.

A pasted plan resolved against the catalogue was the alternative, and it looked cheaper to build
until the cost was counted. **It is not cheaper.** Resolving pasted text needs the identical
catalogue read, plus a parser, plus an error state for lines that do not resolve. The only thing
it saves is typing, and the plan is four to eight lines once a term. Free text without resolution
was never on the table: discovering a typo at the strike moment is the failure this surface exists
to prevent.

A **full Section must be selectable.** A Section absent from the dropdown means full (map fact 13),
and a full Section is precisely what a Vigil is for. The list shows every Section with its live
availability, `full now` included, and picking one is normal.

### Starting now and arming for a time are equals

A segmented control, not a checkbox on a scheduling form. Chasing a Section that is full today has
no scheduled moment at all, and that is the more common of the two — the scheduled arm happens one
morning a term.

**A Vigil started now never passes through Armed.** The glossary defines Armed as scheduled but not
yet watching, and a now-start has no such gap: it goes straight to Watching and the badge skips the
grey `•` for the count. Inventing a one-tick Armed phase to tidy the state machine would create a
state nobody can observe.

Arming **refuses a dead session in both modes**, unchanged from ADR-0004. The refusal is a screen,
not a toast: what is wrong, a button that opens ArchersHub, a disabled Arm button, and the
checklist with *logged in* flipped to a failure. The night-before checklist applies to a now-start
too — a Vigil started at noon can still be running at 3 a.m.

### Stop is a popup act, and a stopped Vigil is not a Suspended one

**Stop** lives on the Run tab and takes two presses; the first asks. The two ways a Vigil stops
watching must never be confused, so they are given different vocabulary, different badges, and
different endings:

| | **Suspended** | **Stopped** |
|---|---|---|
| Cause | the session died | the student pressed Stop |
| Badge | `!` amber | empty |
| Resumes | on its own, within 30s of logging back in | never |
| Popup says | *you have to log back in, nothing else* | *it will not resume*, with **Arm again** |

### The Pass tail is exported, not rendered

ADR-0006 gave the Run Report an **event ledger** plus a **rolling tail of the last 200 Passes**,
and had the popup render both. **The tail is no longer rendered.** It is still stored, and the
Report offers an **Export** instead.

Two hundred rows of `no change — Z25 absent` is not something anyone reads in a 460px popup; it is
something you search, and the browser already has tools for that. What actually diagnoses a Stall
is the ledger entry that names its cause — *10 minutes with no complete Pass — Save Gate refusing,
MSLABS2 row not bound* — and that stays in the popup where it is read.

## Consequences

1. **ADR-0006 is amended in one respect.** Its Run Report holds the same two things, but the popup
   renders only the ledger. Storage is unchanged; rendering is not.
2. **Pre-flight validation is dissolved, not deferred.** The map carried it as fog — validating
   subject and Section codes before enlistment day rather than discovering typos mid-race. Building
   the Plan from the catalogue makes an invalid code unexpressible, so there is nothing left to
   validate and no separate check to run. It is a property of the input control now.
3. **The popup needs the catalogue read at plan time**, not only during a run. Same two endpoints,
   same parameters, no Owned Tab required.
4. **Export needs no new permission** if it is a blob anchor rather than `chrome.downloads`.
5. **Stopping is a new transition on the run loop.** A stopped Vigil is a terminal state that
   leaves the plan intact and the badge empty, distinct from every other way a Vigil ends.

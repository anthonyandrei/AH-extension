# Slot data is read over HTTP; the enlistment is written through the DOM

ArchersHub's enlistment page is backed by endpoints that answer perfectly well on their own.
Probing live, `Enlistment_V2/GetAllCourseSectionData` and `GetCourseWiseSectionData` returned
16 courses and 102 sections — including which subjects the student already holds and the live
`{Avail. Slots: N}` on every section — in about 0.8s total, with `#tblRegularCourses` holding
zero rows. No tab activation, no Select2, no lazy bind, no reload. A write endpoint exists too:
`Enlistment_V2/SaveEnlistmentData`, plain JSON, cookie auth, no anti-forgery token, and every
field its payload needs is obtainable from those same two reads.

We split the surfaces. The run polls availability over HTTP and saves the Course Selection by
driving the page: ticking the row, choosing the section, clicking `#btnEnlistment`.

## Considered Options

**Drive everything through the DOM.** Maximum caution — every request originates from
ArchersHub's own code, so nothing is attributable to a script. Rejected on cost: refreshing
slot data through the page requires a full reload, which re-fires every endpoint and every
asset, lands back on `#STEP1`, drops the step-2 bind, and destroys the content script. Polling
that way for hours is both slower and *more* total traffic than a targeted `fetch()`.

**Drive everything over HTTP.** Fastest, and it deletes the fragile Select2 machinery outright.
Rejected on safety. `#btnEnlistment` and `#btnConfirmEnlistment` call the *same* function, POST
the *same* payload to the *same* URL, and differ only in `IS_FINAL_CONFIRM` being `0` or `1`.
Clicking Save & Next cannot perform **Final Submit** because ArchersHub's own handler hard-codes
the `0`; a payload we assemble ourselves puts the irreversible act one integer away from the
automated write path, on a night nobody is watching. The click handler also runs ~1,400 lines of
validation — prerequisites, co-requisites, credit ceiling, equivalence, clash detection — that a
forged POST skips, with no evidence the server re-checks any of it.

**Rate-testing the endpoints to quantify detection risk.** Rejected without trying. Deliberately
probing for bot-detection thresholds is the one action here that would genuinely resemble an
attack, and the account under test is the student's own live enlistment record.

## Consequences

**Reading is cheap, so the retry policy is shaped by contention, not by refresh cost.** A full
refresh is ~0.8s over HTTP with the content script alive throughout, against a reload-and-rebind
cycle for the DOM equivalent. Polling cadence becomes a question of how fast slots turn over and
how much traffic is prudent, not of what the page can survive.

**Polling footprint is now a real design constraint.** Request *shape* is indistinguishable from
the page's own — same origin, same cookie, same headers — but a fixed-interval loop running for
hours is a pattern a human never produces. Cadence must be jittered, narrowed to the target
courses, kept slow until the Enlistment Activity nears, and backed off rather than retried harder
on any `429` or `403`.

**`Step3Reached` survives as the success signal.** On a successful save the page advances itself
to step 3 (`$('a[href="#STEP3"]').tab('show')`), so state 11 still fires and still stops the run.
An HTTP write would have left the DOM on step 2 while the server had moved on, forcing a parallel
success signal and a rework of the Page State model.

**The Page State signal table gains an HTTP column.** It was recorded per surface with that
column left open pending this decision. It is no longer empty: a poll that comes back as the
login page is a cheap `LoggedOut` signal that does not require the background worker to navigate.
The state *names* are unchanged.

**ADR-0001's stateless-classification rule still holds**, though it is no longer the dominant
constraint. Reloads become rare rather than routine, but the page can still reload on its own,
so history remains an illegitimate source of truth.

**The Select2 and lazy-bind handling gets fixed, not deleted.** Ticking a row, waiting for its
section options to be appended, and choosing one stays on the critical path at strike time.

**`SaveEnlistmentData` is documented and never called** — written down so a later reader finds
this analysis rather than rediscovering the endpoint and assuming nobody weighed it.

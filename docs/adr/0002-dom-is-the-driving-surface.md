# The extension drives ArchersHub through the DOM, not its HTTP endpoints

ArchersHub's enlistment page is backed by endpoints that answer perfectly well on their own.
Probing live, `Enlistment_V2/GetAllCourseSectionData` and `GetCourseWiseSectionData` returned
16 courses and 102 sections — including which subjects the student already holds and the live
`{Avail. Slots: N}` on every section — in about 0.8s total, with `#tblRegularCourses` holding
zero rows. No tab activation, no Select2, no lazy bind, no reload. A write endpoint exists too:
`Enlistment_V2/SaveEnlistmentData`, plain JSON, cookie auth, no anti-forgery token. Everything
its payload needs is available from the two read endpoints, so the whole class of DOM problems
could have been deleted. We are not deleting it. The extension reads and writes exclusively
through the page, and refreshes slot data by reloading it.

## Considered Options

**Drive everything over HTTP.** Fastest and simplest, and it removes the fragile machinery
outright. Rejected on two grounds. First, safety: `#btnEnlistment` and `#btnConfirmEnlistment`
call the *same* function, POST the *same* payload to the *same* URL, and differ only in
`IS_FINAL_CONFIRM` being `0` or `1`. Clicking Save & Next cannot perform **Final Submit**
because ArchersHub's own handler hard-codes the `0`; a payload we assemble ourselves puts the
irreversible act one integer away from the automated write path, on a night nobody is watching.
Second, footprint: a forged request is shaped identically to a real one, but a save arriving
without the browsing traffic that normally precedes it is visible in a way a click never is.

**Hybrid — read over HTTP, write through the DOM.** The technically strongest option, and the
one the evidence pointed at. A `fetch()` refresh is *quieter* than the DOM alternative, because
refreshing through the page costs a full reload that re-fires every endpoint and every asset.
Rejected anyway, on the student's judgement: the exposure that matters is not volume but
whether a request could ever be attributed to a script rather than a browser, and every request
the page makes itself is unambiguously the latter. Volume reads as a keen student refreshing.

**Rate-testing the endpoints to quantify the risk.** Rejected without trying. Deliberately
probing for bot-detection thresholds is the one action here that would genuinely resemble an
attack, and the account under test is the student's own live enlistment record.

## Consequences

**Refresh is expensive, and that constrains the retry policy.** The course list binds once per
page load, so fresh slot data costs a full reload. A reload lands on `#STEP1` and drops the
step-2 bind, so every refresh also pays the `a#DivBindCourseList` click and its AJAX. This is
the dominant cost in the run loop and the retry cadence has to be designed around it, not
around network latency.

**The reload destroying the content script is now load-bearing, not incidental.** ADR-0001
already forbids inferring Page State from history. That constraint was a precaution; with
reload-based refresh as the only refresh, it is the thing that makes the loop work at all.

**The Page State model needs no HTTP signals.** Its signal table was recorded per surface with
an HTTP column left open pending this decision. That column stays empty: every state is
classified from the DOM, and `Step3Reached` (`#STEP3.active`) remains the success signal —
which only fires because a DOM save makes the page advance itself to step 3.

**The Select2 and lazy-bind handling has to be fixed rather than deleted.** Ticking a row,
waiting for its section options to be appended, and choosing one stays on the critical path.

**`SaveEnlistmentData` is documented but never called.** Recorded here so a later reader finds
the analysis instead of rediscovering the endpoint and assuming nobody considered it.

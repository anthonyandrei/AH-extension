# The run has no deadline, and retries on one self-adjusting interval

The old run was one-shot: fire at the scheduled moment, take three attempts *per step*, stop.
Nothing ever retried a whole section, so a Slot that was full at 07:00:02 was a Slot lost. What
the student actually needs is the opposite shape. A full Section is hidden from the dropdown
rather than shown with zero availability, so a Slot reappearing is an event you can only learn
by looking again — and the wait for it is measured in hours or days, not seconds. GERIZAL Z25
sits at 15/15 today; capacity rises to 15/30 tomorrow and the Section comes back.

So the run is a **Vigil**. It retries one **Pass** at a time — Classify, reconcile every
requested subject, save the Course Selection once — and it keeps going until every subject's
Held Section is its Wanted Section, or until the student stops it by hand. There is no
wall-clock deadline, no attempt cap, and no circuit breaker.

The wait between Passes is a single number that adjusts itself. It starts at 2s. Every Pass
that changes nothing multiplies it by 1.5, up to a 60s ceiling. A Pass that sees a change — a
Saved Slot appears, or a Section appears in or disappears from a dropdown — resets it to 2s.
Every wait is jittered ±25%.

## Considered Options

**Two named modes: race and watch.** A fast cadence while students compete for Slots, a slow
one while waiting overnight. Rejected: a mode needs a signal to switch on, and the only
available signals are predictions about what the page is about to do. ADR-0001 rules that out,
and one self-adjusting number reproduces both behaviours with no switching logic. The interval
reaches its ceiling within about nine idle Passes, so a Vigil started early is already slow
before anything matters, and the first real change drops it straight back to 2s.

**A wall-clock deadline, or a cap on attempts.** Rejected on the student's judgement: the run
stops when the classes are held, not when a timer says so. Attempt counts are worse than
useless here — across a variable interval, 200 fast Passes and 200 slow ones describe
completely different runs.

**A circuit breaker: back off and alert after N consecutive failures.** Proposed and explicitly
rejected. Repeated `500`s are ArchersHub's ordinary flakiness — the page silently retries them
itself — and a run that pauses on them is a run that is not watching when the Slot opens.

**A per-subject terminal verdict.** Prerequisite-not-met and credit-limit rejections would kill
one subject while the Pass carried on with the rest. Rejected because nobody has observed what
those rejections look like on this page. ADR-0001's rule applies directly: a guessed signal
reads as authoritative in the spec and fails silently on the day. They land in `Unrecognised`,
which aborts, until someone sees a real one.

## Consequences

**An error is never a reason to go faster.** `500`s count as no change, so they grow the
interval. `429` and `403` jump straight to the ceiling. This is the one place the rule bends
away from "reset on anything interesting", and it bends because ADR-0002 puts the polling
footprint on this loop: the request *shape* is indistinguishable from the page's own, but a
metronome held for hours is a pattern no human produces. Hence the jitter, and hence narrowing
the poll to the subjects the student actually asked for.

**Success means held at the Wanted Section, not held at all.** A backup Section leaves the
subject unresolved and the Vigil running. This is what makes the run useful for the Z25 case,
and it is why the run can outlive the Enlistment Activity's opening minutes by days.

**The switch stays manual for now.** When a Wanted Section reappears, the Pass stops and tells
the student rather than performing the swap, because nobody yet knows whether changing the
dropdown on a saved row swaps atomically or releases the Held Section first. The student's
invariant is non-negotiable: never give up a Slot without the other Slot assured. That
condition lifts on its own once the atomicity question is answered.

**Nothing the run writes down is ever read back as truth.** Reconciliation reads what is held,
every Pass, from ArchersHub. Run logs and reports exist to tell the student what happened; they
are never an input to a decision. This is ADR-0001's stateless rule surviving contact with a
loop that now runs for days.

**A run measured in days leans on liveness far harder than one measured in minutes.** Surviving
service-worker eviction, browser restart and machine sleep stops being a nicety. The Vigil also
makes notification load-bearing: a run that stops at "the Section is back, go and take it" is
worthless if nothing wakes the student while the Slot is still there.

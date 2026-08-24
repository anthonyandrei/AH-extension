# The enlistment run is a classify-act loop, not a scripted sequence

The original content script walks a fixed sequence — do step 1, assume step 2, submit, verify
step 3 — where every `await` bets that a particular element will appear. Bets that lose
become long silent waits, which is why a page whose step 1 was already saved hung for 30
seconds three times over on a button that would never be visible. We replaced the sequence
with a loop that classifies the page into one of twelve Page States on each pass, acts once
on that state, and classifies again, deriving the truth only from what is on the page right
now.

## Considered Options

**Fix the script's waits.** Cheapest, and wrong: it treats each hang as its own bug. The
defect is structural — a script that predicts the page is wrong whenever the page disagrees,
and ArchersHub disagrees often (lazy AJAX binds, intermittent `500`s that the page silently
retries, auto-advancing tabs).

**Drive the loop from a `MutationObserver`.** Lower latency than polling, which matters while
racing other students for slots. Rejected: it fires hundreds of times during step 2's bind,
and any transition that mutates no DOM leaves the run asleep indefinitely. A fixed 250ms poll
gives up a couple hundred milliseconds to remove that failure mode entirely.

## Consequences

**Classification must be stateless.** Fresh slot data requires a full page reload, and a
reload destroys the content script. So no state may ever be inferred from history — "I clicked
Save & Next, therefore I am on step 2" is not available. This is a constraint on every future
signal, not just today's twelve.

**Unknown pages stop the run.** There is no state for a post-Final-Submit locked page, because
we have never observed one and will not risk the student's enlistment to find out. It falls to
`Unrecognised`, which aborts and captures the DOM — the evidence that would later promote it to
a named state. A guessed signal would read as authoritative in the spec and fail silently on
enlistment day.

**Transitions need no announcement.** Nothing has to detect that the page moved from step 2 to
step 3; the next pass simply observes it. This is what makes the loop tolerant of a page that
advances, reloads, or stalls on its own schedule.

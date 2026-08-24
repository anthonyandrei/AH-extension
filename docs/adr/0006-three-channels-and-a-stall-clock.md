# Three channels, and a clock that watches for a Vigil doing nothing

An unattended Vigil knows things the student does not. It runs for hours or days with nobody
watching, and the popup log — the only reporting surface the extension has today — exists only
while the popup is open. An unattended run is by definition unobserved.

This ticket was written expecting the loudest moment to be a race. ADR-0003 stopped a Pass when
the Wanted Section reappeared and left the switch to the student, so something had to wake them
while the Slot was still there, in minutes. **ADR-0005 removed that.** The Pass performs the swap
itself. The minutes-long human race no longer exists, and with it went the only event that
genuinely justified waking someone at 3 a.m.

What remains is the inverse of the original premise. The urgent events are not the win. They are
the states where the Vigil **stops being able to watch**, and only the student can restart it.

## Decision

### The four tiers

**Alert — the Vigil cannot proceed and only the student can unstick it.** Notification, badge,
Run Report entry.

- **Suspended.** The session is gone; the Vigil probes at flat 30s and watches nothing.
- **Abort.** An Unrecognised page. The run is over and never resumes on its own.
- **Stall.** New, and the gap the original framing missed — see below.

**Notice — a call to action with no clock on it.** Notification, badge, Run Report entry.

- **Complete.** Every subject holds a Saved Slot at its Wanted Section and the enlistment sits at
  Pending. **Final Submit** is the student's act alone, so this is a call to action — but Pending
  is a stable resting state, so it can wait until morning.
- **Lost Slot.** The post-write diff of ADR-0005 found a held Slot gone. Deliberately demoted from
  Alert: the Vigil is already chasing that Section and is faster at it than the student, so waking
  them buys only the option to take a manual backup.

**Ambient — badge and Run Report only, never a notification.** A subject acquired or upgraded; the
Vigil armed, started, resumed from Suspended, or resumed after a browser restart.

**Recorded — the rolling Pass tail only.** Transient `500`/`429`/`403`, no-change Passes, single
Save Gate refusals, Owned Tab reloads, worker evictions.

### A Stall is ten minutes with no complete Pass

ADR-0004 guarantees the extension is *alive*. It guarantees nothing about the Vigil being *useful*.
A Vigil whose Save Gate refuses every Pass, or that is pinned at the 60s ceiling by a `403`, looks
identical from outside to one that is watching correctly — same alarms, same badge, same silence.

One counter covers every way that happens. A Pass is **complete** when it classifies the page,
reads the held set over HTTP, and either satisfies the Save Gate and clicks or correctly finds
nothing to do. Any complete Pass resets the clock; ten minutes without one is a Stall.

Three separate counters were considered — Save Gate refusals, hard-error runs, failed reads — and
rejected. Three numbers to tune are three ways to be wrong, and they all describe the same
condition: the loop is turning and nothing is coming out of it.

**A Vigil that is watching correctly and finding nothing is not a Stall.** That is the normal
state of a Vigil and must never alert.

### Three channels, because each covers the others' failure

- **Badge on the extension icon.** Ambient, persistent, readable without opening anything —
  the answer to *is it still watching*. While watching it shows the **count of subjects not yet at
  their Wanted Section**, so progress reads 3 → 2 → 1 from the toolbar. Alert and Notice states
  differ in shape as well as colour (`!` amber Suspended, `!!` red Stall, `X` dark red Abort,
  `✓` green Complete, `•` grey Armed), so they stay distinguishable at a glance.
- **`chrome.notifications`.** Fires on a *transition*, never on a state — Suspended notifies once
  when the session dies, not on every 30s probe. An unresolved Alert repeats every 30 minutes,
  three times, then goes quiet; the badge stays lit, so the state is never lost.
- **The Run Report** in `chrome.storage.local`, rendered by the popup on open. A notification fires
  once and is gone: if the Suspended state happened at 3 a.m., this is the only evidence it ever
  happened. It holds an **event ledger** (every Alert, Notice and Ambient event with its time and
  cause) plus a **rolling tail of the last 200 Passes** for diagnosing a Stall after the fact.

### Nothing crosses off the machine

All three channels are browser-local. Brave must be running and the Mac awake, which ADR-0004
already requires of the Vigil itself. A Brave notification will not wake a sleeping student, and
two ways to fix that were considered and **ruled out of scope**:

- an `offscreen` document looping audio for Alert events;
- a webhook to a phone (Pushover, ntfy, Discord).

Both were rejected on the same reasoning that reshaped this ADR: the event that needed speed is now
automatic. What is left in the Alert tier is *the watch stopped* — bad, and recoverable in the
morning, where the Slot race was not. A webhook in particular buys a marginal case for a real cost:
a secret in browser storage and a third-party service in the alert path.

### Clicking a notification never drives the page

A click **focuses the Owned Tab wherever it is** and does nothing else. For Suspended that is
exactly right: the tab is already parked on the login page. For Complete it was tempting to drive
the tab to STEP 3 so Final Submit sits one click away — and that is precisely the region of the
page the map forbids automation to approach. The student does the last two clicks themselves.

The **Owned Tab stays open** when the Vigil ends, on Complete and on Abort alike. It gives the
click somewhere to land, and on an Abort it *is* the evidence: it holds the page that could not
be classified.

## Consequences

1. **`manifest.json` gains the `notifications` permission**, and with it the "Display
   notifications" install warning. The badge needs no permission — the `action` key covers it.
2. **The Stall clock is a new obligation on the run loop.** Every Pass must report whether it
   completed, which is a distinction the loop does not currently draw.
3. **The Run Report never feeds the loop.** ADR-0004's constraint is unchanged: Reconciliation
   reads the page, every Pass. The report is write-only from the run's perspective. It is for the
   human, and it cannot become a source of truth by accident.
4. **The popup outgrows its current shape.** It must render the Run Report, arm a Vigil against a
   live session, and collect one Wanted Section per subject. Graduated to its own ticket.
5. **A missed night is an accepted cost.** If the session dies at 2 a.m., the Vigil watches nothing
   until the student wakes, logs in, and the flat 30s probe finds the session within half a minute.

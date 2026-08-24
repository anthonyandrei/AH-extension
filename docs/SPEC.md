# The reliable-enlistment spec

This is the destination [Reliable unattended ArchersHub enlistment](https://github.com/anthonyandrei/AH-extension/issues/1)
was charted for. Every decision below was made and recorded on that map, in `docs/adr/0001`
through `0007`, in `CONTEXT.md`, and in the closed tickets' resolution comments. Nothing here is a
new decision. Where two decisions on the map amended each other, this document states only the
final reading, with the sources named so the trail isn't lost.

Read `CONTEXT.md` first. It defines every capitalised term used below: **Slot**, **Course
Selection**, **Saved Slot**, **Held Section**, **Wanted Section**, **Plan**, **Page State**,
**Pass**, **Save Gate**, **Vigil**, **Armed**, **Suspended**, **Stopped**, **Owned Tab**,
**Alert**, **Stall**, **Run Report**. This spec uses them exactly as defined there, never as a
synonym.

## 1. What the run does, and never does

The run reserves Slots; it never commits them. Success is every requested subject holding a
**Saved Slot** at its **Wanted Section**, with the enlistment status sitting at **Pending**.
**Final Submit**, the click on `#btnConfirmEnlistment`, is the student's act alone. The automator
never clicks it, in any circumstance, in any Page State. Every other rule in this document is
subordinate to this one.

## 2. Deployment constraints

- **Unpacked only.** A packed extension clamps every `chrome.alarms` tick to a 30s floor, which
  caps the Vigil's cadence at 30s and makes the 2s striking interval from §7 unreachable
  ([ADR-0004](adr/0004-liveness-lives-in-the-service-worker.md)). The extension is loaded via
  `brave://extensions` → Developer mode → Load unpacked, from the repo root. Its id is
  `gopnbiblghehihcopemcedmnkhpcillf`, stable as long as the repo stays at this path.
- **Brave, not Chrome.** Chrome is not installed on the target machine. Brave Shields can stay
  **up** for `archershub.dlsu.edu.ph`. Neither the content script (an isolated world) nor
  ArchersHub's own jQuery/Select2 AJAX is affected, verified live.
- **`manifest.json` gains the `notifications` permission** for §10's channel, alongside the
  existing `storage`, `alarms`, `tabs`. Both `/Enlistment_V2/*` and `/Enlistment/*` match
  patterns stay, matching the code paths in §14.
- **The student's own precondition, not the extension's:** logged in at the moment of arming
  (checked automatically, §9), the Mac awake with the lid open, and Brave running. macOS sleeps
  on lid-close regardless of software, and a sleeping machine watches nothing.

## 3. The Plan

A **Plan** is the set of subjects the student wants, each with exactly one Wanted Section, no
ranked list, no backup, plus when the Vigil starts. The automator never takes a backup on its own
initiative. A Section held that was never requested is preserved, never chased, never un-ticked
([ADR-0005](adr/0005-the-switch-is-the-students-own-procedure.md)).

Both the subject list and the Wanted Section list are dropdowns populated from ArchersHub's own
catalogue, read over HTTP, never typed and never pasted:

- `GetAllCourseSectionData` returns the ~16 courses in this student's rule allocation.
- `GetCourseWiseSectionData` returns the ~102 Sections across them, availability embedded in each
  `SECTION_NAME` as `"G01 {Avail. Slots: 36}"`. That's the same string the DOM `<option>` shows,
  because the DOM is built from this response.

Both take their parameters from three hidden fields present on the page shell at document load
(`#hdfAcademicSessionId`, `#hdfRuleAllocationId`, `#hdfEnlistmentRuleId`), so a plain
`GET /Enlistment_V2/Index` yields them. It's the same request §9 makes to check the session at
arming time. This makes an invalid subject or Section code unexpressible, which is why there is
no separate pre-flight validation step (§16). A full Section must remain selectable: a Section
absent from the dropdown means full, not nonexistent (§6, fact 13), and a full Section is exactly
what a Vigil exists to watch for.

When to start is a choice between equals, a segmented control (`Now` / `At a set time`), not a
checkbox on a scheduling form. Starting now never passes through **Armed**: there is no gap
between scheduling and watching, so the badge (§10) skips the grey `•`. Both modes refuse to arm
against a dead session (§9), and the night-before checklist (§11) applies to both, because a Vigil
started at noon can still be running at 3 a.m.

## 4. Vigil lifecycle

A **Vigil** has no deadline and no attempt cap. It is a state distinct from **Page State** (§6):
Page State is where the page is right now, Vigil state is what the run is doing.

| State | Meaning | Enters from | Leaves to |
|---|---|---|---|
| **Armed** | Scheduled, not yet watching. Skipped entirely by a now-start. | Plan armed for a future time | Watching, at the start time |
| **Watching** | Running Passes (§7) against the requested subjects. | Armed's start time, or immediately on a now-start | Suspended, Stopped, Complete, or Aborted |
| **Suspended** | Session gone. Probes flat 30s; watches nothing. | `LoggedOut` observed mid-Vigil | Watching, within 30s of the student logging back in |
| **Stopped** | The student pressed Stop. Plan left intact; never resumes. | A Watching or Suspended Vigil, by hand | terminal |
| **Complete** | Every subject holds its Wanted Section; enlistment at Pending. | Watching, on the Pass that satisfies every subject | terminal |
| **Aborted** | `Unrecognised` page. Never resumes on its own. | Watching or Suspended, on an unrecognised page | terminal |

Suspended and Stopped must never be presented as the same thing. They differ in cause, badge,
whether they resume, and what the popup says (table in §11).

## 5. Driving surface

Reading and writing use different surfaces
([ADR-0002](adr/0002-hybrid-driving-surface.md)):

- **Reads are HTTP.** `GetAllCourseSectionData` and `GetCourseWiseSectionData`, ~0.8s combined,
  content script alive throughout. Both work with `#tblRegularCourses` holding zero rows: no tab
  activation, no Select2, no lazy bind, no reload required.
- **The write is a DOM click on `#btnEnlistment`.** `#btnEnlistment` and `#btnConfirmEnlistment`
  call the same handler and POST the same payload to the same URL, differing only in
  `IS_FINAL_CONFIRM` being `0` or `1`. ArchersHub's own code hard-codes the `0` for
  `#btnEnlistment`, so a DOM click cannot perform Final Submit, a guarantee a self-assembled HTTP
  POST would not have. The click handler also runs ~1,400 lines of ArchersHub's own validation
  that a forged POST would skip.
- **`SaveEnlistmentData` (the write endpoint) is documented and never called.** Recorded so a
  later reader finds this reasoning rather than rediscovering the endpoint and assuming nobody
  weighed it.
- **The poll never touches the DOM.** Hours of watching are pure HTTP. The DOM only has to be
  correct once, at the instant of striking.

## 6. Page State model

One ordered enum of 12 states, evaluated top to bottom, first match wins. Classification is
stateless: never inferred from what the run did on a previous Pass, because a reload destroys the
content script and the truth is only ever what's on the page right now
([ADR-0001](adr/0001-classify-act-loop.md)).

**BG** = observed by the background worker (no page needed). **CS** = observed by the content
script (a strike is in progress, an Owned Tab is open).

| # | State | Observer | DOM signal | HTTP signal | Action |
|---|---|---|---|---|---|
| 1 | `NoTab` | BG | none | none | Open the Owned Tab at the enlistment URL |
| 2 | `LoggedOut` | BG | Login form (`<title>Login</title>`) if a tab happens to be open | `GET /Enlistment_V2/Index` returns the login page (a 302 to `/`) instead of the enlistment page | **Suspend the Vigil** (§4, §9): park the Owned Tab on the login page, alert, probe flat 30s |
| 3 | `WrongPage` | BG | On `archershub.dlsu.edu.ph`, not `/Enlistment_V2/Index` | Response body is not the enlistment shell | Navigate the Owned Tab to `/Enlistment_V2/Index` |
| 4 | `NotInjected` | BG | A `ping` message goes unanswered | none | Reload the Owned Tab / re-inject |
| 5 | `Settling` | CS | `body.loader-active`, `#MyLoader`, or `.full-page-loader` visible | none | Wait, re-classify; never act on the page underneath |
| 6 | `ActivityClosed` | CS | `#divAlertMessage` visible | none | Keep polling (§7); this is not a failure, the Enlistment Activity is simply closed right now |
| 7 | `Step1Unconfigured` | CS | `#STEP1.active`, `#btnAdd` visible | none | Open Section, click `#btnAdd` |
| 8 | `Step1Configured` | CS | `#btnAdd` present, `display: none` | none | Click `a#DivBindCourseList` |
| 9 | `Step2Unbound` | CS | `#STEP2.active`, `#tblRegularCourses` empty | none | Click `a#DivBindCourseList` |
| 10 | `Step2Bound` | CS | `#STEP2.active`, `#tblRegularCourses` has rows, `#btnEnlistment` visible | Fresh `GetAllCourseSectionData` / `GetCourseWiseSectionData` read backs the DOM before acting | Run Reconciliation (§8) for every requested subject, then `#btnEnlistment` once, subject to the Save Gate |
| 11 | `Step3Reached` | CS | `#STEP3.active` | none | The write's success signal, not the Vigil's: diff the post-write held set (§8), then classify again. The Vigil itself only reaches **Complete** (§4) once every subject is satisfied |
| 12 | `Unrecognised` | CS | Nothing above matched | Nothing above matched | **Abort** (§4): capture the DOM, alert, stop. Never resumes on its own |

`Locked` (a page after Final Submit) is absent on purpose: never observed, and observing it would
mean risking the student's own enlistment. It falls to `Unrecognised`, and its DOM dump is what
would promote it to a named state later. `Step2Stale` is also absent. Staleness is a property of
the Pass clock (§7), not the page: the DOM at 07:47 is identical to the DOM at 08:00.

**Two cadences, not one.** The Pass interval (§7, 2s–60s) governs how often the worker rereads
availability over HTTP and decides whether a strike is needed; it is not how fast the content
script reclassifies while getting the Owned Tab from a fresh load back to `Step2Bound`. That inner
loop, active only while the tab is settling or binding (states 5–9), keeps ADR-0001's original
250ms poll: the content script mostly sits at `Step2Bound` already, thanks to the 3-minute reload
in §9, so this loop runs briefly after each reload rather than on every Pass.

**Safety rules the model carries** (§12 restates these as one list):

1. Never touch `#btnConfirmEnlistment`. It's present and visible while `#STEP2` is active, not
   confined to step 3.
2. Address every button by id only, never by class or text. `#btnEnlistment` and
   `#btnConfirmEnlistment` share the class `common-submit-btn`; `#btnAdd` and `#btnEnlistment`
   share the label "Save & Next".
3. Never un-tick a checked course row. Already-saved subjects come back pre-checked.
4. Scope every pane check to `#STEP1|2|3` by id. `PayatCampus`, `PayatBank`, and `Online` also
   carry `.tab-pane.active`.
5. Toasts are advisory only, never a state signal. They're transient and gone on reload.

## 7. The Pass

The **Pass** is the unit of retry: `#btnEnlistment` saves the whole Course Selection at once, so
"retry one subject" is not an operation the page offers
([ADR-0003](adr/0003-vigil-with-one-self-adjusting-interval.md)).

**One Pass, while Watching:**

1. Classify the Page State (§6).
2. If it's a terminal or waiting state (`Settling`, `ActivityClosed`, anything not `Step2Bound`),
   act per the table in §6 and stop here; this is not yet a complete Pass (defined below).
3. On `Step2Bound`, read `GetAllCourseSectionData` / `GetCourseWiseSectionData`, scoped to the
   requested subjects only. Run Reconciliation (§8) against the result.
4. If the Save Gate (§8) is satisfied and at least one subject needs a change, click
   `#btnEnlistment` once. Re-read the held set afterward and diff it against the pre-click read.
5. If the Save Gate refuses, do not click. Reclassify next Pass.
6. Record whether this Pass was complete (§9's Stall clock consumes this).

**Cadence.** The wait between Passes is one self-adjusting number, never a mode:

- Starts at **2s**.
- A Pass that changes nothing multiplies the wait by **1.5**, capped at a **60s** ceiling.
- A Pass where a Saved Slot appears, or a Section appears in or disappears from a dropdown,
  resets the wait to **2s**.
- Every wait is jittered **±25%**.

**A change excludes errors.** This corrects the draft language in ADR-0003 §5, superseded by its
own amendment:

| Response | Effect on the interval |
|---|---|
| `500` | Treated as no change: the interval grows. ArchersHub's own page silently retries these; they're its ordinary flakiness. |
| `429` / `403` | Hard back off: jump straight to the 60s ceiling. Never resets, never speeds up. |

This is not a circuit breaker. Nothing pauses, nothing alerts on a `500`/`429`/`403` alone (§10
Recorded tier only). The loop keeps running; it only slows down.

**The interval is never held in memory.** It's derived fresh each tick from a stored
`lastChangeAt`: `n = log(1 + elapsed/4) / log(1.5)`, `interval = min(60s, 2s × 1.5ⁿ)`. See §9 for
why: a remembered interval resets to 2s on every service-worker eviction, producing a permanent
sawtooth that never reaches the ceiling.

**No wall-clock deadline, no attempt cap, no circuit breaker.** The Vigil stops only per the §4
table: every subject satisfied, an abort, or the student stopping it. If a Wanted Section never
reappears, the Vigil never stops on its own. That cost is accepted.

**A complete Pass**, the input to the Stall clock (§10), is one that classifies the page, reads
the held set over HTTP, and either satisfies the Save Gate and clicks, or correctly finds nothing
to do. A Vigil watching correctly and finding nothing (Sections still full) produces complete
Passes continuously and is never a Stall.

## 8. Reconciliation and the Save Gate

**Reconciliation** compares what the student asked for against what they currently hold, per
subject, and decides what to do about it
([ADR-0005](adr/0005-the-switch-is-the-students-own-procedure.md)):

| Held Section | Wanted Section in the read | Disposition |
|---|---|---|
| none | present | tick the row, select it, save |
| none | absent (full) | nothing; keep watching |
| = Wanted | anything | done; leave the row exactly as it is |
| ≠ Wanted | present | set the dropdown to it, save: the switch |
| ≠ Wanted | absent (full) | nothing; leave the backup untouched, keep watching |
| held, never requested | anything | preserve verbatim in the posted list; never un-tick |

Acquiring a Slot and upgrading an already-held one are the same operation: make the Held Section
the Wanted Section. There is no separate "switch" code path.

**The Save Gate** is the precondition every Pass must pass before it's allowed to click
`#btnEnlistment`, the most safety-critical check in the run, because the POST is declarative:
`SaveEnlistmentData` rebuilds the whole Course Selection from every checked row on the page, and
omitting a course from that list is how ArchersHub reads a drop. There is no drop endpoint. A
short list is a drop instruction. Before every click, all of the following must hold:

1. Every course the HTTP read says is held is present as a row, still checked, carrying a
   non-null section id.
2. Every subject being acted on this Pass carries the section id intended for it.
3. No checked box has been un-ticked by the automator, ever.

Any mismatch and the Pass does not click. It reclassifies and tries again next Pass. This protects
every subject on every Pass, not only the one being switched, and costs nothing extra: the HTTP
read is already happening.

**Whether the swap is atomic on ArchersHub's server is not known** (§16). The automator performs
exactly the procedure a student performs by hand and takes on no more risk than that. What
actually protects the Slot is the Save Gate plus the post-write check below, not a claim about
atomicity.

**After every write**, re-read `GetAllCourseSectionData` and diff the held set against what it was
immediately before the click:

- Unchanged or grown: normal, a no-change or successful Pass.
- Shrunk (a held Slot is gone): **Lost Slot**, a Notice-tier event (§10). The Vigil does not stop.
  It's already chasing the Wanted Section for that subject and is faster at retaking it than the
  student would be by hand.

## 9. Liveness

The service worker owns the clock and the poll; the tab is only a striking surface
([ADR-0004](adr/0004-liveness-lives-in-the-service-worker.md)). A hidden page's chained timers
clamp to one wake-up per minute after ~5 minutes backgrounded, so a content-script clock would sit
at 60s exactly when §7 wants 2s.

**What the extension guarantees:**

- **Awake at the scheduled moment and every tick after.** One one-shot alarm schedules the next
  tick. The worker is expected to be evicted between ticks, and every tick assumes a cold start.
  Nothing is ever carried in memory across an eviction.
- **Survives a browser restart, crash, or extension reload.** Storage is the Vigil; alarms are
  rebuilt from storage on worker startup. A start time that passed while Brave was closed starts
  the Vigil immediately on the next startup, rather than being silently dropped.
- **The backoff is real, not nominal.** See §7's derivation from `lastChangeAt`.
- **The session cannot idle out while a Vigil runs.** Every Pass is an authenticated request, so
  the poll itself is the keepalive. Before the Vigil starts (Armed, not yet Watching), the same
  cheap `GET` runs on a slow alarm instead.
- **Refuses to arm against a dead session.** One authenticated `GET` at arming time; a logged-out
  student cannot arm at all. This moves the discovery of a dead session to the moment they're
  sitting there able to fix it.
- **Owns its own tab.** No pre-existing tab required. The Owned Tab is reloaded every **3
  minutes**, keeping `#STEP2` bound and strike-ready, and is never reloaded while a strike (a
  click on `#btnEnlistment`) is pending.
- **A dead session suspends the Vigil; it does not end it.** The worker parks the Owned Tab on the
  login page, alerts, and probes flat **30s**. Flat, because it's asking "am I logged in," not
  "did a Slot open," so §7's backoff doesn't apply. Logging back in brings the Vigil to full
  cadence within 30s, at any hour.

**What it merely attempts, and does not guarantee:**

- **Never meeting the idle modal.** Its threshold is unmeasured: absent from `Enlistment_V2.js`,
  `template.js`, and `vendors.min.js`, so it belongs to the authenticated layout, not the
  enlistment page. The 3-minute reload is a margin, not a fit. The run never clicks it: an
  unrecognised dialog is `Unrecognised` (§6), and clicking a guess risks a server-side logout that
  would kill the worker's own session too.
- **Recovering from machine sleep.** Alarms don't wake a sleeping device. Missed alarms fire at
  wake, and the Vigil resumes having watched nothing in the interim.

**Out of scope, and why (§16 restates):** automatic re-login with stored credentials. A Chrome
extension has no way to read a `.env` file, so credentials would sit as plaintext in
`chrome.storage.local`. The login page also runs Cloudflare Turnstile, which may score an
automated submission differently than a passive human pass.

## 10. Reporting

Four tiers, three channels ([ADR-0006](adr/0006-three-channels-and-a-stall-clock.md),
[ADR-0007](adr/0007-the-popup-is-plan-run-report.md)):

| Tier | Events | Channels |
|---|---|---|
| **Alert**: the Vigil cannot proceed; only the student can unstick it | Suspended, Aborted, Stall | Notification + badge + Run Report |
| **Notice**: a call to action, no clock on it | Complete, Lost Slot | Notification + badge + Run Report |
| **Ambient**: never a notification | Subject acquired/upgraded; Vigil armed, started, resumed from Suspended, resumed after a browser restart | Badge + Run Report |
| **Recorded**: the rolling Pass tail only | Transient `500`/`429`/`403`, no-change Passes, single Save Gate refusals, Owned Tab reloads, worker evictions | Pass tail only |

**A Stall is ten minutes with no complete Pass** (§7 defines "complete"). One counter, not three.
Save Gate refusals, hard errors, and failed reads all describe the same underlying condition, the
loop is turning and nothing is coming out of it, so one clock covers all of them. A Vigil watching
correctly and finding nothing is never a Stall.

**Badge** (`chrome.action.setBadgeText`, no extra permission):

| State | Text | Colour |
|---|---|---|
| Nothing armed | *(empty)* | none |
| Armed, start time not reached | `•` | grey |
| Watching | count of subjects not yet at their Wanted Section | blue |
| Suspended | `!` | amber |
| Stall | `!!` | red |
| Aborted | `X` | dark red |
| Complete | `✓` | green |
| Stopped | *(empty)* | none |

Alert states differ in shape as well as colour, so they read at a glance regardless of colour
perception.

`chrome.notifications` fires on a transition, never on a held state: Suspended notifies once when
the session dies, not on every 30s probe after that. An unresolved Alert repeats every 30 minutes,
three times, then goes quiet; the badge stays lit, so the state is never actually lost. Clicking a
notification only focuses the Owned Tab wherever it is. It never drives the page toward Final
Submit. The Owned Tab stays open when the Vigil ends, on both Complete and Aborted; on an Abort it
is the evidence.

**The Run Report**, in `chrome.storage.local`, holds two things:

1. An event ledger: every Alert, Notice, and Ambient event with its time and cause. The popup
   renders this.
2. A rolling tail of the last 200 Passes, for diagnosing a Stall after the fact. The popup does
   not render this; it offers Export instead (a blob anchor, no `chrome.downloads` permission
   needed). This amends ADR-0006's original claim that the popup renders both; storage is
   unchanged, only rendering is. 200 rows of `no change, Z25 absent` is searched, not read.

The Run Report is write-only from the run's perspective. Reconciliation reads the live page, every
Pass. No decision the loop makes may ever come to depend on it.

## 11. The popup

Three tabs, **Plan**, **Run**, **Report**, opening on whichever the current Vigil state makes
relevant ([ADR-0007](adr/0007-the-popup-is-plan-run-report.md)). All three stay reachable
regardless of which one it opens on.

- **Plan.** The subjects and their Wanted Sections (§3's catalogue dropdowns), and the
  now/at-a-time control.
- **Run.** What the Vigil is doing, the per-subject roster (satisfied / watching), and Stop.
- **Report.** The event ledger, newest first, filterable to Alerts and Notices, with Export for
  the Pass tail.

Arming refusal is a screen, not a toast: what's wrong, an Open ArchersHub button, a disabled Arm
button, and the night-before checklist with *logged in* flipped to a failure mark. The checklist
splits by who can act on it:

| Item | Who | Rendered |
|---|---|---|
| Logged in | the extension checks it, at arming time | ✓ / ✗ |
| Mac awake, lid open | only the student | ○ |
| Brave running | only the student | ○ |

Stop lives on the Run tab and takes two presses; the first asks. Suspended and Stopped are
rendered with different vocabulary on purpose:

| | **Suspended** | **Stopped** |
|---|---|---|
| Cause | the session died | the student pressed Stop |
| Badge | `!` amber | empty |
| Resumes | on its own, within 30s of logging back in | never |
| Popup says | *you have to log back in, nothing else* | *it will not resume*, with **Arm again** |

## 12. Safety rules (consolidated)

1. **Never interact with `#btnConfirmEnlistment`.** Its click handler and `#btnEnlistment`'s
   differ only in `IS_FINAL_CONFIRM`. The target is `#btnEnlistment`, and only `#btnEnlistment`.
2. **Address every element by id, never by class or text.** Two independent id collisions exist on
   this page (§6, rule 2) that make anything looser unsafe.
3. **Never un-tick a checked course row.** Already-saved subjects return pre-checked; the Save
   Gate (§8) treats an un-tick as a violation.
4. **A short posted list is a drop instruction.** The Save Gate (§8) exists to prevent it.
5. **Scope every pane check to `#STEP1|2|3` by id.** Other elements also carry
   `.tab-pane.active`.
6. **Toasts are advisory, never a state signal.** They're transient and don't survive a reload.
7. **`Locked`/post-Final-Submit is never guessed at.** Unobserved pages fall to `Unrecognised` and
   abort (§6).
8. **The automator never clicks an unrecognised dialog** (the idle modal included, §9). An
   unrecognised element is `Unrecognised`, which aborts.

## 13. Storage schema

Derived directly from §9's "storage is the Vigil," not a new decision, just the shapes the
guarantees above require:

- **Plan.** Subjects, each with one Wanted Section; start mode (now / at-time) and, if scheduled,
  the start time.
- **Vigil record.** Current lifecycle state (§4), `lastChangeAt` (§7's cadence input), the
  one-shot alarm's next-fire time.
- **Stall counter input.** Timestamp of the last complete Pass (§7, §10).
- **Event ledger.** Alert / Notice / Ambient entries, each with time and cause (§10).
- **Pass tail.** Rolling last-200-Passes buffer, Recorded-tier detail (§10), export-only.

None of the above is ever read back as an input to Reconciliation (§8) or Page State
classification (§6). Only the Vigil's own lifecycle bookkeeping (state, alarm time,
`lastChangeAt`) is read by the loop. What subjects are held is read from ArchersHub, fresh, every
Pass.

## 14. Build map: what happens to the existing code

- **`background/background.js`** (291 lines today) becomes the Vigil owner. Removed:
  `checkSchedule`'s 1/minute poll and its 60-second arming window (§9 replaces it: a missed start
  time starts the Vigil on next startup, not within a narrow window); the 5-minute `keepAlive`
  alarm and `bounceEnlistmentSessionTab`'s dashboard-bounce heartbeat (§9's poll is itself the
  keepalive); `ENLISTMENT_STEP2_URL` and every navigation to `/Enlistment_V2/Index/2` (fact 2:
  that path is a no-op, `#STEP1` is active regardless). Added: the one-shot alarm chain (§9), the
  HTTP poll (§5, §7), Owned Tab lifecycle (§9), badge (§10), notifications (§10), the event ledger
  and Pass tail (§13).
- **`content/content.js`** (643 lines today) becomes a thin classify-and-strike surface, invoked
  only while a strike is underway. Removed: the scripted `executeEnlistment` sequence and its
  fixed step1 → step2 → submit → verify order; `runWithRetries`; `waitForStep1NextButton` /
  `waitForStep2NextButton` (the 30s × 3 hangs §6/ADR-0001 replaces); `findButtonByText` (can
  return step 1's button, or worse, §6 rule 2); toast waiting (§6 rule 6: advisory only). Kept and
  fixed rather than deleted: `selectSubjectSection`'s Select2/lazy-bind handling, which stays on
  the critical path at strike time (§5); the full-page-loader detection, which becomes the
  `Settling` signal (§6, state 5).
- **`popup/popup.js`, `popup/popup.html`, `styles/popup.css`** (455 + 104 + 346 lines today) are
  rebuilt as Plan / Run / Report (§11), against the shape validated on `prototype/popup-shape`
  (variant B). Note for whoever builds this: today a successful `ping` immediately calls
  `sendRunRequest` → `executeEnlistment`, and if the tab is already on the enlistment page the
  popup skips `ping` and runs automation straight away. The current popup is unsafe to test
  against a real Pending enlistment and must not survive the rebuild.
- **`manifest.json`.** Add `notifications` (§2, §10). Both `Enlistment_V2` and `Enlistment` match
  patterns stay, since the code above still branches on both path forms.

## 15. Acceptance checklist

Not run as part of writing this document; this is what a later session verifies live, against the
rebuilt extension, once §14 is implemented:

- [ ] Badge shows each state in the §10 table correctly: empty, `•` grey, count blue, `!` amber,
      `!!` red, `X` dark red, `✓` green.
- [ ] A Stall fires at ten minutes with no complete Pass, and never fires while the Vigil is
      watching correctly and finding nothing.
- [ ] Logging out mid-Vigil suspends it (flat 30s probe, Owned Tab parked on login); logging back
      in resumes full cadence within 30s.
- [ ] The Save Gate refuses a click when a course row is unbound or un-ticked, and the Pass
      reclassifies rather than clicking anyway.
- [ ] A post-write diff correctly detects a lost Slot and raises a Notice without stopping the
      Vigil.
- [ ] Arming refuses against a logged-out session, in both start-now and start-at-time modes.
- [ ] A start time that passed while Brave was closed starts the Vigil immediately on next
      startup, rather than being silently dropped.
- [ ] Stop takes two presses, leaves the Plan intact, empties the badge, and never resumes,
      distinguishable in the popup from Suspended.
- [ ] The Owned Tab is never reloaded while a strike (`#btnEnlistment` click) is pending.
- [ ] `#btnConfirmEnlistment` is never clicked, in any state, across a full run.

## 16. Deliberately unresolved

Carried forward rather than papered over, each with the behaviour the run takes in its absence:

- **Whether the section-switch POST is atomic on ArchersHub's server.** Not answered; ruled
  ArchersHub's to guarantee, because answering it would mean provoking a capacity failure against
  a live enlistment record on purpose. The automator takes the same risk a human takes doing the
  same thing by hand, and the Save Gate (§8) plus the post-write diff are what actually protect
  the Slot.
- **The idle modal's timeout threshold and behaviour.** Unmeasured: its code isn't in
  `Enlistment_V2.js`, `template.js`, or `vendors.min.js`. The 3-minute Owned Tab reload (§9) is a
  margin against it, not a measured fit, and the run never clicks it regardless.
- **What server response code `4` (`'Section capacity is full !'`) actually proves.** It sits
  alongside `1` as a positive guard code in the stored proc's own comments, which suggests
  validate-then-write. That's inference, not proof. Treated as a no-change Pass (§7); the
  post-write diff is the real backstop, not this inference.
- **What a per-subject rejection (prerequisite not met, credit limit exceeded) looks like on this
  page.** Never observed. Falls to `Unrecognised` (§6, state 12) and aborts until one is actually
  seen and can be named as its own state.

---

*Written to close [Write the reliable-enlistment spec](https://github.com/anthonyandrei/AH-extension/issues/7),
the last open ticket on [Reliable unattended ArchersHub enlistment](https://github.com/anthonyandrei/AH-extension/issues/1).
Sources: `docs/adr/0001` through `0007`, `CONTEXT.md`, and the resolution comments on
[#2](https://github.com/anthonyandrei/AH-extension/issues/2),
[#3](https://github.com/anthonyandrei/AH-extension/issues/3),
[#4](https://github.com/anthonyandrei/AH-extension/issues/4),
[#5](https://github.com/anthonyandrei/AH-extension/issues/5),
[#6](https://github.com/anthonyandrei/AH-extension/issues/6),
[#8](https://github.com/anthonyandrei/AH-extension/issues/8),
[#9](https://github.com/anthonyandrei/AH-extension/issues/9), and
[#12](https://github.com/anthonyandrei/AH-extension/issues/12).
The prototype captured on `prototype/driving-surface` (`prototypes/FINDINGS.md`) and the popup
shapes on `prototype/popup-shape` (variant B) are the primary sources for §3, §5, and §11 and are
linked rather than restated.*

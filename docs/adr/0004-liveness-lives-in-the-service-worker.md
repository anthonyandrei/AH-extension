# Liveness lives in the service worker, and the tab is only a striking surface

ADR-0003 turned the run into a Vigil with no deadline, so the question stopped being "is the
extension awake at 07:00" and became "what keeps it awake for days". The old answer was a tab:
both entry points required a pre-existing ArchersHub tab, and a 5-minute heartbeat bounced that
tab through the dashboard to keep the cookie warm. A tab cannot carry that weight. Chromium
clamps a hidden page's chained timers to one wake-up per minute after roughly five minutes in
the background, which means a Vigil whose clock lives in the page degrades to a 60s cadence
precisely when ADR-0003 says it should be at 2s — the seconds after a Section reappears.

So the service worker owns the clock and the poll, and the tab is picked up only when there is
something to click. Two facts, both verified live in Brave on 2026-08-24, make that possible:

**The worker carries the session.** A `fetch` from the worker with `credentials: 'include'`
returned `200` on `/Enlistment_V2/Index` with no redirect to the login page. Chrome treats an
extension request as same-site to a host it holds permissions for, and Brave's default
third-party cookie blocking does not revoke that. Combined with ADR-0002, where reading is
already an HTTP call, the entire watching half of the Vigil needs no page at all.

**Sub-minute alarms fire when the extension is unpacked.** A 3s periodic alarm ticked at 3s,
with Brave printing the caveat itself: *"In packed extensions, alarm `tickTest` will fire after
the minimum duration."* This extension is loaded unpacked from the repo and will stay that way,
so the 30s alarm floor that would have capped the cadence does not apply.

## Considered Options

**Keep the clock in the content script.** It has the cookies and the DOM already, so it looks
like the obvious home. Rejected on the throttling fact above, and on three ways it dies that
the worker survives: a page reload destroys it, closing the tab destroys it, and a browser
restart destroys it with nothing left to notice.

**Split it: worker holds the schedule, content script polls.** Inherits the throttling of the
page and the eviction of the worker, and buys nothing neither has alone.

**Keep the worker alive during the fast phase, fall back to alarms when the interval grows.**
Smoother at 2s, and rejected: it adds a mode switch and a dependency on keepalive folklore.
This ADR exists because the previous keepalive folklore — the 5-minute `keepAlive` alarm at
`background.js:291` — was never verified to do anything.

**Let the student stage the tab, as today.** Makes the student the liveness mechanism. One
accidental ⌘W ends an unattended run that had days left in it.

## Consequences

**Every tick assumes a cold start.** One one-shot alarm schedules the next tick, and the worker
is expected to be dead in between — which it will be, for any interval over 30s. This is
ADR-0001's stateless rule applied to the run's own lifetime: just as Page State may never be
inferred from history, no tick may rely on what the previous tick left in memory.

**The backoff is derived, not remembered.** ADR-0003's interval climbs per no-change Pass, and
a variable holding it would reset to 2s on every eviction — producing a permanent 2s → 34s
sawtooth that never reaches the 60s ceiling and averages roughly five requests a minute for the
life of the Vigil. Instead only `lastChangeAt` is stored, and the interval is a pure function of
the time since it: `n = log(1 + elapsed/4) / log(1.5)`, `interval = min(60s, 2s × 1.5ⁿ)`. A cold
worker computes what a warm one would, because the clock is the state.

**Storage is the Vigil; alarms are derived from it.** `persistAcrossSessions` is unreliable
before Chrome 150, so alarms are rebuilt from storage on every worker startup. A start time that
passed while Brave was closed starts the Vigil immediately rather than dropping it, which the
current 60-second window in `checkScheduledExecution` does silently.

**The extension owns its tab, and a tab is not a session.** Authentication lives in the
profile's cookie jar, so a tab the extension opens is authenticated exactly when a tab the
student opened is. The student's precondition is a live session, not a staged tab, and it is
enforced at arming time rather than discovered at 07:00.

**The Owned Tab is reloaded every 3 minutes.** ArchersHub's authenticated layout shows an idle
modal with a countdown, and it is driven by user activity, so the worker's polling would not
touch it — an unattended tab meets that countdown every time. Nobody has read that modal's code
(it is absent from `Enlistment_V2.js` and from the site's public `template.js` and
`vendors.min.js`), so the run never clicks it: clicking an unrecognised dialog is what ADR-0001
forbids, and the downside if the guess is wrong is a server-side logout that kills the worker's
session too. A reload is understood, costs nothing on a tab nobody is watching, and resets any
client-side timer by construction. The threshold is unmeasured, so 3 minutes is a margin rather
than a fit; if it is ever measured below 3 minutes, this number changes.

**A dead session suspends the Vigil rather than ending it.** `LoggedOut` is a known state with a
known cause and a known cure, so ADR-0001's abort-on-the-unknown rule does not reach it. The
worker parks the Owned Tab on the login page, alerts, and probes on a flat 30s cadence — flat
because it is asking "am I logged in", not "did a Slot open", so ADR-0003's backoff does not
apply. Automatic re-login stays out of scope, now for a second reason beyond credential storage:
the login page runs Cloudflare Turnstile.

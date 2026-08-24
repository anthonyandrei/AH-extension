# PROTOTYPE — driving surface probe (throwaway)

Answers [#3 Decide the driving surface: DOM automation or HTTP endpoints](https://github.com/anthonyandrei/AH-extension/issues/3).

Read-only. Run from the page context of a logged-in
`https://archershub.dlsu.edu.ph/Enlistment_V2/Index`.

Three probes, in order of what they settle:

1. **Does a write endpoint exist, and what does it want?**
   Read the page's own `#btnEnlistment` handler out of the loaded scripts.
   No request is issued — the answer is in the source.
2. **Does the read path work from `fetch()`?**
   Call `GetAllCourseSectionData` with session cookies and compare its slot
   counts against what the DOM currently shows.
3. **Is the read path actually fresher than the DOM?**
   The DOM binds once per page load (map fact 10). If `fetch()` returns
   different numbers than the bound table, HTTP wins as a refresh path.

Nothing here mutates the enlistment record. Probe 1 reads source; probes 2 and 3
issue GET/POST reads that the page itself fires on every bind.

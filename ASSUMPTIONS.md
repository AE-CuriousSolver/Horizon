# Assumptions

These are decisions the agent made during the build (Run 2) that `SPEC.md`, `QUESTIONS.md` and the agreed `PLAN.md` didn't settle. Each one is easy to change. Most are a single value in [`src/lib/priority/config.ts`](src/lib/priority/config.ts) or a line in [`src/lib/copy/en-GB.ts`](src/lib/copy/en-GB.ts).

## Timing

1. **Part-of-day boundaries.**
   - Deadlines and event ends are read as "by", so they resolve to the *end* of the part: morning → 12:00, middle of the day → 17:00, evening → 22:00, "on the day" → the next local midnight.
   - Event starts resolve to the *start* of the part: on the day / morning → 00:00, middle of the day → 12:00, evening → 17:00.
2. **Changing timezone doesn't move existing times.** Stored instants stay as they are. A date-only deadline set in Sydney could therefore show as a different day after switching to London.
3. **Overdue beats an event check-in.** In the birthday-card example:
   - After the holiday ends but before Sunday evening, the prompt is "Holiday is over. Does this need updating?"
   - Once Sunday evening has passed, it becomes "Sun … has been and gone. Still need this?"
4. **An overdue task always shows**, even if its `after` event hasn't happened yet. The deadline is the hard limit.
5. **The check-in clock starts at the moment that passed:** the deadline, the event start for `before`, or the event end for `during`. Moving the deadline or event, unlinking, or removing the deadline clears the check-in. Done and Let go close it.
6. **Automatic let-go happens when the app is next opened** (any page that loads tasks), because there's no backend timer. The let-go is stamped at the end of the 14-day grace period, not the time you opened the app. One Note per day lists everything let go that day.
7. **The check-in card says** "If this isn't answered within 14 days, Horizon will let it go for you", so the automatic step is never a surprise.
8. **Lead-time override** (`lead_days`) is kept only for `before` links. Switching to `during` or `after` clears it.

## Scoring and ordering (all in `config.ts`)

9. **Layer 2 weights:** urgency 45, impact 35, deadline 60 (14-day horizon, squared curve), `before` event 15 (7-day horizon), impact floor 0.4. These are as agreed in `PLAN.md`.
10. **Quick win:** effort ≤ 2 and impact ≤ 2, waiting ≥ 7 days. The bump is +8, rising to +20 at 21 days. "Waiting" starts at the later of creation (or the last undo/restore) and the moment the task became visible.
11. **Effort balance:**
    - It looks at the last 3 days of completions, needs at least 3 of them, and a "run" is 2/3 or more of those.
    - Heavy means effort ≥ 4. Light means effort ≤ 2.
    - After a heavy run, light tasks get +10.
    - After a light run, heavy tasks that have waited 7+ days get +10.
    - **Low energy** adds +4 for each effort point below 5.
    - Low energy is recognised by the preset it came from, so renaming "Low energy" keeps it working. A state you add yourself doesn't trigger it.
12. **Spreading busy weeks:**
    - Looks at deadlines in the next 14 days. A cluster is 3 or more deadlines within 3 days of the first one.
    - Each task's load is its effort + 0.5 × open steps. The heaviest task moves earliest; the lightest doesn't move.
    - A task moves at most 5 days earlier. The re-score uses the normal layer 2 function.
13. **Mixing effort:**
    - No more than one heavy task (effort ≥ 4) in a row in the first 2 × list size positions.
    - A lighter task (effort ≤ 3) from up to 3 places further down moves up, but only if its score is within 15 points.
    - Check-ins are left alone.
14. **Filters apply before ordering**, so adjustments only consider the filtered list.
15. **"Why it's here" order of precedence:** check-in, brought forward, after a light run, after a heavy run, low energy, quick win, mixed in, due (only when deadline pressure is the largest part of the score and the deadline is within 7 days), before event, during event, urgent (U ≥ 4), matters a lot (I ≥ 4), ready when you are.
16. **"Show workings"** lists urgency, impact, deadline and event points, every adjustment with its points, and the effective due date when a task was brought forward.

## Filters and Views

17. **Filters:** a task with no environment or state matches every filter. Within a filter, any chosen item matches (OR). Across filters, all must match (AND). "Overdue only" means overdue check-ins, not passed-event check-ins.
18. **Filters live in the page address** (`?env=…&state=…&overdue=1&view=…`), so a View is simply saved filters, and the back button works.
19. **Hidden list items** disappear from pickers and filter chips, except when they're already selected in an active filter or already set on the task being edited.

## Lifecycle, Notes and history

20. **Delete has no confirmation.** It's a soft delete with an 8-second **Undo** toast and a Note with **Restore**. There's no permanent delete in v1, so the "are you sure?" exception in the brief never comes up. Events, Views and list items aren't tasks. Events and Views are deleted outright, and list items can only be hidden.
21. **Done and Let go** take one tap, with no follow-up questions. Marking a task done also clears any let-go, and the reverse.
22. **Undoing Done, or restoring from Let go,** restarts the "waiting" clock.
23. **Notes:**
    - There's one note per kind per local day, and repeats merge into it.
    - Ordering notes are written only for tasks on the first page of the Radar.
    - Re-rendering the Radar with nothing new doesn't touch a note, so it doesn't come back as "new".
    - "All good" marks a note resolved.
    - The subtle dot shows when a note has been added or updated since you last opened Notes.
24. **Notes cover four things:** automatic let-gos, deletions, "hidden by an event change" (only when your own edit to an event or a task's link takes a task off the Radar, per Q-R2-1) and big-picture ordering (brought forward, light run, heavy run, quick win). Mixing and low energy don't write notes, because the reason line already explains them.
25. **"Put it back"** on an ordering note switches that adjustment off for that one task for 7 days.
26. **Activity history:**
    - Each entry carries a snapshot of the title and effort.
    - Edits record which fields changed.
    - A step reorder is one entry. Tidying step positions after a step is removed isn't logged as a reorder.
    - The demo seed writes a short, matching history, so effort balance has something to work with.

## Screens

27. **Shaping hint:** shown when effort ≥ 4 and the task has no steps or no "Done when…". It can be dismissed once per task.
28. **"Show a few more"** reveals another list's worth (10 by default). The Radar size can be 1–100.
29. **Quick capture** adds only the title and the three scores (default 3/3/3). The scores appear when you start typing.
30. **Look ahead** lists Notes, Events and Views. Blocks are hidden until v2 (Q-R2-4).
31. **The Events list** is grouped as On now, Coming up and Past.
32. **Phones** get a bottom navigation bar. Wider screens use the top bar.
33. **Score arrows on cards** use a compact layout (label above ▾ n ▴) so all three fit on one row on a phone.
34. **Time display:** relative words ("today", "tomorrow", "Wed"), then "Wed 3 Dec", with the year only when it differs. Times are shown as "3pm".

## Accounts and demo

35. **"Try the demo"** signs in with email and password on the server, using `DEMO_PASSWORD`. Email+password stays enabled in Supabase only for this. Your own account has no password.
36. **The demo resets itself** on "Try the demo" if its last reset was over 24 hours ago or it's empty (Q-R2-5). Visitors can change anything in the meantime.
37. **The demo account is recognised by its email** (`demo@example.com`) when the user is created, or by the migration if it already exists.
38. **The login form never reveals whether an address has an account.** It does say so plainly if Supabase can't be reached.

## Technical

39. **Next.js 15.5** (the maintained 15.x line) rather than 16, for well-known App Router behaviour. Tailwind 4, Vitest 3, zod 3, date-fns 4 with `@date-fns/tz`.
40. **RLS is enabled but not FORCED.** Supabase's migration owner isn't a superuser, and the activity-log and demo-seed functions run as that owner. The app never connects as the owner. This was verified locally with a non-superuser, non-BYPASSRLS owner.
41. **Database types are hand-written** in `src/lib/data/rows.ts`, not generated, because there was no running Supabase to generate them from. You can switch to `supabase gen types` later.
42. **The CI database job** uses `supabase db start` (database only) and `supabase test db`, with CLI 2.40.7 pinned.
43. **How this was tested before handing over:**
    - All pgTAP tests were run against a local Postgres 16 with a minimal stand-in for Supabase's `auth` schema.
    - The whole app was driven end to end in a phone-sized browser against that database through a small throwaway stand-in for Supabase's REST and Auth endpoints, with every query run as the signed-in role so RLS applied.
    - That stand-in isn't part of the repo. The real Supabase services haven't been exercised yet. See the PR checklist.

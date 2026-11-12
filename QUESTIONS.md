# Horizon: Questions (Run 1)

Each question has a **proposed default** in brackets. If you're happy with a default, you only need to answer the ones you disagree with. In Run 2, any question without an answer uses its default, and that choice is recorded in `ASSUMPTIONS.md`.

The ones that most affect the build are marked ★.

---

## A. Accounts, demo and operations

**★ Q-O1. How does a visitor log into the demo account?**
The brief says "magic link only", but visitors can't receive magic-link emails sent to the demo address. Options:
(a) a "Try the demo" button that signs in with a demo password held only in a Vercel server env var. Password login is enabled in Supabase, but the app only exposes it for the demo account.
(b) you share the demo email and password privately, and the login page gets a small password form.
(c) the demo is only shown by you, live.
[Default: **(a)**. Real users still use magic link only. `is_demo` on the profile can also block destructive actions on that account if you'd like (Q-O3).]

**★ Q-O2. How should demo data be created, given that I never have database credentials and the app never uses the `service_role` key?**
Proposal: a migration adds a `seed_demo_data()` SQL function that wipes and recreates fake data **for the calling user only**, and only if their profile has `is_demo = true`. You'd set that flag once with a migration that matches the demo email. All dates are relative to `now()`, so the demo never goes stale. It runs on demo sign-in when the account is empty, or from a "Reset demo" button.
[Default: as proposed. The demo email goes in a migration. Is it OK for that email address to be public in the repo? If not, I'll use a `DEMO_EMAIL` setting that you add as a GitHub secret used by the migration workflow.]
** Answer: demo email can be public; use a fake address (demo@example.com).

**Q-O3. Should demo visitors be able to change data freely, with a periodic reset?**
[Default: yes, they can edit freely, plus a "Reset demo data" button. No scheduled job.]

**★ Q-O4. Can CI run database tests on pull requests?**
The rule "never run on pull requests" applies to the **migrate** workflow. I'd like a separate PR workflow with **no secrets**. It would start a throwaway local Supabase in Docker and run the pgTAP RLS tests, which proves privacy automatically. Is that acceptable?
[Default: yes. A documented manual check in `SECURITY.md` is included either way.]

**Q-O5. Vercel preview deployments for PRs would point at the production database, which hasn't had that PR's migrations applied yet.**
Should previews be disabled, or is it fine for them to be broken until merge?
[Default: leave previews on and document the limitation in `DEPLOY.md`.]

**Q-O6. Vercel function region.**
[Default: `syd1`, close to the Supabase Sydney database.]

**Q-O7. Is the `seed.sql` used by local Supabase (`supabase start`) acceptable as local-dev fake data, separate from the demo seed?**
[Default: yes, and it uses the same fake dataset.]

---

## B. Timing and visibility

**★ Q-T1. If an overdue task's event window has closed, does it still appear?**
For example, a task linked `during` "Holiday" with a deadline of Sunday, where the holiday has ended and Sunday has passed. The event rule says hide it, and "the deadline always wins" says show it as overdue.
[Default: **show it as overdue.** The deadline is the hard limit, and hiding it silently feels like "losing" it.]
** Answer: A gentle prompt less about the task and more about holiday over. So still display it but then say Holiday has passed, does this need updating? Then if no updated can mark as deleted after set time. Similar for Q2. 

**★ Q-T2. What happens to a `before` task that wasn't done before the event started?**
By the rules it disappears and is never overdue. That risks something quietly vanishing.
[Default: hide it from the Radar, and show it in the Orbit with a soft note ("Holiday has started. Still useful?") offering *mark done*, *unlink* or *let it go*.]

**Q-T3. If a deadline has no time, is it due at the end of that day in the user's timezone (23:59)?**
[Default: yes. It's stored in UTC as the end of that local day. If you change timezone later, date-only deadlines keep their stored instant and aren't recalculated.]

**Q-T4. For an event with no end and relation `during`: is "event day only" the start time until local midnight, or the whole calendar day?**
[Default: from the start time until the end of that local day. For an all-day event, it's the whole day.]

**Q-T5. Do events need an "all day" option, or do they always have a start time?**
For example, "UK holiday" probably doesn't have a meaningful start time.
[Default: add an `all_day` toggle.]
** Answer: I never like the wording "all day" when you just mean that day. So Event is on a day, and you can ask if specific time, or between dates (option to set time but hidden by drop down so not overwhelming)

**Q-T6. Should `before` tasks be visible as soon as they're created, even if the event is months away?**
For example, "Pack for holiday" created in January for an August holiday.
[Default: yes, as the brief says. Their event pressure stays near zero until the last 7 days, so they sit low in the list. Would you prefer an optional "show from N days before" setting later?]
** Answer: Yes, as the brief says. Let's calculate the N days based off effort, if high effort maybe 3 weeks before, low effort 7 days. With a 'when will this become visible?" little i pop up where we state the time due to effort, then say sounds a bit off? would you like to set number of days?

**Q-T7. Is the timezone per user and editable in Settings, or always `Australia/Sydney`?**
[Default: stored per user, defaulting to Sydney, with a simple picker in Settings.]

---

## C. Scoring and ordering

**Q-S1. Do the proposed formulas and weights in `PLAN.md` section 5 feel right?**
In particular:
- urgency weighs slightly more than impact (45 vs 35)
- deadlines more than 14 days away add nothing
- a low-impact deadline still gets 40% of the push
[Default: as proposed. Everything is in one config object to tune later.]

**Q-S2. What effort values should the three spec examples have?**
The brief doesn't give effort for toilet paper, tax or zoo. I've assumed E1, E4 and E1.
**Answers: effort values confirmed: toilet paper 1, tax 4, zoo 1.

**Q-S3. How long is "been sitting a while" for a quick win?**
[Default: 7 days of being visible and not done, rising to the maximum bump at 21 days. Does the timer reset when a task is edited, or only when it's undone? Default: only on creation or undo. Edits don't reset it.]

**Q-S4. What counts as "low effort, low impact" and as "high effort"?**
[Default: quick win is E ≤ 2 and I ≤ 2. Heavy is E ≥ 4.]

**Q-S5. For deadline clusters, what's a sensible daily workload in effort points?**
[Default: 6 effort points a day. For example, one E5 and one E1, or three E2s.]
Answer: The relationship is not linear. I could do 10 low effort tasks in one day but an E5 could take chunks of time over 3 or 4 days. The steps should help understand how much 'stuff' there is to do but we don't ask the user to estimate the amount of time. Effort workload is completely dependant on how much time you have free, A working day vs a Sunday would be different. We don't need a daily effort workload check. 

**Q-S6. Should ordering adjustments and the cap apply before or after filters?**
For example, should the effort mix consider only the filtered list?
[Default: filter first, then order. This matches "given everything visible".]

**Q-S7. Is "overdue only" a filter that shows only overdue tasks, combined with other filters using AND?**
[Default: yes.]

---

## D. Product behaviour

**★ Q-P1. Is a task's Environment or State required, or optional?**
[Default: **optional**, so capture stays quick. A task without one shows under every environment or state filter, because it can be done anywhere or in any state.]

**★ Q-P2. How should the State filter work?**
Exact match, or graded so that "Low energy" also shows tasks needing less? For example, does filtering on *Focused* also show *Low energy* tasks?
[Default: exact match, multi-select. States are an editable list with no inherent order, so grading would need extra settings.]
Answer: exact match for V1. 

**Q-P3. Can filters select several environments at once?**
For example, "Home or Computer".
[Default: yes, multi-select, combined with OR within a filter and AND across filters.]

**Q-P4. When the last open step of a task is marked done, should the task complete automatically?**
[Default: no. It asks gently: "That was the last step. Mark the task done?"]
Answer: No, and no prompt, they don't need to explain themselves if they're not also marking the task done. It should be a quick process where they follow their cognition not answer out questions. 

**Q-P5. On an overdue task, what does "let it go" do?**
[Default: mark it done, logged as `let_go` in the activity history so it's distinguishable from real completion. The alternatives are delete, or remove the deadline.]
Answer: check the revised brief.  

**Q-P6. What happens to tasks when you remove an Environment or State that they use?**
[Default: it's archived, not deleted. Tasks keep the label, and it no longer appears in pickers or filters. Alternatively, prompt to reassign or clear.]

**Q-P7. What does "Show more" do?**
Reveal the next 5, or the whole visible list?
[Default: reveal the next 5 each time. Is the cap of 5 something you want to change in Settings? Default: yes, a small number field.]

**Q-P8. Is there a default View when the Radar opens, or always "no filters"?**
And should the last-used filters be remembered between visits?
[Default: no filters on open, and nothing remembered.]

**Q-P9. Should tasks hidden by an event appear in the Orbit with their reason?**
For example, "Appears when Holiday starts".
[Default: yes. This reinforces "nothing is lost".]

**Q-P10. The default environment "Private": does it mean a place where you have privacy (e.g. a private call), or tasks you don't want shown on screen?**
If it's the latter, should Private tasks be masked on the Radar?
[Default: treat it like any other environment, with no masking.]
Answer: Private is actually more like Privacy. I can't make phone calls at the office but I can make them on my walk. I think it's more about privacy, being on my own. I am thinking of people with house mates, partners, kids and how some stuff can only be done when not around other people. It could be due to sensitive content, it could be due to a surprise, it could be because it's easier.

**Q-P11. Should reasons be one line only, or can a task show two?**
For example, "Due Wed · Urgent".
[Default: one primary reason, to keep it calm.]

**Q-P12. Activity history: should edits to title, description, environment, state and event link also be logged?**
The brief lists created, completed, undone, deleted, deadline changed, scores changed and steps completed.
[Default: yes, as `edited` and `event_link_changed`, plus the step add, undo and delete events, because they're cheap and useful later.]

**Q-P13. When a task is deleted, should its activity history stay?**
[Default: yes. The log keeps the task id and title snapshot so patterns like "added and removed quickly" can be found later.]

**Q-P14. Does the app need to work offline or as an installable phone app (PWA)?**
[Default: not in v1. A mobile-friendly site, with friendly messages when offline.]

---

## E. Vision and naming

**Q-V1. Should the placeholder names (Radar, Orbit, Views) be the user-facing labels for v1, or would you prefer neutral labels?**
Neutral labels would be something like "Now", "Everything" and "Saved views".
[Default: use Radar / Orbit / Views as written, all in one labels file.]

**Q-V2. Overdue tone: the brief says no red alarms. Is a soft accent colour (e.g. warm amber) acceptable for overdue items, or should they be marked only by position and wording?**
[Default: a muted warm tone plus wording, never red.]

**Q-V3. Should there be any gentle "all clear" moment when the Radar is empty or everything is done?**
For example, "Nothing needs you right now. Everything else is held safely."
Or would you rather it stay strictly neutral?
[Default: a short, calm message with no celebration or confetti.]
Answer: a short, calm message with no celebration or confetti. With maybe at the bottom, not obvious but a clickable action, something about time on hands? Or feeling motivated? Or Want to look ahead? Then note a few things 1. tasks evaluation, any scoring updates, tasks we deleted, all good? 2. Any events to add? 3. Create views 4. Want to organise some blocks?

**Q-V4. Is a light/dark theme following the device setting wanted?**
[Default: yes, following the system setting, with no toggle.]

---

# Round 2 (Run 1b)

I've kept these to what I need for building v1. Each has a default, and Run 2 uses the default unless you say otherwise. Conflicts I've already resolved in favour of `SPEC.md` are listed in `PLAN.md` §9, not here.

**Q-R2-1. When should a "hidden by events" Note be written?**
§7's example, "*Pack for holiday* was hidden because Holiday has started", clashes with §5. Under §5, a `before` task whose event has started stays visible with a check-in, so it isn't hidden.
[Default: write it when **one of your own edits** hides a task that was on the Radar. Examples: moving an event later hides its `after` tasks, or linking a task `during` a future event. Event moments passing are handled by check-ins, not this note.]

**Q-R2-2. What should "Not right?" do on an ordering Note?**
For example, "We moved *Tax return* up". Notes need an undo, but ordering is recalculated every time.
[Default: "**Put it back**" skips that adjustment for that one task for 7 days. If you'd prefer it simpler, the note can just link to the matching toggle in Settings.]

**Q-R2-3. How does a single-day event with an exact time affect `during` and `after` tasks?**
For example, "Dinner with John, 7pm".
[Default: follow the brief literally. A `during` task shows for that whole local day. An `after` task shows from 7pm.]

**Q-R2-4. Should the "Look ahead" page show the v2 Blocks item?**
[Default: hide it until Blocks exist.]

**Q-R2-5. The demo account is shared by every visitor. Should it reset itself, as well as having the "Reset demo" button?**
[Default: yes. On "Try the demo", if the data was last reset more than 24 hours ago, it's reset first. Each visitor then usually starts from a tidy state.]

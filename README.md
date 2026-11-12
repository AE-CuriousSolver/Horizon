# Horizon

A calm, personal "things to do" app that helps you focus on what's in front of you now, and trust that everything further down the road is held safely out of sight.

> **About this repo.** This project shows product definition and handing work to an AI agent. The product vision, requirements and decisions are Anna-Marie Edeleanu's ([`SPEC.md`](SPEC.md)). The implementation was delegated to an AI coding agent (Claude Code) working from that brief. The plan it agreed is in [`PLAN.md`](PLAN.md), the questions and answers in [`QUESTIONS.md`](QUESTIONS.md), and every judgement call it made alone in [`ASSUMPTIONS.md`](ASSUMPTIONS.md).

## The idea

People are good at noticing what's in the way of a task: deadlines, where they need to be, how they feel. Weighing all of that together to decide *what to do next* is draining. Horizon does the weighing and shows a short, ordered list, with a one-line reason for each item.

You only see as far as the horizon. A task appears when it can actually be done. Everything else is real and accounted for, but out of view until it's relevant. Nothing is ever lost: the Orbit shows everything you're carrying.

The tone is calm and UK English: no guilt, streaks or red alarms. Horizon may act on your behalf, but never silently. Every automatic change is written up in Notes with an undo.

## How the ranking works (in plain language)

Each task has three scores from 1 to 5: **Effort** (how much it takes out of you), **Impact** (how much it matters) and **Urgency** (how soon *you* feel it needs doing). A task can also have a deadline, and can be linked to an event (before, during or after it).

Horizon decides what to show in three steps.

### 1. Can it be done now? (visibility)

| Link | When it's on the Radar |
|---|---|
| No event | Always |
| **Before** an event | From a lead time before the event until it starts. Bigger tasks show up earlier: effort 1–2 → 7 days, 3 → 14 days, 4–5 → 21 days. You can set your own number of days. |
| **During** an event | Only while it's on (a single-day event: that whole day) |
| **After** an event | Once it's over (a single-day event: once it has started) |

When a moment passes (a deadline goes by, a `before` event starts, a `during` event ends), the task doesn't silently vanish or nag. It stays at the top with a gentle question about the situation, such as "Yesterday has been and gone. Still need this?" or "Holiday is over. Does this need updating?". You can **Update**, mark it **Done** or **Let go**. If nobody answers within 14 days, Horizon lets it go and writes a Note with a **Restore** button.

### 2. How much does it matter on its own? (score)

- **Urgency** and **impact** add up to the base score. Urgency weighs slightly more (45 vs 35 points at most), because it's your own judgement of timing.
- A **deadline** adds pressure in the last two weeks, rising more steeply as it gets close and highest once it's passed. That pressure is **scaled by impact**: a deadline on something important pushes hard (up to 60 points), while a deadline on something minor only nudges (40% of that).
- A **before** event with no deadline warms the task up gently in its last week (at most 15 points). It's never "overdue".
- **Effort doesn't count here.** Hard things that matter must still rank well. Effort only affects the order in step 3.

The brief's examples, with the real numbers:

| Task | U / I / E | Deadline | Score |
|---|---|---|---|
| Buy toilet paper | 5 / 2 / 1 | none | ~54: high, driven by urgency |
| Submit tax return | 4 / 4 / 4 | in 4 months | 60: high, the far deadline adds nothing yet |
| Book zoo tickets | 1 / 1 / 1 | Wednesday | ~2 a fortnight out, ~21–24 by Wednesday: a nudge |
| The same, but impact 5 | 1 / 5 / 1 | tomorrow | ~87: pushes hard |

### 3. What's a good order? (ordering)

Starting from the scores, a few gentle, explainable adjustments are applied. Each can be switched off in Settings:

- **Quick wins:** a small, low-impact task that's been waiting a week or more gets lifted, so it can just be cleared.
- **Effort balance:** after a run of heavy tasks, lighter ones get a boost. After a run of small wins, a heavy task that's been waiting gets one ("maybe time for a bigger one?"). With the *Low energy* filter on, lighter tasks rise.
- **Spread busy weeks:** when three or more deadlines bunch together, the heavier tasks (more effort, more open steps) are treated as due a little earlier, so there's no pile-up. There's no "daily capacity": free time varies too much.
- **Mix effort:** heavy tasks aren't stacked back to back at the top. A lighter one is slipped in between, but never in front of a much more important heavy task.
- **Check-ins stay on top**, overdue first.

Every card shows one reason line ("Urgent", "Due Wed", "Been waiting a while: quick win", "Brought forward: busy week ahead"…). Turn on **Show workings** in Settings to see every number.

All weights, thresholds and switches live in one file, [`src/lib/priority/config.ts`](src/lib/priority/config.ts). The model itself is pure functions in [`src/lib/priority/`](src/lib/priority/), with tests next to it.

## Screens

| Screen | What it's for |
|---|---|
| **Login** | Magic link (no public sign-up), plus **Try the demo** |
| **Radar** | Home. Quick capture, then the ranked list (10 by default, "Show a few more"). Each card leads with the **next open step**, with the task title underneath. Done, Step done, and inline ▾▴ score arrows. Filters (where, state, overdue only) and saved Views. When nothing needs you: "Nothing needs you right now. Everything else is held safely." |
| **Orbit** | Everything you're carrying: In view, Hidden for now (and why), Done, Let go. Undo and restore from here. |
| **Task editor** | Title, "Done when…", steps, scores, where, state, deadline (rough part of the day; exact time under "More options"), event link with lead-time info, conflict warning. Done, Let go, Delete (with Undo). |
| **Events** | Soft anchors "on a day" or "between dates". Deleting one with linked tasks asks first and unlinks them. |
| **Views** | Saved filter combinations: apply, rename, delete. |
| **Notes** | What Horizon did and why (tasks let go, hidden by an event change, ordering decisions, deletions), each with Restore, Edit or Put it back. |
| **Look ahead** | A quiet page reached from the all-clear: review Notes, add events, create Views. |
| **Settings** | Your own environment and state lists (rename, hide, add), timezone, Radar size, Show workings, ordering switches, Reset demo. |

All the wording lives in one file, [`src/lib/copy/en-GB.ts`](src/lib/copy/en-GB.ts). Placeholder names (Radar, Orbit, Views, Notes) can be renamed there without touching code or the database.

## Tech

- **App:** Next.js (App Router) and TypeScript, Tailwind. Mobile-first, with light and dark mode following the device.
- **Data:** Supabase Postgres (Sydney). The app talks to Supabase directly with the signed-in user's session. There's no separate backend, and **Row Level Security** on every table keeps each person's data private. See [`SECURITY.md`](SECURITY.md).
- **Schema:** everything (tables, RLS, triggers, functions) is in [`supabase/migrations/`](supabase/migrations/). A GitHub Action applies them when a PR is merged to `main`.
- **History:** an append-only activity log is written by database triggers, so every task change is recorded whichever screen made it.

### Folder map

```
src/lib/priority/   the model: visibility, score, ordering, reasons (pure + tested)
src/lib/board.ts    turns rows + the model into Radar and Orbit view models
src/lib/data/       Supabase reads (load.ts) and server actions (actions.ts)
src/lib/copy/       every user-facing label
src/app/            pages     src/components/   UI
supabase/           migrations, pgTAP tests, local config
```

## Running it locally

You need Node 20+ and, for the database, the [Supabase CLI](https://supabase.com/docs/guides/cli) with Docker.

```bash
npm install
```

```bash
supabase start
```

Copy `.env.example` to `.env.local` and fill in the local URL and anon key that `supabase start` prints. Then:

```bash
npm run dev
```

To sign in locally, create a user in the local Studio (http://127.0.0.1:54323). For the demo, create `demo@example.com` with a password and put that password in `DEMO_PASSWORD`.

## Tests

```bash
npm test
```

Unit tests (Vitest) cover every visibility rule (including the birthday-card example and lead times), part-of-day conversions (including Sydney's daylight-saving changes), the brief's three score examples, and a fires/doesn't-fire case for each ordering adjustment. They assert relationships, not exact numbers, so the weights can be tuned.

```bash
supabase test db
```

Database tests (pgTAP) prove that one user can't read, change, delete or link to another user's rows in any table, that the activity log can't be written directly, and that history, notes and the demo seed behave.

Both run on every pull request in CI (no secrets involved).

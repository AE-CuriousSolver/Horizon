/**
 * Every user-facing label in one place (UK English).
 * Placeholder names (Radar, Orbit, Views, Notes) can be renamed here only;
 * code and database use neutral names.
 */

export const names = {
  product: "Horizon",
  radar: "Radar",
  orbit: "Orbit",
  views: "Views",
  view: "View",
  notes: "Notes",
  events: "Events",
  settings: "Settings",
  lookAhead: "Look ahead",
} as const;

export const nav = [
  { href: "/", label: names.radar },
  { href: "/tasks", label: names.orbit },
  { href: "/events", label: names.events },
  { href: "/views", label: names.views },
  { href: "/notes", label: names.notes },
  { href: "/settings", label: names.settings },
] as const;

export const scores = {
  effort: { label: "Effort", hint: "How much it takes out of you" },
  impact: { label: "Impact", hint: "How much it matters" },
  urgency: { label: "Urgency", hint: "How soon you feel it needs doing" },
  more: (label: string) => `More ${label.toLowerCase()}`,
  less: (label: string) => `Less ${label.toLowerCase()}`,
} as const;

export const parts = {
  day: "On the day",
  morning: "Morning",
  midday: "Middle of the day",
  evening: "Evening",
  exact: "Specific time",
} as const;

export const partShort = {
  morning: "morning",
  midday: "middle of the day",
  evening: "evening",
} as const;

export const relations = {
  before: "Before",
  during: "During",
  after: "After",
} as const;

export const login = {
  title: "Welcome back",
  intro: "Horizon keeps what's in front of you in view, and holds the rest safely.",
  emailLabel: "Email",
  send: "Send me a link",
  sending: "Sending…",
  sent: "If that address has an account, a sign-in link is on its way. You can close this tab.",
  tryDemo: "Try the demo",
  demoHint: "Have a look around with made-up tasks. Changes reset daily.",
  demoUnavailable: "The demo isn't available right now. Please try again later.",
  linkProblem: "That link didn't work. It may have expired, so please ask for a new one.",
  signOut: "Sign out",
} as const;

export const radar = {
  heading: "What's in front of you",
  capturePlaceholder: "Add something you're carrying…",
  captureButton: "Add",
  captureScores: "Adjust scores",
  showMore: "Show a few more",
  allClearTitle: "Nothing needs you right now.",
  allClearBody: "Everything else is held safely.",
  allClearLink: "Time on your hands? Look ahead",
  filteredEmpty: "Nothing here for these filters. Everything else is held safely.",
  clearFilters: "Clear filters",
  done: "Done",
  stepDone: "Step done",
  workingsTitle: "Workings",
  undo: "Undo",
  markedDone: (title: string) => `Marked "${title}" done.`,
} as const;

export const filters = {
  environment: "Where",
  state: "State",
  overdueOnly: "Overdue only",
  view: "View",
  noView: "No view",
  saveAsView: "Save as a View",
  viewNamePlaceholder: "e.g. At home, low energy",
  save: "Save",
  any: "Any",
} as const;

export const checkIn = {
  overdue: (when: string) => `${when} has been and gone. Still need this?`,
  eventStarted: (event: string) => `${event} has started. Does this need updating?`,
  eventEnded: (event: string) => `${event} is over. Does this need updating?`,
  update: "Update",
  done: "Done",
  letGo: "Let go",
  autoLetGoHint: (days: number) => `If this isn't answered within ${days} days, Horizon will let it go for you.`,
} as const;

export const reasons = {
  brought_forward: "Brought forward: busy week ahead",
  light_run: "You've cleared lots of small things: maybe time for a bigger one?",
  heavy_run: "Something lighter after a heavy run",
  low_energy: "Lighter, for a low-energy moment",
  quick_win: "Been waiting a while: quick win",
  mix: "Something lighter between bigger tasks",
  due: (when: string) => `Due ${when}`,
  before_event: (event: string) => `Before ${event}`,
  during_event: (event: string) => `While ${event} is on`,
  urgent: "Urgent",
  matters: "Matters a lot",
  ready: "Ready when you are",
} as const;

export const adjustmentNames = {
  quick_win: "Quick win",
  heavy_run: "Lighter after a heavy run",
  light_run: "Bigger one after light wins",
  low_energy: "Low energy",
  brought_forward: "Brought forward",
  mix: "Mixed in between heavy tasks",
} as const;

export const adjustmentToggles = {
  quickWin: { label: "Quick wins", hint: "Lift small things that have waited a while." },
  effortBalance: {
    label: "Effort balance",
    hint: "Balance against what you've recently finished, and favour lighter tasks when you're low on energy.",
  },
  spreadClusters: { label: "Spread busy weeks", hint: "Bring some tasks forward when deadlines bunch together." },
  mixEffort: { label: "Mix effort", hint: "Avoid heavy tasks back to back at the top." },
} as const;

export const editor = {
  newTitle: "New task",
  editTitle: "Edit task",
  title: "What is it?",
  description: "Notes",
  doneWhen: "Done when…",
  doneWhenPlaceholder: "e.g. CV sent to 3 roles",
  steps: "Steps",
  addStep: "Add a step",
  stepPlaceholder: "Next small thing",
  moveUp: "Move up",
  moveDown: "Move down",
  removeStep: "Remove step",
  scores: "Scores",
  environment: "Where",
  state: "State",
  none: "Any",
  deadline: "Deadline",
  addDeadline: "Add a deadline",
  removeDeadline: "Remove deadline",
  event: "Linked event",
  linkEvent: "Link to an event",
  unlinkEvent: "Unlink event",
  noEvents: "No events yet.",
  relation: "When",
  leadInfo: (days: number, event: string, big: boolean) =>
    `Appears ${days} day${days === 1 ? "" : "s"} before ${event}${big ? ", because it's a big one" : ""}.`,
  leadCustomInfo: (days: number, event: string) =>
    `Appears ${days} day${days === 1 ? "" : "s"} before ${event}, as you set.`,
  leadOverride: "Sounds off? Set your own number of days",
  leadUseDefault: "Use the usual",
  leadDays: "Days before",
  conflict: (when: string) =>
    `Heads up: the deadline comes before this can appear (${when}). You can still save it.`,
  shapingHint: "Big one? You could break it into steps, or say what done looks like.",
  dismiss: "Dismiss",
  save: "Save",
  saving: "Saving…",
  saved: "Saved",
  cancel: "Cancel",
  done: "Mark done",
  undone: "Not done after all",
  letGo: "Let go",
  restore: "Restore",
  delete: "Delete",
  deleted: (title: string) => `Deleted "${title}".`,
  moreOptions: "More options",
  fewerOptions: "Fewer options",
  date: "Date",
  time: "Time",
  partOfDay: "Part of the day",
} as const;

export const events = {
  heading: "Events",
  intro: "Soft anchors, like a holiday or a dinner. Tasks can be linked before, during or after them.",
  newEvent: "New event",
  editEvent: "Edit event",
  name: "Name",
  namePlaceholder: "e.g. Holiday in the mountains",
  onADay: "On a day",
  betweenDates: "Between dates",
  from: "From",
  to: "To",
  on: "On",
  empty: "No events yet. Add one when something's coming up.",
  linkedTasks: (n: number) => `${n} linked task${n === 1 ? "" : "s"}`,
  deleteTitle: "Delete this event?",
  deleteWithTasks: (n: number) =>
    `${n} task${n === 1 ? " is" : "s are"} linked to it. They'll be unlinked and keep any deadline.`,
  unlinkAndDelete: "Unlink tasks and delete",
  delete: "Delete event",
  past: "Past",
  upcoming: "Coming up",
  now: "On now",
} as const;

export const orbit = {
  heading: "Everything you're carrying",
  intro: "Nothing is lost. Here's all of it.",
  visible: "In view",
  hidden: "Hidden for now",
  done: "Done",
  letGo: "Let go",
  empty: "Nothing here yet.",
  appearsBefore: (days: number, event: string) => `Appears ${days} day${days === 1 ? "" : "s"} before ${event}`,
  appearsWhen: (event: string) => `Appears when ${event} starts`,
  appearsAfter: (event: string) => `Appears once ${event} is over`,
  appearsOn: (when: string) => `Appears ${when}`,
  letGoBy: { user: "Let go", horizon: "Let go by Horizon" },
  newTask: "New task",
} as const;

export const views = {
  heading: "Views",
  intro: "Saved filter combinations. Pick one on the Radar to apply it.",
  empty: "No Views yet. Set some filters on the Radar and save them as a View.",
  rename: "Rename",
  delete: "Delete",
  apply: "Apply",
  save: "Save",
  name: "Name",
} as const;

export const notes = {
  heading: "Notes",
  intro: "What Horizon did on your behalf, and why. Nothing happens silently.",
  empty: "No notes yet. When Horizon does something for you, it'll explain here.",
  allGood: "All good",
  restore: "Restore",
  edit: "Edit",
  putBack: "Put it back",
  putBackDone: "Put back for a week.",
  notRight: "Not right?",
  kinds: {
    auto_let_go: (titles: string) =>
      `We didn't hear back after the moment passed, so we let ${titles} go.`,
    hidden_by_event: (titles: string, _n: number, event?: string) =>
      event
        ? `${titles} went out of view after ${event} changed. It'll come back when the time is right.`
        : `${titles} went out of view because of an event change.`,
    deleted: (titles: string) => `You deleted ${titles}.`,
    brought_forward: (titles: string) => `A run of deadlines is coming, so we brought ${titles} forward.`,
    light_run_boost: (titles: string) =>
      `You've cleared lots of small things, so we moved ${titles} up.`,
    heavy_run_boost: (titles: string) => `After some heavy going, we lifted ${titles} for a lighter moment.`,
    quick_win: (titles: string, n: number) =>
      `${titles} had been waiting a while, so we moved ${n === 1 ? "it" : "them"} up as ${n === 1 ? "a quick win" : "quick wins"}.`,
  } as Record<string, (titles: string, n: number, event?: string) => string>,
  gone: "(no longer here)",
} as const;

export const lookAhead = {
  heading: "Look ahead",
  intro: "A few gentle things you could do, if you feel like it.",
  reviewNotes: "Review what Horizon did",
  reviewNotesHint: "Score changes and tasks let go: all good?",
  addEvents: "Add events",
  addEventsHint: "Anything coming up that tasks could hang off?",
  createViews: "Create Views",
  createViewsHint: "Save filters for the situations you're often in.",
} as const;

export const settings = {
  heading: "Settings",
  environments: "Where (environments)",
  states: "States",
  listsHint: "Rename, hide or add your own. Hiding keeps the label on existing tasks.",
  add: "Add",
  addPlaceholder: "New item",
  rename: "Rename",
  hide: "Hide",
  show: "Show",
  hidden: "hidden",
  timezone: "Timezone",
  listSize: "How many tasks the Radar shows",
  showWorkings: "Show workings",
  showWorkingsHint: "Show every part of each task's score on the Radar. Useful for testing and tuning.",
  adjustments: "Ordering adjustments",
  adjustmentsHint: "Switch each gentle adjustment on or off, for testing.",
  save: "Save",
  saved: "Saved",
  demo: "Demo account",
  resetDemo: "Reset demo data",
  resetDemoHint: "Puts the made-up tasks back the way they started.",
} as const;

export const errors = {
  generic: "Something went wrong. Please try again in a moment.",
  network: "We couldn't reach Horizon. Check your connection and try again.",
  notFound: "We couldn't find that. It may have been deleted.",
  titleRequired: "Give it a short title.",
  nameRequired: "Give it a name.",
  scoreRange: "Scores go from 1 to 5.",
  endBeforeStart: "The end can't be before the start.",
  duplicateName: "You already have one with that name.",
  tryAgain: "Try again",
  home: "Back to the Radar",
  setup: "Horizon isn't fully set up yet: the Supabase settings are missing.",
} as const;

export const empty = {
  allClearCalm: "Nothing needs you right now.",
} as const;

import { DemoReset, ListEditor, PreferencesForm } from "@/components/SettingsForms";
import { PageHeader } from "@/components/ui";
import { login, settings as copy } from "@/lib/copy/en-GB";
import { signOut } from "@/lib/data/actions";
import { getLists, getSession } from "@/lib/data/load";

function allTimezones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  if (!zones.includes(current)) zones = [current, ...zones];
  return zones;
}

export default async function SettingsPage() {
  const [{ profile, config, user }, lists] = await Promise.all([getSession(), getLists()]);
  const toItems = (rows: { id: string; name: string; hidden_at: string | null }[]) =>
    rows.map((r) => ({ id: r.id, name: r.name, hidden: !!r.hidden_at }));
  return (
    <div className="space-y-4">
      <PageHeader title={copy.heading} intro={user.email ?? undefined} />
      <ListEditor kind="environments" title={copy.environments} items={toItems(lists.environments)} />
      <ListEditor kind="states" title={copy.states} items={toItems(lists.states)} />
      <PreferencesForm
        timezone={profile.timezone}
        timezones={allTimezones(profile.timezone)}
        listSize={profile.focus_list_size}
        showWorkings={profile.show_workings}
        flags={{ ...config.ordering.flags }}
      />
      {profile.is_demo && <DemoReset />}
      <form action={signOut}>
        <button type="submit" className="min-h-10 rounded-full px-4 text-sm text-muted hover:bg-surface-2 hover:text-ink">
          {login.signOut}
        </button>
      </form>
    </div>
  );
}

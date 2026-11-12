# Deploying Horizon (one-time setup)

This is done once, in the Supabase, GitHub and Vercel dashboards. You never need to run SQL by hand: the database schema arrives through the migration workflow when a pull request is merged into `main`.

Dashboard wording changes from time to time. If a label below doesn't match exactly, look for the nearest equivalent.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in, then **New project**.
2. Name it `horizon`.
3. Choose a strong **database password** and save it in your password manager. GitHub needs it in step 3.
4. Set **Region** to **Sydney (ap-southeast-2)**.
5. Create the project and wait for it to finish setting up.
6. Note two values from **Project Settings → General / API**:
   - **Reference ID** (the project ID, e.g. `abcdefghijklmnop`)
   - **Project URL** (`https://<reference-id>.supabase.co`) and the **anon / public key**. The anon key is safe to use in the browser. Never use the `service_role` key anywhere.

## 2. Configure sign-in

In **Authentication**:

1. **Sign In / Providers → turn off "Allow new users to sign up".** This means only users you create yourself can sign in.
2. **Sign In / Providers → Email:** keep **Email** enabled. Magic links and the demo's password both use it.
3. **URL Configuration:**
   - **Site URL:** your Vercel address, e.g. `https://horizon-yourname.vercel.app` (you can come back to this after step 4).
   - **Redirect URLs:** add `https://horizon-yourname.vercel.app/auth/confirm`. If you use a custom domain, add that version too.
4. **Users → Add user → Create new user**, twice:
   - **You:** your real email address. Leave the password empty, and tick **Auto Confirm User**. You'll sign in by magic link.
   - **The demo account:** email `demo@example.com`, a strong password (save it; Vercel needs it in step 5), and tick **Auto Confirm User**.

You can create these users before or after the first migration runs. Either way, each gets their own profile and copies of the Environment and State lists, and `demo@example.com` is recognised as the demo.

## 3. Add the GitHub secrets

The **Apply migrations** workflow (`.github/workflows/migrate.yml`) runs only when something is pushed to `main`, i.e. when you merge a pull request. It needs three repository secrets.

1. **Create an access token.** In Supabase, go to your avatar → **Account preferences → Access Tokens → Generate new token**. Name it `horizon-github-actions` and copy it.
2. **Add the secrets.** In GitHub, open the repo and go to **Settings → Secrets and variables → Actions → New repository secret**. Add:

   | Name | Value |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | the token from step 1 |
   | `SUPABASE_DB_PASSWORD` | the database password from section 1 |
   | `SUPABASE_PROJECT_ID` | the Reference ID from section 1 |

3. **Run the first migration.** Merge the pull request into `main`. Under **Actions → Apply migrations**, the run should go green. In Supabase, **Database → Tables** should then list the Horizon tables, each marked "RLS enabled".

The workflow never prints these secrets. It doesn't run on pull requests or other branches. The pull-request workflow (`ci.yml`) uses no secrets at all.

## 4. Connect Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub, then **Add New → Project**. Import this repository.
2. Leave **Framework Preset** on **Next.js**. Leave the build settings as they are.
3. The region is already set to **Sydney (`syd1`)** by `vercel.json`, close to the database.

## 5. Set the environment variables

In Vercel, go to **Project → Settings → Environment Variables** and add these for **Production** (and **Preview** if you use previews):

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / public key | public |
| `DEMO_PASSWORD` | the demo account's password | **server-only**; powers "Try the demo" |

Then **Deployments → Redeploy** so the new variables are used.

## 6. Check it works

1. **Magic link:** open the site and enter your email. The link should sign you in and land you on the Radar.
2. **Demo:** sign out and press **Try the demo**. You should see made-up tasks.
3. **Privacy:** follow the short manual privacy check in [`SECURITY.md`](SECURITY.md).

## Good to know

- **Schema changes only ever arrive by merging a PR** that adds a new file in `supabase/migrations/`. Already-merged migration files are never edited.
- **Vercel preview deployments** (built for each pull request) use the same production database. If a pull request adds a migration, its preview may not work properly until the PR is merged and the migration has run. That's expected. To avoid it, turn off previews in **Project → Settings → Git**.
- **Demo data** resets itself when someone presses **Try the demo** and the last reset was more than 24 hours ago. It can also be reset any time from **Settings → Reset demo data** while signed in as the demo.
- **Automatic let-go** (for check-ins nobody answers within 14 days) happens when the app is next opened. There's no background timer. The Note is dated from when the grace period ended.
- **Magic-link emails** use Supabase's built-in email service, which has low hourly limits. That's fine for personal use. For more, add your own SMTP under **Authentication → Emails**.

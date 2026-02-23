# Hydrate — Water tracking PWA

This is a minimal Supabase-backed water-tracking Progressive Web App.

## Local setup

1. Copy `env.js.example` to `env.js` and fill in your Supabase project values:

```js
window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_ANON_KEY = 'public-anon-key';
```

2. Serve the folder with a static server (Python example):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

3. Create a Supabase project and run the SQL in the `sql/` folder to create tables and policies.

## Notes on features added

- Friends: search users, send requests, accept/reject. Data stored in `public.friendships`.
- Export/Import: use the `Export my data` button (Friends tab) to download a JSON export. Use `Import data` to upload a JSON export and merge into local state; when signed in you can optionally push imported entries/profile to Supabase.
- Daily goal: saved locally and pushed to Supabase when signed in (via `Save` in Profile tab).
- Weekly chart: animated bars representing the last 7 days (based on local + fetched entries).
- PWA: `manifest.json` and `sw.js` included (basic static caching).

## RLS & Security testing

The repo includes example RLS policies in `sql/04_rls_policies.sql`. You must test these manually:

1. Create two separate user accounts (A and B) in Supabase.
2. Sign in as A; insert a water log and verify you can read it.
3. Sign in as B; verify B cannot read A's private logs.
4. Create a friendship row with `status = 'accepted'` linking A and B and verify both can read each other's logs.

If you see leaks, adjust the policies in `sql/04_rls_policies.sql` accordingly and re-run.

## Deployment

- For Vercel: create a new project from this repo and set environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) in the Vercel dashboard. Add `env.js` generation step if needed (or use server-side build to inject env values).

## PWA & Notifications

- Service worker (`sw.js`) provides a simple cache-first strategy. Update the `ASSETS` list if you add files.
- Browser notifications are used for reminders but scheduling in background is limited on iOS PWAs; use native apps or server push for reliable reminders.

## Troubleshooting

- Static assets get cached. Use a hard reload or clear cache when testing CSS/JS changes. You can also update `sw.js` cache name to force a refresh.

---
If you want, I can now:
- Add an import-confirm modal and deduplication logic for entries, or
- Implement a small UI to manage friendship requests in more detail, or
- Add automated RLS integration tests (requires Supabase project & keys).

Tell me which I should work on next.
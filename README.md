# BigCal

A read-only calendar for your DayFlow events, showing October 2026 through December 2027 in fifteen compact rows, with two blank lines between groups of three months. Each row begins with the abbreviated month followed by every integer date. Events appear in a floating box when you hover over or focus a date. Tap a date on a phone. Move off the date and box, or press Escape, to dismiss it.

## Open

GitHub Pages address: https://esemmelman.github.io/bigcal/ — sign in with your DayFlow account. Events are visible only after signing in. The `Publish GitHub Pages` workflow tests, builds, and publishes the page whenever changes are pushed to `main`, after Pages hosting is enabled in repository settings.

Run `powershell -ExecutionPolicy Bypass -File .\Start-BigCal.ps1`, or run `npm ci` and `npm run dev`, then open http://127.0.0.1:5173. Requires Node.js 20.19+ or 22.12+.

Choose **Sign in** and use your existing DayFlow email and password. BigCal reads the same Supabase `tasks` table, through DayFlow's existing user ownership policies. It never changes events. Events refresh on changes, every minute, and when returning to the tab. Local-only DayFlow events must first sync in DayFlow, or use **Open DayFlow backup** to view a JSON export. Backup events remain in memory and are not uploaded to GitHub or Supabase. Inbox tasks without dates are omitted.

Sign-in is remembered in the same browser for 90 days after entering your password. Supabase refreshes the session tokens automatically; the password is never stored. After 90 days BigCal requires sign-in again. Signing out, clearing browser storage, or DayFlow server-side session revocation can require an earlier sign-in. Signing out here affects only this session.

## GitHub automatic pushes

The Windows scheduled task **BigCal GitHub Auto Push** runs every five minutes while you are signed in. It tests and builds tracked changes, commits them, and pushes to `main`. New files must be explicitly added with `git add path/to/file` first. Personal backups, credentials, build outputs, and dependencies are excluded. The sync never force pushes or resolves conflicts automatically. View failures in Windows Task Scheduler (Last Run Result).

Install/reinstall: `powershell -ExecutionPolicy Bypass -File .\scripts\Enable-AutoPush.ps1`.
Run immediately: `powershell -ExecutionPolicy Bypass -File .\scripts\Sync-GitHub.ps1`.
Disable: `Disable-ScheduledTask -TaskName 'BigCal GitHub Auto Push'`.

## Checks

`npm test` checks dates, leap years, DayFlow format conversion, and API pagination. `npm run build` creates `dist`. `npx playwright install chromium` then `npm run test:browser` checks actual crowded-day layout, text handling, and mobile scrolling. Auth requires your own account; no credentials or personal events are included in tests.

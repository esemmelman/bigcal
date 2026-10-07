# BigCal

A read-only, rolling twelve-month calendar for your DayFlow events. Starts with the current month on your device, then shows eleven more months. Each row begins with the abbreviated month and year, followed by every integer date. Day cells wrap event titles and rows grow with their busiest day. Scroll horizontally to reach all dates; the month label stays visible.

## Open

Run `powershell -ExecutionPolicy Bypass -File .\Start-BigCal.ps1`, or run `npm ci` and `npm run dev`, then open http://127.0.0.1:5173. Requires Node.js 20.19+ or 22.12+.

Choose **Sign in** and use your existing DayFlow email and password. BigCal reads the same Supabase `tasks` table, through DayFlow's existing user ownership policies. It never changes events. Events refresh on changes, every minute, and when returning to the tab. Local-only DayFlow events must first sync in DayFlow, or use **Open DayFlow backup** to view a JSON export. Backup events remain in memory and are not uploaded to GitHub or Supabase. Inbox tasks without dates are omitted.

Use **Day width** for more space. Click an event with notes to expand its details. A signed-in session is remembered by Supabase in this browser; **Sign out** clears it.

## GitHub automatic pushes

The Windows scheduled task **BigCal GitHub Auto Push** runs every five minutes while you are signed in. It tests and builds tracked changes, commits them, and pushes to `main`. New files must be explicitly added with `git add path/to/file` first. Personal backups, credentials, build outputs, and dependencies are excluded. The sync never force pushes or resolves conflicts automatically. View failures in Windows Task Scheduler (Last Run Result).

Install/reinstall: `powershell -ExecutionPolicy Bypass -File .\scripts\Enable-AutoPush.ps1`.
Run immediately: `powershell -ExecutionPolicy Bypass -File .\scripts\Sync-GitHub.ps1`.
Disable: `Disable-ScheduledTask -TaskName 'BigCal GitHub Auto Push'`.

## Checks

`npm test` checks dates, leap years, DayFlow format conversion, and API pagination. `npm run build` creates `dist`. `npx playwright install chromium` then `npm run test:browser` checks actual crowded-day layout, text handling, and mobile scrolling. Auth requires your own account; no credentials or personal events are included in tests.

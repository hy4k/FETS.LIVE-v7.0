# FETS.LIVE-2025

FETS.LIVE is a comprehensive staff management and operations platform built with React, TypeScript, Vite, and Supabase.

## Project Structure

- **fets-point/**: Main React application.
- **scripts/**: Database and deployment scripts.
  - **maintenance/**: Maintenance and verification scripts.
- **docs/**: Project documentation and guides.
- **supabase/**: Supabase configuration.

## Deployment

fets.live is a static SPA served by nginx on a VPS; Supabase provides the
backend. To restore the site on a fresh or rebuilt server, and for the ongoing
deploy flow, see **[VPS Restore Runbook](docs/VPS_RESTORE.md)**.

```bash
# on the VPS, from scratch
bash scripts/vps/restore-fets-live.sh

# subsequent releases
bash deploy.sh
```

`scripts/vps/` also holds restore scripts for the other sites on the same
server (e.g. `restore-costudy.sh`) and the shared `lib/common.sh` they build
on.

## Documentation

Key documentation files can be found in the `docs/` directory:

- [VPS Restore Runbook](docs/VPS_RESTORE.md)

- [Getting Started](docs/GETTING_STARTED.md)
- [Start Here](docs/START-HERE.md)
- [Migration Instructions](docs/MIGRATION_INSTRUCTIONS.md)
- [Work Completed](docs/WORK-COMPLETED.md)
- [Brainstorm Feature](docs/BRAINSTORM_FEATURE.md)

## Quick Start

To start the development server:

```bash
cd fets-point
pnpm install
pnpm dev
```

## Scripts

Maintenance and verification scripts are located in `scripts/maintenance/`. You can run them using `node` or `pnpm`.

Example:
```bash
node scripts/maintenance/verify-database.js
```

## CMA Exam Seat Availability Tracker

The CMA tracker scrapes Prometric test center availability and stores results in Supabase so the in-app widget (`cma-availability` route) can display live seat counts.

### One-time setup

1. **Install scraper dependencies** (from the repo root):
   ```bash
   npm install playwright @supabase/supabase-js dotenv
   npx playwright install chromium
   ```

2. **Add your service role key** to `fets-point/.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
   Get it from: Supabase Dashboard → Project Settings → API → `service_role` key.

3. **Run the database migration** (already applied — only needed for a fresh project):
   ```bash
   # Paste scripts/create-cma-availability-table.sql in the Supabase SQL Editor
   # or use the run-sql helper:
   node scripts/run-sql.js --query "$(cat scripts/create-cma-availability-table.sql)"
   ```

### Running the scraper manually

```bash
# Scrape all centers
node scripts/scrape-prometric.js

# Debug mode (shows browser window)
node scripts/scrape-prometric.js --headless=false

# Single center
node scripts/scrape-prometric.js --center=cochin
```

### Automating with cron (Linux / macOS / WSL)

Add to your crontab with `crontab -e`:

```cron
# Scrape CMA availability every 6 hours
0 */6 * * * cd /path/to/repo && node scripts/scrape-prometric.js >> /var/log/cma-scraper.log 2>&1
```

### Automating with Windows Task Scheduler

```powershell
# Run once to register the task (adjust paths as needed)
$action = New-ScheduledTaskAction -Execute "node" `
  -Argument "scripts\scrape-prometric.js" `
  -WorkingDirectory "E:\FETS.LIVE NEW\fets.live 5.0 apr 28"

$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Hours 6) -Once -At "00:00"

Register-ScheduledTask -TaskName "CMA-Prometric-Scraper" -Action $action -Trigger $trigger -RunLevel Highest
```

### Automating with GitHub Actions

Create `.github/workflows/scrape-cma.yml`:

```yaml
name: CMA Seat Scraper
on:
  schedule:
    - cron: '0 */6 * * *'   # every 6 hours
  workflow_dispatch:          # allow manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install playwright @supabase/supabase-js dotenv
      - run: npx playwright install --with-deps chromium
      - run: node scripts/scrape-prometric.js
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

Add `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to your GitHub repo secrets.

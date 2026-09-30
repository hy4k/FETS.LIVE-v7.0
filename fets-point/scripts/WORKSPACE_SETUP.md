# Finish My Desk and duty handover setup

1. Open Supabase project **qqewusetilxxfvfkmsed**, then **SQL Editor → New query**.
2. Paste the entire `complete_workspace_setup.sql` file and run it as the SQL Editor’s default postgres role.
3. Expect one result beginning **READY — refresh fets.live and open My Desk or Handover**. Check that a super-admin access record and the expected staff-centre records are present.
4. Refresh https://fets.live. Handover automatically detects the setup; **Check database setup** can retry without reloading. No deployment or environment edit is needed after this SQL.
5. Open **Plan ahead**, save weekly leads, then open a date from the real roster. Confirm actual shift hours, review assigned duties and break cover, then publish.
6. During the shift, staff record their own due checks and submit block notes. The lead reviews colleagues’ submissions; the super admin reviews the lead’s own work. Use **Arrange cover or acting lead** for changes, which take effect from a future minute.
7. After 17:00 India time, the lead submits the final report. Open **Centre reports** as super admin to review and acknowledge it. Submitted reports close the shift and preserve the original plan, checks and coverage history.

`setup_chat_and_tools.sql` is unrelated to this setup and is not required for these features. The installer does not delete existing operational data. If it reports an error, the transaction rolls back; copy the complete error for diagnosis rather than running selected fragments.

New employees or cross-centre transfers require trusted `centre_duty_members` provisioning by an administrator through SQL/server administration. Profile role text or a browser toggle alone does not grant duty access. The initial installer seeds active staff and super admins from existing staff profiles.

## Running the first centre shift

- **Super admin, before the month starts:** prepare the real roster, open Handover → Plan ahead, and save one lead for each week. Open each working date to review the generated 90-minute rotation. Weekly leadership does not remove that person's regular duties.
- **Lead, before publication:** confirm actual staff hours, check each duty lane, and name cover for every staggered break. Record how combined responsibilities will be covered; if staffing is insufficient, resolve it before publishing. Select an acting lead for a weekly lead's rest day.
- **Each colleague, during the day:** use My centre duties from My Desk. Record the lab walk every 10 minutes or DVR check every 6 minutes while responsible for that lane, then submit a useful block update. Raise support needs as they happen. Missed checks remain visible rather than being backfilled as completed.
- **Lead, when staffing changes:** use Arrange cover or acting lead. Select the named colleague, confirmed hours, future effective time and reason. The original published plan and prior ownership remain in the audit history.
- **Lead and reviewer, at handover:** review colleagues' updates independently. After 17:00 IST, submit the centre summary, open items with named owners and due times, and team recognition. Submission closes that day's report; the super admin reviews and acknowledges it in Centre reports.

The supplied template covers 08:00–17:00 India time. Monitoring reminders run while the page is open; this release does not provide background push alerts. Candidate calling opens the existing external fets.online/t screen.

## Activate FETS AI

FETS AI is a separate addition to the completed My Desk and Handover setup. The floating interface is deployed, but it needs its own database migration, server-side Gemini key and Edge Function. The connected Supabase management account cannot currently deploy to project `qqewusetilxxfvfkmsed`.

1. In that project's SQL Editor, run [`../../supabase/migrations/20260929171645_fets_ai_knowledge_and_usage.sql`](../../supabase/migrations/20260929171645_fets_ai_knowledge_and_usage.sql), or download `https://fets.live/setup/fets-ai-knowledge-and-usage.sql`. Expect **FETS AI DATABASE READY — deploy fets-ai-agent with GEMINI_API_KEY next**. The old draft link is superseded. Any previously approved draft documents are preserved and renamed.
2. In Supabase Dashboard → Edge Functions → Secrets, check that `GEMINI_API_KEY` exists. If it already exists, leave it unchanged. Do not place this key in browser settings or the Vite frontend.
3. In a terminal at the repository root (the parent of `fets-point`, containing `supabase/functions/fets-ai-agent/index.ts`), run `npx supabase login`, then `npx supabase functions deploy fets-ai-agent --project-ref qqewusetilxxfvfkmsed --use-api`.
4. Refresh fets.live and open FETS AI. Its status should say **Connected to your workspace**. Ask about a centre roster, then start Live and grant one media permission explicitly to verify voice or sharing.

New calendar, roster, duty and case rows are read when asked. Admins can add approved operating guides through the Knowledge tab. Other modules need an explicit, reviewed source mapping before the assistant can claim to know their records. Personal journals and credentials are excluded.

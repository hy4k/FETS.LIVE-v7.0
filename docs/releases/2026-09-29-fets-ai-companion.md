# FETS AI companion — release 20260929T194033Z

The frontend release is live at `https://fets.live`. The public index matches the local production build by SHA-256. Current Docker image: `sha256:258a5e0f0b8804a05ab03011faffd8b0535207b94bfe256d685973ca17dd4f34`. The prior image is retained as `fets-live-app:rollback-20260929T194033Z`. This release also carries the premium first paint, login, home hero and menu from the previous release.

FETS AI is a floating companion on signed-in pages. Text uses Gemini 3.1 Pro; user-started voice, camera and screen sharing use Gemini 3.1 Flash Live with a short-lived session token. The browser never receives the long-lived Gemini API key. Media permissions are explicit, visible, and stopped on disconnection, centre switch, sign-out or after nine minutes. The existing Intelligence assistant now uses the same guarded backend instead of its earlier autonomous-write endpoint. Operational lookups are fresh, scoped to trusted duty membership and existing row-level security, and capped/paginated. The assistant can suggest navigation and prepare a handover draft, but a lead must review and submit the actual report. An admin can publish approved centre knowledge documents; later lookups search their current published content. Unconnected pages remain navigation context only, and the assistant says so.

## Supabase activation

On 2026-09-29, project `qqewusetilxxfvfkmsed` exposed the `fets_ai_documents` and `fets_ai_usage` tables with anonymous access denied as expected. The Supabase CLI confirmed that `GEMINI_API_KEY` exists. Function `fets-ai-agent` was deployed from the repository root with `--use-api`; the Supabase function list reports it ACTIVE at version 1 with JWT verification enabled. A public request now reaches the function and returns its expected `401 Your session expired` response. A signed-in workspace check remains to be done in the browser.

The exact migration is [`supabase/migrations/20260929171645_fets_ai_knowledge_and_usage.sql`](../../supabase/migrations/20260929171645_fets_ai_knowledge_and_usage.sql), also served at `https://fets.live/setup/fets-ai-knowledge-and-usage.sql`. The function source is `supabase/functions/fets-ai-agent`. The existing Gemini secret was left unchanged.

Refresh `fets.live`, sign in, open the floating orb and ask about the roster or centre shift. Its status line should read **Connected to your workspace**. For a live-session check, start Live first and then grant microphone/camera/screen permissions individually. The approved knowledge shelf appears for trusted super admins.

## Validation and scope

- Production TypeScript/Vite build passed; 26 focused UI/duty/agent tests passed; Deno type-check passed for the Edge Function.
- Isolated PostgreSQL ran the exact new migration in both fresh-install and earlier-draft upgrade paths, verifying publication rights, branch read isolation, versioning, retained documents, membership, usage RPC and anonymous denial.
- The release image served the exact local index hash and SQL hash in an isolated container, then on the public domain. `/handover` returns HTTP 200.
- Current fresh-record sources: exam calendar, staff roster, day plans, weekly leads, checks, coverage changes, centre reports and incident records. Approved knowledge is a ninth source. Personnel records, private desk journal, passwords, ID proofs and unconnected modules are intentionally excluded. New rows in connected sources become available on the next lookup; new modules still need an explicitly reviewed source mapping and RLS.

The assistant is named **FETS AI** throughout the interface, database objects, function endpoint and deployment instructions. The old SQL URL returns a clear superseded-file error to prevent an accidental draft installation.

## Floating assistant interaction fix

The assistant stylesheet was incomplete, which left its panel inside the clipped app layout. The companion now renders in a body portal with a fixed, responsive panel and orb. My Desk's AI shortcut opens it directly, and the old combined team-chat/AI banner was removed from the operations home. Team chat remains available through its separate chat route. The 11 focused agent/My Desk/home tests and production build passed. An isolated VPS container and the public `candidate-tracker` route returned HTTP 200; the public index hash is `bb1adb92a304c29ef62e2b92c993848d2d604f1d0801f0695bc4db8254b4e3b9`.

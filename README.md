# Helio CRM — Solar System

Solar customer tracking with HR/worker roles, quotation approvals, flexible stages, EB summary import and optional WhatsApp Business integration.

**Deployment stack: Vercel + Supabase only.** Next.js/React/TypeScript run on Vercel. Supabase provides PostgreSQL and private quotation storage. No Turso, Vercel Blob, paid AI or third-party scheduler account is required. The `v1` Git tag preserves the original version.

## What works without WhatsApp API credentials

HR and worker logins, customer registration by EB number, worker assignment, individual/group/global workflows, dated follow-ups, comments, quotation uploads, separate owner/customer decisions, service issues and daily summaries. WhatsApp Web opens a text draft. Staff attach the PDF and send it themselves; replies must be recorded as customer updates. A WhatsApp Business **phone app** alone does not enable website automation.

The EB screen opens the official TNPDCL page, where the user completes CAPTCHA. Paste the account summary back into Helio to extract explicitly labelled phase, load and consumption. This is assisted import, not automated access or CAPTCHA solving. PM Surya Ghar remains a tracking stage.

## Supabase setup

1. Create/use a Supabase project. In its SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates an isolated `helio` schema and a **private** `helio-quotations` bucket. It does not delete existing customer records. Keep the schema private; do not grant browser/anonymous roles access.
2. In Supabase **Connect**, copy the **transaction pooler** PostgreSQL connection URI (port 6543) into `DATABASE_URL`. Replace the password placeholder and URL-encode special characters in that password. Connections use verified TLS; if required, supply the downloaded trusted CA as `DATABASE_CA_CERT`. Do not disable certificate verification.
3. Set `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`. Never prefix these secrets with `NEXT_PUBLIC_` or put them in Git. The service-role key is used only by server routes for private files; worker/customer authorization happens before storage access.
4. Keep the bucket private. Uploads are limited to **3.5 MB** per PDF/JPG/PNG to stay under Vercel's request-size limit. File downloads require the customer's assigned worker or HR session.

## Vercel setup (no deployment has been performed)

Import the GitHub repository using the **Next.js** framework preset and Node.js **24.x**. The app is at the repository root. Build command: `npm run build`. No Cloudflare bindings are used by the production app.

Set the variables from [`.env.example`](.env.example):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase transaction-pooler connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Private storage access, server only |
| `APP_URL` | Exact public HTTPS Vercel URL |
| `ADMIN_SETUP_TOKEN` | Strong one-time setup secret for creating the first HR account |
| `INTEGRATION_ENCRYPTION_KEY` | 32 random bytes encoded as 64 hex characters |
| `CRON_SECRET` | Strong random secret protecting scheduled-job requests |

Generate independent random values locally, for example `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Store them in Vercel environment settings. Never reuse the example or commit actual values. Keep an offline copy of the encryption key; without it, saved API credentials cannot be decrypted.

On first visit, HR enters the setup token and creates a username/password. Subsequent public HR signup is blocked. HR creates worker logins; workers see only assigned customers. Use Account for password changes, worker password resets and worker deactivation. Reassign a worker's records before disabling that login. Password changes revoke existing sessions.

Existing local records are **not automatically uploaded** to Supabase. They remain on your computer. Use the controlled migration instructions below before replacing a populated local workspace with a hosted database.

## Daily summaries and update notifications

Three distinct behaviors are shown in HR Settings:

* **Prepare on opening:** creates a once-daily draft when HR opens the site. It does not itself run while the website is closed.
* **Scheduled daily report:** after deployment, the Vercel cron in `vercel.json` runs at **03:30 UTC / 09:00 IST**. Enable scheduled reports in HR Settings. Reports are split into template-sized numbered messages, queued with date-based IDs, and sent through the configured Business API. This works while HR is offline. Vercel Hobby scheduling is approximate within the hour; exact timing needs a suitable plan. With no API connection, drafts/queued messages remain in Helio and are not delivered.
* **Automatic update notifications:** when explicitly enabled by HR, customer edits, worker comments and incoming replies queue HR messages and attempt API delivery. Otherwise they remain drafts.

Vercel cron also recovers pending webhook processing and queued notifications. Each run processes a bounded batch. If the queue is large, HR can send outstanding items from the WhatsApp desk; larger installations should configure a more frequent drain schedule on a plan that supports it. Failed requests are visible; uncertain network outcomes are marked `unknown` and are not automatically retried, to avoid duplicate messages. A worker update saving successfully is not a guarantee that WhatsApp delivered its notification.

An API sender is a business number sending **to** HR's recipient number. It is not the personal “Message yourself” chat. Use an appropriate different recipient number for API reports. Web mode may open a self-chat when logged into that same personal account.

## Optional WhatsApp Business Platform setup

In **Settings → Optional WhatsApp Business setup**, HR can leave everything blank and use Web mode, or enter their Meta settings. Credentials are encrypted before database storage; the UI never reads them back. Blank fields keep existing values.

1. Configure a WhatsApp Business Platform / Cloud API sender in Meta. An existing Business mobile-app number may need Meta-supported onboarding/coexistence; don't assume registration automatically supports both interfaces.
2. Supply a system-user token with messaging access, the **phone number ID** (not the phone number), Meta app secret, and a random webhook verify token.
3. Create and obtain approval for a text template with exactly one body text variable and a quotation template with a **DOCUMENT header** plus one body text variable. Set the exact template names, language code and supported Graph API version. The configured default version is v23.0; verify its availability for your Meta app before activation.
4. Click **Verify API connection**. This checks the token/phone ID only; it does not prove templates or webhook delivery work.
5. In Meta's webhook settings, enter `https://YOUR-APP/api/whatsapp` and the same verify token. Subscribe the business account to the **messages** field. Meta must reach this HTTPS endpoint without preview-password protection. Localhost cannot receive Meta webhooks directly.
6. Send an authorized test quotation from the CRM, reply to it and confirm the reply and delivery events in customer history before enabling automatic notifications. Meta's messaging/approval rules and fees still apply; no live integration is claimed until this check passes.

Business sending uploads the selected PDF privately to Meta and sends it with the approved document template. Web fallback never attaches a file automatically. If the API reports an uncertain outcome, check WhatsApp/history before using fallback to avoid duplicates.

Incoming webhooks are HMAC-verified and durably stored before acknowledgement. Messages are deduplicated. Replies match the original outbound message, a known sender's EB reference, or a unique customer phone. Owner replies without a reliable customer reference are flagged for HR review. Incoming attachments are noted, not downloaded automatically. Replies never automatically approve quotations. Delivery events distinguish accepted/sent/delivered/read/failed where Meta supplies them.

## Local development

Node.js 24 or newer is required. `npm ci`, `npm run db:migrate`, `node scripts/setup-local.mjs`, then `npm run dev`. Open `http://127.0.0.1:5173` or `/?demo=1` for fictional demo records. Without Supabase variables, development uses local SQLite and files under ignored `.data/`; production on Vercel refuses that fallback. Local operation needs no external account.

To migrate the previous local v1, stop the old dev server, run `npm run db:migrate`, then `node scripts/import-v1-local.mjs` **once into an empty destination**. Old `.wrangler` data remains untouched; sessions are deliberately not transferred. For hosted migration, use the reviewed `scripts/export-local.mjs` / `scripts/import-supabase.mjs` workflow documented by their usage messages. Do not upload local data to a different Supabase project without verifying its URL.

The demo is temporary and does not exercise persistence, real uploads or real delivery. Real local records persist in `.data`; never commit this directory, `.wrangler`, `.env.local` or exports.

## Operations and verification limits

HR can export business records from Settings. This export excludes passwords, sessions, API credentials and actual file contents. For disaster recovery, configure Supabase database backups and independently preserve private bucket contents. Keep the encryption key backed up separately. `scripts/reset-admin.mjs` provides a server-operator recovery path without email. Do not expose it as a web route.

Build and focused local checks catch code/permission regressions. Supabase connection, Meta templates, real delivery/webhooks, Vercel cron timing and provider backups require verification in your own accounts before staff rollout. No Vercel deployment or live messages were performed by this implementation.

References: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Vercel cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Meta webhooks](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference).

# Helio CRM v1

Helio is a shared solar operations workspace with HR/admin and worker logins. The first account created is the HR administrator. HR creates worker accounts under Team. Each worker can read and update only assigned customers; HR sees all customers. The hosted preview is owner-private at the Sites layer, in addition to these application accounts. Sharing the website with staff requires a separate access-policy change.

## Stack and storage

- React and TypeScript, using the Vinext / Vite framework with Next-compatible routes.
- Cloudflare Worker server routes for authentication, authorization and CRM changes.
- D1 SQL database for customer records, stages, users, sessions, history and notification drafts.
- Private R2 storage for uploaded quotations, with authorized downloads.
- Passwords are salted PBKDF2 hashes. Login sessions use HttpOnly cookies. Customer edits use version checks to prevent stale overwrites. No government credentials or customer records are stored in browser localStorage.

## Customer flow

1. HR or a worker registers a new/existing customer using an EB service connection number. Duplicate numbers are rejected. Set the customer number, area/group, assigned worker, priority and proposed capacity.
2. Record the connection phase, sanctioned load and consumption from a verified source. The interface shows the source and verification date. Live EB retrieval is not connected.
3. Upload the quotation PDF or image. Prepare a WhatsApp message to the owner; attach the quotation in WhatsApp. HR records the owner’s actual decision and supporting note. Merely opening or sending a message never grants approval.
4. Obtain and record customer acceptance separately. Owner approval must precede acceptance. Workers cannot grant either approval.
5. Track the remaining default stages: additional load, PM Surya Ghar registration, signed agreement, installation and serial numbers, DCR / installation documents, net-meter application, meter installation, inspection, subsidy receipt.
6. Every stage has independent status, follow-up date and notes. Parallel EB and PM work is possible; advancing one stage does not clear another stage’s outstanding work. Additional-load work can be marked skipped if not needed. Registration completion adds follow-up dates to outstanding agreement and net-meter application stages when they have no date.
7. Record document lists, panel/inverter serial numbers, invoice references, application/payment references, field handovers and EB-office contacts in stage notes. Quotations have file uploads; other evidence is tracked in notes in v1.
8. Report a service issue from any customer, including completed installations. This adds an active service follow-up, with resolution to be confirmed with the customer.

The default stage order is an editable working interpretation of the call notes, not a claim that government processes must occur in that sequence. Inspection/subsidy details still need HR’s review. HR can modify future defaults, all records, one group or an individual customer. Matching stage names preserve progress. Renamed stages start fresh; removed stages are recorded in history.

## WhatsApp behavior in this version

Customer updates and worker comments prepare HR notification drafts. On HR’s first opening each day, one daily summary draft is prepared in IST. The report screen always builds a current summary with each customer’s status, most recent update and outstanding stages. Data refreshes every 30 seconds while no edit dialog is open.

Web mode opens the selected WhatsApp chat with the message prepared. The user must review and press Send. A manual “I have sent it” action records the user’s acknowledgement; it is not delivery verification. Long summaries can be copied. Setting HR’s own number can open the self-chat when signed into the same account. A separate website cannot silently write into that personal chat, read WhatsApp Web conversations or automatically send messages.

The server includes an optional Business API sender and HMAC-verified incoming-message webhook. These are unconfigured and have not been tested against a live business account. Configure server secrets `WA_TOKEN`, `WA_PHONE_ID`, `WA_TEMPLATE`, `WA_LANGUAGE` (default `en`), `WA_API_VERSION`, `WA_APP_SECRET` and `WA_VERIFY_TOKEN`. The sender expects an approved template with one text variable and rejects reports over 900 characters. API acceptance is not proof of delivery. Incoming messages match a known customer phone and create activity entries and HR drafts; they do not infer approval from ambiguous text.

Meta must be able to reach `/api/whatsapp` to verify and deliver webhooks. This owner-private preview’s access boundary prevents direct public Meta webhooks; production connectivity needs an authorized public webhook gateway or an explicitly approved hosting/access arrangement. A business sender sends to HR’s number from the business account, not into HR’s personal “You” chat. Background automatic dispatch, delivery receipts and large-report chunking remain production integration work. No phone numbers, credentials, approved templates or business account were provided, and no actual messages were sent.

## EB research

The official [TNPDCL bill-status page](https://www.tnebltd.gov.in/BillStatus/) asks for the service connection number, registered mobile number and CAPTCHA. This does not establish a supported number-only API for phase, sanctioned load and consumption. Another official [TNPDCL service form](https://www.tnebltd.gov.in/usrp/app_form-ncfa.xhtml) refers to account, sanctioned load and phase fields, but is not documentation of a public lookup API.

The recording describes an existing login-based office method. That particular portal and authorized workflow must be demonstrated before an integration can be verified. Required credentials alone do not remove CAPTCHA/OTP requirements or establish permission for automated access. V1 therefore does not collect EB passwords, bypass verification or invent fetched values. Once an authorized interface is confirmed, credentials should be stored encrypted on the server, with role-limited access; plaintext localStorage is unsuitable for shared government logins.

WhatsApp references: [official click-to-chat guide](https://faq.whatsapp.com/5913398998672934) and [Meta’s official WhatsApp Business Platform collection](https://www.postman.com/meta/whatsapp-business-platform/overview). Research checked during the v1 implementation on 11 October 2026.

## Preview and development

Use “Explore the interactive demo” to inspect eight fictional customers. Sample edits live in memory and disappear on reload. Team offers a worker-view preview. Sample EB details are explicitly labelled as demo data. Create a real workspace to persist data and files.

`npm run dev` serves port 5173. `npm run db:generate` generates schema migrations. Apply the generated migration locally with Wrangler, following the starter README. `npm run build` builds the Worker and client. Sites publication applies the tracked database migrations to a separate hosted database. Local QA accounts and uploaded fixtures are not deployed.

Meaningful verification is recorded by `scripts/verify-crm.mjs`: account creation, role isolation, duplicate EB detection, stale-edit rejection, quotation access, approval prerequisites, workflow preservation, registration reminders, daily-summary deduplication and explicit unavailable integrations. It is intended for a fresh local test database only.

Before staff rollout: confirm workflow/checklists with HR, connect the approved EB and WhatsApp services, arrange shared access, add account recovery/password changes and operational backup/retention policies. This is a reviewable v1, not a claim that these external services are already live.

## Latest local revision
Publication paused at the user's request; use http://127.0.0.1:5173/. The EB dialog now offers the exact billstatus.xhtml link, an EB-registered mobile field separate from WhatsApp, copy buttons, and pasted-summary extraction. This is a user-assisted import, not automatic retrieval. Explicit English phase/load/consumption labels are parsed without an AI model or paid API; missing values require manual review. The supplied reference customer details were not submitted or embedded. Only a readiness check was performed for this revision; the earlier 31 checks predate this import addition.


## Business-first messaging update
The quotation dialog prefers a configured Business API, uploads the selected private PDF to Meta media storage, and sends it with an approved document-header template. Configure WA_DOCUMENT_TEMPLATE alongside WA_TOKEN, WA_PHONE_ID, WA_TEMPLATE and webhook secrets; templates expect one body text variable. A WhatsApp Business mobile-app account by itself does not activate these integrations. Web fallback remains available and requires manual attachment and sending. No live API credentials were supplied, so live sending is unverified.
Reply webhooks deduplicate message IDs and match quoted outbound messages, explicit EB references, or unique customer phone numbers. Ambiguous owner replies enter HR’s notification outbox for manual review. Delivery-status events appear in activity history. No reply automatically grants approval. Localhost needs an approved public HTTPS webhook endpoint before Meta can deliver events. Outbox notifications remain reviewed sends, not background auto-dispatch.

